import { db } from './db';
import { IMAGE_ORDER } from './order';
import { imageCode, sceneCode, parseJson, lines, klingCode } from './util';

export type ChecklistEntry = {
  id: string; label: string; role: string; required: boolean; notes: string | null;
  assetId: string | null; kind: 'REFERENCE' | 'APPROVED_IMAGE'; packageCritical: boolean; sourceImageCode?: string; missing?: boolean;
};

export const imageInclude = {
  scene: true,
  dependsOn: { include: { approvedAttempt: true } },
  approvedAttempt: { include: { asset: true } },
  attempts: { include: { asset: true }, orderBy: { number: 'asc' as const } },
  refs: {
    orderBy: { order: 'asc' as const },
    include: {
      reference: { include: { asset: true, ingredient: true } },
      sourceImage: { include: { approvedAttempt: { include: { asset: true } }, scene: true } },
    },
  },
};

/** Build the human-readable reference checklist for a planned image. */
export function buildChecklist(img: { refs: any[] }): ChecklistEntry[] {
  return img.refs.map((r: any): ChecklistEntry => {
    if (r.sourceImage) {
      const a = r.sourceImage.approvedAttempt;
      return {
        id: r.id, role: r.role, required: r.required, notes: r.notes, kind: 'APPROVED_IMAGE',
        label: `${imageCode(r.sourceImage.seq)} ${r.role === 'PREVIOUS APPROVED FRAME' ? 'Previous Picture' : r.sourceImage.title}`,
        assetId: a?.assetId ?? null, packageCritical: false, sourceImageCode: imageCode(r.sourceImage.seq), missing: !a,
      };
    }
    const ref = r.reference;
    const ing = ref?.ingredient;
    const label = ing ? `${ing.name}${ing.brand ? ' (' + ing.brand + ')' : ''} Brand Reference — ${ref.category}` : ref?.title ?? 'Missing reference';
    return {
      id: r.id, role: r.role, required: r.required, notes: r.notes, kind: 'REFERENCE', label,
      assetId: ref?.assetId ?? null, packageCritical: ing?.importance === 'PACKAGE_CRITICAL', missing: !ref,
    };
  });
}

/** Images eligible for "next prompt": READY with satisfied dependencies. */
export async function nextReadyImages(projectId?: string | null) {
  const imgs = await db.plannedImage.findMany({
    where: { status: 'READY', ...(projectId ? { projectId } : {}), project: { deletedAt: null } },
    include: { ...imageInclude, project: true },
  });
  const rank: Record<string, number> = { HIGH: 0, NORMAL: 1, LOW: 2 };
  const ok = (i: any) => !i.dependsOn || i.dependsOn.status === 'APPROVED';
  imgs.sort((a, b) =>
    a.project.title.localeCompare(b.project.title) ||
    (a.scene as any).pos - (b.scene as any).pos || a.scene.order - b.scene.order || (a as any).pos - (b as any).pos || a.seq - b.seq || rank[a.priority] - rank[b.priority]);
  return { eligible: imgs.filter(ok), blocked: imgs.filter(i => !ok(i)) };
}

