'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '../db';
import { bool, pickText, slugify, str, int, strRaw } from '../util';
import { logActivity } from '../activity';
import { ensureChecklist, getSettings } from '../settings';
import { PROJECT_STATUSES } from '../constants';

export async function createProject(fd: FormData) {
  const title = str(fd, 'title');
  if (!title) throw new Error('Project title is required');
  const s = await getSettings();
  let slug = slugify(str(fd, 'slug') || title), n = 1;
  while (await db.project.findUnique({ where: { slug } })) slug = `${slugify(str(fd, 'slug') || title)}-${++n}`;
  const p = await db.project.create({
    data: {
      title, slug, ...pickText(fd, ['recipeName', 'cuisine', 'description', 'babyChefId', 'longDuration', 'shortDuration', 'recipeSource', 'recipeNotes', 'recipeOriginal']),
      aspectRatio: str(fd, 'aspectRatio') || s.defaultAspect, verticalCrop: fd.has('verticalCrop') ? bool(fd, 'verticalCrop') : s.defaultVerticalCrop === 'true',
      status: str(fd, 'status') || s.defaultProjectStatus,
    } as any,
  });
  await ensureChecklist(p.id);
  await db.projectDoc.create({ data: { projectId: p.id, key: 'continuity', data: '{}' } });
  await logActivity(`Project "${p.title}" created`, `/projects/${p.slug}`, p.id);
  redirect(`/projects/${p.slug}`);
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

export async function addNote(fd: FormData) {
  const content = str(fd, 'content');
  if (!content) return;
  await db.projectNote.create({ data: { projectId: str(fd, 'projectId')!, category: str(fd, 'category') || 'General Notes', content } });
  revalidatePath('/', 'layout');
}
export async function deleteNote(fd: FormData) { await db.projectNote.delete({ where: { id: str(fd, 'id')! } }); revalidatePath('/', 'layout'); }
void int;
