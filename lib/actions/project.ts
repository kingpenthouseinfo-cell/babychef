'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '../db';
import { bool, pickText, slugify, str, int, strRaw } from '../util';
import { logActivity } from '../activity';
import { ensureChecklist, getSettings } from '../settings';
import { PROJECT_STATUSES } from '../constants';
import { parseIngredientLines } from '../ingredient-parse';
import { uploadReference } from './babychef';

export async function createProject(fd: FormData) {
  const title = str(fd, 'title');
  if (!title) throw new Error('Project title is required');
  const s = await getSettings();
  let slug = slugify(str(fd, 'slug') || title), n = 1;
  while (await db.project.findUnique({ where: { slug } })) slug = `${slugify(str(fd, 'slug') || title)}-${++n}`;
  const p = await db.project.create({
    data: {
      title, slug, recipeName: str(fd, 'recipeName') || title, ...pickText(fd, ['cuisine', 'description', 'mainHook', 'finishedFood', 'ctaCustom', 'babyChefId', 'longDuration', 'shortDuration', 'recipeSource', 'recipeNotes', 'recipeOriginal']),
      ...(str(fd, 'kitchen') ? { recipeNotes: `Kitchen: ${str(fd, 'kitchen')}` } : {}),
      aspectRatio: str(fd, 'aspectRatio') || s.defaultAspect, verticalCrop: fd.has('verticalCrop') ? bool(fd, 'verticalCrop') : s.defaultVerticalCrop === 'true',
      status: str(fd, 'status') || s.defaultProjectStatus,
    } as any,
  });
  await ensureChecklist(p.id);
  await db.projectDoc.create({ data: { projectId: p.id, key: 'continuity', data: '{}' } });
  await logActivity(`Project "${p.title}" created`, `/projects/${p.slug}`, p.id);
  redirect(`/projects/${p.slug}`);
}

/** Home screen shortcut: paste a recipe, pick a Baby Chef, create. The name comes from the first line of the recipe. */
export async function createFromHome(fd: FormData) {
  const text = strRaw(fd, 'recipe').trim();
  const first = text.split('\n').map(l => l.replace(/^(recipe|title|name)\s*:\s*/i, '').trim()).find(Boolean);
  const nf = new FormData();
  nf.set('title', (first || 'New recipe video').slice(0, 60));
  if (text) nf.set('recipeOriginal', text);
  const chef = str(fd, 'babyChefId'); if (chef) nf.set('babyChefId', chef);
  return createProject(nf);
}

/** Copy a recipe video (recipe, ingredients, scenes and pictures with their prompts — never results or files). */
export async function duplicateProject(fd: FormData) {
  const src = await db.project.findUniqueOrThrow({ where: { id: str(fd, 'id')! }, include: { ingredients: false } as any });
  const { id, slug, folderName, createdAt, updatedAt, deletedAt, title, ...rest } = src as any;
  let ns = slugify(`${title} copy`), n = 1;
  while (await db.project.findUnique({ where: { slug: ns } })) ns = `${slugify(`${title} copy`)}-${++n}`;
  const copy = await db.project.create({ data: { ...rest, title: `${title} (copy)`, slug: ns, status: 'PLANNING' } });
  await ensureChecklist(copy.id);
  for (const i of await db.ingredient.findMany({ where: { projectId: src.id }, orderBy: { order: 'asc' } })) { const { id: _i, projectId: _p, createdAt: _c, ...r } = i as any; await db.ingredient.create({ data: { ...r, projectId: copy.id } }); }
  let seq = (await db.plannedImage.aggregate({ _max: { seq: true }, where: { projectId: copy.id } }))._max.seq ?? 0;
  for (const sc of await db.scene.findMany({ where: { projectId: src.id }, orderBy: [{ pos: 'asc' }, { order: 'asc' }] })) {
    const { id: sid, projectId: _p, createdAt: _c, updatedAt: _u, ...sr } = sc as any;
    const ns2 = await db.scene.create({ data: { ...sr, projectId: copy.id, status: 'PLANNED' } });
    for (const im of await db.plannedImage.findMany({ where: { sceneId: sc.id }, orderBy: [{ pos: 'asc' }, { seq: 'asc' }] })) {
      const { id: iid, projectId: _pp, sceneId: _s, seq: _q, createdAt: _cc, updatedAt: _uu, approvedAttemptId, dependsOnId, attemptCount, status, waitingAt, waitingReason, waitingNote, ...ir } = im as any;
      await db.plannedImage.create({ data: { ...ir, projectId: copy.id, sceneId: ns2.id, seq: ++seq, status: 'PLANNED', attemptCount: 0 } });
    }
  }
  await logActivity(`Copied "${title}"`, `/projects/${ns}`, copy.id);
  revalidatePath('/', 'layout');
  redirect(`/projects/${ns}`);
}

