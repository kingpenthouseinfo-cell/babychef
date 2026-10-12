'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '../db';
import { importFile, nextCode, projectFolder, moveAssetToFolder } from '../files';
import { bool, imageCode, pickText, sceneCode, str, strRaw, int, parseJson } from '../util';
import { logActivity } from '../activity';
import { IMAGE_STATUSES, PRIORITIES } from '../constants';

const IMG_TEXT = ['title','shotType','purpose','priority','promptStatus','aspectRatio','cropImportance','startingComposition','characterVisibility','expression','bodyPosition','handPosition','ingredients','ingredientQty','ingredientState','foodTexture','foodColor','cookware','utensils','objectPlacement','actionMoment','physics','lighting','cameraAngle','cameraDistance','lens','depthOfField','focusPoint','background','safety','mustBeVisible','mustNotChange','mustNotAppear','continuity','restrictions','notes','dependsOnId'];

async function pinfo(imageId: string) {
  const img = await db.plannedImage.findUniqueOrThrow({ where: { id: imageId }, include: { scene: true, project: true } });
  return { img, code: imageCode(img.seq), sc: sceneCode(img.scene.order), slug: img.project.slug };
}
const touch = () => revalidatePath('/', 'layout');

export async function createImage(fd: FormData) {
  const projectId = str(fd, 'projectId')!, sceneId = str(fd, 'sceneId');
  const title = str(fd, 'title');
  if (!sceneId) throw new Error('Choose a scene');
  if (!title) throw new Error('Image title is required');
  const max = await db.plannedImage.aggregate({ where: { projectId }, _max: { seq: true } });
  const img = await db.plannedImage.create({ data: { projectId, sceneId, seq: (max._max.seq ?? 0) + 1, title, shotType: str(fd, 'shotType') || 'MAIN NARRATIVE SHOT', priority: str(fd, 'priority') || 'NORMAL', purpose: str(fd, 'purpose') } });
  const proj = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  await logActivity(`${imageCode(img.seq)} planned: ${title}`, `/projects/${proj.slug}/images/${img.id}`, projectId);
  touch();
  redirect(`/projects/${proj.slug}/images/${img.id}`);
}

async function maybeVersion(imageId: string, type: 'FULL' | 'CONTINUATION', oldText: string, newText: string, reason: string | null) {
  if (newText === oldText) return;
  if (!newText.trim() && !oldText.trim()) return;
  const n = await db.promptVersion.count({ where: { ownerId: imageId, type } });
  // preserve the very first text as v1 when editing an unversioned prompt
  if (n === 0 && oldText.trim()) await db.promptVersion.create({ data: { ownerId: imageId, type, version: 1, text: oldText, reason: 'Initial', active: false } });
  const nn = n === 0 && oldText.trim() ? 1 : n;
  await db.promptVersion.updateMany({ where: { ownerId: imageId, type }, data: { active: false } });
  await db.promptVersion.create({ data: { ownerId: imageId, type, version: nn + 1, text: newText, reason: reason || (nn === 0 ? 'Initial' : 'Revision'), active: true } });
}

export async function saveImage(fd: FormData) {
  const id = str(fd, 'id')!;
  const old = await db.plannedImage.findUniqueOrThrow({ where: { id } });
  const full = strRaw(fd, 'fullPrompt'), cont = strRaw(fd, 'contPrompt');
  const data: any = { ...pickText(fd, IMG_TEXT), fullPrompt: full, contPrompt: cont };
  if (!data.title) delete data.title;
  for (const k of ['shotType', 'priority', 'promptStatus', 'cropImportance']) if (!data[k]) delete data[k];
  if (data.priority && !PRIORITIES.includes(data.priority)) delete data.priority;
  if (data.dependsOnId === id) data.dependsOnId = null;
  if ((full.trim() || cont.trim()) && (data.promptStatus ?? old.promptStatus) === 'NOT STARTED') data.promptStatus = 'DRAFT';
  if (old.status === 'PLANNED' && (full.trim() || cont.trim())) data.status = 'PROMPT DRAFT';
  const reason = str(fd, 'promptReason');
  await maybeVersion(id, 'FULL', old.fullPrompt, full, reason);
  await maybeVersion(id, 'CONTINUATION', old.contPrompt, cont, reason);
  await db.plannedImage.update({ where: { id }, data });
  touch();
}

export async function restorePrompt(fd: FormData) {
  const v = await db.promptVersion.findUniqueOrThrow({ where: { id: str(fd, 'id')! } });
  const img = await db.plannedImage.findUniqueOrThrow({ where: { id: v.ownerId } });
  const field = v.type === 'FULL' ? 'fullPrompt' : 'contPrompt';
  await maybeVersion(img.id, v.type as any, (img as any)[field], v.text, `Restored v${v.version}`);
  await db.plannedImage.update({ where: { id: img.id }, data: { [field]: v.text } });
  touch();
}

export async function deleteImage(fd: FormData) {
  const { img, slug } = await pinfo(str(fd, 'id')!);
  await db.plannedImage.delete({ where: { id: img.id } });
  touch();
  redirect(`/projects/${slug}/images`);
}

