'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '../db';
import { bool, str, strRaw } from '../util';
import { snapshotBible } from '../bible';
import { logActivity } from '../activity';

const touch = () => revalidatePath('/', 'layout');

export async function saveBibleSection(fd: FormData) {
  const key = str(fd, 'key')!;
  await db.bibleSection.update({ where: { key }, data: { content: strRaw(fd, 'content'), notes: str(fd, 'notes'), active: bool(fd, 'active'), ...(str(fd, 'title') ? { title: str(fd, 'title')! } : {}) } });
  const v = await snapshotBible(str(fd, 'versionNote') || `Edited "${key}"`);
  await logActivity(`Production Bible saved (v${v})`, '/settings/bible');
  touch();
}
export async function resetBibleSection(fd: FormData) {
  const s = await db.bibleSection.findUniqueOrThrow({ where: { key: str(fd, 'key')! } });
  await db.bibleSection.update({ where: { key: s.key }, data: { content: s.defaultContent } });
  await snapshotBible(`Reset "${s.key}" to default`);
  touch();
}
export async function moveBibleSection(fd: FormData) {
  const key = str(fd, 'key')!, dir = str(fd, 'dir') === 'up' ? -1 : 1;
  const all = await db.bibleSection.findMany({ orderBy: { order: 'asc' } });
  const i = all.findIndex(s => s.key === key), j = i + dir;
  if (j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  await db.$transaction(all.map((s, k) => db.bibleSection.update({ where: { id: s.id }, data: { order: k } })));
  touch();
}
export async function addBibleSection(fd: FormData) {
  const title = str(fd, 'title');
  if (!title) return;
  const n = await db.bibleSection.count();
  const key = `custom-${Date.now().toString(36)}`;
  await db.bibleSection.create({ data: { key, title, order: n } });
  await snapshotBible(`Added section "${title}"`);
  touch();
  redirect(`/settings/bible?s=${key}`);
}
export async function restoreBibleVersion(fd: FormData) {
  const v = await db.bibleVersion.findUniqueOrThrow({ where: { id: str(fd, 'id')! } });
  const snap = JSON.parse(v.snapshot) as { key: string; title: string; content: string; active: boolean; order: number; notes: string | null }[];
  for (const s of snap) {
    await db.bibleSection.upsert({ where: { key: s.key }, update: { title: s.title, content: s.content, active: s.active, order: s.order, notes: s.notes }, create: { key: s.key, title: s.title, content: s.content, defaultContent: '', active: s.active, order: s.order, notes: s.notes } });
  }
  await snapshotBible(`Restored version ${v.version}`);
  touch();
}

export async function saveOverrides(fd: FormData) {
  const projectId = str(fd, 'projectId')!;
  const data: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (k.startsWith('f:')) data[k.slice(2)] = String(v);
  await db.projectDoc.upsert({ where: { projectId_key: { projectId, key: 'overrides' } }, update: { data: JSON.stringify(data) }, create: { projectId, key: 'overrides', data: JSON.stringify(data) } });
  touch();
}
