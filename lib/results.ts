import { db } from './db';
import { imageCode } from './util';
import { logActivity } from './activity';
import { expectedFilename, nextVersion } from './naming';
import { sceneCode } from './util';
import { syncFolderNamesSafe } from './folder-sync';

/** Create a Generated Attempt for an already-stored asset and move the image into REVIEW (never APPROVED automatically). */
export async function registerAttempt(o: { imageId: string; assetId: string; number: number; sourceTool?: string; promptType?: string; notes?: string | null; activity?: string }) {
  const img = await db.plannedImage.findUniqueOrThrow({ where: { id: o.imageId }, include: { project: true } });
  const pType = o.promptType === 'CONTINUATION' ? 'CONTINUATION' : 'FULL';
  const pv = await db.promptVersion.findFirst({ where: { ownerId: o.imageId, type: pType, active: true } });
  const attempt = await db.attempt.create({ data: { imageId: o.imageId, number: o.number, assetId: o.assetId, sourceTool: o.sourceTool || 'ChatGPT', promptType: pType, promptVersion: pv?.version ?? null, notes: o.notes ?? null } });
  const max = (await db.attempt.aggregate({ where: { imageId: o.imageId }, _max: { number: true } }))._max.number ?? o.number;
  await db.plannedImage.update({ where: { id: o.imageId }, data: { attemptCount: max, status: img.approvedAttemptId ? img.status : 'REVIEW', ...(img.waitingAt ? { waitingAt: null, waitingReason: null, waitingNote: null } : {}) } });
  await syncFolderNamesSafe(img.projectId, { imageIds: [o.imageId] }); // the new file gets its storyboard place in its name
  await logActivity(o.activity ?? `${imageCode(img.seq)} result added (attempt ${o.number})`, `/projects/${img.project.slug}/images/${o.imageId}`, img.projectId);
  return attempt;
}

/** The exact filename the NEXT result for this image should have (current attempts → next version). */
export async function expectedFor(imageId: string, ext = 'png') {
  const img = await db.plannedImage.findUniqueOrThrow({ where: { id: imageId }, include: { project: true, scene: true, attempts: { select: { number: true } } } });
  const version = nextVersion(img.attempts.map(a => a.number));
  return { filename: expectedFilename({ slug: img.project.slug, code: img.project.code, sceneOrder: img.scene.order, seq: img.seq, title: img.title, version, ext }), version, sceneCode: sceneCode(img.scene.order) };
}
