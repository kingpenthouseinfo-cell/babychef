'use server';
import { revalidatePath } from 'next/cache';
import { db } from '../db';
import { backfillPositions } from '../order';
import { logActivity } from '../activity';
import { autoAttachReferences } from '../auto-refs';
import { fillFromScene } from '../image-gen';
import type { toSavePayload } from '../storyboard-order';

const touch = () => revalidatePath('/', 'layout');

/** Storyboard "Save order": one transaction that creates the new scenes/pictures, renames, and stores the whole new order (scene order, which scene each picture is in, and the order inside it).
 *  Stable codes (SC02, IMG-021) and file names never change — only order, scene membership and titles do. */
export async function saveOrder(projectId: string, payload: ReturnType<typeof toSavePayload>): Promise<{ saved: true }> {
  await backfillPositions();
  const [scenes, pics, maxScene, maxImg] = await Promise.all([
    db.scene.findMany({ where: { projectId }, select: { id: true, title: true } }),
    db.plannedImage.findMany({ where: { projectId }, select: { id: true, title: true, sceneId: true } }),
    db.scene.aggregate({ where: { projectId }, _max: { order: true } }),
    db.plannedImage.aggregate({ where: { projectId }, _max: { seq: true } }),
  ]);
  const haveScene = new Set(scenes.map(s => s.id)), havePic = new Map(pics.map(p => [p.id, p])), sceneTitle = new Map(scenes.map(s => [s.id, s.title]));
  const clean = (t: string, fallback: string) => (t || '').trim().slice(0, 140) || fallback;
  let moved = 0, renamed = 0;
  const newPics: string[] = [];

  await db.$transaction(async tx => {
    // 1) new scenes get a real id (and a fresh stable scene number)
    const idOf = new Map<string, string>();
    let order = maxScene._max.order ?? 0;
    for (const s of payload.scenes) {
      if (haveScene.has(s.id)) { idOf.set(s.id, s.id); continue; }
      if (!s.isNew) continue;
      const row = await tx.scene.create({ data: { projectId, title: clean(s.title, 'New scene'), order: ++order, pos: 9999 } as any });
      idOf.set(s.id, row.id);
    }
    // 2) scene titles + order
    for (const s of payload.scenes) {
      const id = idOf.get(s.id); if (!id) continue;
      const data: any = { pos: s.order };
      if (haveScene.has(s.id) && clean(s.title, '') && clean(s.title, '') !== sceneTitle.get(id)) { data.title = clean(s.title, ''); renamed++; }
      await tx.scene.update({ where: { id }, data });
    }
    // 3) pictures: create the new ones, then store scene + position + title of every one
    let seq = maxImg._max.seq ?? 0;
    for (const p of payload.pictures) {
      const sceneId = idOf.get(p.sceneId); if (!sceneId) continue;
      if (p.isNew && !havePic.has(p.id)) {
        const row = await tx.plannedImage.create({ data: { projectId, sceneId, seq: ++seq, pos: p.orderInScene, title: clean(p.title, 'New picture'), shotType: 'MAIN NARRATIVE SHOT' } as any });
        newPics.push(row.id);
        continue;
      }
      const cur = havePic.get(p.id); if (!cur) continue;
      const data: any = { sceneId, pos: p.orderInScene };
      if (cur.sceneId !== sceneId) moved++;
      if (clean(p.title, '') && clean(p.title, '') !== cur.title) { data.title = clean(p.title, ''); renamed++; }
      await tx.plannedImage.update({ where: { id: p.id }, data });
    }
  });
  // new pictures: attach references and write their first prompt from the scene (best effort)
  for (const id of newPics) { try { await autoAttachReferences(id); await fillFromScene(id); } catch { /* the picture exists; it can be filled in later */ } }
  await logActivity(`Storyboard order saved${moved ? ` (${moved} picture${moved === 1 ? '' : 's'} moved to another scene)` : ''}${newPics.length ? `, ${newPics.length} new picture${newPics.length === 1 ? '' : 's'}` : ''}${renamed ? `, ${renamed} renamed` : ''}`, null, projectId);
  touch();
  return { saved: true };
}
