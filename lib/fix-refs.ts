import { db } from './db';
import { aiReferencesFor } from './ai-refs';
import { imageCode } from './util';

/** One thumbnail on the NEED TO FIX page that can be ticked and described. */
export type FixRef = { key: string; assetId: string; group: 'SUGGESTED' | 'REFERENCE' | 'PICTURE'; label: string; title: string; hint: string };

/** Every picture that could go to ChatGPT as a reference for this picture: suggested ones first (chef, kitchen, outfit, before, after), then all reference photos (ingredients too), then approved pictures. */
export async function fixCandidates(projectId: string, imageId: string): Promise<FixRef[]> {
  const proj = await db.project.findUnique({ where: { id: projectId }, select: { babyChefId: true } });
  const [set, refs, pics] = await Promise.all([
    aiReferencesFor(projectId, imageId),
    db.reference.findMany({ where: { deletedAt: null, active: true, OR: [{ babyChefId: proj?.babyChefId ?? '__none__' }, { projectId }] }, orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }] }),
    db.plannedImage.findMany({ where: { projectId, approvedAttemptId: { not: null }, id: { not: imageId } }, orderBy: [{ scene: { pos: 'asc' } }, { pos: 'asc' }], include: { approvedAttempt: true } }),
  ]);
  const out: FixRef[] = [], seen = new Set<string>();
  const add = (r: FixRef) => { if (seen.has(r.assetId)) return; seen.add(r.assetId); out.push(r); };
  for (const r of set?.refs ?? []) if (r.assetId) add({ key: `s:${r.key}`, assetId: r.assetId, group: 'SUGGESTED', label: r.label, title: r.title ?? r.label, hint: r.role === 'BEFORE' ? 'the picture just before this one' : r.role === 'AFTER' ? 'the picture just after this one' : r.role === 'BABY' ? 'the baby chef' : r.role === 'KITCHEN' ? 'the kitchen' : r.role === 'OUTFIT' ? 'the outfit' : '' });
  for (const r of refs) add({ key: `r:${r.id}`, assetId: r.assetId, group: 'REFERENCE', label: r.kind === 'INGREDIENT' ? 'INGREDIENT' : r.category.toUpperCase(), title: r.title, hint: r.description || r.category });
  for (const p of pics) if (p.approvedAttempt) add({ key: `p:${p.id}`, assetId: p.approvedAttempt.assetId, group: 'PICTURE', label: imageCode(p.seq), title: p.title, hint: p.title });
  return out;
}
