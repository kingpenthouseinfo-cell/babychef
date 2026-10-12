import { db } from './db';

export async function versionPrompt(ownerId: string, type: string, oldText: string, newText: string, reason: string | null) {
  if (oldText === newText) return;
  const n = await db.promptVersion.count({ where: { ownerId, type } });
  if (n === 0 && oldText.trim()) await db.promptVersion.create({ data: { ownerId, type, version: 1, text: oldText, reason: 'Initial', active: false } });
  const base = n === 0 && oldText.trim() ? 1 : n;
  await db.promptVersion.updateMany({ where: { ownerId, type }, data: { active: false } });
  await db.promptVersion.create({ data: { ownerId, type, version: base + 1, text: newText, reason: reason || (base === 0 ? 'Initial' : 'Revision'), active: true } });
}

/** Make the current Full/Continuation text a numbered prompt version (only if it differs from the latest version). */
export async function snapshotPrompts(imageId: string, reason: string | null) {
  const img = await db.plannedImage.findUniqueOrThrow({ where: { id: imageId } });
  for (const [type, text] of [['FULL', img.fullPrompt], ['CONTINUATION', img.contPrompt]] as const) {
    if (!text.trim()) continue;
    const last = await db.promptVersion.findFirst({ where: { ownerId: imageId, type }, orderBy: { version: 'desc' } });
    if (last && last.text === text) { if (!last.active) { await db.promptVersion.updateMany({ where: { ownerId: imageId, type }, data: { active: false } }); await db.promptVersion.update({ where: { id: last.id }, data: { active: true } }); } continue; }
    await db.promptVersion.updateMany({ where: { ownerId: imageId, type }, data: { active: false } });
    await db.promptVersion.create({ data: { ownerId: imageId, type, version: (last?.version ?? 0) + 1, text, reason: reason || (last ? 'Revision' : 'Initial'), active: true } });
  }
}
