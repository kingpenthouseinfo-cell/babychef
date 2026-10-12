'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '../db';
import { str, strRaw } from '../util';
import { logActivity } from '../activity';
import { openImagePos, openScenePos, moveImagePos, moveScenePos, closeGaps, orderedPictures, backfillPositions } from '../order';
import { addNotice, getNotices, setNotices } from '../notices';
import { autoAttachReferences } from '../auto-refs';

const touch = () => revalidatePath('/', 'layout');
const storyUrl = async (projectId: string, hash = '') => `/projects/${(await db.project.findUniqueOrThrow({ where: { id: projectId } })).slug}/story${hash}`;

/** Add a picture right after `afterImageId` ('START' = first in the scene, empty = end of the scene). */
export async function addPictureHere(fd: FormData) {
  const projectId = str(fd, 'projectId')!;
  const title = str(fd, 'title');
  if (!title) throw new Error('Describe the picture you need');
  const afterImageId = str(fd, 'afterImageId');
  let sceneId = str(fd, 'sceneId');
  if (!sceneId && afterImageId && afterImageId !== 'START') sceneId = (await db.plannedImage.findUnique({ where: { id: afterImageId } }))?.sceneId ?? null;
  if (!sceneId) sceneId = (await db.scene.findFirst({ where: { projectId }, orderBy: { pos: 'desc' } }))?.id ?? null;
  if (!sceneId) throw new Error('Add a scene first');
  const max = await db.plannedImage.aggregate({ where: { projectId }, _max: { seq: true } });
  const pos = await openImagePos(sceneId, afterImageId);
  const img = await db.plannedImage.create({ data: { projectId, sceneId, seq: (max._max.seq ?? 0) + 1, pos, title: title.slice(0, 140), purpose: str(fd, 'what') || str(fd, 'purpose'), shotType: str(fd, 'shotType') || 'MAIN NARRATIVE SHOT' } as any });
  // continuity: the picture before it becomes its Previous Picture; if the next picture was using that one, ask before changing it.
  const all = await orderedPictures(projectId);
  const i = all.findIndex(x => x.id === img.id);
  const prev = all[i - 1], next = all[i + 1];
  if (prev) await db.plannedImage.update({ where: { id: img.id }, data: { dependsOnId: prev.id } });
  if (next && prev) {
    const usedPrev = next.dependsOnId === prev.id || (await db.imageRef.count({ where: { imageId: next.id, role: 'PREVIOUS APPROVED FRAME', sourceImageId: prev.id } })) > 0;
    if (usedPrev) await addNotice(projectId, { kind: 'PREV_PICTURE', imageId: next.id, targetId: img.id, text: `Use the new picture as the Previous Picture for Picture ${next.n}?` });
  }
  await autoAttachReferences(img.id);
  // video clips already planned for this section
  const clips = await db.klingClip.findMany({ where: { projectId, OR: [{ scenes: { some: { sceneId } } }, { refs: { some: { imageId: { in: [prev?.id, next?.id].filter(Boolean) as string[] } } } }] }, select: { id: true } });
  for (const c of clips) await addNotice(projectId, { kind: 'CLIP_ADD', imageId: img.id, targetId: c.id, text: 'You added a new picture to this section. Do you want to include it in the video clip?' });
  await logActivity(`Picture added: ${title}`, null, projectId);
  touch();
  redirect(await storyUrl(projectId, `#pic-${img.id}`));
}

/** Add a scene before/after an existing one (or at the end). */
export async function addSceneHere(fd: FormData) {
  const projectId = str(fd, 'projectId')!;
  const title = str(fd, 'title');
  if (!title) throw new Error('Give the scene a name');
  const max = await db.scene.aggregate({ where: { projectId }, _max: { order: true } });
  const pos = await openScenePos(projectId, { afterId: str(fd, 'afterSceneId'), beforeId: str(fd, 'beforeSceneId') });
  const sc = await db.scene.create({ data: { projectId, order: (max._max.order ?? 0) + 1, pos, title: title.slice(0, 140), narrative: str(fd, 'narrative'), dialogue: str(fd, 'dialogue'), notes: str(fd, 'notes') } });
  await logActivity(`Scene added: ${title}`, null, projectId);
  touch();
  redirect(await storyUrl(projectId, `#scene-${sc.id}`));
}

export async function moveSceneUpDown(fd: FormData) {
  const sc = await db.scene.findUniqueOrThrow({ where: { id: str(fd, 'id')! } });
  await moveScenePos(sc.id, str(fd, 'dir') === 'up' ? -1 : 1);
  touch(); redirect(await storyUrl(sc.projectId, `#scene-${sc.id}`));
}
export async function movePictureUpDown(fd: FormData) {
  const img = await db.plannedImage.findUniqueOrThrow({ where: { id: str(fd, 'id')! } });
  await moveImagePos(img.id, str(fd, 'dir') === 'up' ? -1 : 1);
  touch(); redirect(await storyUrl(img.projectId, `#pic-${img.id}`));
}