export async function setImageStatus(fd: FormData) {
  const id = str(fd, 'id')!, status = str(fd, 'status')!;
  if (!IMAGE_STATUSES.includes(status)) throw new Error('Invalid status');
  const { img, code } = await pinfo(id);
  const data: any = { status };
  if (status === 'WAITING') { data.waitingAt = new Date(); data.waitingReason = str(fd, 'reason'); data.waitingNote = str(fd, 'note'); }
  else if (img.status === 'WAITING') { data.waitingAt = null; data.waitingReason = null; data.waitingNote = null; }
  if (status === 'READY' && img.promptStatus !== 'LOCKED') data.promptStatus = 'READY';
  await db.plannedImage.update({ where: { id }, data });
  await logActivity(`${code} marked ${status}`, null, img.projectId);
  touch();
}

// ---- reference links
export async function attachRef(fd: FormData) {
  const imageId = str(fd, 'imageId')!, target = str(fd, 'target');
  if (!target) return;
  const [kind, tid] = target.split(':');
  const role = str(fd, 'role') || 'CUSTOM REFERENCE';
  const max = await db.imageRef.aggregate({ where: { imageId }, _max: { order: true } });
  const exists = await db.imageRef.findFirst({ where: { imageId, ...(kind === 'ref' ? { referenceId: tid } : { sourceImageId: tid }) } });
  if (exists) return;
  await db.imageRef.create({ data: { imageId, role, required: fd.has('required') ? bool(fd, 'required') : true, notes: str(fd, 'notes'), order: (max._max.order ?? -1) + 1, ...(kind === 'ref' ? { referenceId: tid } : { sourceImageId: tid }) } });
  touch();
}
export async function usePreviousApproved(fd: FormData) {
  const imageId = str(fd, 'imageId')!, srcId = str(fd, 'sourceId')!;
  const exists = await db.imageRef.findFirst({ where: { imageId, sourceImageId: srcId } });
  if (!exists) {
    const max = await db.imageRef.aggregate({ where: { imageId }, _max: { order: true } });
    await db.imageRef.create({ data: { imageId, sourceImageId: srcId, role: 'PREVIOUS APPROVED FRAME', required: true, order: (max._max.order ?? -1) + 1 } });
  }
  touch();
}
export async function detachRef(fd: FormData) { await db.imageRef.delete({ where: { id: str(fd, 'id')! } }); touch(); }
export async function updateRef(fd: FormData) {
  await db.imageRef.update({ where: { id: str(fd, 'id')! }, data: { required: bool(fd, 'required'), role: str(fd, 'role') || 'CUSTOM REFERENCE', notes: str(fd, 'notes') } });
  touch();
}
export async function moveRef(fd: FormData) {
  const r = await db.imageRef.findUniqueOrThrow({ where: { id: str(fd, 'id')! } });
  const dir = str(fd, 'dir') === 'up' ? -1 : 1;
  const all = await db.imageRef.findMany({ where: { imageId: r.imageId }, orderBy: { order: 'asc' } });
  const i = all.findIndex(x => x.id === r.id), j = i + dir;
  if (j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  await db.$transaction(all.map((x, k) => db.imageRef.update({ where: { id: x.id }, data: { order: k } })));
  touch();
}

// ---- results / review
export async function uploadResult(fd: FormData) {
  const imageId = str(fd, 'imageId')!;
  const file = fd.get('file') as File | null;
  if (!file || !file.size) throw new Error('Choose the generated image file');
  const { img, code, sc, slug } = await pinfo(imageId);
  const n = (await db.attempt.aggregate({ where: { imageId }, _max: { number: true } }))._max.number ?? 0;
  const number = n + 1;
  const asset = await importFile(file, { rootFolder: await projectFolder(img.projectId), folder: '02 Images', fileBase: `${slug}_${sc}_${code}_attempt-v${number}`, kind: 'GENERATED', version: number, projectSlug: slug });
  const pType = str(fd, 'promptType') || 'FULL';
  const pv = await db.promptVersion.findFirst({ where: { ownerId: imageId, type: pType === 'FULL' ? 'FULL' : 'CONTINUATION', active: true } });
  await db.attempt.create({ data: { imageId, number, assetId: asset.id, sourceTool: str(fd, 'sourceTool') || 'ChatGPT', promptType: pType, promptVersion: pv?.version ?? null, notes: str(fd, 'notes') } });
  await db.plannedImage.update({ where: { id: imageId }, data: { attemptCount: number, status: img.approvedAttemptId ? img.status : 'REVIEW', ...(img.waitingAt ? { waitingAt: null, waitingReason: null, waitingNote: null } : {}) } });
  await logActivity(`${code} result uploaded (attempt ${number})`, `/projects/${slug}/images/${imageId}`, img.projectId);
  touch();
}

export async function saveChecklist(fd: FormData) {
  const id = str(fd, 'attemptId')!;
  const checked = fd.getAll('check').map(String);
  await db.attempt.update({ where: { id }, data: { checklist: JSON.stringify(checked), notes: str(fd, 'notes') } });
  touch();
}

export async function approveAttempt(fd: FormData) {
  const id = str(fd, 'attemptId')!;
  const a = await db.attempt.findUniqueOrThrow({ where: { id }, include: { image: { include: { scene: true, project: true } } } });
  const img = a.image;
  const prev = img.approvedAttemptId;
  await db.$transaction(async tx => {
    if (prev && prev !== id) await tx.attempt.update({ where: { id: prev }, data: { status: 'SUPERSEDED' } });
    await tx.plannedImage.update({ where: { id: img.id }, data: { approvedAttemptId: null } });
    await tx.attempt.update({ where: { id }, data: { status: 'APPROVED', approvedAt: new Date(), checklist: JSON.stringify(fd.getAll('check').map(String)) } });
    await tx.plannedImage.update({ where: { id: img.id }, data: { approvedAttemptId: id, status: 'APPROVED' } });
  });
  await moveAssetToFolder(a.assetId, '02 Images');
  await logActivity(`${imageCode(img.seq)} approved (attempt ${a.number})`, `/projects/${img.project.slug}/images/${img.id}`, img.projectId);
  touch();
}

export async function redoAttempt(fd: FormData) {
  const id = str(fd, 'attemptId')!;
  const a = await db.attempt.findUniqueOrThrow({ where: { id }, include: { image: { include: { project: true } } } });
  await db.attempt.update({ where: { id }, data: { status: 'REDO', wrong: str(fd, 'wrong'), change: str(fd, 'change'), keep: str(fd, 'keep'), corrCategory: str(fd, 'corrCategory'), severity: str(fd, 'severity') || 'MEDIUM', notes: str(fd, 'notes') ?? a.notes, checklist: JSON.stringify(fd.getAll('check').map(String)) } });
  if (a.image.approvedAttemptId !== id) { await db.plannedImage.update({ where: { id: a.imageId }, data: { status: a.image.approvedAttemptId ? 'APPROVED' : 'REDO' } }); await moveAssetToFolder(a.assetId, '03 Redos'); }
  if (bool(fd, 'addToLibrary')) {
    await db.correction.create({ data: { code: await nextCode('correction', 'COR', 3), title: `${imageCode(a.image.seq)}: ${str(fd, 'corrCategory') || 'Correction'}`, category: str(fd, 'corrCategory') || 'Other', wrong: str(fd, 'wrong'), correct: str(fd, 'change'), projectId: a.image.projectId, severity: str(fd, 'severity') || 'MEDIUM', assetId: a.assetId } });
  }
  await logActivity(`${imageCode(a.image.seq)} attempt ${a.number} → REDO`, null, a.image.projectId);
  touch();
}
export async function rejectAttempt(fd: FormData) {
  const id = str(fd, 'attemptId')!;
  const a = await db.attempt.findUniqueOrThrow({ where: { id }, include: { image: true } });
  await db.attempt.update({ where: { id }, data: { status: 'REJECTED', notes: str(fd, 'notes') ?? a.notes } });
  if (a.image.approvedAttemptId !== id) { await db.plannedImage.update({ where: { id: a.imageId }, data: { status: a.image.approvedAttemptId ? 'APPROVED' : 'REJECTED' } }); await moveAssetToFolder(a.assetId, '03 Redos'); }
  touch();
}

// ---- batch
export async function batchImages(fd: FormData) {
  const ids = fd.getAll('ids').map(String);
  const op = str(fd, 'op');
  if (!ids.length || !op) return;
  if (op === 'status') {
    const st = str(fd, 'status')!; if (!IMAGE_STATUSES.includes(st)) return;
    await db.plannedImage.updateMany({ where: { id: { in: ids } }, data: { status: st, ...(st === 'WAITING' ? { waitingAt: new Date(), waitingReason: str(fd, 'reason') } : {}) } });
  } else if (op === 'addRef') {
    const target = str(fd, 'target'); if (!target) return;
    const [kind, tid] = target.split(':');
    for (const imageId of ids) {
      if (await db.imageRef.findFirst({ where: { imageId, ...(kind === 'ref' ? { referenceId: tid } : { sourceImageId: tid }) } })) continue;
      const max = await db.imageRef.aggregate({ where: { imageId }, _max: { order: true } });
      await db.imageRef.create({ data: { imageId, role: str(fd, 'role') || 'CUSTOM REFERENCE', required: true, order: (max._max.order ?? -1) + 1, ...(kind === 'ref' ? { referenceId: tid } : { sourceImageId: tid }) } });
    }
  } else if (op === 'removeRef') {
    const target = str(fd, 'target'); if (!target) return;
    const [kind, tid] = target.split(':');
    await db.imageRef.deleteMany({ where: { imageId: { in: ids }, ...(kind === 'ref' ? { referenceId: tid } : { sourceImageId: tid }) } });
  }
  touch();
}
void int; void parseJson;