export async function projectStats(projectId: string) {
  const [scenes, images, clips, items, shortItems, pub] = await Promise.all([
    db.scene.findMany({ where: { projectId }, select: { status: true, shotPriority: true } }),
    db.plannedImage.findMany({ where: { projectId }, select: { status: true } }),
    db.klingClip.findMany({ where: { projectId }, select: { status: true } }),
    db.checklistItem.count({ where: { projectId } }),
    db.shortItem.count({ where: { short: { projectId } } }),
    db.publishingAsset.findMany({ where: { projectId }, select: { status: true } }),
  ]);
  const c = (arr: { status: string }[], s: string) => arr.filter(x => x.status === s).length;
  const totalImg = images.length;
  const approved = c(images, 'APPROVED');
  return {
    scenes: scenes.length, scenesComplete: c(scenes, 'COMPLETE'),
    images: totalImg, planned: c(images, 'PLANNED') + c(images, 'PROMPT DRAFT'), ready: c(images, 'READY'), waiting: c(images, 'WAITING'),
    review: c(images, 'REVIEW'), approved, redo: c(images, 'REDO'),
    clips: clips.length, clipsPlanned: c(clips, 'PLANNED') + c(clips, 'DRAFT'), clipsReady: c(clips, 'READY'), clipsApproved: c(clips, 'APPROVED'),
    shortItems, publishing: pub.length, publishingSelected: pub.filter(p => ['SELECTED', 'PUBLISHED'].includes(p.status)).length,
    publishingTasks: pub.filter(p => !['SELECTED', 'PUBLISHED', 'SKIPPED'].includes(p.status)).length,
    checklistItems: items,
    progress: totalImg ? Math.round((approved / totalImg) * 100) : 0,
  };
}

export async function getProjectBySlug(slug: string) {
  return db.project.findFirst({ where: { slug, deletedAt: null }, include: { babyChef: true } });
}

/** Suggest the previous image (by sequence) that has an approved result. */
export async function suggestPrevious(projectId: string, seq: number) {
  // previous = the closest earlier picture in the VISIBLE order that has an approved result (inserts and moves are respected)
  const all = await db.plannedImage.findMany({ where: { projectId }, orderBy: [...IMAGE_ORDER], include: { approvedAttempt: { include: { asset: true } } } });
  const i = all.findIndex(x => x.seq === seq);
  for (let j = i - 1; j >= 0; j--) if (all[j].approvedAttemptId) return all[j];
  return null;
}

export async function relevantCorrections(img: { projectId: string; ingredients: string | null; actionMoment: string | null; title: string }, babyChefId: string | null | undefined) {
  const all = await db.correction.findMany({
    where: { OR: [{ projectId: img.projectId }, { babyChefId: babyChefId ?? '__none__' }, { AND: [{ projectId: null }, { babyChefId: null }] }] },
    include: { asset: true }, orderBy: { createdAt: 'desc' },
  });
  const text = `${img.ingredients ?? ''} ${img.actionMoment ?? ''} ${img.title}`.toLowerCase();
  const rel = all.filter(c => {
    const keys = [c.ingredient, c.action].filter(Boolean).map(s => s!.toLowerCase());
    return keys.length === 0 ? true : keys.some(k => text.includes(k) || k.split(/\s+/).some(w => w.length > 3 && text.includes(w)));
  });
  return rel;
}

export function shotSummary(rows: { shotType?: string; shotPriority?: string }[]) {
  const m: Record<string, number> = {};
  for (const r of rows) { const k = r.shotType ?? r.shotPriority ?? 'OTHER'; m[k] = (m[k] || 0) + 1; }
  return m;
}

export { sceneCode, imageCode, parseJson, lines };

/** Everything that can be attached to an image as a reference, grouped for a <select>. */
export async function refPool(project: { id: string; babyChefId: string | null }, excludeImageId?: string) {
  const [masters, own, imgs] = await Promise.all([
    project.babyChefId ? db.reference.findMany({ where: { babyChefId: project.babyChefId, kind: 'MASTER', deletedAt: null, active: true }, include: { ingredient: true }, orderBy: [{ isGold: 'desc' }, { createdAt: 'asc' }] }) : [],
    db.reference.findMany({ where: { projectId: project.id, deletedAt: null, active: true }, include: { ingredient: true }, orderBy: { createdAt: 'asc' } }),
    db.plannedImage.findMany({ where: { projectId: project.id, approvedAttemptId: { not: null }, ...(excludeImageId ? { id: { not: excludeImageId } } : {}) }, orderBy: [{ scene: { pos: 'asc' } }, { pos: 'asc' }, { seq: 'asc' }] }),
  ]);
  const refLabel = (r: any) => `${r.isGold ? '★ ' : ''}${r.ingredient ? r.ingredient.name + ' — ' : ''}${r.title} (${r.category})`;
  return {
    groups: [
      { label: 'Baby Chef master references', options: masters.map(r => ({ value: `ref:${r.id}`, label: refLabel(r) })) },
      { label: 'Project & ingredient references', options: own.map(r => ({ value: `ref:${r.id}`, label: refLabel(r) })) },
      { label: 'Approved images (previous frames)', options: imgs.map(i => ({ value: `img:${i.id}`, label: `${imageCode(i.seq)} ${i.title}` })) },
    ].filter(g => g.options.length),
  };
}

