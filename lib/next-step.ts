import { db } from './db';
import { klingCode } from './util';
import { IMAGE_ORDER, SCENE_ORDER, backfillPositions } from './order';
import { syncQuestions } from './questions';

export type Step = { imageId?: string; title: string; body?: string; cta: string; href: string; tone: 'pink' | 'blue' | 'sage' | 'purple' | 'amber' };
export type NextStepResult = { next: Step | null; steps: Step[]; questions: { soon: number; later: number }; fixing: { text: string; href: string }[]; waiting: { text: string; href: string }[]; todo: { text: string; href: string }[]; done: string[] };


/** Deterministic "What do I do next?" — plain-language, derived only from the project's current state. */
export async function nextStep(projectId: string, slug: string): Promise<NextStepResult> {
  const b = `/projects/${slug}`;
  await backfillPositions();
  await syncQuestions(projectId);
  const [p, ings, scenes, imgs, clips, shortItems, pubs, qs] = await Promise.all([
    db.project.findUniqueOrThrow({ where: { id: projectId } }),
    db.ingredient.findMany({ where: { projectId }, include: { references: { select: { id: true } } }, orderBy: { order: 'asc' } }),
    db.scene.findMany({ where: { projectId }, orderBy: [{ pos: 'asc' }, { order: 'asc' }], include: { images: { select: { id: true } } } }),
    db.plannedImage.findMany({ where: { projectId }, orderBy: [...IMAGE_ORDER], include: { dependsOn: { select: { id: true, status: true, seq: true } } } }),
    db.klingClip.findMany({ where: { projectId }, orderBy: { order: 'asc' } }),
    db.shortItem.count({ where: { short: { projectId } } }).catch(() => 0),
    db.publishingAsset.findMany({ where: { projectId } }),
    db.projectQuestion.findMany({ where: { projectId, status: 'OPEN' } }),
  ]);
  const num = new Map(imgs.map((i, n) => [i.id, n + 1]));
  const pic = (id: string) => `Picture ${num.get(id)}`;
  const steps: Step[] = [], fixing: NextStepResult['fixing'] = [], waiting: NextStepResult['waiting'] = [], todo: NextStepResult['todo'] = [], done: string[] = [];
  const hasRecipe = !!(p.recipeOriginal || p.recipeAdapted) || ings.length > 0;
  if (hasRecipe) done.push('Recipe added'); else { steps.push({ title: 'Add the recipe', body: 'Paste it in, or fill it in from text.', cta: 'ADD RECIPE', href: `${b}/recipe`, tone: 'blue' }); todo.push({ text: 'Add the recipe', href: `${b}/recipe` }); }
  if (p.babyChefId) done.push('Baby Chef chosen'); else { steps.push({ title: 'Choose a Baby Chef', cta: 'CHOOSE BABY CHEF', href: b, tone: 'sage' }); todo.push({ text: 'Choose a Baby Chef', href: b }); }
  const needPhoto = ings.filter(i => i.importance === 'PACKAGE_CRITICAL' && i.references.length === 0);
  if (needPhoto.length) { steps.push({ title: `Add a photo of the ${needPhoto[0].name.toLowerCase()}`, body: 'The package has to look right in the pictures.', cta: 'ADD PRODUCT PHOTO', href: `${b}/ingredients`, tone: 'sage' }); todo.push({ text: `Add ${needPhoto.length} product photo${needPhoto.length > 1 ? 's' : ''}`, href: `${b}/ingredients` }); }
  else if (ings.some(i => i.importance === 'PACKAGE_CRITICAL')) done.push('Product photos added');
  for (const i of imgs.filter(i => i.status === 'REDO')) { fixing.push({ text: `Fix ${pic(i.id)} · ${i.title}`, href: `${b}/images/${i.id}` }); }
  const review = imgs.filter(i => i.status === 'REVIEW');
  if (review.length) steps.push({ title: `Check ${pic(review[0].id)}`, body: `${review[0].title} is waiting for you to look at it.`, cta: 'CHECK PICTURE', href: `${b}/images/${review[0].id}#review`, tone: 'pink', imageId: review[0].id });
  const ready = imgs.filter(i => i.status === 'READY');
  const makeable = ready.filter(i => !i.dependsOn || i.dependsOn.status === 'APPROVED');
  for (const i of imgs) {
    if (i.status === 'WAITING') waiting.push({ text: `${pic(i.id)} · ${i.waitingReason || 'waiting on something'}`, href: `${b}/images/${i.id}` });
    else if (['READY', 'PLANNED', 'PROMPT DRAFT'].includes(i.status) && i.dependsOn && i.dependsOn.status !== 'APPROVED') waiting.push({ text: `${pic(i.id)} is waiting for ${pic(i.dependsOn.id)} to look good`, href: `${b}/images/${i.id}` });
  }
  const firstOpenScene = scenes.find(sc => { const l = imgs.filter(i => i.sceneId === sc.id); return l.length === 0 || l.some(i => !['APPROVED', 'SKIPPED', 'REJECTED'].includes(i.status)); });
  const blocking = qs.filter(q => q.priority === 'SOON' && q.blocksText && firstOpenScene && q.blocksText.includes(firstOpenScene.title));
  if (blocking.length) steps.push({ title: `Answer one question before we make “${firstOpenScene!.title}”`, body: blocking[0].question, cta: 'ANSWER QUESTION', href: `${b}/questions`, tone: 'amber' });
  if (makeable.length) steps.push({ title: `Make ${pic(makeable[0].id)}`, body: `${makeable[0].title} — copy the prompt and make it in ChatGPT.`, cta: 'MAKE NEXT PICTURE', href: `${b}/images/${makeable[0].id}`, tone: 'pink', imageId: makeable[0].id });
  if (fixing.length) { const i = imgs.find(i => i.status === 'REDO')!; const reds = imgs.filter(x => x.status === 'REDO'); steps.push({ title: reds.length > 1 ? `Fix ${reds.length} pictures` : `Fix ${pic(i.id)}`, body: reds.length > 1 ? reds.map(x => pic(x.id)).join(' and ') : `${i.title} needs another try.`, cta: 'FIX THIS PICTURE', href: `${b}/images/${i.id}`, tone: 'pink', imageId: i.id }); }
  const emptyScene = scenes.find(s => s.images.length === 0);
  if (scenes.length === 0) { steps.push({ title: 'Add Scene 1', body: 'Break the video into scenes.', cta: 'ADD FIRST SCENE', href: `${b}/scenes`, tone: 'blue' }); todo.push({ text: 'Add the scenes', href: `${b}/scenes` }); }
  else { done.push(`${scenes.length} scene${scenes.length > 1 ? 's' : ''} added`); if (emptyScene) { steps.push({ title: `Add the first picture for Scene ${scenes.indexOf(emptyScene) + 1}`, body: emptyScene.title, cta: 'ADD PICTURE', href: `${b}/images`, tone: 'pink' }); todo.push({ text: `Add pictures for ${scenes.filter(s => s.images.length === 0).length} scene${scenes.filter(s => s.images.length === 0).length > 1 ? 's' : ''}`, href: `${b}/images` }); } }
  const open = imgs.filter(i => !['APPROVED', 'SKIPPED', 'REJECTED'].includes(i.status));
  if (open.length) todo.push({ text: `Make ${open.length} picture${open.length > 1 ? 's' : ''}`, href: `${b}/images` });
  const okImgs = imgs.filter(i => i.status === 'APPROVED').length;
  if (okImgs) done.push(`${okImgs} picture${okImgs > 1 ? 's' : ''} look good`);
  const clipReady = clips.filter(c => c.status === 'READY');
  const allPicsOk = imgs.length > 0 && open.length === 0;
  if (clipReady.length) steps.push({ title: `Make ${klingCode(clipReady[0].order).replace('KLING-', 'video clip ')}`, body: clipReady[0].title, cta: 'MAKE VIDEO CLIP', href: `${b}/kling/${clipReady[0].id}`, tone: 'purple' });
  else if (allPicsOk && clips.length === 0) steps.push({ title: 'Make the first video clip', body: 'All your pictures look good.', cta: 'ADD VIDEO CLIP', href: `${b}/kling`, tone: 'purple' });
  const clipOpen = clips.filter(c => c.status !== 'APPROVED');
  if (clipOpen.length) todo.push({ text: `Make ${clipOpen.length} video clip${clipOpen.length > 1 ? 's' : ''}`, href: `${b}/kling` });
  for (const c of clips.filter(c => c.status === 'REDO')) fixing.push({ text: `Fix video clip ${c.order} · ${c.title}`, href: `${b}/kling/${c.id}` });
  if (clips.filter(c => c.status === 'APPROVED').length) done.push(`${clips.filter(c => c.status === 'APPROVED').length} video clips look good`);
  if (shortItems === 0 && (allPicsOk || clips.length)) todo.push({ text: 'Plan the Short/Reel', href: `${b}/short` }); else if (shortItems) done.push('Short/Reel planned');
  if (pubs.filter(a => a.selected).length === 0 && (clips.length || allPicsOk)) todo.push({ text: 'Write the post (title, caption)', href: `${b}/publishing` });
  if (qs.some(q => q.priority === 'SOON') && !steps.some(x => x.href.includes('/questions'))) { const soonQs = qs.filter(q => q.priority === 'SOON'); steps.push({ title: `Answer ${soonQs.length} question${soonQs.length > 1 ? 's' : ''}`, body: soonQs.slice(0, 3).map(q => q.question.replace(/\?$/, '')).join(', '), cta: 'ANSWER', href: `${b}/questions`, tone: 'sage' }); }
  return { next: steps[0] ?? null, steps, questions: { soon: qs.filter(q => q.priority === 'SOON').length, later: qs.filter(q => q.priority !== 'SOON').length }, fixing, waiting, todo, done };
}
