'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '../db';
import { saveUpload, deleteAssetIfOrphan, nextCode } from '../files';
import { bool, pickText, slugify, str } from '../util';
import { logActivity } from '../activity';

const FIELDS = ['displayName','seriesName','cuisine','age','gender','appearance','skinTone','facialFeatures','hair','bodyNotes','outfit','accessories','personality','dialogueStyle','voiceInstruction','recurringJokes','recurringReacts','behaviorNotes','kitchen','lighting','cinematography','safetyRules','continuityRules'];

async function uniqueSlug(base: string) {
  let s = slugify(base), i = 1;
  while (await db.babyChef.findUnique({ where: { slug: s } })) s = `${slugify(base)}-${++i}`;
  return s;
}

export async function saveBabyChef(fd: FormData) {
  const id = str(fd, 'id');
  const data = { ...pickText(fd, FIELDS), active: bool(fd, 'active') } as any;
  if (!data.displayName) throw new Error('Baby Chef name is required');
  if (id) {
    await db.babyChef.update({ where: { id }, data });
    await logActivity(`Baby Chef "${data.displayName}" updated`, `/babychefs/${id}`);
    revalidatePath('/babychefs'); revalidatePath(`/babychefs/${id}`);
    return;
  }
  const b = await db.babyChef.create({ data: { ...data, slug: await uniqueSlug(data.displayName) } });
  await logActivity(`Baby Chef "${b.displayName}" created`, `/babychefs/${b.id}`);
  redirect(`/babychefs/${b.id}`);
}

export async function deleteBabyChef(fd: FormData) {
  const id = str(fd, 'id')!;
  const n = await db.project.count({ where: { babyChefId: id, deletedAt: null } });
  if (n > 0) throw new Error('This Baby Chef is used by projects. Archive (deactivate) it instead.');
  await db.babyChef.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
  revalidatePath('/babychefs');
  redirect('/babychefs');
}

export async function uploadReference(fd: FormData) {
  const file = fd.get('file') as File | null;
  if (!file || !file.size) throw new Error('Choose an image file');
  const babyChefId = str(fd, 'babyChefId');
  const projectId = str(fd, 'projectId');
  const ingredientId = str(fd, 'ingredientId');
  const category = str(fd, 'category') || 'Other';
  const title = str(fd, 'title') || file.name.replace(/\.[^.]+$/, '');
  const kind = ingredientId ? 'INGREDIENT' : projectId ? 'PROJECT' : 'MASTER';
  const [chef, project, ing] = await Promise.all([
    babyChefId ? db.babyChef.findUnique({ where: { id: babyChefId } }) : null,
    projectId ? db.project.findUnique({ where: { id: projectId } }) : null,
    ingredientId ? db.ingredient.findUnique({ where: { id: ingredientId } }) : null,
  ]);
  const catSlug = slugify(category);
  let folder = 'references/other', base = `REF_${catSlug}_${slugify(title)}`;
  if (ing) { folder = 'references/ingredients'; base = `REF_ingredient_${slugify(ing.name)}${ing.brand ? '_' + slugify(ing.brand) : ''}_${catSlug}`; }
  else if (chef && kind === 'MASTER') {
    const c = category.toLowerCase();
    folder = c.includes('kitchen') || c.includes('counter') || c.includes('cookware') || c.includes('lighting') || c.includes('cinematography') ? 'references/kitchen' : c.includes('food') ? 'references/food' : 'references/baby';
    base = `REF_${folder.endsWith('kitchen') ? 'kitchen' : folder.endsWith('food') ? 'food' : 'baby'}_${slugify(chef.displayName)}-${slugify(title)}`;
  } else if (kind === 'PROJECT') { folder = 'references/' + (category.toLowerCase().includes('action') ? 'actions' : category.toLowerCase().includes('food') ? 'food' : category.toLowerCase().includes('kitchen') ? 'kitchen' : 'baby'); base = `REF_${catSlug}_${slugify(title)}`; }
  const slug = project?.slug ?? (ing ? (await db.project.findUnique({ where: { id: ing.projectId } }))?.slug : null) ?? (chef ? `_library/${chef.slug}` : null);
  // version = how many files already share this base
  const existing = await db.asset.count({ where: { displayName: { startsWith: base } } });
  const asset = await saveUpload(file, { projectSlug: slug, folder, friendlyBase: base, kind: ing ? 'INGREDIENT_REF' : 'REFERENCE', version: existing + 1, altText: str(fd, 'altText') });
  const code = await nextCode('reference', 'REF', 4);
  const ref = await db.reference.create({
    data: {
      code, kind, babyChefId: chef?.id ?? project?.babyChefId ?? null, projectId: project?.id ?? ing?.projectId ?? null, ingredientId: ing?.id ?? null, assetId: asset.id,
      title, category, description: str(fd, 'description'), notes: str(fd, 'notes'), isGold: bool(fd, 'isGold'), version: 1,
    },
  });
  await logActivity(`Reference ${code} "${title}" uploaded`, null, ref.projectId);
  revalidatePath('/', 'layout');
}