export type ActionItem = { key: string; kind: 'READY' | 'REVIEW' | 'REDO' | 'WAITING' | 'KLING' | 'PUB'; code: string; chip: string; title: string; desc: string; cta: string; href: string; score: number; project: string };

/** "What needs me now", sorted by what unblocks the most. */
export async function actionCenter(limit = 8, projectId?: string): Promise<ActionItem[]> {
  const live = { project: { deletedAt: null, status: { not: 'ARCHIVED' } }, ...(projectId ? { projectId } : {}) };
  const [imgs, clips, pubs] = await Promise.all([
    db.plannedImage.findMany({ where: { status: { in: ['READY', 'REVIEW', 'REDO', 'WAITING'] }, ...live }, include: { project: true, scene: true, dependents: { select: { id: true } }, dependsOn: true } }),
    db.klingClip.findMany({ where: { status: { in: ['READY', 'REVIEW', 'REDO'] }, ...live }, include: { project: true } }),
    db.publishingAsset.findMany({ where: { status: 'GENERATED', ...live }, include: { project: true } }),
  ]);
  const items: ActionItem[] = [];
  for (const i of imgs) {
    if (i.status === 'READY' && i.dependsOn && i.dependsOn.status !== 'APPROVED') continue;
    const unblocks = i.dependents.length;
    const base = `/projects/${i.project.slug}/images/${i.id}`;
    const cfg = { READY: { cta: 'Make picture', href: '/queue', w: 1 }, REVIEW: { cta: 'Check it', href: `${base}#review`, w: 3 }, REDO: { cta: 'Fix it', href: base, w: 2 }, WAITING: { cta: 'Try again', href: '/queue?show=waiting', w: 0 } }[i.status as 'READY' | 'REVIEW' | 'REDO' | 'WAITING'];
    items.push({ key: i.id, kind: i.status as ActionItem['kind'], code: imageCode(i.seq), chip: i.status, title: i.title, desc: i.status === 'WAITING' ? `${i.waitingReason ?? 'waiting'}` : unblocks ? `${i.scene.title} · unblocks ${unblocks} image${unblocks > 1 ? 's' : ''}` : i.scene.title, cta: cfg.cta, href: cfg.href, score: cfg.w * 2 + unblocks * 3 + (i.priority === 'HIGH' ? 2 : 0), project: i.project.title });
  }
  for (const k of clips) items.push({ key: k.id, kind: 'KLING', code: klingCode(k.order), chip: k.status, title: k.title, desc: k.project.title, cta: k.status === 'REDO' ? 'Fix it' : 'Open video clip', href: `/projects/${k.project.slug}/kling/${k.id}`, score: 4, project: k.project.title });
  for (const a of pubs) items.push({ key: a.id, kind: 'PUB', code: `${a.platform.split(' ')[0].slice(0, 2).toUpperCase()} ${a.assetType.toLowerCase()}`, chip: 'GENERATED', title: `${a.platform} · ${a.assetType}`, desc: 'result pasted — choose the version to use', cta: 'Select', href: `/projects/${a.project.slug}/publishing`, score: 1, project: a.project.title });
  return items.sort((a, b) => b.score - a.score).slice(0, limit);
}