export async function updateProject(fd: FormData) {
  const id = str(fd, 'id')!;
  const data: any = { ...pickText(fd, ['title', 'recipeName', 'cuisine', 'description', 'babyChefId', 'longDuration', 'shortDuration', 'aspectRatio', 'finishedFood', 'mainHook', 'longHook', 'shortHook', 'ctaCustom']) };
  if (!data.title) delete data.title;
  if (fd.has('status')) { const st = str(fd, 'status')!; if (PROJECT_STATUSES.includes(st)) data.status = st; }
  if (fd.has('ctaPreference')) data.ctaPreference = str(fd, 'ctaPreference') || 'Minimal';
  if (fd.has('verticalCrop') || fd.has('_vc')) data.verticalCrop = bool(fd, 'verticalCrop');
  const slug = str(fd, 'slug');
  if (slug) { const sl = slugify(slug); const ex = await db.project.findUnique({ where: { slug: sl } }); if (!ex || ex.id === id) data.slug = sl; }
  const p = await db.project.update({ where: { id }, data });
  revalidatePath('/', 'layout');
  if (data.slug && str(fd, '_redirect')) redirect(`/projects/${p.slug}${str(fd, '_redirect')}`);
}

export async function archiveProject(fd: FormData) {
  const id = str(fd, 'id')!;
  const hard = str(fd, 'mode') === 'delete';
  await db.project.update({ where: { id }, data: hard ? { deletedAt: new Date() } : { status: 'ARCHIVED' } });
  revalidatePath('/', 'layout');
  redirect('/projects');
}

export async function saveRecipe(fd: FormData) {
  const id = str(fd, 'id')!;
  const old = await db.project.findUniqueOrThrow({ where: { id } });
  const orig = strRaw(fd, 'recipeOriginal'), adapted = strRaw(fd, 'recipeAdapted');
  const changed = orig !== (old.recipeOriginal ?? '') || adapted !== (old.recipeAdapted ?? '');
  const version = changed ? old.recipeVersion + 1 : old.recipeVersion;
  if (changed && (old.recipeOriginal || old.recipeAdapted)) await db.recipeVersion.create({ data: { projectId: id, version: old.recipeVersion, original: old.recipeOriginal, adapted: old.recipeAdapted, notes: old.recipeNotes } });
  await db.project.update({ where: { id }, data: { ...pickText(fd, ['recipeName', 'cuisine', 'recipeSource', 'recipeYield', 'prepTime', 'cookTime', 'recipeNotes']), recipeOriginal: orig || null, recipeAdapted: adapted || null, recipeVersion: version } as any });
  await logActivity('Recipe saved', null, id);
  revalidatePath('/', 'layout');
}

