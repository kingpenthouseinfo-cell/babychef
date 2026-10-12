'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '../db';
import { str, strRaw, parseJson } from '../util';
import { versionPrompt } from '../prompt-versions';
import { parseScenes, toSceneData, ParsedScene } from '../import';
import { logActivity } from '../activity';

const touch = () => revalidatePath('/', 'layout');

/** SAVE VERSION — stores the (possibly user-edited) prompt with full build metadata. */
export async function savePromptVersion(fd: FormData) {
  const projectId = str(fd, 'projectId')!;
  const meta = parseJson<Record<string, any>>(strRaw(fd, 'meta'), {});
  const text = strRaw(fd, 'text');
  const original = strRaw(fd, 'original');
  const purpose = String(meta.purpose || 'PROMPT');
  const n = await db.projectPrompt.count({ where: { projectId, category: purpose } });
  const link = meta.imageId ? `${meta.imageId}` : meta.klingId ? `${meta.klingId}` : '';
  const sameLink = link ? (await db.projectPrompt.findMany({ where: { projectId, category: purpose } })).filter(p => (p.meta || '').includes(link)).length : n;
  const label = (str(fd, 'label') || purpose);
  meta.userEdited = text.trim() !== original.trim();
  meta.finalText = true;
  await db.projectPrompt.create({ data: { projectId, name: `${label} v${sameLink + 1}`, category: purpose, text, meta: JSON.stringify(meta) } });
  await logActivity(`${purpose} saved (v${sameLink + 1})`, null, projectId);
  touch();
}
export async function saveResult(fd: FormData) {
  await db.projectPrompt.update({ where: { id: str(fd, 'id')! }, data: { result: strRaw(fd, 'result') } });
  touch();
}
export async function deleteSavedPrompt(fd: FormData) { await db.projectPrompt.delete({ where: { id: str(fd, 'id')! } }); touch(); }

/** Use the pasted-back AI result where it belongs (image prompt, Kling prompt, new script version). */
export async function applyResult(fd: FormData) {
  const sp = await db.projectPrompt.findUniqueOrThrow({ where: { id: str(fd, 'id')! }, include: { project: true } });
  const to = str(fd, 'to')!;
  const meta = parseJson<Record<string, any>>(sp.meta, {});
  const result = (sp.result || '').trim();
  if (!result) throw new Error('Paste the AI result first.');
  if (to === 'image-full' || to === 'image-cont') {
    const img = await db.plannedImage.findUniqueOrThrow({ where: { id: meta.imageId } });
    const field = to === 'image-full' ? 'fullPrompt' : 'contPrompt';
    await versionPrompt(img.id, to === 'image-full' ? 'FULL' : 'CONTINUATION', (img as any)[field], result, 'From AI result (Production Brain)');
    await db.plannedImage.update({ where: { id: img.id }, data: { [field]: result, promptStatus: img.promptStatus === 'NOT STARTED' ? 'DRAFT' : img.promptStatus, status: img.status === 'PLANNED' ? 'PROMPT DRAFT' : img.status } });
    touch(); redirect(`/projects/${sp.project.slug}/images/${img.id}`);
  }
  if (to === 'kling') {
    const k = await db.klingClip.findUniqueOrThrow({ where: { id: meta.klingId } });
    await versionPrompt(k.id, 'KLING', k.finalPrompt, result, 'From AI result (Production Brain)');
    await db.klingClip.update({ where: { id: k.id }, data: { finalPrompt: result, status: k.status === 'PLANNED' ? 'DRAFT' : k.status } });
    touch(); redirect(`/projects/${sp.project.slug}/kling/${k.id}`);
  }
  if (to === 'script') {
    const max = await db.scriptVersion.aggregate({ where: { projectId: sp.projectId }, _max: { version: true } });
    const v = (max._max.version ?? 0) + 1;
    await db.scriptVersion.create({ data: { projectId: sp.projectId, version: v, content: result, notes: `From AI result (${sp.name})`, isCurrent: v === 1 } });
    touch(); redirect(`/projects/${sp.project.slug}/script`);
  }
}

// ---- structured scene import (preview first, never destructive)
export async function previewScenes(_prev: unknown, fd: FormData): Promise<{ scenes: ParsedScene[]; error?: string }> {
  const scenes = parseScenes(strRaw(fd, 'text'));
  return scenes.length ? { scenes } : { scenes: [], error: 'No scenes were found. The text needs headings like "### SCENE 01 — Title" followed by labelled lines (PURPOSE:, FOOD STATE BEFORE:, ...). You can still add scenes manually.' };
}
export async function importScenes(fd: FormData) {
  const projectId = str(fd, 'projectId')!;
  const all = parseJson<ParsedScene[]>(strRaw(fd, 'scenes'), []);
  const picked = fd.getAll('pick').map(Number);
  const max = await db.scene.aggregate({ where: { projectId }, _max: { order: true } });
  let order = max._max.order ?? 0;
  for (const i of picked) {
    const s = all[i]; if (!s) continue;
    await db.scene.create({ data: { ...toSceneData(s), projectId, order: ++order } as any });
  }
  const p = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  await logActivity(`${picked.length} scene(s) imported from text`, `/projects/${p.slug}/scenes`, projectId);
  touch();
  redirect(`/projects/${p.slug}/scenes`);
}
