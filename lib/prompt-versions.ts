import { db } from './db';

export async function versionPrompt(ownerId: string, type: string, oldText: string, newText: string, reason: string | null) {
  if (oldText === newText) return;
  const n = await db.promptVersion.count({ where: { ownerId, type } });
  if (n === 0 && oldText.trim()) await db.promptVersion.create({ data: { ownerId, type, version: 1, text: oldText, reason: 'Initial', active: false } });
  const base = n === 0 && oldText.trim() ? 1 : n;
  await db.promptVersion.updateMany({ where: { ownerId, type }, data: { active: false } });
  await db.promptVersion.create({ data: { ownerId, type, version: base + 1, text: newText, reason: reason || (base === 0 ? 'Initial' : 'Revision'), active: true } });
}
