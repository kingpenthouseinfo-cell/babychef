import { db } from './db';

/** Visible order helpers. `Scene.order` and `PlannedImage.seq` are stable IDs (used in file names) and are never renumbered;
 *  `Scene.pos` (project-wide) and `PlannedImage.pos` (inside its scene) are the visible order and are free to change. */

/** Give legacy rows (pos = 0) a position equal to their stable order. Safe to run repeatedly. */
export async function backfillPositions() {
  const scenes = await db.scene.findMany({ where: { pos: 0 }, select: { id: true, projectId: true } });
  for (const pid of new Set(scenes.map(s => s.projectId))) {
    const all = await db.scene.findMany({ where: { projectId: pid }, orderBy: [{ pos: 'asc' }, { order: 'asc' }], select: { id: true, pos: true } });
    await db.$transaction(all.map((s, i) => db.scene.update({ where: { id: s.id }, data: { pos: i + 1 } })));
  }
  const imgs = await db.plannedImage.findMany({ where: { pos: 0 }, select: { sceneId: true } });
  for (const sid of new Set(imgs.map(i => i.sceneId))) {
    const all = await db.plannedImage.findMany({ where: { sceneId: sid }, orderBy: [{ pos: 'asc' }, { seq: 'asc' }], select: { id: true } });
    await db.$transaction(all.map((i, k) => db.plannedImage.update({ where: { id: i.id }, data: { pos: k + 1 } })));
  }
}

export const SCENE_ORDER = [{ pos: 'asc' }, { order: 'asc' }] as const;
export const IMAGE_ORDER = [{ scene: { pos: 'asc' } }, { pos: 'asc' }, { seq: 'asc' }] as const;

async function resequenceScenes(projectId: string, ids: string[]) {
  await db.$transaction(ids.map((id, i) => db.scene.update({ where: { id }, data: { pos: i + 1 } })));
}
async function resequenceImages(ids: string[]) {
  await db.$transaction(ids.map((id, i) => db.plannedImage.update({ where: { id }, data: { pos: i + 1 } })));
}
const sceneIds = async (projectId: string) => (await db.scene.findMany({ where: { projectId }, orderBy: [...SCENE_ORDER], select: { id: true } })).map(s => s.id);
const imageIds = async (sceneId: string) => (await db.plannedImage.findMany({ where: { sceneId }, orderBy: [{ pos: 'asc' }, { seq: 'asc' }], select: { id: true } })).map(s => s.id);

/** Position for a new scene: after `afterId`, before `beforeId`, or at the end. Shifts the rest down. Returns the pos to use. */
export async function openScenePos(projectId: string, opts: { afterId?: string | null; beforeId?: string | null } = {}) {
  await backfillPositions();
  const ids = await sceneIds(projectId);
  let at = ids.length;
  if (opts.afterId) { const i = ids.indexOf(opts.afterId); if (i > -1) at = i + 1; }
  else if (opts.beforeId) { const i = ids.indexOf(opts.beforeId); if (i > -1) at = i; }
  ids.splice(at, 0, '__new__');
  const real = ids.filter(x => x !== '__new__');
  await db.$transaction(real.map(id => db.scene.update({ where: { id }, data: { pos: ids.indexOf(id) + 1 } })));
  return at + 1;
}
/** Position for a new picture inside a scene: after `afterId`, at the start (`afterId = 'START'`), or at the end. */
export async function openImagePos(sceneId: string, afterId?: string | null) {
  await backfillPositions();
  const ids = await imageIds(sceneId);
  let at = ids.length;
  if (afterId === 'START') at = 0; else if (afterId) { const i = ids.indexOf(afterId); if (i > -1) at = i + 1; }
  ids.splice(at, 0, '__new__');
  const real = ids.filter(x => x !== '__new__');
  await db.$transaction(real.map(id => db.plannedImage.update({ where: { id }, data: { pos: ids.indexOf(id) + 1 } })));
  return at + 1;
}
export async function moveScenePos(id: string, dir: -1 | 1) {
  await backfillPositions();
  const sc = await db.scene.findUniqueOrThrow({ where: { id } });
  const ids = await sceneIds(sc.projectId);
  const i = ids.indexOf(id), j = i + dir;
  if (j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await resequenceScenes(sc.projectId, ids);
}
export async function moveImagePos(id: string, dir: -1 | 1) {
  await backfillPositions();
  const img = await db.plannedImage.findUniqueOrThrow({ where: { id } });
  const ids = await imageIds(img.sceneId);
  const i = ids.indexOf(id), j = i + dir;
  if (j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await resequenceImages(ids);
}
/** Close the gap after a delete (stable IDs untouched). */
export async function closeGaps(projectId: string, sceneId?: string) {
  await resequenceScenes(projectId, await sceneIds(projectId));
  if (sceneId) await resequenceImages(await imageIds(sceneId));
}

/** All pictures of a project in visible order, with their visible number (1-based). */
export async function orderedPictures(projectId: string) {
  await backfillPositions();
  const imgs = await db.plannedImage.findMany({ where: { projectId }, orderBy: [...IMAGE_ORDER], include: { scene: true } });
  return imgs.map((i, n) => ({ ...i, n: n + 1 }));
}
