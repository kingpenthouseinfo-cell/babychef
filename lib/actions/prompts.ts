'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '../db';
import { bool, pickText, str, strRaw } from '../util';
import { versionPrompt } from '../prompt-versions';
import { buildVars, render, templateCodeFor } from '../template-engine';
import { contextBlock } from '../publishing';
import { PUBLISHING_PLAN, PUB_CONTEXT_FIELDS, DEFAULT_CHECKLIST } from '../constants';
import { logActivity } from '../activity';
import { parseJson } from '../util';

const touch = () => revalidatePath('/', 'layout');

// ---- templates
export async function saveTemplate(fd: FormData) {
  const id = str(fd, 'id');
  const data: any = { ...pickText(fd, ['name', 'category', 'purpose', 'description', 'cuisine']), text: strRaw(fd, 'text'), active: bool(fd, 'active') };
  if (!data.name) throw new Error('Template name is required');
  if (id) await db.promptTemplate.update({ where: { id }, data });
  else {
    const n = await db.promptTemplate.count();
    await db.promptTemplate.create({ data: { ...data, code: `TPL-U${String(n + 1).padStart(3, '0')}-${Date.now().toString(36)}`, isDefault: false } });
  }
  touch();
}
export async function duplicateTemplate(fd: FormData) {
  const t = await db.promptTemplate.findUniqueOrThrow({ where: { id: str(fd, 'id')! } });
  await db.promptTemplate.create({ data: { code: `TPL-U-${Date.now().toString(36)}`, name: `${t.name} (copy)`, category: t.category, purpose: t.purpose, description: t.description, text: t.text, isDefault: false, active: true } });
  touch();
}
export async function deleteTemplate(fd: FormData) {
  const t = await db.promptTemplate.findUniqueOrThrow({ where: { id: str(fd, 'id')! } });
  if (t.isDefault) await db.promptTemplate.update({ where: { id: t.id }, data: { active: false } });
  else await db.promptTemplate.delete({ where: { id: t.id } });
  touch();
}

// ---- project prompts
export async function saveProjectPrompt(fd: FormData) {
  const projectId = str(fd, 'projectId')!;
  await db.projectPrompt.create({ data: { projectId, name: str(fd, 'name') || 'Saved prompt', category: str(fd, 'category') || 'GENERAL', text: strRaw(fd, 'text'), templateId: str(fd, 'templateId') } });
  touch();
}
export async function deleteProjectPrompt(fd: FormData) { await db.projectPrompt.delete({ where: { id: str(fd, 'id')! } }); touch(); }

export async function applyPrompt(target: string, fd: FormData) {
  const id = str(fd, 'targetId')!, text = strRaw(fd, 'text');
  if (target === 'image-full' || target === 'image-cont') {
    const img = await db.plannedImage.findUniqueOrThrow({ where: { id }, include: { project: true } });
    const field = target === 'image-full' ? 'fullPrompt' : 'contPrompt';
    await versionPrompt(id, target === 'image-full' ? 'FULL' : 'CONTINUATION', (img as any)[field], text, 'From template');
    await db.plannedImage.update({ where: { id }, data: { [field]: text, promptStatus: img.promptStatus === 'NOT STARTED' ? 'DRAFT' : img.promptStatus, status: img.status === 'PLANNED' ? 'PROMPT DRAFT' : img.status } });
    touch(); redirect(`/projects/${img.project.slug}/images/${id}`);
  }
  if (target === 'kling') {
    const k = await db.klingClip.findUniqueOrThrow({ where: { id }, include: { project: true } });
    await versionPrompt(id, 'KLING', k.finalPrompt, text, 'From template');
    await db.klingClip.update({ where: { id }, data: { finalPrompt: text } });
    touch(); redirect(`/projects/${k.project.slug}/kling/${id}`);
  }
}

// ---- publishing
export async function createPublishingAssets(fd: FormData) {
  const projectId = str(fd, 'projectId')!;
  const ex = await db.publishingAsset.findMany({ where: { projectId } });
  let n = ex.length;
  for (const pl of PUBLISHING_PLAN) {
    if (ex.some(e => e.platform === pl.platform && e.assetType === pl.type)) continue;
    n++;
    await db.publishingAsset.create({ data: { projectId, platform: pl.platform, assetType: pl.type, code: `PUB-${String(n).padStart(3, '0')}` } });
  }
  touch();
}

export async function savePubContext(fd: FormData) {
  const projectId = str(fd, 'projectId')!;
  const data: Record<string, any> = { include: fd.getAll('include').map(String) };
  for (const k of ['Funny moments', 'Recipe highlights', 'Cooking techniques', 'Notes']) data[k] = strRaw(fd, `x:${k}`);
  await db.projectDoc.upsert({ where: { projectId_key: { projectId, key: 'pubctx' } }, update: { data: JSON.stringify(data) }, create: { projectId, key: 'pubctx', data: JSON.stringify(data) } });
  touch();
}

