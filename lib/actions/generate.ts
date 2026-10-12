'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '../db';
import { str, bool } from '../util';
import { planScene } from '../image-plan';
import { composePromptFor } from '../image-gen';
import { SCENE_ORDER, backfillPositions } from '../order';
import { autoAttachReferences } from '../auto-refs';
import { versionPrompt } from '../prompt-versions';
import { logActivity } from '../activity';
import { approveAttempt, redoAttempt, uploadResult } from './image';

const touch = () => revalidatePath('/', 'layout');
const back = async (projectId: string, hash = '') => `/projects/${(await db.project.findUniqueOrThrow({ where: { id: projectId } })).slug}/generate${hash}`;

async function writeFor(imageId: string, reason: string) {
  const img = await db.plannedImage.findUniqueOrThrow({ where: { id: imageId } });
  if (img.promptStatus === 'LOCKED') return;
  const text = await composePromptFor(imageId);
  await versionPrompt(imageId, 'FULL', img.fullPrompt ?? '', text, reason);
  await db.plannedImage.update({ where: { id: imageId }, data: { fullPrompt: text, promptStatus: 'READY', ...(img.status === 'PLANNED' || img.status === 'PROMPT DRAFT' ? { status: 'READY' } : {}) } });
}

/** Create the image plan for scenes that have no pictures yet (or `sceneId` only), and write every prompt. Never touches existing pictures. */
export async function planImages(fd: FormData) {
  const projectId = str(fd, 'projectId')!, only = str(fd, 'sceneId');
  await backfillPositions();
  const scenes = await db.scene.findMany({ where: { projectId, ...(only ? { id: only } : {}) }, orderBy: [...SCENE_ORDER], include: { images: true } });
  let made = 0;
  const newIds: string[] = [];
  for (const sc of scenes) {
    if (!only && sc.images.length) continue;
    const have = new Set(sc.images.map(i => i.title.toLowerCase()));
    let pos = sc.images.reduce((m, i) => Math.max(m, i.pos), 0);
    for (const a of planScene(sc as any)) {
      if (have.has(a.title.toLowerCase())) continue;
      const max = await db.plannedImage.aggregate({ where: { projectId }, _max: { seq: true } });
      const img = await db.plannedImage.create({ data: { projectId, sceneId: sc.id, seq: (max._max.seq ?? 0) + 1, pos: ++pos, title: a.title.slice(0, 140), purpose: a.text, why: a.why, foodState: a.foodState || null, shotType: a.shotType, cropImportance: a.crop, autoPlanned: true } as any });
      newIds.push(img.id); made++;
    }
  }
  // dependency chain + references + prompts after all pictures exist (the prompts mention the picture before them)
  const order = await db.plannedImage.findMany({ where: { projectId }, orderBy: [{ scene: { pos: 'asc' } }, { pos: 'asc' }, { seq: 'asc' }] });
  for (let k = 1; k < order.length; k++) if (newIds.includes(order[k].id)) await db.plannedImage.update({ where: { id: order[k].id }, data: { dependsOnId: order[k - 1].id } });
  for (const id of newIds) { await autoAttachReferences(id); await writeFor(id, 'Written automatically from the scene'); }
  await logActivity(`Image plan: ${made} picture${made === 1 ? '' : 's'} planned`, null, projectId);
  touch();
  redirect(await back(projectId));
}

/** Rewrite one picture's prompt from the current scene information (old text is kept as a version). */
export async function rewritePrompt(fd: FormData) {
  const img = await db.plannedImage.findUniqueOrThrow({ where: { id: str(fd, 'imageId')! } });
  await writeFor(img.id, 'Rewritten from the scene');
  touch();
}

/** Upload a generated picture straight onto this picture card. */
export async function uploadToCard(fd: FormData) {
  await uploadResult(fd);
  touch();
}

export async function approveLatest(fd: FormData) {
  const imageId = str(fd, 'imageId')!;
  const a = await db.attempt.findFirst({ where: { imageId, status: { in: ['REVIEW', 'REDO', 'APPROVED'] } }, orderBy: { number: 'desc' } });
  if (!a) throw new Error('Upload the picture first');
  const f = new FormData(); f.set('attemptId', a.id);
  await approveAttempt(f);
}
export async function needsRevision(fd: FormData) {
  const imageId = str(fd, 'imageId')!;
  const a = await db.attempt.findFirst({ where: { imageId, status: { in: ['REVIEW', 'APPROVED'] } }, orderBy: { number: 'desc' } });
  if (!a) throw new Error('Upload the picture first');
  const f = new FormData(); f.set('attemptId', a.id); f.set('wrong', str(fd, 'wrong') ?? 'Needs revision'); f.set('corrCategory', 'Other');
  await redoAttempt(f);
}
void bool;
