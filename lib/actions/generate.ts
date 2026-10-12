'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '../db';
import { str, bool } from '../util';
import { planScene } from '../image-plan';
import { planProjectImages, writePromptFor } from '../image-gen';
import { SCENE_ORDER, backfillPositions } from '../order';
import { autoAttachReferences } from '../auto-refs';
import { versionPrompt } from '../prompt-versions';
import { logActivity } from '../activity';
import { approveAttempt, redoAttempt, uploadResult } from './image';

const touch = () => revalidatePath('/', 'layout');
const back = async (projectId: string, hash = '') => `/projects/${(await db.project.findUniqueOrThrow({ where: { id: projectId } })).slug}/generate${hash}`;

/** Create the image plan for scenes that have no pictures yet (or `sceneId` only), and write every prompt. Never touches existing pictures. */
export async function planImages(fd: FormData) {
  const projectId = str(fd, 'projectId')!;
  await backfillPositions();
  await planProjectImages(projectId, str(fd, 'sceneId'));
  touch();
  redirect(await back(projectId));
}

/** Rewrite one picture's prompt from the current scene information (old text is kept as a version). */
export async function rewritePrompt(fd: FormData) {
  const img = await db.plannedImage.findUniqueOrThrow({ where: { id: str(fd, 'imageId')! } });
  await writePromptFor(img.id, 'Rewritten from the scene');
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
