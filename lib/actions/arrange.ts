'use server';
import { revalidatePath } from 'next/cache';
import { db } from '../db';
import { str } from '../util';
import { backfillPositions, resequenceImages, SCENE_ORDER } from '../order';
import { logActivity } from '../activity';

const touch = () => revalidatePath('/', 'layout');

async function sceneImageIds(sceneId: string) {
  return (await db.plannedImage.findMany({ where: { sceneId }, orderBy: [{ pos: 'asc' }, { seq: 'asc' }], select: { id: true } })).map(x => x.id);
}

/** Move a picture up or down one place in the whole video. At the edge of a scene it moves into the neighbouring scene. IMG numbers never change. */
export async function movePictureStep(fd: FormData) {
  const id = str(fd, 'imageId')!, dir = str(fd, 'dir') === 'up' ? -1 : 1;
  await backfillPositions();
  const img = await db.plannedImage.findUniqueOrThrow({ where: { id } });
  const ids = await sceneImageIds(img.sceneId);
  const i = ids.indexOf(id), j = i + dir;
  if (j >= 0 && j < ids.length) { [ids[i], ids[j]] = [ids[j], ids[i]]; await resequenceImages(ids); touch(); return; }
  const scenes = await db.scene.findMany({ where: { projectId: img.projectId }, orderBy: [...SCENE_ORDER], select: { id: true } });
  const k = scenes.findIndex(s => s.id === img.sceneId) + dir;
  if (k < 0 || k >= scenes.length) return;
  const target = scenes[k].id;
  const tIds = await sceneImageIds(target);
  await db.plannedImage.update({ where: { id }, data: { sceneId: target } });
  await resequenceImages(dir === 1 ? [id, ...tIds] : [...tIds, id]);
  await resequenceImages(ids.filter(x => x !== id));
  await logActivity('Picture moved to another scene', null, img.projectId);
  touch();
}

/** Move a picture into another scene (placed at the end of it, or the start). */
export async function movePictureToScene(fd: FormData) {
  const id = str(fd, 'imageId')!, sceneId = str(fd, 'sceneId');
  if (!sceneId) return;
  await backfillPositions();
  const img = await db.plannedImage.findUniqueOrThrow({ where: { id } });
  if (img.sceneId === sceneId) return;
  const from = await sceneImageIds(img.sceneId);
  const to = await sceneImageIds(sceneId);
  await db.plannedImage.update({ where: { id }, data: { sceneId } });
  await resequenceImages(str(fd, 'where') === 'start' ? [id, ...to] : [...to, id]);
  await resequenceImages(from.filter(x => x !== id));
  await logActivity('Picture moved to another scene', null, img.projectId);
  touch();
}

/** Swap two pictures' places (they may be in different scenes). Nothing else about them changes. */
export async function swapPictures(fd: FormData) {
  const a = str(fd, 'imageId')!, b = str(fd, 'otherId');
  if (!b || a === b) return;
  await backfillPositions();
  const [x, y] = await Promise.all([db.plannedImage.findUniqueOrThrow({ where: { id: a } }), db.plannedImage.findUniqueOrThrow({ where: { id: b } })]);
  if (x.projectId !== y.projectId) throw new Error('Pictures from different videos can\'t be swapped');
  await db.$transaction([
    db.plannedImage.update({ where: { id: a }, data: { sceneId: y.sceneId, pos: y.pos } }),
    db.plannedImage.update({ where: { id: b }, data: { sceneId: x.sceneId, pos: x.pos } }),
  ]);
  await resequenceImages(await sceneImageIds(x.sceneId));
  if (y.sceneId !== x.sceneId) await resequenceImages(await sceneImageIds(y.sceneId));
  await logActivity('Two pictures swapped', null, x.projectId);
  touch();
}
