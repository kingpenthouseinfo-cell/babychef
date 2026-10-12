import { db } from './db';
import type { MethodSection } from './recipe-parse';

/** The structured Method lives in a project document so the Recipe page never has to guess from raw text. */
export async function saveMethod(projectId: string, sections: MethodSection[]) {
  const data = JSON.stringify({ sections, at: new Date().toISOString() });
  await db.projectDoc.upsert({ where: { projectId_key: { projectId, key: 'recipeMethod' } }, create: { projectId, key: 'recipeMethod', data }, update: { data } });
}
export async function loadMethod(projectId: string): Promise<MethodSection[] | null> {
  const d = await db.projectDoc.findUnique({ where: { projectId_key: { projectId, key: 'recipeMethod' } } });
  if (!d) return null;
  try { const j = JSON.parse(d.data || '{}'); return Array.isArray(j.sections) ? j.sections : null; } catch { return null; }
}

import { parseRecipeText } from './recipe-parse';
/** Apply a parsed recipe to a project: create missing ingredient records (never deletes), fill the group on ones already there, save the structured method. */
export async function applyRecipeText(projectId: string, text: string): Promise<{ added: number; sections: number }> {
  const rp = parseRecipeText(text);
  const have = new Map((await db.ingredient.findMany({ where: { projectId } })).map(i => [i.name.toLowerCase(), i]));
  let order = ((await db.ingredient.aggregate({ where: { projectId }, _max: { order: true } }))._max.order ?? -1) + 1, added = 0;
  for (const g of rp.groups) for (const i of g.items) {
    const ex = have.get(i.name.toLowerCase());
    if (ex) { if (!ex.group || !ex.original) await db.ingredient.update({ where: { id: ex.id }, data: { group: ex.group ?? g.name, original: ex.original ?? i.original } }); continue; }
    const made = await db.ingredient.create({ data: { projectId, order: order++, name: i.name, quantity: i.quantity ?? null, unit: i.unit ?? null, prepNote: i.prepNote ?? null, brand: i.brand ?? null, packageSize: i.package ?? null, group: g.name, original: i.original, importance: i.importance ?? 'OPTIONAL', notes: i.uncertain ? `Original text: ${i.original}` : null } });
    have.set(i.name.toLowerCase(), made); added++;
  }
  const cur = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  const data: any = {};
  if (rp.yield && (!cur.recipeYield || /ingredients?\s*:?$/i.test(cur.recipeYield) || /^[A-Z ]+:?$/.test(cur.recipeYield))) data.recipeYield = rp.yield;
  if (Object.keys(data).length) await db.project.update({ where: { id: projectId }, data });
  if (rp.sections.length) await saveMethod(projectId, rp.sections);
  return { added, sections: rp.counts.sections };
}
