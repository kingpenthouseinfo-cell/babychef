import { db } from './db';
import { projectFolder } from './files';
import { storage } from './storage';
import { imageCode, klingCode, parseJson, sceneCode, slugify } from './util';
import { CONTINUITY_FIELDS } from './constants';

export type TextFile = { path: string; content: string };

/** Human-readable text files derived from the database (scripts, prompts, publishing copy, scenes...). */
export async function collectTextFiles(projectId: string): Promise<TextFile[]> {
  const p = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      babyChef: true, ingredients: { orderBy: { order: 'asc' } }, scripts: { orderBy: { version: 'asc' } },
      scenes: { orderBy: [{ pos: 'asc' }, { order: 'asc' }], include: { images: { orderBy: [{ pos: 'asc' }, { seq: 'asc' }] } } }, clips: { orderBy: { order: 'asc' } },
      publishing: true, docs: true, short: { include: { items: { orderBy: { order: 'asc' } } } }, prompts: { orderBy: { createdAt: 'asc' } },
    },
  });
  const out: TextFile[] = [];
  const f = (path: string, content: string | null | undefined) => { if (content && content.trim()) out.push({ path, content }); };
  f('recipe.txt', [p.recipeName || p.title, p.recipeSource ? `Source: ${p.recipeSource}` : null, '', p.recipeAdapted || p.recipeOriginal].filter((v): v is string => typeof v === 'string').join('\n'));
  f('ingredients.txt', p.ingredients.map(i => `${[i.quantity, i.unit, i.name].filter(Boolean).join(' ')}${i.prepNote ? ', ' + i.prepNote : ''}${i.brand ? ` [${i.brand}]` : ''}`).join('\n'));
  for (const s of p.scripts) f(`05 Prompts/script/${p.slug}_script_v${s.version}${s.isCurrent ? '_CURRENT' : ''}.txt`, s.content);
  for (const sc of p.scenes) for (const i of sc.images) {
    const base = `${p.slug}_${sceneCode(sc.order)}_${imageCode(i.seq)}`;
    f(`05 Prompts/images/${base}_full-prompt.txt`, i.fullPrompt); f(`05 Prompts/images/${base}_continuation-prompt.txt`, i.contPrompt);
  }
  for (const k of p.clips) f(`05 Prompts/kling/${p.slug}_${klingCode(k.order)}_prompt.txt`, k.finalPrompt);
  for (const sp of p.prompts) f(`05 Prompts/production-brain/${slugify(sp.name)}.txt`, sp.text + (sp.result ? `\n\n===== RESULT PASTED BACK =====\n${sp.result}` : ''));
  const byPlat = new Map<string, string[]>();
  for (const a of p.publishing) {
    const body = a.selected || a.returned || a.prompt;
    if (!body.trim()) continue;
    byPlat.set(a.platform, [...(byPlat.get(a.platform) ?? []), `## ${a.assetType} [${a.status}]${a.selected ? '' : ' (not yet selected)'}\n${body}\n`]);
  }
  for (const [pl, parts] of byPlat) f(`06 Publishing/${slugify(pl)}.txt`, parts.join('\n'));
  f('production/scenes.txt', p.scenes.map(s => `${sceneCode(s.order)} ${s.title}\n  BEFORE: ${s.foodBefore || ''}\n  DURING: ${s.foodDuring || ''}\n  AFTER: ${s.foodAfter || ''}\n  Dialogue: ${s.dialogue || ''}`).join('\n\n'));
  const cont = parseJson<Record<string, string>>(p.docs.find(d => d.key === 'continuity')?.data, {});
  f('production/continuity.txt', CONTINUITY_FIELDS.filter(k => cont[k]?.trim()).map(k => `${k}: ${cont[k]}`).join('\n'));
  if (p.short) f('production/short-version.txt', [`Hook: ${p.short.hook || ''}`, ...p.short.items.map((it, n) => `${n + 1}. (${it.seconds}s) ${it.visual || ''} ${it.dialogue ? '— "' + it.dialogue + '"' : ''}`), `Ending: ${p.short.endVisual || ''} ${p.short.endDialogue || ''}`].join('\n'));
  return out;
}

/** Write the derived text files into the project's folder on disk so it is self-explanatory without the app. */
export async function writeProjectTextFiles(projectId: string) {
  const folder = await projectFolder(projectId);
  const files = await collectTextFiles(projectId);
  for (const t of files) {
    const rel = t.path.startsWith('05 ') || t.path.startsWith('06 ') ? t.path : `00 Project Info/${t.path}`;
    await storage.put(`${folder}/${rel}`, Buffer.from(t.content, 'utf8'));
  }
  return { count: files.length, folder, root: await storage.root() };
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const esc = (v: unknown) => { const s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [keys.join(','), ...rows.map(r => keys.map(k => esc(r[k])).join(','))].join('\n');
}
