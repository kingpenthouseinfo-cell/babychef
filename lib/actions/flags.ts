'use server';
import { revalidatePath } from 'next/cache';
import { db } from '../db';
import { redirect } from 'next/navigation';
import { str } from '../util';
import { approveLatest } from './generate';
import { uploadReference } from './babychef';

const touch = () => revalidatePath('/', 'layout');

/** Red flag on a picture or a scene: it then shows up in NEED TO FIX. Flagging again removes it. */
export async function toggleFlag(fd: FormData) {
  const kind = str(fd, 'kind'), id = str(fd, 'id')!;
  const on = str(fd, 'on');
  if (kind === 'scene') {
    const cur = await db.scene.findUniqueOrThrow({ where: { id } });
    const next = on ? on === '1' : !cur.flagged;
    await db.scene.update({ where: { id }, data: { flagged: next, flaggedAt: next ? new Date() : null, ...(next ? {} : { flagNote: null }) } });
  } else {
    const cur = await db.plannedImage.findUniqueOrThrow({ where: { id } });
    const next = on ? on === '1' : !cur.flagged;
    await db.plannedImage.update({ where: { id }, data: { flagged: next, flaggedAt: next ? new Date() : null, ...(next ? {} : { flagNote: null, fixHelpers: null }) } as any });
  }
  touch();
}

/** A short note on what needs fixing. */
export async function saveFlagNote(fd: FormData) {
  const kind = str(fd, 'kind'), id = str(fd, 'id')!, note = (str(fd, 'note') ?? '').trim() || null;
  if (kind === 'scene') await db.scene.update({ where: { id }, data: { flagNote: note } });
  else await db.plannedImage.update({ where: { id }, data: { flagNote: note } as any });
  touch();
}

/** Picture fixed: approve the newest uploaded picture, take the flag off and go to the next flagged picture. */
export async function resolveFlagged(fd: FormData) {
  const id = str(fd, 'id')!;
  const img = await db.plannedImage.findUniqueOrThrow({ where: { id }, include: { project: true } });
  if (img.status !== 'APPROVED') { const f = new FormData(); f.set('imageId', id); await approveLatest(f); }
  await db.plannedImage.update({ where: { id }, data: { flagged: false, flaggedAt: null, flagNote: null, fixHelpers: null } as any });
  touch();
  redirect(`/projects/${img.project.slug}/fix`);
}

/** NEED TO FIX: upload a helper picture by hand. It is saved as a project reference (so it stays available) and handed back to be ticked. */
export async function uploadFixHelper(fd: FormData): Promise<{ key: string; assetId: string; title: string }> {
  const projectId = str(fd, 'projectId')!;
  const file = fd.get('file') as File | null;
  if (!file || !file.size) throw new Error('Choose a picture');
  if (!/^image\//.test(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) throw new Error('Choose a PNG, JPG or WebP picture');
  const f = new FormData(); f.set('projectId', projectId); f.set('file', file); f.set('category', 'Other'); f.set('title', (str(fd, 'title') || file.name.replace(/\.[^.]+$/, '')).slice(0, 80));
  await uploadReference(f);
  const r = await db.reference.findFirstOrThrow({ where: { projectId, deletedAt: null }, orderBy: { createdAt: 'desc' } });
  return { key: `r:${r.id}`, assetId: r.assetId, title: r.title };
}

/** NEED TO FIX: remember which helper pictures are ticked and what each is for (so leaving the page loses nothing). */
export async function saveFixHelpers(imageId: string, picked: string[], notes: Record<string, string>): Promise<{ savedAt: string }> {
  const clean: Record<string, string> = {};
  for (const k of picked) if (typeof notes[k] === 'string' && notes[k].trim()) clean[k] = notes[k].slice(0, 500);
  await db.plannedImage.update({ where: { id: imageId }, data: { fixHelpers: JSON.stringify({ picked: picked.slice(0, 40), notes: clean }) } as any });
  return { savedAt: new Date().toISOString() };
}