export async function duplicateScene(fd: FormData) {
  const sc = await db.scene.findUniqueOrThrow({ where: { id: str(fd, 'id')! } });
  const { id, order, pos, createdAt, updatedAt, ...rest } = sc as any;
  const max = await db.scene.aggregate({ where: { projectId: sc.projectId }, _max: { order: true } });
  const np = await openScenePos(sc.projectId, { afterId: sc.id });
  const copy = await db.scene.create({ data: { ...rest, title: `${sc.title} (copy)`, order: (max._max.order ?? 0) + 1, pos: np, status: 'PLANNED' } });
  touch(); redirect(await storyUrl(sc.projectId, `#scene-${copy.id}`));
}
export async function duplicatePicture(fd: FormData) {
  const img = await db.plannedImage.findUniqueOrThrow({ where: { id: str(fd, 'id')! } });
  const max = await db.plannedImage.aggregate({ where: { projectId: img.projectId }, _max: { seq: true } });
  const pos = await openImagePos(img.sceneId, img.id);
  const copy = await db.plannedImage.create({ data: { projectId: img.projectId, sceneId: img.sceneId, seq: (max._max.seq ?? 0) + 1, pos, title: `${img.title} (copy)`, purpose: img.purpose, shotType: img.shotType, fullPrompt: img.fullPrompt, contPrompt: img.contPrompt } as any });
  touch(); redirect(await storyUrl(img.projectId, `#pic-${copy.id}`));
}
export async function deleteSceneHere(fd: FormData) {
  const sc = await db.scene.findUniqueOrThrow({ where: { id: str(fd, 'id')! } });
  // deleting a scene also deletes its picture plan (results already saved in the folder are left alone)
  await db.plannedImage.deleteMany({ where: { sceneId: sc.id } });
  await db.scene.delete({ where: { id: sc.id } });
  await closeGaps(sc.projectId);
  touch(); redirect(await storyUrl(sc.projectId));
}

/** Split one long scene in two: the ticked pictures move to a new scene that follows it. */
export async function splitScene(fd: FormData) {
  const sc = await db.scene.findUniqueOrThrow({ where: { id: str(fd, 'id')! } });
  const ids = fd.getAll('img').map(String);
  if (!ids.length) throw new Error('Tick the pictures that should go in the second half');
  const max = await db.scene.aggregate({ where: { projectId: sc.projectId }, _max: { order: true } });
  const np = await openScenePos(sc.projectId, { afterId: sc.id });
  const { id, order, pos, createdAt, updatedAt, ...rest } = sc as any;
  const second = await db.scene.create({ data: { ...rest, title: str(fd, 'title') || `${sc.title} (part 2)`, order: (max._max.order ?? 0) + 1, pos: np, status: 'PLANNED' } });
  const moving = await db.plannedImage.findMany({ where: { id: { in: ids }, sceneId: sc.id }, orderBy: [{ pos: 'asc' }, { seq: 'asc' }], select: { id: true } });
  await db.$transaction(moving.map((m, i) => db.plannedImage.update({ where: { id: m.id }, data: { sceneId: second.id, pos: i + 1 } })));
  await closeGaps(sc.projectId, sc.id);
  await logActivity(`Scene split: ${sc.title}`, null, sc.projectId);
  touch(); redirect(await storyUrl(sc.projectId, `#scene-${second.id}`));
}

/** Answer a "do you want to…?" notice. */
export async function resolveNotice(fd: FormData) {
  const projectId = str(fd, 'projectId')!, nid = str(fd, 'noticeId')!;
  const yes = str(fd, 'yes') === '1';
  const all = await getNotices(projectId);
  const n = all.find(x => x.id === nid);
  if (n && yes) {
    if (n.kind === 'PREV_PICTURE') {
      await db.plannedImage.update({ where: { id: n.imageId }, data: { dependsOnId: n.targetId } });
      await db.imageRef.updateMany({ where: { imageId: n.imageId, role: 'PREVIOUS APPROVED FRAME' }, data: { sourceImageId: n.targetId } });
    } else {
      const c = await db.klingRef.aggregate({ where: { klingId: n.targetId }, _max: { order: true } });
      if (!(await db.klingRef.count({ where: { klingId: n.targetId, imageId: n.imageId } }))) await db.klingRef.create({ data: { klingId: n.targetId, imageId: n.imageId, order: (c._max.order ?? 0) + 1 } });
    }
  }
  await setNotices(projectId, all.filter(x => x.id !== nid));
  touch();
}
void strRaw; void backfillPositions;

/** Drag-and-drop: save the new visible order of scenes (stable scene numbers never change). */
export async function reorderScenes(projectId: string, ids: string[]) {
  await backfillPositions();
  const have = new Set((await db.scene.findMany({ where: { projectId }, select: { id: true } })).map(s => s.id));
  const wanted = ids.filter(i => have.has(i));
  const rest = [...have].filter(i => !wanted.includes(i));
  await db.$transaction([...wanted, ...rest].map((id, k) => db.scene.update({ where: { id }, data: { pos: k + 1 } })));
  touch();
}
/** Drag-and-drop: save the new visible order of pictures inside one scene. */
export async function reorderPictures(sceneId: string, ids: string[]) {
  await backfillPositions();
  const have = new Set((await db.plannedImage.findMany({ where: { sceneId }, select: { id: true } })).map(s => s.id));
  const wanted = ids.filter(i => have.has(i));
  const rest = [...have].filter(i => !wanted.includes(i));
  await db.$transaction([...wanted, ...rest].map((id, k) => db.plannedImage.update({ where: { id }, data: { pos: k + 1 } })));
  touch();
}
export async function deletePictureHere(fd: FormData) {
  const img = await db.plannedImage.findUniqueOrThrow({ where: { id: str(fd, 'id')! } });
  await db.plannedImage.delete({ where: { id: img.id } });
  await closeGaps(img.projectId, img.sceneId);
  touch(); redirect(await storyUrl(img.projectId));
}
