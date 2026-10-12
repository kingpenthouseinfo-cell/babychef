'use server';
import { revalidatePath } from 'next/cache';
import { db } from '../db';
import { bool, int, pickText, str } from '../util';
import { VERTICAL_OPTIONS } from '../constants';

const touch = () => revalidatePath('/', 'layout');

async function getShort(projectId: string) {
  return (await db.shortVersion.findUnique({ where: { projectId } })) ?? db.shortVersion.create({ data: { projectId } });
}
export async function saveShort(fd: FormData) {
  const projectId = str(fd, 'projectId')!;
  const s = await getShort(projectId);
  await db.shortVersion.update({ where: { id: s.id }, data: { ...pickText(fd, ['hook', 'hookVisual', 'hookDialogue', 'endVisual', 'endDialogue', 'cta', 'editNotes', 'transcriptCues', 'mustKeepLines', 'jumpCuts', 'montage', 'asmrKeep', 'music', 'cropNotes', 'onScreenText', 'transitions', 'subtitles']), targetSeconds: int(fd, 'targetSeconds') ?? 55 } as any });
  touch();
}
/** Pull SHORT KEEP scenes into the plan (skips scenes already present). */
export async function collectShortKeep(fd: FormData) {
  const projectId = str(fd, 'projectId')!;
  const s = await getShort(projectId);
  const scenes = await db.scene.findMany({ where: { projectId, shortKeep: true }, orderBy: { order: 'asc' } });
  const existing = await db.shortItem.findMany({ where: { shortId: s.id } });
  let order = existing.length;
  for (const sc of scenes) {
    if (existing.some(e => e.sceneId === sc.id)) continue;
    await db.shortItem.create({ data: { shortId: s.id, sceneId: sc.id, order: order++, dialogue: sc.dialogue, visual: sc.mainAction || sc.narrative, hookImp: sc.hook, foodImp: sc.beauty, vertical: sc.cropImportance === 'CRITICAL' ? 'VERTICAL SAFE' : sc.cropImportance === 'NOT IMPORTANT' ? 'NOT IDEAL FOR VERTICAL' : 'MAY REQUIRE REFRAMING', seconds: 5, reason: 'Marked SHORT KEEP' } });
  }
  touch();
}
export async function addShortItem(fd: FormData) {
  const projectId = str(fd, 'projectId')!;
  const s = await getShort(projectId);
  const n = await db.shortItem.count({ where: { shortId: s.id } });
  await db.shortItem.create({ data: { shortId: s.id, order: n, sceneId: str(fd, 'sceneId'), klingId: str(fd, 'klingId'), visual: str(fd, 'visual'), seconds: int(fd, 'seconds') ?? 5 } });
  touch();
}
export async function saveShortItem(fd: FormData) {
  const id = str(fd, 'id')!;
  const v = str(fd, 'vertical') || 'MAY REQUIRE REFRAMING';
  await db.shortItem.update({ where: { id }, data: { ...pickText(fd, ['sceneId', 'klingId', 'imageIds', 'dialogue', 'visual', 'reason', 'notes']), seconds: int(fd, 'seconds') ?? 5, hookImp: bool(fd, 'hookImp'), comedyImp: bool(fd, 'comedyImp'), recipeImp: bool(fd, 'recipeImp'), foodImp: bool(fd, 'foodImp'), vertical: VERTICAL_OPTIONS.includes(v) ? v : 'MAY REQUIRE REFRAMING' } as any });
  touch();
}
export async function moveShortItem(fd: FormData) {
  const it = await db.shortItem.findUniqueOrThrow({ where: { id: str(fd, 'id')! } });
  const dir = str(fd, 'dir') === 'up' ? -1 : 1;
  const all = await db.shortItem.findMany({ where: { shortId: it.shortId }, orderBy: { order: 'asc' } });
  const i = all.findIndex(x => x.id === it.id), j = i + dir;
  if (j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  await db.$transaction(all.map((x, k) => db.shortItem.update({ where: { id: x.id }, data: { order: k } })));
  touch();
}
export async function deleteShortItem(fd: FormData) { await db.shortItem.delete({ where: { id: str(fd, 'id')! } }); touch(); }