export async function updateReference(fd: FormData) {
  const id = str(fd, 'id')!;
  await db.reference.update({ where: { id }, data: { ...pickText(fd, ['title', 'category', 'description', 'notes']), title: str(fd, 'title') || 'Untitled', active: bool(fd, 'active'), isGold: bool(fd, 'isGold') } as any });
  revalidatePath('/', 'layout');
}
export async function toggleGold(fd: FormData) {
  const id = str(fd, 'id')!;
  const r = await db.reference.findUniqueOrThrow({ where: { id } });
  await db.reference.update({ where: { id }, data: { isGold: !r.isGold } });
  revalidatePath('/', 'layout');
}
/** Replace image: new version, old file kept (never overwritten). */
export async function replaceReference(fd: FormData) {
  const id = str(fd, 'id')!;
  const file = fd.get('file') as File | null;
  if (!file || !file.size) throw new Error('Choose an image file');
  const r = await db.reference.findUniqueOrThrow({ where: { id }, include: { asset: true } });
  const version = r.version + 1;
  const base = r.asset.displayName.replace(/_\d+(\.[a-z0-9]+)?$/i, '');
  const asset = await saveUpload(file, { projectSlug: r.asset.projectSlug, folder: 'references/versions', friendlyBase: base, kind: r.asset.kind, version });
  await db.reference.update({ where: { id }, data: { assetId: asset.id, version } });
  revalidatePath('/', 'layout');
}
export async function deleteReference(fd: FormData) {
  const id = str(fd, 'id')!;
  const r = await db.reference.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
  await db.imageRef.deleteMany({ where: { referenceId: id } });
  void r;
  revalidatePath('/', 'layout');
}

export async function saveCorrection(fd: FormData) {
  const id = str(fd, 'id');
  const file = fd.get('file') as File | null;
  const data: any = { ...pickText(fd, ['title', 'category', 'wrong', 'correct', 'babyChefId', 'projectId', 'ingredient', 'action', 'severity']) };
  if (!data.title) throw new Error('Title is required');
  if (file && file.size) {
    const a = await saveUpload(file, { projectSlug: null, folder: 'references/corrections', friendlyBase: `REF_correction_${slugify(data.title)}`, kind: 'CORRECTION', version: 1 });
    data.assetId = a.id;
  }
  if (id) await db.correction.update({ where: { id }, data });
  else await db.correction.create({ data: { ...data, code: await nextCode('correction', 'COR', 3) } });
  revalidatePath('/', 'layout');
}
export async function deleteCorrection(fd: FormData) {
  await db.correction.delete({ where: { id: str(fd, 'id')! } });
  revalidatePath('/', 'layout');
}
export async function deleteAsset(assetId: string) { await deleteAssetIfOrphan(assetId); }
