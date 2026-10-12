'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '../db';
import { saveUpload } from '../files';
import { bool, int, klingCode, pickText, str, strRaw } from '../util';
import { logActivity } from '../activity';
import { KLING_STATUSES } from '../constants';

const touch = () => revalidatePath('/', 'layout');
const TEXT = ['title','aspectRatio','purpose','startingComposition','actionSequence','physicalMovement','foodPhysics','dialogue','voiceOverride','cameraBehavior','focusBehavior','asmrLines','ambient','lighting','continuity','safety','restrictions','endingComposition','foodState','notes','status'];

export async function createKling(fd: FormData) {
  const projectId = str(fd, 'projectId')!;
  const title = str(fd, 'title');
  if (!title) throw new Error('Clip title is required');
  const max = await db.klingClip.aggregate({ where: { projectId }, _max: { order: true } });
  const k = await db.klingClip.create({ data: { projectId, title, order: (max._max.order ?? 0) + 1, durationTarget: int(fd, 'durationTarget') } });
  const p = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  await logActivity(`${klingCode(k.order)} created: ${title}`, `/projects/${p.slug}/kling/${k.id}`, projectId);
  touch();
  redirect(`/projects/${p.slug}/kling/${k.id}`);
}

async function snapshotPrompt(id: string, oldText: string, newText: string, reason: string | null) {
  if (oldText === newText) return;
  const n = await db.promptVersion.count({ where: { ownerId: id, type: 'KLING' } });
  if (n === 0 && oldText.trim()) await db.promptVersion.create({ data: { ownerId: id, type: 'KLING', version: 1, text: oldText, reason: 'Initial', active: false } });
  const base = n === 0 && oldText.trim() ? 1 : n;
  await db.promptVersion.updateMany({ where: { ownerId: id, type: 'KLING' }, data: { active: false } });
  await db.promptVersion.create({ data: { ownerId: id, type: 'KLING', version: base + 1, text: newText, reason: reason || (base === 0 ? 'Initial' : 'Revision'), active: true } });
}

export async function saveKling(fd: FormData) {
  const id = str(fd, 'id')!;
  const old = await db.klingClip.findUniqueOrThrow({ where: { id } });
  const data: any = { ...pickText(fd, TEXT), durationTarget: int(fd, 'durationTarget'), durationMin: int(fd, 'durationMin'), durationMax: int(fd, 'durationMax'), useProfileVoice: bool(fd, 'useProfileVoice'), offScreen: bool(fd, 'offScreen'), lipSync: bool(fd, 'lipSync') };
  if (!data.title) delete data.title;
  if (!data.status || !KLING_STATUSES.includes(data.status)) delete data.status;
  const actions = fd.getAll('action').map(a => String(a).trim()).filter(Boolean);
  const extra = strRaw(fd, 'newActions').split('\n').map(s => s.trim()).filter(Boolean);
  data.majorActions = JSON.stringify([...actions, ...extra]);
  const prompt = strRaw(fd, 'finalPrompt');
  data.finalPrompt = prompt;
  await snapshotPrompt(id, old.finalPrompt, prompt, str(fd, 'promptReason'));
  const scenes = fd.getAll('scenes').map(String);
  await db.$transaction([db.klingScene.deleteMany({ where: { klingId: id } }), ...scenes.map(sceneId => db.klingScene.create({ data: { klingId: id, sceneId } }))]);
  await db.klingClip.update({ where: { id }, data });
  touch();
}

export async function setKlingStatus(fd: FormData) {
  const id = str(fd, 'id')!, status = str(fd, 'status')!;
  if (!KLING_STATUSES.includes(status)) throw new Error('Invalid status');
  const k = await db.klingClip.update({ where: { id }, data: { status } });
  await logActivity(`${klingCode(k.order)} marked ${status}`, null, k.projectId);
  touch();
}
export async function deleteKling(fd: FormData) {
  const k = await db.klingClip.findUniqueOrThrow({ where: { id: str(fd, 'id')! }, include: { project: true } });
  await db.klingClip.delete({ where: { id: k.id } });
  touch();
  redirect(`/projects/${k.project.slug}/kling`);
}

