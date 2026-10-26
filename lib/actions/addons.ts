'use server';
import { revalidatePath } from 'next/cache';
import { db } from '../db';
import { type AddonKind, addonsFor, listAddons, parseIds, withAddons, withoutAddon, appliesTo } from '../addons';
import { versionPrompt } from '../prompt-versions';
import { logActivity } from '../activity';

const touch = () => revalidatePath('/', 'layout');
const clean = (t: string) => (t || '').replace(/\r/g, '').trim().slice(0, 2000);
const scope = (ids: string[]) => JSON.stringify(Array.from(new Set(ids.filter(Boolean))));

export async function createAddon(text: string, position: 'START' | 'END', projectIds: string[], kind: AddonKind = 'IMAGE'): Promise<{ id: string }> {
  const t = clean(text); if (!t) throw new Error('Type the sentence first');
  const r = await db.promptAddon.create({ data: { kind: kind === 'VIDEO' ? 'VIDEO' : 'IMAGE', text: t, position: position === 'START' ? 'START' : 'END', projectIds: scope(projectIds) } });
  touch(); return { id: r.id };
}
export async function updateAddon(id: string, patch: { text?: string; position?: 'START' | 'END'; projectIds?: string[]; enabled?: boolean }): Promise<void> {
  const data: Record<string, unknown> = {};
  if (patch.text !== undefined) { const t = clean(patch.text); if (!t) throw new Error('The sentence cannot be empty'); data.text = t; }
  if (patch.position) data.position = patch.position === 'START' ? 'START' : 'END';
  if (patch.projectIds) data.projectIds = scope(patch.projectIds);
  if (patch.enabled !== undefined) data.enabled = patch.enabled;
  await db.promptAddon.update({ where: { id }, data });
  touch();
}
export async function deleteAddon(id: string): Promise<void> { await db.promptAddon.delete({ where: { id } }).catch(() => undefined); touch(); }

type PromptRow = { id: string; fullPrompt: string; contPrompt: string; projectId: string };
async function eachPrompt(addonId: string | null, kind: AddonKind, fn: (img: PromptRow, addons: Awaited<ReturnType<typeof listAddons>>) => Promise<boolean>) {
  const all = await listAddons(kind);
  const use = addonId ? all.filter(a => a.id === addonId) : all;
  const projects = await db.project.findMany({ where: { deletedAt: null }, select: { id: true } });
  let changed = 0, same = 0;
  for (const p of projects) {
    const mine = use.filter(a => appliesTo(a, p.id));
    if (!mine.length) continue;
    const rows: PromptRow[] = kind === 'VIDEO'
      ? (await db.klingClip.findMany({ where: { projectId: p.id }, select: { id: true, finalPrompt: true, projectId: true } })).map(k => ({ id: k.id, fullPrompt: k.finalPrompt, contPrompt: '', projectId: k.projectId }))
      : await db.plannedImage.findMany({ where: { projectId: p.id }, select: { id: true, fullPrompt: true, contPrompt: true, projectId: true } });
    for (const i of rows) { if (await fn(i, mine)) changed++; else same++; }
  }
  return { changed, same };
}

/** How many prompts would change if this sentence (or all sentences) were added now? Nothing is changed. */
export async function previewAddons(addonId: string | null, kind: AddonKind = 'IMAGE'): Promise<{ changed: number; same: number }> {
  return eachPrompt(addonId, kind, async (i, a) => (i.fullPrompt.trim() && withAddons(i.fullPrompt, a) !== i.fullPrompt) || (i.contPrompt.trim() && withAddons(i.contPrompt, a) !== i.contPrompt) ? true : false);
}

/** Add the saved sentences to the picture prompts now (beginning or end as chosen for each). Each changed prompt keeps its old text as a version. */
export async function applyAddons(addonId: string | null, kind: AddonKind = 'IMAGE'): Promise<{ changed: number; same: number }> {
  const r = await eachPrompt(addonId, kind, async (i, a) => {
    const full = i.fullPrompt.trim() ? withAddons(i.fullPrompt, a) : i.fullPrompt, cont = i.contPrompt.trim() ? withAddons(i.contPrompt, a) : i.contPrompt;
    if (full === i.fullPrompt && cont === i.contPrompt) return false;
    if (kind === 'VIDEO') { await versionPrompt(i.id, 'KLING', i.fullPrompt, full, 'Sentence added to all video prompts'); await db.klingClip.update({ where: { id: i.id }, data: { finalPrompt: full } }); return true; }
    if (full !== i.fullPrompt) await versionPrompt(i.id, 'FULL', i.fullPrompt, full, 'Sentence added to all prompts');
    await db.plannedImage.update({ where: { id: i.id }, data: { fullPrompt: full, contPrompt: cont } });
    return true;
  });
  if (r.changed) await logActivity(`Sentence${addonId ? '' : 's'} added to ${r.changed} ${kind === 'VIDEO' ? 'video' : 'picture'} prompt${r.changed === 1 ? '' : 's'}`, null, null as any);
  touch();
  return r;
}

/** Take one sentence back out of the prompts it was added to. */
export async function removeAddonFromPrompts(addonId: string, kind: AddonKind = 'IMAGE'): Promise<{ changed: number }> {
  const a = (await listAddons(kind)).find(x => x.id === addonId); if (!a) return { changed: 0 };
  let changed = 0;
  if (kind === 'VIDEO') {
    const ks = await db.klingClip.findMany({ select: { id: true, projectId: true, finalPrompt: true } });
    for (const k of ks) {
      if (!(a.projectIds.length === 0 || a.projectIds.includes(k.projectId))) continue;
      const next = withoutAddon(k.finalPrompt, a.text);
      if (next === k.finalPrompt) continue;
      await versionPrompt(k.id, 'KLING', k.finalPrompt, next, 'Sentence taken out of video prompts');
      await db.klingClip.update({ where: { id: k.id }, data: { finalPrompt: next } });
      changed++;
    }
    touch();
    return { changed };
  }
  const imgs = await db.plannedImage.findMany({ select: { id: true, projectId: true, fullPrompt: true, contPrompt: true } });
  for (const i of imgs) {
    if (!(a.projectIds.length === 0 || a.projectIds.includes(i.projectId))) continue;
    const full = withoutAddon(i.fullPrompt, a.text), cont = withoutAddon(i.contPrompt, a.text);
    if (full === i.fullPrompt && cont === i.contPrompt) continue;
    if (full !== i.fullPrompt) await versionPrompt(i.id, 'FULL', i.fullPrompt, full, 'Sentence taken out of prompts');
    await db.plannedImage.update({ where: { id: i.id }, data: { fullPrompt: full, contPrompt: cont } });
    changed++;
  }
  touch();
  return { changed };
}
void parseIds; void addonsFor;
