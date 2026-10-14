import { db } from './db';
import { sceneLabels } from './scene-label';
import { imageLabel } from './image-gen';
import { shortDesc } from './naming';
import { imageCode, pad } from './util';

/** AI generation references: which pictures to give ChatGPT while generating ONE picture (continuity only). Pure lookups by id — nothing is copied. */
export type AiRef = {
  key: string; role: 'BABY' | 'KITCHEN' | 'OUTFIT' | 'BEFORE' | 'AFTER' | 'EXTRA';
  label: string;            // BABY CHEF / KITCHEN / OUTFIT / BEFORE / AFTER / EXTRA
  assetId: string | null;
  sourceImageId?: string;   // for BEFORE / AFTER / extra pictures
  tag?: string;             // IMG 14.2
  title?: string;
  approved?: boolean;
  overridden?: boolean;
  dlName: string;           // download name without extension
};
export type AiRefSet = { imageId: string; seq: number; tag: string; title: string; current: { assetId: string | null; dlName: string }; refs: AiRef[]; hasOverride: boolean };
export type AiMasters = { baby: AiRef | null; kitchen: AiRef | null; outfit: AiRef | null };
type Over = { prev?: string; next?: string; extra?: { k: 'img' | 'ref'; id: string }[] };

const short = (seq: number, title: string) => `IMG${pad(seq, 3)}${shortDesc(title) ? '_' + shortDesc(title) : ''}`;
const parse = (s?: string | null): Over => { try { return s ? JSON.parse(s) : {}; } catch { return {}; } };

export async function projectMasters(projectId: string): Promise<AiMasters> {
  const proj = await db.project.findUnique({ where: { id: projectId }, select: { babyChefId: true } });
  const refs = await db.reference.findMany({
    where: { deletedAt: null, active: true, OR: [{ kind: 'MASTER', babyChefId: proj?.babyChefId ?? '__none__' }, { kind: 'PROJECT', projectId }] },
    include: { asset: true }, orderBy: [{ isGold: 'desc' }, { createdAt: 'asc' }],
  });
  const kitchen = refs.find(r => /kitchen|location/i.test(r.category + ' ' + r.title));
  const outfit = refs.find(r => /outfit|costume|clothes|wardrobe/i.test(r.category + ' ' + r.title));
  const baby = refs.find(r => /^character (face|full)/i.test(r.category) && r !== kitchen && r !== outfit) ?? refs.find(r => r !== kitchen && r !== outfit && /baby|chef|character|face/i.test(r.category + ' ' + r.title));
  const mk = (r: (typeof refs)[number] | undefined, role: AiRef['role'], label: string, name: string): AiRef | null => r ? { key: role.toLowerCase(), role, label, assetId: r.assetId, title: r.title, approved: true, dlName: `REF_MASTER_${name}` } : null;
  return { baby: mk(baby, 'BABY', 'BABY CHEF', 'BABY-CHEF'), kitchen: mk(kitchen, 'KITCHEN', 'KITCHEN', 'KITCHEN'), outfit: mk(outfit, 'OUTFIT', 'OUTFIT', 'OUTFIT') };
}

