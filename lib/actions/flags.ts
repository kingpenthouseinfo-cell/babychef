'use server';
import { revalidatePath } from 'next/cache';
import { db } from '../db';
import { redirect } from 'next/navigation';
import { str } from '../util';
import { approveLatest } from './generate';

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
    await db.plannedImage.update({ where: { id }, data: { flagged: next, flaggedAt: next ? new Date() : null, ...(next ? {} : { flagNote: null }) } as any });
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
  await db.plannedImage.update({ where: { id }, data: { flagged: false, flaggedAt: null, flagNote: null } as any });
  touch();
  redirect(`/projects/${img.project.slug}/fix`);
}
