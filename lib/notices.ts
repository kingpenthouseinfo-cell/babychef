import { db } from './db';

/** Small "do you want to…?" notices saved per project (stored in the ProjectDoc 'notices'). Never applied silently. */
export type Notice = { id: string; kind: 'PREV_PICTURE' | 'CLIP_ADD'; text: string; imageId: string; targetId: string; createdAt: number };

export async function getNotices(projectId: string): Promise<Notice[]> {
  const d = await db.projectDoc.findUnique({ where: { projectId_key: { projectId, key: 'notices' } } });
  try { return (JSON.parse(d?.data || '{}').items ?? []) as Notice[]; } catch { return []; }
}
export async function setNotices(projectId: string, items: Notice[]) {
  await db.projectDoc.upsert({ where: { projectId_key: { projectId, key: 'notices' } }, create: { projectId, key: 'notices', data: JSON.stringify({ items }) }, update: { data: JSON.stringify({ items }) } });
}
export async function addNotice(projectId: string, n: Omit<Notice, 'id' | 'createdAt'>) {
  const all = await getNotices(projectId);
  if (all.some(x => x.kind === n.kind && x.imageId === n.imageId && x.targetId === n.targetId)) return;
  await setNotices(projectId, [...all, { ...n, id: Math.random().toString(36).slice(2, 10), createdAt: Date.now() }]);
}
