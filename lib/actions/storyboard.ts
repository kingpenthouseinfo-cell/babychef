'use server';
import { revalidatePath } from 'next/cache';
import { isRedirectError } from 'next/dist/client/components/redirect';
import { db } from '../db';
import { backfillPositions } from '../order';
import { logActivity } from '../activity';
import { addPictureHere } from './insert';

const touch = () => revalidatePath('/', 'layout');

/** Storyboard: save the whole new layout — scene order, and which pictures sit in which scene in which order. Stable codes (SC02, IMG-021) never change; only the order and a picture's scene do. */
export async function saveStoryboard(projectId: string, layout: { sceneId: string; pictureIds: string[] }[]): Promise<{ savedAt: string }> {
  await backfillPositions();
  const [scenes, pics] = await Promise.all([
    db.scene.findMany({ where: { projectId }, select: { id: true } }),
    db.plannedImage.findMany({ where: { projectId }, select: { id: true, sceneId: true } }),
  ]);
  const sceneSet = new Set(scenes.map(s => s.id)), picScene = new Map(pics.map(p => [p.id, p.sceneId]));
  const seen = new Set<string>();
  const ops: any[] = [];
  let moved = 0;
  const sceneOrder = layout.filter(l => sceneSet.has(l.sceneId));
  // scenes the page did not mention keep their place at the end
  const missing = scenes.map(s => s.id).filter(id => !sceneOrder.some(l => l.sceneId === id));
  [...sceneOrder.map(l => l.sceneId), ...missing].forEach((id, k) => ops.push(db.scene.update({ where: { id }, data: { pos: k + 1 } })));
  for (const l of sceneOrder) {
    let k = 0;
    for (const id of l.pictureIds) {
      if (!picScene.has(id) || seen.has(id)) continue;
      seen.add(id); k++;
      if (picScene.get(id) !== l.sceneId) moved++;
      ops.push(db.plannedImage.update({ where: { id }, data: { sceneId: l.sceneId, pos: k } }));
    }
  }
  // pictures the page did not mention stay in their scene, after the others
  for (const p of pics) if (!seen.has(p.id)) { const n = [...seen].filter(x => (sceneOrder.find(l => l.pictureIds.includes(x))?.sceneId) === p.sceneId).length; ops.push(db.plannedImage.update({ where: { id: p.id }, data: { pos: n + 1 + ops.length } })); }
  await db.$transaction(ops);
  if (moved) await logActivity(`Storyboard saved (${moved} picture${moved === 1 ? '' : 's'} moved to another scene)`, null, projectId);
  touch();
  return { savedAt: new Date().toISOString() };
}

/** Storyboard: add a new picture in a scene, right after `afterImageId` ('START' = first, empty = end). Returns the new picture's id. */
export async function addStoryboardPicture(projectId: string, sceneId: string, afterImageId: string | null): Promise<{ id: string }> {
  const before = await db.plannedImage.aggregate({ where: { projectId }, _max: { seq: true } });
  const fd = new FormData();
  fd.set('projectId', projectId); fd.set('sceneId', sceneId); if (afterImageId) fd.set('afterImageId', afterImageId);
  try { await addPictureHere(fd); } catch (e) { if (!isRedirectError(e)) throw e; }
  const img = await db.plannedImage.findFirstOrThrow({ where: { projectId, seq: { gt: before._max.seq ?? 0 } }, orderBy: { seq: 'desc' } });
  touch();
  return { id: img.id };
}

/** Storyboard: rename a scene (click its title on the page). */
export async function renameScene(sceneId: string, title: string): Promise<{ title: string }> {
  const t = title.trim().slice(0, 140);
  if (!t) throw new Error('A scene needs a name');
  await db.scene.update({ where: { id: sceneId }, data: { title: t } });
  touch();
  return { title: t };
}