export async function preparePublishingPrompt(fd: FormData) {
  const id = str(fd, 'id')!;
  const a = await db.publishingAsset.findUniqueOrThrow({ where: { id } });
  const tpl = await db.promptTemplate.findUnique({ where: { code: templateCodeFor(a.platform, a.assetType) } });
  const vars = await buildVars(a.projectId);
  const body = tpl ? render(tpl.text, vars).out : '';
  const ctx = await contextBlock(a.projectId);
  const text = `${body}\n\nFOCUS ON: ${a.platform} — ${a.assetType}\n\nADDITIONAL CONTEXT\n${ctx}`.trim();
  const v = a.promptVersion + 1;
  await db.promptVersion.updateMany({ where: { ownerId: id, type: 'PUBLISHING' }, data: { active: false } });
  await db.promptVersion.create({ data: { ownerId: id, type: 'PUBLISHING', version: v, text, reason: 'Prepared from template', active: true } });
  await db.publishingAsset.update({ where: { id }, data: { prompt: text, promptVersion: v, status: a.status === 'NEEDS PROMPT' ? 'PROMPT READY' : a.status } });
  touch();
}
export async function savePublishingAsset(fd: FormData) {
  const id = str(fd, 'id')!;
  const old = await db.publishingAsset.findUniqueOrThrow({ where: { id } });
  const prompt = strRaw(fd, 'prompt');
  let promptVersion = old.promptVersion;
  if (prompt !== old.prompt && prompt.trim()) {
    promptVersion++;
    await db.promptVersion.updateMany({ where: { ownerId: id, type: 'PUBLISHING' }, data: { active: false } });
    await db.promptVersion.create({ data: { ownerId: id, type: 'PUBLISHING', version: promptVersion, text: prompt, reason: 'Edited', active: true } });
  }
  const returned = strRaw(fd, 'returned'), selected = strRaw(fd, 'selected');
  let status = str(fd, 'status') || old.status;
  if (status === old.status) { // auto-advance
    if (selected.trim() && ['NEEDS PROMPT', 'PROMPT READY', 'GENERATED', 'REVIEW'].includes(status)) status = 'SELECTED';
    else if (returned.trim() && ['NEEDS PROMPT', 'PROMPT READY'].includes(status)) status = 'GENERATED';
    else if (prompt.trim() && status === 'NEEDS PROMPT') status = 'PROMPT READY';
  }
  const pd = str(fd, 'publishedAt');
  await db.publishingAsset.update({ where: { id }, data: { prompt, promptVersion, returned, selected, status, notes: str(fd, 'notes'), publishedUrl: str(fd, 'publishedUrl'), publishedAt: status === 'PUBLISHED' ? (pd ? new Date(pd) : old.publishedAt ?? new Date()) : pd ? new Date(pd) : null } });
  if (status !== old.status) await logActivity(`${old.platform} ${old.assetType} → ${status}`, null, old.projectId);
  touch();
}
export async function deletePublishingAsset(fd: FormData) { await db.publishingAsset.delete({ where: { id: str(fd, 'id')! } }); touch(); }

export async function saveThumbnail(fd: FormData) {
  const projectId = str(fd, 'projectId')!;
  const data: Record<string, string> = {};
  for (const k of ['concept', 'text', 'refImageId', 'foodImageId', 'babyImageId', 'notes']) data[k] = strRaw(fd, k);
  await db.projectDoc.upsert({ where: { projectId_key: { projectId, key: 'thumbnail' } }, update: { data: JSON.stringify(data) }, create: { projectId, key: 'thumbnail', data: JSON.stringify(data) } });
  touch();
}

// ---- checklist
export async function toggleChecklist(fd: FormData) {
  const id = str(fd, 'id')!;
  const c = await db.checklistItem.findUniqueOrThrow({ where: { id } });
  await db.checklistItem.update({ where: { id }, data: { done: !c.done } });
  touch();
}
export async function addChecklist(fd: FormData) {
  const projectId = str(fd, 'projectId')!, label = str(fd, 'label');
  if (!label) return;
  const n = await db.checklistItem.count({ where: { projectId } });
  await db.checklistItem.create({ data: { projectId, label, group: str(fd, 'group') || 'Custom', order: n, custom: true } });
  touch();
}
export async function deleteChecklist(fd: FormData) { await db.checklistItem.delete({ where: { id: str(fd, 'id')! } }); touch(); }
void DEFAULT_CHECKLIST;