/** References for every picture of a project (one pass; masters and ordering are computed once). */
export async function aiReferencesForProject(projectId: string): Promise<Map<string, AiRefSet>> {
  const [scenes, imgs, masters] = await Promise.all([
    db.scene.findMany({ where: { projectId }, select: { id: true, pos: true, order: true, inserted: true } }),
    db.plannedImage.findMany({ where: { projectId }, orderBy: [{ scene: { pos: 'asc' } }, { pos: 'asc' }, { seq: 'asc' }], include: { approvedAttempt: { include: { asset: true } }, attempts: { orderBy: { number: 'desc' }, take: 1, include: { asset: true } } } }),
    projectMasters(projectId),
  ]);
  const lab = sceneLabels(scenes);
  const perScene = new Map<string, number>();
  const info = imgs.map(i => {
    const idx = (perScene.get(i.sceneId) ?? 0) + 1; perScene.set(i.sceneId, idx);
    const approvedAsset = i.approvedAttempt?.asset ?? null;
    const anyAsset = approvedAsset ?? i.attempts[0]?.asset ?? null;
    return { i, tag: `IMG ${imageLabel(lab.get(i.sceneId) ?? '', idx).replace(/^0/, '')}`, asset: anyAsset, approved: !!approvedAsset };
  });
  const byId = new Map(info.map(x => [x.i.id, x]));
  const refFor = (x: (typeof info)[number], role: 'BEFORE' | 'AFTER' | 'EXTRA', overridden: boolean): AiRef => ({
    key: `${role.toLowerCase()}:${x.i.id}`, role, label: role === 'EXTRA' ? 'EXTRA' : role, assetId: x.asset?.id ?? null, sourceImageId: x.i.id, tag: x.tag, title: x.i.title, approved: x.approved, overridden,
    dlName: `REF_${role}_${short(x.i.seq, x.i.title)}`,
  });
  const nearest = (from: number, step: 1 | -1) => {
    let fallback: (typeof info)[number] | null = null;
    for (let j = from + step; j >= 0 && j < info.length; j += step) {
      if (info[j].approved && info[j].asset) return info[j];
      if (!fallback && info[j].asset) fallback = info[j];
    }
    return fallback;
  };
  const refRecs = new Map<string, { id: string; assetId: string; title: string }>();
  const out = new Map<string, AiRefSet>();
  const extraRefIds = new Set<string>();
  for (const x of info) for (const e of parse(x.i.aiRefs).extra ?? []) if (e.k === 'ref') extraRefIds.add(e.id);
  if (extraRefIds.size) for (const r of await db.reference.findMany({ where: { id: { in: [...extraRefIds] }, deletedAt: null } })) refRecs.set(r.id, { id: r.id, assetId: r.assetId, title: r.title });
  info.forEach((x, n) => {
    const o = parse(x.i.aiRefs);
    const pick = (id: string | undefined, role: 'BEFORE' | 'AFTER', auto: (typeof info)[number] | null) => {
      const manual = id ? byId.get(id) : undefined;
      if (manual && manual.asset && manual.i.id !== x.i.id) return refFor(manual, role, true);
      return auto ? refFor(auto, role, false) : { key: `${role.toLowerCase()}:none`, role, label: role, assetId: null, dlName: `REF_${role}` } as AiRef;
    };
    const refs: AiRef[] = [];
    if (masters.baby) refs.push(masters.baby);
    if (masters.kitchen) refs.push(masters.kitchen);
    if (masters.outfit) refs.push(masters.outfit);
    refs.push(pick(o.prev, 'BEFORE', nearest(n, -1)), pick(o.next, 'AFTER', nearest(n, 1)));
    for (const e of o.extra ?? []) {
      if (e.k === 'img') { const t = byId.get(e.id); if (t && t.asset) refs.push({ ...refFor(t, 'EXTRA', true), key: `extra:img:${t.i.id}` }); }
      else { const r = refRecs.get(e.id); if (r) refs.push({ key: `extra:ref:${r.id}`, role: 'EXTRA', label: 'EXTRA', assetId: r.assetId, title: r.title, approved: true, overridden: true, dlName: `REF_EXTRA_${shortDesc(r.title) || 'reference'}` }); }
    }
    out.set(x.i.id, { imageId: x.i.id, seq: x.i.seq, tag: x.tag, title: x.i.title, current: { assetId: x.asset?.id ?? null, dlName: `CURRENT_${short(x.i.seq, x.i.title)}` }, refs, hasOverride: !!(o.prev || o.next || o.extra?.length) });
  });
  return out;
}

export async function aiReferencesFor(projectId: string, imageId: string): Promise<AiRefSet | null> {
  return (await aiReferencesForProject(projectId)).get(imageId) ?? null;
}

/** Options for the CHANGE / + ADD EXTRA REFERENCE pickers: approved pictures of this project and the Baby Chef's other reference pictures. */
export async function aiRefOptions(projectId: string, exceptImageId?: string) {
  const proj = await db.project.findUnique({ where: { id: projectId }, select: { babyChefId: true } });
  const [imgs, refs] = await Promise.all([
    db.plannedImage.findMany({ where: { projectId, approvedAttemptId: { not: null }, ...(exceptImageId ? { id: { not: exceptImageId } } : {}) }, orderBy: [{ scene: { pos: 'asc' } }, { pos: 'asc' }, { seq: 'asc' }], select: { id: true, seq: true, title: true } }),
    db.reference.findMany({ where: { deletedAt: null, active: true, OR: [{ babyChefId: proj?.babyChefId ?? '__none__' }, { projectId }] }, orderBy: { createdAt: 'asc' }, select: { id: true, title: true, category: true } }),
  ]);
  return { images: imgs.map(i => ({ value: i.id, label: `${imageCode(i.seq)} ${i.title}` })), refs: refs.map(r => ({ value: r.id, label: `${r.category}: ${r.title}` })) };
}
