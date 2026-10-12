import { db } from './db';
import { DEFAULT_SETTINGS, DEFAULT_CHECKLIST } from './constants';
import { DEFAULT_TEMPLATES } from './default-templates';

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await db.setting.findMany();
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}
export async function setSetting(key: string, value: string) {
  await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

/** Idempotent: make sure default templates exist (never overwrites user edits). */
export async function ensureDefaults() {
  const n = await db.promptTemplate.count({ where: { isDefault: true } });
  if (n >= DEFAULT_TEMPLATES.length) return;
  for (const t of DEFAULT_TEMPLATES) {
    const ex = await db.promptTemplate.findUnique({ where: { code: t.code } });
    if (!ex) await db.promptTemplate.create({ data: { ...t, isDefault: true } });
  }
}

export async function ensureChecklist(projectId: string) {
  const n = await db.checklistItem.count({ where: { projectId } });
  if (n > 0) return;
  await db.checklistItem.createMany({ data: DEFAULT_CHECKLIST.map(([group, label], i) => ({ projectId, group, label, order: i })) });
}
