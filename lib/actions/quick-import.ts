'use server';
import { planProjectImages } from '../image-gen';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '../db';
import { slugify } from '../util';
import { logActivity } from '../activity';
import { ensureChecklist, getSettings } from '../settings';
import { parseImport } from '../quick-import';
import { openImagePos, openScenePos, backfillPositions } from '../order';
import { syncQuestions } from '../questions';
import { autoAttachReferences } from '../auto-refs';
import { saveMethod } from '../recipe-store';
import { newProjectCode } from '../project-codes';

export type Choice = 'KEEP' | 'REPLACE' | 'MERGE';
export type ApplyInput = { text: string; slug: string | null; choices: Record<string, Choice>; chef: string }; // chef: existing id | 'NEW' | ''

const join = (a: string, b: string) => (a.includes(b.trim()) ? a : `${a}\n${b}`);

export async function applyImport(input: ApplyInput) {
  const parsed = parseImport(input.text);
  if (!parsed.found.length) throw new Error('Nothing to import');
  const created: string[] = [], skipped: string[] = [];
  // ---- project (existing or new)
  let project = input.slug ? await db.project.findUnique({ where: { slug: input.slug } }) : null;
  let chefId: string | null = input.chef && input.chef !== 'NEW' ? input.chef : null;
  if (input.chef === 'NEW' && parsed.babyChef) {
    const base = slugify(parsed.babyChef) || 'baby-chef'; let slug = base, n = 1;
    while (await db.babyChef.findUnique({ where: { slug } })) slug = `${base}-${++n}`;
    const c = await db.babyChef.create({ data: { displayName: parsed.babyChef, slug, cuisine: parsed.fields.cuisine ?? null } });
    chefId = c.id; created.push(`Baby Chef “${c.displayName}”`);
  }
  if (!project) {
    const title = parsed.fields.title || parsed.fields.recipeName || 'New recipe video';
    const s = await getSettings();
    let slug = slugify(title), n = 1;
    while (await db.project.findUnique({ where: { slug } })) slug = `${slugify(title)}-${++n}`;
    project = await db.project.create({ data: { title, slug, code: await newProjectCode(parsed.fields.recipeName || title), recipeName: parsed.fields.recipeName || title, babyChefId: chefId, aspectRatio: s.defaultAspect, verticalCrop: s.defaultVerticalCrop === 'true', status: s.defaultProjectStatus } as any });
    await ensureChecklist(project.id);
    await db.projectDoc.create({ data: { projectId: project.id, key: 'continuity', data: '{}' } });
    created.push(`Recipe video “${title}”`);
  } else if (chefId && !project.babyChefId) { await db.project.update({ where: { id: project.id }, data: { babyChefId: chefId } }); created.push('Baby Chef chosen'); }
  const pid = project.id;
  const cur: any = await db.project.findUniqueOrThrow({ where: { id: pid } });
  // ---- plain fields with KEEP / REPLACE / MERGE for values that already exist
  const data: any = {};
  for (const [k, v] of Object.entries(parsed.fields)) {
    if (!v || k === 'title') continue;
    const old = (cur[k] ?? '') as string;
    if (!old.trim()) { data[k] = v; created.push(k); continue; }
    if (old.trim() === v.trim()) continue;
    const ch = input.choices[k] ?? 'KEEP';
    if (ch === 'REPLACE') { data[k] = v; created.push(`${k} replaced`); } else if (ch === 'MERGE') { data[k] = join(old, v); created.push(`${k} merged`); } else skipped.push(`${k} (kept yours)`);
  }
  const recipeText = [parsed.recipe, parsed.method ? `METHOD:\n${parsed.method}` : ''].filter(Boolean).join('\n\n');
  if (recipeText) {
    const old = (cur.recipeOriginal ?? '') as string;
    if (!old.trim()) { data.recipeOriginal = recipeText; created.push('Recipe'); }
    else if (old.trim() !== recipeText.trim()) {
      const ch = input.choices.recipe ?? 'KEEP';
      if (ch === 'REPLACE') { await db.recipeVersion.create({ data: { projectId: pid, version: cur.recipeVersion, original: cur.recipeOriginal, adapted: cur.recipeAdapted, notes: cur.recipeNotes } }); data.recipeOriginal = recipeText; data.recipeVersion = cur.recipeVersion + 1; created.push('Recipe replaced (old version saved)'); }
      else if (ch === 'MERGE') { data.recipeOriginal = `${old}\n\n${recipeText}`; created.push('Recipe merged'); } else skipped.push('Recipe (kept yours)');
    }
  }
  if (Object.keys(data).length) await db.project.update({ where: { id: pid }, data });
  // ---- ingredients (append; same name is skipped, never duplicated)
  if (parsed.ingredients.length) {
    const have = new Set((await db.ingredient.findMany({ where: { projectId: pid }, select: { name: true } })).map(i => i.name.toLowerCase()));
    let order = ((await db.ingredient.aggregate({ where: { projectId: pid }, _max: { order: true } }))._max.order ?? -1) + 1, added = 0;
    for (const i of parsed.ingredients) {
      if (have.has(i.name.toLowerCase())) { skipped.push(`Ingredient “${i.name}” (already there)`); continue; }
      await db.ingredient.create({ data: { projectId: pid, order: order++, name: i.name, quantity: i.quantity ?? null, unit: i.unit ?? null, prepNote: i.prepNote ?? null, brand: i.brand ?? null, packageSize: i.package ?? null, group: i.group ?? null, original: i.original, importance: i.importance ?? 'OPTIONAL', notes: i.uncertain ? `Original text: ${i.original}` : null } as any });
      have.add(i.name.toLowerCase()); added++;
    }
    if (added) created.push(`${added} ingredient${added > 1 ? 's' : ''}`);
  }
  // ---- scenes + pictures (always added after what you have; same title is skipped)
  await backfillPositions();
  const scenesIn = [...parsed.scenes];
  if (parsed.strayImages.length) scenesIn.push({ title: 'Imported pictures', images: parsed.strayImages });
  for (const s of scenesIn) {
    let sc = await db.scene.findFirst({ where: { projectId: pid, title: s.title } });
    if (sc && s.title !== 'Imported pictures') skipped.push(`Scene “${s.title}” (already there)`);
    if (!sc) {
      const order = ((await db.scene.aggregate({ where: { projectId: pid }, _max: { order: true } }))._max.order ?? 0) + 1;
      const pos = await openScenePos(pid);
      const { images, title, ...rest } = s;
      sc = await db.scene.create({ data: { projectId: pid, order, pos, title, ...rest } as any });
      created.push(`Scene “${title}”`);
    }
    for (const im of s.images) {
      if (await db.plannedImage.findFirst({ where: { sceneId: sc.id, title: im.title } })) { skipped.push(`Picture “${im.title}” (already there)`); continue; }
      const seq = ((await db.plannedImage.aggregate({ where: { projectId: pid }, _max: { seq: true } }))._max.seq ?? 0) + 1;
      const pos = await openImagePos(sc.id);
      const made = await db.plannedImage.create({ data: { projectId: pid, sceneId: sc.id, seq, pos, title: im.title.slice(0, 140), purpose: im.purpose ?? null, fullPrompt: im.fullPrompt ?? '', contPrompt: im.contPrompt ?? '', ...(im.shotType ? { shotType: im.shotType.toUpperCase() } : {}), foodState: im.foodState ?? null, cameraAngle: im.cameraAngle ?? null, mustBeVisible: im.mustBeVisible ?? null, mustNotAppear: im.mustNotAppear ?? null } as any });
      await autoAttachReferences(made.id);
      created.push(`Picture “${im.title}”`);
    }
  }
  if (scenesIn.length) { const n = await planProjectImages(pid); if (n) created.push(`${n} picture${n === 1 ? '' : 's'} planned automatically`); }
  if (parsed.recipeStructured?.sections.length) { await saveMethod(pid, parsed.recipeStructured.sections); created.push(`Method (${parsed.recipeStructured.counts.sections} sections)`); }
  if (parsed.publishing) { await db.projectNote.create({ data: { projectId: pid, category: 'Publishing', content: parsed.publishing } }); created.push('Publishing notes'); }
  // ---- history + follow-up questions for blanks
  const doc = await db.projectDoc.findUnique({ where: { projectId_key: { projectId: pid, key: 'importHistory' } } });
  const list = (() => { try { return JSON.parse(doc?.data || '{}').items ?? []; } catch { return []; } })();
  list.unshift({ at: new Date().toISOString(), created, skipped, warnings: parsed.warnings, chars: input.text.length });
  const json = JSON.stringify({ items: list.slice(0, 20) });
  await db.projectDoc.upsert({ where: { projectId_key: { projectId: pid, key: 'importHistory' } }, create: { projectId: pid, key: 'importHistory', data: json }, update: { data: json } });
  await syncQuestions(pid);
  await logActivity(`Filled from text: ${created.length} things added`, `/projects/${project.slug}`, pid);
  revalidatePath('/', 'layout');
  redirect(`/projects/${project.slug}?filled=1`);
}
