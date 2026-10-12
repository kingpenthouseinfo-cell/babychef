'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '../db';
import { importFile, deleteAssetIfOrphan, nextCode, projectFolder, safeSegment } from '../files';
import { bool, pickText, slugify, str } from '../util';
import { logActivity } from '../activity';

const FIELDS = ['displayName','seriesName','cuisine','age','gender','appearance','skinTone','facialFeatures','hair','bodyNotes','outfit','accessories','personality','dialogueStyle','voiceInstruction','recurringJokes','recurringReacts','behaviorNotes','kitchen','lighting','cinematography','safetyRules','continuityRules','humorPatterns','typicalExpressions','ingredientReactions','ctaBehavior','culturalNotes'];

async function uniqueSlug(base: string) {
  let s = slugify(base), i = 1;
  while (await db.babyChef.findUnique({ where: { slug: s } })) s = `${slugify(base)}-${++i}`;
  return s;
}

export async function saveBabyChef(fd: FormData) {
  const id = str(fd, 'id');
  // The profile is edited in tabs, so only fields present in the submitted form are changed.
  const data = { ...pickText(fd, FIELDS) } as any;
  if (fd.has('_hasActive')) data.active = bool(fd, 'active');
  if (id) {
    if (fd.has('displayName') && !data.displayName) throw new Error('Baby Chef name is required');
    if (Object.keys(data).length) await db.babyChef.update({ where: { id }, data });
    const name = data.displayName ?? (await db.babyChef.findUnique({ where: { id } }))?.displayName;
    await logActivity(`Baby Chef "${name}" updated`, `/babychefs/${id}`);
    revalidatePath('/babychefs'); revalidatePath(`/babychefs/${id}`);
    return;
  }
  if (!data.displayName) throw new Error('Baby Chef name is required');
  data.active = fd.has('_hasActive') ? bool(fd, 'active') : true;
  const b = await db.babyChef.create({ data: { ...data, slug: await uniqueSlug(data.displayName) } });
  await logActivity(`Baby Chef "${b.displayName}" created`, `/babychefs/${b.id}`);
  redirect(`/babychefs/${b.id}`);
}

export async function deleteBabyChef(fd: FormData) {
  const id = str(fd, 'id')!;
  // recipe videos that used this Baby Chef simply become "no Baby Chef yet"; nothing else is touched
  await db.project.updateMany({ where: { babyChefId: id }, data: { babyChefId: null } });
  await db.babyChef.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
  revalidatePath('/babychefs');
  redirect('/babychefs');
}

