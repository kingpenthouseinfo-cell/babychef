'use server';
import { revalidatePath } from 'next/cache';
import { db } from '../db';
import { str, int } from '../util';
import { storage } from '../storage';
import { projectFolder } from '../files';
import { expectedFilename, nextVersion } from '../naming';
import { registerAttempt } from '../results';
import { snapshotPrompts } from '../prompt-versions';
import { scanProjectFolders } from '../watcher';

const touch = () => revalidatePath('/', 'layout');

/** Scan the watched project folders right now. */
export async function rescanNow() {
  await scanProjectFolders();
  touch();
}

/**
 * Manual assignment of an unmatched file to a Planned Image + version.
 * The file is renamed/moved to the organized name inside the project's 02 Images folder (never overwritten, never deleted).
 */
export async function assignUnmatched(fd: FormData) {
  const uf = await db.unmatchedFile.findUniqueOrThrow({ where: { id: str(fd, 'id')! } });
  if (uf.status !== 'OPEN' || !uf.assetId) return;
  const imageId = str(fd, 'imageId');
  if (!imageId) throw new Error('Choose a planned image');
  const img = await db.plannedImage.findUniqueOrThrow({ where: { id: imageId }, include: { scene: true, project: true, attempts: { select: { number: true } } } });
  const number = int(fd, 'version') ?? nextVersion(img.attempts.map(a => a.number));
  if (img.attempts.some(a => a.number === number)) throw new Error(`Version v${number} already exists for this image. Choose another version.`);
  const asset = await db.asset.findUniqueOrThrow({ where: { id: uf.assetId } });
  const ext = (uf.name.split('.').pop() || 'png').toLowerCase().replace('jpeg', 'jpg');
  const folder = await projectFolder(img.projectId);
  const canonical = expectedFilename({ slug: img.project.slug, code: img.project.code, sceneOrder: img.scene.order, seq: img.seq, title: img.title, version: number, ext });
  let target = `${folder}/02 Images/${canonical}`;
  let n = 1;
  while (target !== asset.relPath && (await storage.exists(target))) target = `${folder}/02 Images/${canonical.replace(/(\.[a-z0-9]+)$/i, `_${++n}$1`)}`;
  if (target !== asset.relPath) await storage.move(asset.relPath, target);
  const finalName = target.split('/').pop()!;
  await snapshotPrompts(img.id, 'Snapshot when file was assigned');
  await db.asset.update({ where: { id: asset.id }, data: { relPath: target, displayName: finalName, internalName: finalName, kind: 'GENERATED', projectSlug: img.project.slug, version: number, status: 'ACTIVE' } });
  await db.unmatchedFile.update({ where: { id: uf.id }, data: { status: 'ASSIGNED', assignedAt: new Date(), relPath: `__assigned__/${uf.id}` } });
  await registerAttempt({ imageId: img.id, assetId: asset.id, number, sourceTool: 'Other', promptType: 'FULL', notes: 'Assigned manually from Unmatched Files' });
  touch();
}

/** Hide a file from the Unmatched list. The file itself is left untouched (and will not be flagged again). */
export async function ignoreUnmatched(fd: FormData) {
  await db.unmatchedFile.update({ where: { id: str(fd, 'id')! }, data: { status: 'IGNORED' } });
  touch();
}
