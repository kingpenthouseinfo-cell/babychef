import { db } from './db';
import { SCENE_ORDER, IMAGE_ORDER, backfillPositions } from './order';
import { syncQuestions } from './questions';

export type JState = 'DONE' | 'IN PROGRESS' | 'NOT STARTED' | 'NEEDS FIXING' | 'WAITING';
export type JStep = { label: string; state: JState; href: string; detail?: string; children?: JStep[] };
export type JSection = { title: string; steps: JStep[] };
export type Journey = { sections: JSection[]; summary: { recipe: boolean; planning: boolean; pictures: [number, number]; clips: [number, number]; short: JState; posting: JState } };

const worst = (xs: JState[]): JState => xs.includes('NEEDS FIXING') ? 'NEEDS FIXING' : xs.every(x => x === 'DONE') && xs.length ? 'DONE' : xs.every(x => x === 'NOT STARTED') ? 'NOT STARTED' : xs.includes('IN PROGRESS') || xs.includes('DONE') ? 'IN PROGRESS' : 'WAITING';

/** The whole project, in order, with statuses decided automatically from existing data. */
export async function buildJourney(projectId: string, slug: string): Promise<Journey> {
  await backfillPositions();
  await syncQuestions(projectId);
  const b = `/projects/${slug}`;
  const [p, ings, scenes, imgs, clips, shortItems, pubs, qs, scripts, kitchenRefs] = await Promise.all([
    db.project.findUniqueOrThrow({ where: { id: projectId }, include: { babyChef: true } }),
    db.ingredient.findMany({ where: { projectId }, include: { references: { where: { deletedAt: null }, select: { id: true } } } }),
    db.scene.findMany({ where: { projectId }, orderBy: [...SCENE_ORDER] }),
    db.plannedImage.findMany({ where: { projectId }, orderBy: [...IMAGE_ORDER], include: { dependsOn: { select: { id: true, status: true } } } }),
    db.klingClip.findMany({ where: { projectId }, orderBy: { order: 'asc' }, include: { scenes: true } }),
    db.shortItem.count({ where: { short: { projectId } } }),
    db.publishingAsset.findMany({ where: { projectId } }),
    db.projectQuestion.findMany({ where: { projectId, status: 'OPEN' } }),
    db.scriptVersion.count({ where: { projectId } }),
    db.reference.count({ where: { deletedAt: null, category: { contains: 'Kitchen' }, projectId } }).catch(() => 0),
  ]);
  const hasRecipe = !!(p.recipeOriginal || p.recipeAdapted) || ings.length > 0;
  const kitchenOk = !!(p.babyChef?.kitchen) || kitchenRefs > 0 || (p.babyChefId ? (await db.reference.count({ where: { babyChefId: p.babyChefId, deletedAt: null, category: { contains: 'Kitchen' } } })) > 0 : false);
  const critical = ings.filter(i => i.importance === 'PACKAGE_CRITICAL');
  const missingPhotos = critical.filter(i => i.references.length === 0);
  const soon = qs.filter(q => q.priority === 'SOON').length;
  const num = new Map(imgs.map((i, n) => [i.id, n + 1]));
  const picState = (i: (typeof imgs)[number]): JState => {
    if (i.status === 'APPROVED') return 'DONE';
    if (i.status === 'REDO') return 'NEEDS FIXING';
    if (i.status === 'WAITING' || (i.dependsOn && i.dependsOn.status !== 'APPROVED' && ['READY', 'PLANNED', 'PROMPT DRAFT'].includes(i.status))) return 'WAITING';
    if (['REVIEW', 'GENERATING', 'READY'].includes(i.status)) return 'IN PROGRESS';
    if (i.status === 'SKIPPED' || i.status === 'REJECTED') return 'DONE';
    return 'NOT STARTED';
  };

  const getReady: JStep[] = [
    { label: 'Add Recipe', state: hasRecipe ? 'DONE' : 'NOT STARTED', href: `${b}/recipe` },
    { label: 'Choose Baby Chef', state: p.babyChefId ? 'DONE' : 'NOT STARTED', href: b },
    { label: 'Choose Kitchen', state: kitchenOk ? 'DONE' : 'NOT STARTED', href: p.babyChefId ? `/babychefs/${p.babyChefId}` : b },
    { label: 'Add Product Photos', state: critical.length === 0 ? (ings.length ? 'DONE' : 'NOT STARTED') : missingPhotos.length === 0 ? 'DONE' : missingPhotos.length < critical.length ? 'IN PROGRESS' : 'NOT STARTED', href: `${b}/ingredients`, detail: missingPhotos.length ? `${missingPhotos.length} still need a photo` : undefined },
    { label: 'Answer Missing Info', state: soon > 0 ? 'IN PROGRESS' : 'DONE', href: `${b}/questions`, detail: soon > 0 ? `${soon} question${soon > 1 ? 's' : ''} left` : qs.length ? `${qs.length} can wait` : undefined },
  ];
  const withPics = scenes.filter(s => imgs.some(i => i.sceneId === s.id)).length;
  const plan: JStep[] = [
    { label: 'Make Script', state: scripts > 0 ? 'DONE' : 'NOT STARTED', href: `${b}/script` },
    { label: 'Create Scenes', state: scenes.length > 0 ? 'DONE' : 'NOT STARTED', href: `${b}/story` },
    { label: 'Finish Picture Plan', state: scenes.length === 0 ? 'NOT STARTED' : withPics === scenes.length ? 'DONE' : withPics > 0 ? 'IN PROGRESS' : 'NOT STARTED', href: `${b}/story`, detail: scenes.length && withPics < scenes.length ? `${scenes.length - withPics} scene${scenes.length - withPics > 1 ? 's' : ''} have no pictures yet` : undefined },
  ];
  const pictures: JStep[] = scenes.map((s, n) => {
    const list = imgs.filter(i => i.sceneId === s.id);
    const states = list.map(picState);
    const ok = states.filter(x => x === 'DONE').length;
    const state: JState = list.length === 0 ? 'NOT STARTED' : worst(states);
    const fixN = states.filter(x => x === 'NEEDS FIXING').length;
    return {
      label: `Scene ${n + 1}: ${s.title}`, state, href: `${b}/story#scene-${s.id}`,
      detail: list.length === 0 ? undefined : fixN ? `${fixN} picture${fixN > 1 ? 's need' : ' needs'} fixing · ${ok} of ${list.length} done` : state === 'DONE' ? undefined : `${ok} of ${list.length} pictures done`,
      children: list.map(i => ({ label: `Picture ${num.get(i.id)}`, state: picState(i), href: `${b}/images/${i.id}${i.status === 'REVIEW' ? '#review' : ''}`, detail: i.title })),
    };
  });
  const fixing = imgs.filter(i => i.status === 'REDO');
  const review = imgs.filter(i => i.status === 'REVIEW');
  const done = imgs.filter(i => i.status === 'APPROVED').length;
  const check: JStep[] = [
    { label: fixing.length ? `${fixing.length} Picture${fixing.length > 1 ? 's' : ''} Need${fixing.length > 1 ? '' : 's'} Fixing` : 'Fix Pictures', state: fixing.length ? 'NEEDS FIXING' : imgs.length && done > 0 ? 'DONE' : 'NOT STARTED', href: fixing[0] ? `${b}/images/${fixing[0].id}` : `${b}/story` },
    { label: 'Check Remaining Pictures', state: review.length ? 'IN PROGRESS' : imgs.length && imgs.every(i => ['APPROVED', 'SKIPPED', 'REJECTED'].includes(i.status)) ? 'DONE' : 'NOT STARTED', href: review[0] ? `${b}/images/${review[0].id}#review` : `${b}/story`, detail: review.length ? `${review.length} waiting to be checked` : undefined },
  ];
  const clipState = (s: string): JState => s === 'APPROVED' ? 'DONE' : s === 'REDO' ? 'NEEDS FIXING' : ['READY', 'REVIEW', 'GENERATING'].includes(s) ? 'IN PROGRESS' : s === 'WAITING' ? 'WAITING' : 'NOT STARTED';
  const clipSteps: JStep[] = clips.length ? clips.map(c => ({ label: `Video Clip ${c.order}: ${c.title}`, state: clipState(c.status), href: `${b}/kling/${c.id}` })) : scenes.map((s, n) => ({ label: `Scene ${n + 1} Video Clip`, state: 'NOT STARTED' as JState, href: `${b}/kling` }));
  const keepScenes = scenes.filter(s => s.shortKeep).length;
  const shortSteps: JStep[] = [
    { label: 'Choose Short Moments', state: keepScenes + shortItems > 0 ? 'DONE' : 'NOT STARTED', href: `${b}/short` },
    { label: 'Make Short/Reel', state: shortItems > 0 ? 'IN PROGRESS' : 'NOT STARTED', href: `${b}/short` },
    { label: 'Final Short Check', state: 'NOT STARTED', href: `${b}/short` },
  ];
  const pubState = (match: (a: (typeof pubs)[number]) => boolean): JState => { const l = pubs.filter(match); if (!l.length) return 'NOT STARTED'; if (l.some(a => a.selected)) return 'DONE'; return l.some(a => a.returned || a.status === 'GENERATED' || a.status === 'PROMPT READY') ? 'IN PROGRESS' : 'NOT STARTED'; };
  const post: JStep[] = [
    { label: 'YouTube Title', state: pubState(a => a.platform === 'YouTube Long Form' && a.assetType === 'Title'), href: `${b}/publishing` },
    { label: 'YouTube Description', state: pubState(a => a.platform === 'YouTube Long Form' && a.assetType === 'Description'), href: `${b}/publishing` },
    { label: 'Thumbnail', state: pubState(a => a.assetType.startsWith('Thumbnail')), href: `${b}/publishing` },
    { label: 'Instagram / TikTok Caption', state: pubState(a => (a.platform === 'Instagram' || a.platform === 'TikTok') && /caption/i.test(a.assetType)), href: `${b}/publishing` },
    { label: 'Facebook Post', state: pubState(a => a.platform === 'Facebook' && /caption/i.test(a.assetType)), href: `${b}/publishing` },
  ];
  const sections: JSection[] = [
    { title: 'GET READY', steps: getReady }, { title: 'PLAN THE VIDEO', steps: plan }, { title: 'MAKE THE PICTURES', steps: pictures },
    { title: 'CHECK PICTURES', steps: check }, { title: 'MAKE VIDEO CLIPS', steps: clipSteps }, { title: 'SHORT / REEL', steps: shortSteps }, { title: 'POST VIDEO', steps: post },
    { title: 'FINISH', steps: [{ label: 'Final Video Complete', state: p.status === 'COMPLETE' ? 'DONE' : 'NOT STARTED', href: b }] },
  ];
  const clipDone = clips.filter(c => c.status === 'APPROVED').length;
  return { sections, summary: { recipe: hasRecipe, planning: plan.every(s => s.state === 'DONE'), pictures: [done, imgs.length], clips: [clipDone, clips.length], short: worst(shortSteps.map(s => s.state)), posting: worst(post.map(s => s.state)) } };
}
