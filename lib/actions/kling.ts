'use server';
import { sceneLabels } from '../scene-label';
import { effectiveCode } from '../project-code';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '../db';
import { importFile, projectFolder } from '../files';
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

/** One video clip per scene: gathers the scene's pictures that look good, in order, then opens the clip. */
/** Find or make the video clip of a scene (pictures gathered from the approved ones). No redirect. */
async function ensureClipForScene(sceneId: string) {
  const sc = await db.scene.findUniqueOrThrow({ where: { id: sceneId } });
  const p = await db.project.findUniqueOrThrow({ where: { id: sc.projectId } });
  const existing = await db.klingClip.findFirst({ where: { projectId: p.id, scenes: { some: { sceneId } } } });
  if (existing) return { clip: existing, slug: p.slug, created: false };
  const scenesNo = sceneLabels(await db.scene.findMany({ where: { projectId: p.id }, select: { id: true, pos: true, order: true, inserted: true } })).get(sceneId) ?? '?';
  const max = await db.klingClip.aggregate({ where: { projectId: p.id }, _max: { order: true } });
  const k = await db.klingClip.create({ data: { projectId: p.id, title: `Scene ${scenesNo} video — ${sc.title}`, order: (max._max.order ?? 0) + 1, purpose: (sc as any).klingNote || null } as any });
  await db.klingScene.create({ data: { klingId: k.id, sceneId } });
  const pics = await db.plannedImage.findMany({ where: { sceneId, approvedAttemptId: { not: null } }, orderBy: [{ pos: 'asc' }, { seq: 'asc' }] });
  let o = 0;
  for (const im of pics) await db.klingRef.create({ data: { klingId: k.id, imageId: im.id, order: ++o } });
  await logActivity(`${klingCode(k.order)} made from scene ${scenesNo}`, `/projects/${p.slug}/kling/${k.id}`, p.id);
  return { clip: k, slug: p.slug, created: true };
}
export async function makeClipForScene(fd: FormData) {
  const { clip, slug } = await ensureClipForScene(str(fd, 'sceneId')!);
  touch();
  redirect(`/projects/${slug}/kling/${clip.id}`);
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
  const k: any = await db.klingClip.findUniqueOrThrow({ where: { id: klingId }, include: { project: true, scenes: { include: { scene: true } }, refs: { orderBy: { order: 'asc' }, include: { image: { include: { approvedAttempt: { include: { asset: true } }, attempts: { orderBy: { number: 'desc' }, take: 1, include: { asset: true } } } } } } } as any });
  const imageFiles = (k as any).refs.map((r: any) => (r.image.approvedAttempt?.asset ?? r.image.attempts[0]?.asset)?.displayName).filter(Boolean) as string[];
  const n = (await db.klingAttempt.aggregate({ where: { klingId }, _max: { number: true } }))._max.number ?? 0;
  const file = fd.get('file') as File | null;
  let assetId: string | null = null;
  if (file && file.size) {
    const a = await importFile(file, { rootFolder: await projectFolder(k.projectId), folder: '04 Kling', fileBase: `${effectiveCode(k.project)}${(k as any).scenes?.[0]?.scene ? `-S${String((k as any).scenes[0].scene.order).padStart(2, '0')}` : ''}-CLIP${String(k.order).padStart(2, '0')}_v${n + 1}`, kind: 'KLING_VIDEO', version: n + 1, projectSlug: k.project.slug });
    assetId = a.id;
  }
  await db.klingAttempt.create({ data: { klingId, number: n + 1, externalName: str(fd, 'externalName'), assetId, notes: str(fd, 'notes'), status: 'REVIEW', imageFiles: JSON.stringify(imageFiles) } as any });
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

/** Drag-and-drop reorder of the @image reference strip. */
export async function reorderKlingRefs(klingId: string, orderedIds: string[]) {
  const refs = await db.klingRef.findMany({ where: { klingId } });
  const valid = orderedIds.filter(id => refs.some(r => r.id === id));
  await db.$transaction(valid.map((id, i) => db.klingRef.update({ where: { id }, data: { order: i } })));
  touch();
}

/** Video Prompts page: save one clip's prompt (the old text is kept as a version). */
export async function saveClipPrompt(klingId: string, text: string): Promise<{ savedAt: string }> {
  const old = await db.klingClip.findUniqueOrThrow({ where: { id: klingId } });
  await snapshotPrompt(klingId, old.finalPrompt, text, 'Edited on Video Prompts');
  await db.klingClip.update({ where: { id: klingId }, data: { finalPrompt: text, ...(text.trim() && old.status === 'PLANNED' ? { status: 'DRAFT' } : {}) } });
  touch();
  return { savedAt: new Date().toISOString() };
}

/** Video Prompts import: where would each pasted prompt go? (nothing is saved here) */
export type VideoImportItem = { seqs: number[]; title: string; prompt: string; target: string; targetLabel: string; hasPrompt: boolean };
export async function previewVideoImport(projectId: string, text: string): Promise<{ items: VideoImportItem[]; options: { value: string; label: string }[] }> {
  const { parseVideoPrompts } = await import('../video-import');
  const sections = parseVideoPrompts(text);
  const [clips, scenes, imgs] = await Promise.all([
    db.klingClip.findMany({ where: { projectId }, orderBy: { order: 'asc' }, include: { scenes: true, refs: true } }),
    db.scene.findMany({ where: { projectId }, orderBy: [{ pos: 'asc' }, { order: 'asc' }], select: { id: true, title: true, pos: true, order: true, inserted: true } }),
    db.plannedImage.findMany({ where: { projectId }, select: { id: true, seq: true, sceneId: true } }),
  ]);
  const lab = sceneLabels(scenes);
  const clipLabel = (k: (typeof clips)[number]) => `${klingCode(k.order)} · ${k.title}`;
  const items: VideoImportItem[] = sections.map(sec => {
    let target = '', targetLabel = '';
    for (const seq of sec.seqs) {
      const im = imgs.find(i => i.seq === seq); if (!im) continue;
      const k = clips.find(c => c.refs.some(r => r.imageId === im.id)) ?? clips.find(c => c.scenes.some(s => s.sceneId === im.sceneId));
      if (k) { target = `clip:${k.id}`; targetLabel = clipLabel(k); break; }
      const sc = scenes.find(s => s.id === im.sceneId);
      if (sc && !target) { target = `scene:${sc.id}`; targetLabel = `NEW clip for Scene ${lab.get(sc.id)} · ${sc.title}`; }
    }
    const k = target.startsWith('clip:') ? clips.find(c => c.id === target.slice(5)) : null;
    return { ...sec, target, targetLabel, hasPrompt: !!k?.finalPrompt.trim() };
  });
  const options = [...clips.map(k => ({ value: `clip:${k.id}`, label: clipLabel(k) })), ...scenes.filter(s => !clips.some(c => c.scenes.some(x => x.sceneId === s.id))).map(s => ({ value: `scene:${s.id}`, label: `NEW clip for Scene ${lab.get(s.id)} · ${s.title}` }))];
  return { items, options };
}

/** Video Prompts import: save the checked prompts into their clips (a clip is made for a scene that has none; old prompt text is kept as a version). */
export async function applyVideoImport(items: { target: string; prompt: string }[]): Promise<{ saved: number }> {
  let saved = 0;
  for (const it of items) {
    if (!it.target || !it.prompt.trim()) continue;
    let clipId = '';
    if (it.target.startsWith('clip:')) clipId = it.target.slice(5);
    else if (it.target.startsWith('scene:')) clipId = (await ensureClipForScene(it.target.slice(6))).clip.id;
    if (!clipId) continue;
    const old = await db.klingClip.findUniqueOrThrow({ where: { id: clipId } });
    await snapshotPrompt(clipId, old.finalPrompt, it.prompt, 'Imported on Video Prompts');
    await db.klingClip.update({ where: { id: clipId }, data: { finalPrompt: it.prompt, ...(old.status === 'PLANNED' ? { status: 'DRAFT' } : {}) } });
    saved++;
  }
  touch();
  return { saved };
}