// ---- ingredients
export async function saveIngredient(fd: FormData) {
  const id = str(fd, 'id');
  const projectId = str(fd, 'projectId')!;
  const name = str(fd, 'name');
  if (!name) throw new Error('Ingredient name is required');
  const data: any = { ...pickText(fd, ['name', 'quantity', 'unit', 'prepNote', 'stage', 'brand', 'product', 'packageSize', 'appearance', 'continuity', 'notes']), importance: str(fd, 'importance') || 'OPTIONAL', packageVisible: bool(fd, 'packageVisible') };
  if (id) await db.ingredient.update({ where: { id }, data });
  else {
    const max = await db.ingredient.aggregate({ where: { projectId }, _max: { order: true } });
    await db.ingredient.create({ data: { ...data, projectId, order: (max._max.order ?? -1) + 1 } });
  }
  revalidatePath('/', 'layout');
}
/** Quick add: one ingredient per line. Each line is parsed into quantity / unit / name / prep note; nothing is lost (original text kept in notes when unsure). */
export async function quickAddIngredients(fd: FormData) {
  const projectId = str(fd, 'projectId')!;
  const lines = parseIngredientLines(strRaw(fd, 'text'));
  if (!lines.length) return;
  const max = await db.ingredient.aggregate({ where: { projectId }, _max: { order: true } });
  let order = (max._max.order ?? -1) + 1;
  for (const l of lines) await db.ingredient.create({ data: { projectId, order: order++, name: l.name, quantity: l.quantity ?? null, unit: l.unit ?? null, prepNote: l.prepNote ?? null, brand: l.brand ?? null, importance: l.importance ?? 'OPTIONAL', notes: l.uncertain ? `Original text: ${l.original}` : null } });
  await logActivity(`${lines.length} ingredient${lines.length > 1 ? 's' : ''} added`, null, projectId);
  revalidatePath('/', 'layout');
}
/** Pick one ingredient, give its brand / label details and (optionally) a product photo in one step. */
export async function addProductPhoto(fd: FormData) {
  const id = str(fd, 'ingredientId');
  if (!id) throw new Error('Choose an ingredient');
  const data: any = {};
  for (const k of ['brand', 'product', 'packageSize']) if (fd.has(k)) data[k] = str(fd, k);
  if (fd.has('_pv')) {
    data.packageVisible = bool(fd, 'packageVisible');
    data.importance = data.packageVisible ? 'PACKAGE_CRITICAL' : bool(fd, 'texture') ? 'TEXTURE_CRITICAL' : 'OPTIONAL';
  }
  if (Object.keys(data).length) await db.ingredient.update({ where: { id }, data });
  const file = fd.get('file') as File | null;
  if (file && file.size) await uploadReference(fd);
  revalidatePath('/', 'layout');
}
export async function deleteIngredient(fd: FormData) {
  const id = str(fd, 'id')!;
  await db.reference.updateMany({ where: { ingredientId: id }, data: { deletedAt: new Date(), active: false } });
  const refs = await db.reference.findMany({ where: { ingredientId: id }, select: { id: true } });
  await db.imageRef.deleteMany({ where: { referenceId: { in: refs.map(r => r.id) } } });
  await db.reference.updateMany({ where: { ingredientId: id }, data: { ingredientId: null } });
  await db.ingredient.delete({ where: { id } });
  revalidatePath('/', 'layout');
}
export async function moveIngredient(fd: FormData) {
  const id = str(fd, 'id')!, dir = str(fd, 'dir') === 'up' ? -1 : 1;
  const ing = await db.ingredient.findUniqueOrThrow({ where: { id } });
  const all = await db.ingredient.findMany({ where: { projectId: ing.projectId }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] });
  const i = all.findIndex(x => x.id === id), j = i + dir;
  if (j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  await db.$transaction(all.map((x, k) => db.ingredient.update({ where: { id: x.id }, data: { order: k } })));
  revalidatePath('/', 'layout');
}

// ---- generic project docs (continuity, longform notes, publishing context)
export async function saveDoc(fd: FormData) {
  const projectId = str(fd, 'projectId')!, key = str(fd, 'key')!;
  const data: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (k.startsWith('f:')) data[k.slice(2)] = String(v);
  await db.projectDoc.upsert({ where: { projectId_key: { projectId, key } }, update: { data: JSON.stringify(data) }, create: { projectId, key, data: JSON.stringify(data) } });
  revalidatePath('/', 'layout');
}

/** Copy the Settings "production defaults" into this project's Continuity Bible (explicit action). */
export async function copyDefaultsToContinuity(fd: FormData) {
  const projectId = str(fd, 'projectId')!;
  const s = await getSettings();
  const doc = await db.projectDoc.findUnique({ where: { projectId_key: { projectId, key: 'continuity' } } });
  const data = JSON.parse(doc?.data || '{}') as Record<string, string>;
  const cur = data['General restrictions'] || '';
  if (!cur.includes(s.principles.slice(0, 40))) data['General restrictions'] = [cur, s.principles].filter(Boolean).join('\n');
  await db.projectDoc.upsert({ where: { projectId_key: { projectId, key: 'continuity' } }, update: { data: JSON.stringify(data) }, create: { projectId, key: 'continuity', data: JSON.stringify(data) } });
  revalidatePath('/', 'layout');
}

export async function addNote(fd: FormData) {
  const content = str(fd, 'content');
  if (!content) return;
  await db.projectNote.create({ data: { projectId: str(fd, 'projectId')!, category: str(fd, 'category') || 'General Notes', content } });
  revalidatePath('/', 'layout');
}
export async function deleteNote(fd: FormData) { await db.projectNote.delete({ where: { id: str(fd, 'id')! } }); revalidatePath('/', 'layout'); }
void int;
