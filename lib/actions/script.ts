'use server';
import { revalidatePath } from 'next/cache';
import { db } from '../db';
import { bool, pickText, str, strRaw, sceneCode } from '../util';
import { logActivity } from '../activity';

export async function createScript(fd: FormData) {
  const projectId = str(fd, 'projectId')!;
  const max = await db.scriptVersion.aggregate({ where: { projectId }, _max: { version: true } });
  const dupFrom = str(fd, 'from');
  const src = dupFrom ? await db.scriptVersion.findUnique({ where: { id: dupFrom } }) : null;
  const first = (max._max.version ?? 0) === 0;
  const s = await db.scriptVersion.create({ data: { projectId, version: (max._max.version ?? 0) + 1, title: src?.title ?? str(fd, 'title'), content: src?.content ?? '', notes: str(fd, 'notes'), isCurrent: first } });
  await logActivity(`Script v${s.version} created`, null, projectId);
  revalidatePath('/', 'layout');
}
export async function saveScript(fd: FormData) {
  const id = str(fd, 'id')!;
  const s = await db.scriptVersion.findUniqueOrThrow({ where: { id } });
  if (s.status === 'LOCKED' && str(fd, 'status') === 'LOCKED') throw new Error('This version is LOCKED. Reopen it (set status to DRAFT) to edit.');
  await db.scriptVersion.update({ where: { id }, data: { content: strRaw(fd, 'content'), title: str(fd, 'title'), notes: str(fd, 'notes'), status: str(fd, 'status') || s.status } });
  if (str(fd, 'status') && str(fd, 'status') !== s.status) await logActivity(`Script v${s.version} → ${str(fd, 'status')}`, null, s.projectId);
  revalidatePath('/', 'layout');
}
export async function setCurrentScript(fd: FormData) {
  const id = str(fd, 'id')!;
  const s = await db.scriptVersion.findUniqueOrThrow({ where: { id } });
  await db.$transaction([db.scriptVersion.updateMany({ where: { projectId: s.projectId }, data: { isCurrent: false } }), db.scriptVersion.update({ where: { id }, data: { isCurrent: true } })]);
  await logActivity(`Script v${s.version} set current`, null, s.projectId);
  revalidatePath('/', 'layout');
}
export async function reopenScript(fd: FormData) { await db.scriptVersion.update({ where: { id: str(fd, 'id')! }, data: { status: 'DRAFT' } }); revalidatePath('/', 'layout'); }

// ---- scenes
const SCENE_TEXT = ['title','recipeStep','purpose','narrative','dialogue','babyReaction','mainAction','secondaryAction','ingredients','utensils','cookware','babyPosition','adultAssist','adultNotes','cameraAngle','cameraMovement','shotPriority','cropImportance','asmr','safetyNotes','foodBefore','foodDuring','foodAfter','continuity','notes','status'];

export async function saveScene(fd: FormData) {
  const id = str(fd, 'id');
  const projectId = str(fd, 'projectId')!;
  const data: any = { ...pickText(fd, SCENE_TEXT), shortKeep: bool(fd, 'shortKeep'), hook: bool(fd, 'hook'), beauty: bool(fd, 'beauty') };
  if (!data.title) throw new Error('Scene title is required');
  for (const k of ['adultAssist', 'shotPriority', 'cropImportance', 'status']) if (!data[k]) delete data[k];
  if (id) { await db.scene.update({ where: { id }, data }); revalidatePath('/', 'layout'); return; }
  const max = await db.scene.aggregate({ where: { projectId }, _max: { order: true } });
  const sc = await db.scene.create({ data: { ...data, projectId, order: (max._max.order ?? 0) + 1 } });
  await logActivity(`${sceneCode(sc.order)} "${sc.title}" added`, null, projectId);
  revalidatePath('/', 'layout');
}
async function renumber(projectId: string, ids: string[]) {
  await db.$transaction(ids.map((id, i) => db.scene.update({ where: { id }, data: { order: i + 1 } })));
}
export async function moveScene(fd: FormData) {
  const id = str(fd, 'id')!, dir = str(fd, 'dir') === 'up' ? -1 : 1;
  const sc = await db.scene.findUniqueOrThrow({ where: { id } });
  const all = await db.scene.findMany({ where: { projectId: sc.projectId }, orderBy: { order: 'asc' } });
  const i = all.findIndex(s => s.id === id), j = i + dir;
  if (j < 0 || j >= all.length) return;
  const ids = all.map(s => s.id); [ids[i], ids[j]] = [ids[j], ids[i]];
  await renumber(sc.projectId, ids);
  revalidatePath('/', 'layout');
}
export async function deleteScene(fd: FormData) {
  const sc = await db.scene.findUniqueOrThrow({ where: { id: str(fd, 'id')! } });
  const n = await db.plannedImage.count({ where: { sceneId: sc.id } });
  if (n > 0 && str(fd, 'force') !== '1') throw new Error('Scene has planned images. Move or delete them first.');
  await db.scene.delete({ where: { id: sc.id } });
  const rest = await db.scene.findMany({ where: { projectId: sc.projectId }, orderBy: { order: 'asc' } });
  await renumber(sc.projectId, rest.map(s => s.id));
  revalidatePath('/', 'layout');
}
void pickText;
