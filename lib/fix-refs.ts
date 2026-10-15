import { db } from './db';
import { imageCode } from './util';

export type FixCat = 'chef' | 'ingredients' | 'reference' | 'good' | 'other';
/** One photo that can be picked as a helper on the NEED TO FIX page. Nothing is ever pre-selected. */
export type FixRef = { key: string; assetId: string; cat: FixCat; label: string; title: string; hint: string };

/** EVERY photo of the project (and of its Baby Chef): chef/kitchen masters, ingredient photos, reference photos, pictures that look good, other pictures. */
export async function fixCandidates(projectId: string, imageId: string): Promise<FixRef[]> {
  const proj = await db.project.findUnique({ where: { id: projectId }, select: { babyChefId: true } });
  const [refs, pics] = await Promise.all([
    db.reference.findMany({ where: { deletedAt: null, active: true, OR: [{ babyChefId: proj?.babyChefId ?? '__none__' }, { projectId }] }, orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }] }),
    db.plannedImage.findMany({ where: { projectId, id: { not: imageId } }, orderBy: [{ scene: { pos: 'asc' } }, { pos: 'asc' }], include: { approvedAttempt: true, attempts: { orderBy: { number: 'desc' }, take: 1 } } }),
  ]);
  const out: FixRef[] = [], seen = new Set<string>();
  const add = (r: FixRef) => { if (seen.has(r.assetId)) return; seen.add(r.assetId); out.push(r); };
  for (const r of refs) add({ key: `r:${r.id}`, assetId: r.assetId, cat: r.kind === 'INGREDIENT' ? 'ingredients' : r.kind === 'MASTER' ? 'chef' : 'reference', label: r.category, title: r.title, hint: r.description || '' });
  for (const p of pics) { const a = p.approvedAttempt ?? p.attempts[0]; if (a) add({ key: `p:${p.id}`, assetId: a.assetId, cat: p.approvedAttempt ? 'good' : 'other', label: imageCode(p.seq), title: p.title, hint: '' }); }
  return out;
}