export async function addKlingRef(fd: FormData) {
  const klingId = str(fd, 'klingId')!, imageId = str(fd, 'imageId');
  if (!imageId) return;
  if (await db.klingRef.findFirst({ where: { klingId, imageId } })) return;
  const max = await db.klingRef.aggregate({ where: { klingId }, _max: { order: true } });
  await db.klingRef.create({ data: { klingId, imageId, order: (max._max.order ?? -1) + 1 } });
  touch();
}
export async function removeKlingRef(fd: FormData) { await db.klingRef.delete({ where: { id: str(fd, 'id')! } }); touch(); }
export async function moveKlingRef(fd: FormData) {
  const r = await db.klingRef.findUniqueOrThrow({ where: { id: str(fd, 'id')! } });
  const dir = str(fd, 'dir') === 'up' ? -1 : 1;
  const all = await db.klingRef.findMany({ where: { klingId: r.klingId }, orderBy: { order: 'asc' } });
  const i = all.findIndex(x => x.id === r.id), j = i + dir;
  if (j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  await db.$transaction(all.map((x, k) => db.klingRef.update({ where: { id: x.id }, data: { order: k } })));
  touch();
}

/** Build a prompt skeleton from the structured fields, with @imageN pairing. Stored only when the user saves. */
export async function restoreKlingPrompt(fd: FormData) {
  const v = await db.promptVersion.findUniqueOrThrow({ where: { id: str(fd, 'id')! } });
  const k = await db.klingClip.findUniqueOrThrow({ where: { id: v.ownerId } });
  await snapshotPrompt(k.id, k.finalPrompt, v.text, `Restored v${v.version}`);
  await db.klingClip.update({ where: { id: k.id }, data: { finalPrompt: v.text } });
  touch();
}

export async function recordKlingAttempt(fd: FormData) {
  const klingId = str(fd, 'klingId')!;
  const k = await db.klingClip.findUniqueOrThrow({ where: { id: klingId }, include: { project: true } });
  const n = (await db.klingAttempt.aggregate({ where: { klingId }, _max: { number: true } }))._max.number ?? 0;
  const file = fd.get('file') as File | null;
  let assetId: string | null = null;
  if (file && file.size) {
    const a = await saveUpload(file, { projectSlug: k.project.slug, folder: 'generated-videos', friendlyBase: `${k.project.slug}_${klingCode(k.order)}`, versionLabel: `video-v${n + 1}`, kind: 'KLING_VIDEO', version: n + 1 });
    assetId = a.id;
  }
  await db.klingAttempt.create({ data: { klingId, number: n + 1, externalName: str(fd, 'externalName'), assetId, notes: str(fd, 'notes'), status: 'REVIEW' } });
  await db.klingClip.update({ where: { id: klingId }, data: { status: 'REVIEW' } });
  await logActivity(`${klingCode(k.order)} generation ${n + 1} recorded`, null, k.projectId);
  touch();
}
export async function reviewKlingAttempt(fd: FormData) {
  const id = str(fd, 'id')!, result = str(fd, 'result')!;
  const a = await db.klingAttempt.findUniqueOrThrow({ where: { id }, include: { kling: true } });
  if (result === 'APPROVED') {
    await db.klingAttempt.update({ where: { id }, data: { status: 'APPROVED' } });
    await db.klingClip.update({ where: { id: a.klingId }, data: { status: 'APPROVED' } });
  } else {
    await db.klingAttempt.update({ where: { id }, data: { status: 'REDO', wrong: str(fd, 'wrong'), change: str(fd, 'change'), keep: str(fd, 'keep'), promptNotes: str(fd, 'promptNotes') } });
    await db.klingClip.update({ where: { id: a.klingId }, data: { status: 'REDO' } });
  }
  await logActivity(`${klingCode(a.kling.order)} attempt ${a.number} ${result}`, null, a.kling.projectId);
  touch();
}
