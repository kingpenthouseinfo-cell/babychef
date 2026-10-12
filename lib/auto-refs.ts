import { db } from './db';
import { suggestPrevious } from './queries';

/** Pick the obvious example pictures for a picture: Baby Chef, kitchen, the previous picture that looks good, and product photos whose ingredient appears in the picture or scene.
 *  Only adds what is missing — never removes or reorders what you already attached. */
export async function autoAttachReferences(imageId: string): Promise<number> {
  const img = await db.plannedImage.findUnique({ where: { id: imageId }, include: { scene: true, project: true, refs: true } });
  if (!img) return 0;
  const have = new Set(img.refs.flatMap(r => [r.referenceId, r.sourceImageId]).filter(Boolean) as string[]);
  let order = img.refs.reduce((m, r) => Math.max(m, r.order), -1) + 1;
  let added = 0;
  const add = async (data: { role: string; referenceId?: string; sourceImageId?: string }) => {
    const key = data.referenceId ?? data.sourceImageId!;
    if (have.has(key)) return; have.add(key);
    await db.imageRef.create({ data: { imageId, required: true, order: order++, ...data } });
    added++;
  };
  const masters = img.project.babyChefId ? await db.reference.findMany({ where: { babyChefId: img.project.babyChefId, kind: 'MASTER', deletedAt: null, active: true }, orderBy: [{ isGold: 'desc' }, { createdAt: 'asc' }] }) : [];
  const kitchenRef = masters.find(r => /kitchen/i.test(r.category));
  const babyRef = masters.find(r => /^character (face|full)/i.test(r.category)) ?? masters.find(r => r !== kitchenRef);
  if (babyRef && !img.refs.some(r => r.role === 'MASTER BABY')) await add({ role: 'MASTER BABY', referenceId: babyRef.id });
  if (kitchenRef && !img.refs.some(r => r.role === 'MASTER KITCHEN')) await add({ role: 'MASTER KITCHEN', referenceId: kitchenRef.id });
  const prev = await suggestPrevious(img.projectId, img.seq);
  if (prev && !img.refs.some(r => r.role === 'PREVIOUS APPROVED FRAME')) await add({ role: 'PREVIOUS APPROVED FRAME', sourceImageId: prev.id });
  const text = `${img.title} ${img.scene.title} ${img.scene.ingredients ?? ''} ${img.ingredients ?? ''}`.toLowerCase();
  const ings = await db.ingredient.findMany({ where: { projectId: img.projectId }, include: { references: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } } } });
  for (const ing of ings) {
    if (!ing.references.length || !text.includes(ing.name.toLowerCase().split(',')[0].trim())) continue;
    const best = ing.references.find(r => /front/i.test(r.category + r.title)) ?? ing.references[0];
    await add({ role: 'INGREDIENT BRAND REFERENCE', referenceId: best.id });
  }
  return added;
}