function groupFor(category: string): { sub: string; prefix: string } {
  const c = category.toLowerCase();
  if (c.includes('kitchen') || c.includes('counter') || c.includes('cookware') || c.includes('lighting') || c.includes('cinematography')) return { sub: 'Kitchen', prefix: 'REF-KITCHEN' };
  if (c.includes('food') || c.includes('texture')) return { sub: 'Food', prefix: 'REF-FOOD' };
  if (c.includes('action')) return { sub: 'Actions', prefix: 'REF-ACTION' };
  if (c.includes('product') || c.includes('label') || c.includes('package') || c.includes('poured') || c.includes('bowl')) return { sub: 'Products', prefix: 'REF-PRODUCT' };
  if (c.includes('correction')) return { sub: 'Corrections', prefix: 'REF-CORRECTION' };
  return { sub: 'Baby', prefix: 'REF-BABY' };
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
  const g = ing ? { sub: 'Products', prefix: 'REF-PRODUCT' } : groupFor(category);
  const code = await nextCode('reference', g.prefix, 3);
  const projId = project?.id ?? ing?.projectId ?? null;
  const owner = projId ? await db.project.findUnique({ where: { id: projId } }) : null;
  // Shared (master) references live with the Baby Chef; project/ingredient refs live inside the project folder.
  const rootFolder = owner && kind !== 'MASTER' ? await projectFolder(owner.id) : `00 Baby Chefs/${safeSegment(chef?.displayName || 'Unassigned')}`;
  const folder = owner && kind !== 'MASTER' ? `01 References/${g.sub}` : `References/${g.sub}`;
  const nameBits = ing ? [slugify(ing.name), ing.brand ? slugify(ing.brand) : '', slugify(category)] : [slugify(title), slugify(category)];
  const base = `${code}_${nameBits.filter(Boolean).join('_')}`;
  const asset = await importFile(file, { rootFolder, folder, fileBase: base, kind: ing ? 'INGREDIENT_REF' : 'REFERENCE', version: 1, projectSlug: owner?.slug ?? null, altText: str(fd, 'altText') });
  const ref = await db.reference.create({
    data: {
      code, kind, babyChefId: chef?.id ?? owner?.babyChefId ?? null, projectId: projId, ingredientId: ing?.id ?? null, assetId: asset.id,
      title, category, description: str(fd, 'description'), notes: str(fd, 'notes'), isGold: bool(fd, 'isGold'), version: 1,
    },
  });
  await logActivity(`Reference ${code} "${title}" added`, null, ref.projectId);
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
/** Replace image: new version saved next to the old file (never overwritten). */
export async function replaceReference(fd: FormData) {
  const id = str(fd, 'id')!;
  const file = fd.get('file') as File | null;
  if (!file || !file.size) throw new Error('Choose an image file');
  const r = await db.reference.findUniqueOrThrow({ where: { id }, include: { asset: true } });
  const version = r.version + 1;
  const dir = r.asset.relPath.split('/').slice(0, -1).join('/');
  const base = r.asset.displayName.replace(/(_v\d+)?\.[a-z0-9]+$/i, '');
  const asset = await importFile(file, { rootFolder: '', folder: '', dir, fileBase: `${base}_v${version}`, kind: r.asset.kind, version, projectSlug: r.asset.projectSlug });
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
    const ccode = await nextCode('correction', 'COR', 3);
    const a = await importFile(file, { rootFolder: '00 Baby Chefs', folder: '_Corrections', fileBase: `${ccode}_${slugify(data.title)}`, kind: 'CORRECTION', version: 1 });
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

/** Gallery bulk actions. */
export async function setGoldBulk(ids: string[], value: boolean) {
  await db.reference.updateMany({ where: { id: { in: ids } }, data: { isGold: value } });
  revalidatePath('/', 'layout');
}
export async function linkRefsToImage(imageId: string, refIds: string[], role: string) {
  if (!imageId || !refIds.length) return;
  const max = await db.imageRef.aggregate({ where: { imageId }, _max: { order: true } });
  let order = (max._max.order ?? -1) + 1;
  for (const referenceId of refIds) {
    if (await db.imageRef.findFirst({ where: { imageId, referenceId } })) continue;
    await db.imageRef.create({ data: { imageId, referenceId, role: role || 'CUSTOM REFERENCE', required: true, order: order++ } });
  }
  revalidatePath('/', 'layout');
}

/** Home screen: add a Baby Chef (with optional example pictures) or set a kitchen on a Baby Chef. */
export async function addChefOrKitchen(fd: FormData) {
  const kind = str(fd, 'kind') === 'kitchen' ? 'kitchen' : 'chef';
  const name = str(fd, 'name');
  if (!name) throw new Error('Type a name first');
  if (kind === 'kitchen') {
    const chefId = str(fd, 'babyChefId');
    if (!chefId) throw new Error('Choose which Baby Chef cooks in this kitchen');
    await db.babyChef.update({ where: { id: chefId }, data: { kitchen: name } });
    revalidatePath('/', 'layout');
    redirect(`/babychefs?chef=${chefId}`);
  }
  const b = await db.babyChef.create({ data: { displayName: name, slug: await uniqueSlug(name), active: true } });
  for (const f of fd.getAll('files')) {
    if (!(f instanceof File) || !f.size) continue;
    const one = new FormData(); one.set('file', f); one.set('babyChefId', b.id); one.set('category', 'Character Face'); one.set('title', f.name.replace(/\.[^.]+$/, ''));
    await uploadReference(one);
  }
  await logActivity(`Baby Chef "${b.displayName}" created`, `/babychefs?chef=${b.id}`);
  revalidatePath('/', 'layout');
  redirect(`/babychefs?chef=${b.id}`);
}
