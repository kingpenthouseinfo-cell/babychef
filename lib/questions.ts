import { sceneLabels } from './scene-label';
import { db } from './db';
import { SCENE_ORDER } from './order';

/** Missing-info engine. Produces plain-language questions from the project's current content. Deterministic, no AI.
 *  Only information is asked for here — never pictures, photos or video tasks. */
export type Q = { key: string; group: 'RECIPE' | 'BABY CHEF' | 'VIDEO STYLE' | 'SCENES' | 'OTHER'; question: string; hint?: string; answerType: 'text' | 'number' | 'long' | 'choice'; choices?: string[]; target?: string; priority: 'SOON' | 'LATER'; blocksText?: string; resolved?: string | null };

export const PLACEHOLDER = /\[([^\]\n]{1,60})\]|\b(TBD|TBC)\b|\?\?\?+|\bX{2,}\b/gi;
const PH_WORDS = /(temp|time|minute|hour|quantity|amount|number|enter|unknown|add later|insert|tbd|how|exact|yield|size|brand|\?)/i;
export const isPlaceholder = (raw: string) => { const m = raw.replace(/^\[|\]$/g, ''); return /^(TBD|TBC|\?+|X{2,})$/i.test(m) || PH_WORDS.test(m); };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const has = (v?: string | null) => !!(v && v.trim());

export function phQuestion(ph: string, where: string): { question: string; type: Q['answerType'] } {
  const t = ph.toLowerCase();
  if (/temp/.test(t)) return { question: 'What temperature should it cook at?', type: 'text' };
  if (/(cook|bake|time|minute|hour)/.test(t)) return { question: 'How long should it cook?', type: 'text' };
  if (/(quantity|amount|how much)/.test(t)) return { question: `What is the exact amount? (the ${where} says “${ph}”)`, type: 'text' };
  if (/number|how many|yield/.test(t)) return { question: 'What number goes here? (how many does the recipe make?)', type: 'number' };
  return { question: `What should replace “${ph}” in the ${where}?`, type: 'text' };
}

type Src = { where: string; text: string };
const normMin = (n: number, unit: string) => (/^h/i.test(unit) ? n * 60 : n);

export function findContradictions(srcs: Src[]) {
  const by = new Map<string, Map<number, string>>();
  for (const s of srcs) {
    const re = /\b(bake|baking|cook|cooking|simmer|simmering|rest|resting|chill|chilling|fry|frying|boil|boiling|marinate|marinating|roast|roasting)\b[^.\n\d]{0,25}?(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?)\b/gi;
    for (const m of s.text.matchAll(re)) {
      const verb = m[1].toLowerCase().replace(/ing$/, '').replace(/^bak$/, 'bake').replace(/^cook$/, 'cook');
      const v = normMin(parseFloat(m[2]), m[3]);
      const map = by.get(verb) ?? new Map<number, string>();
      if (!map.has(v)) map.set(v, `${m[2]} ${m[3].toLowerCase().replace(/^mins?$/, 'minutes')}`);
      by.set(verb, map);
    }
  }
  return [...by.entries()].filter(([, m]) => m.size >= 2).map(([verb, m]) => ({ verb, values: [...m.values()] }));
}

export async function desiredQuestions(projectId: string): Promise<Q[]> {
  const p = await db.project.findUniqueOrThrow({ where: { id: projectId }, include: { babyChef: true } });
  const [scenes, ings] = await Promise.all([
    db.scene.findMany({ where: { projectId }, orderBy: [...SCENE_ORDER] }),
    db.ingredient.findMany({ where: { projectId }, orderBy: { order: 'asc' } }),
  ]);
  const out: Q[] = [];
  const add = (q: Q) => { if (!out.some(x => x.key === q.key)) out.push(q); };
  const recipeText = [p.recipeOriginal, p.recipeAdapted, p.recipeNotes].filter(has).join('\n');
  const cookScene = scenes.find(s => /bake|oven|roast|fry|simmer|boil|cook/i.test(`${s.title} ${s.mainAction ?? ''} ${s.recipeStep ?? ''}`));
  const bakeScene = scenes.find(s => /bake|oven|roast/i.test(`${s.title} ${s.mainAction ?? ''} ${s.recipeStep ?? ''}`));
  const hasRecipe = has(recipeText) || ings.length > 0;

  if (hasRecipe) {
    add({ key: 'recipeYield', group: 'RECIPE', question: 'How many does this recipe make?', hint: 'For example: 8 patties, or 4 servings.', answerType: 'text', target: 'project.recipeYield', priority: 'SOON', resolved: p.recipeYield });
    const cooks = /\b(bake|baking|oven|roast|fry|simmer|boil|cook)\b/i.test(recipeText) || !!cookScene;
    add({ key: 'cookTime', group: 'RECIPE', question: 'How long should it cook?', answerType: 'text', target: 'project.cookTime', priority: cooks ? 'SOON' : 'LATER', blocksText: cookScene ? `Needed before “${cookScene.title}”` : undefined, resolved: p.cookTime });
    if (/\b(bake|baking|oven|roast)\b/i.test(recipeText) || bakeScene) {
      const hasTemp = /\d{2,3}\s*°|\bdegrees\b|\b\d{3}\s*°?\s*[FC]\b|gas mark/i.test(recipeText);
      add({ key: 'ovenTemp', group: 'RECIPE', question: 'What temperature should the oven be?', answerType: 'text', target: 'append:project.recipeNotes:Oven temperature', priority: 'SOON', blocksText: bakeScene ? `Needed before “${bakeScene.title}”` : undefined, resolved: hasTemp ? 'in recipe' : null });
    }
    add({ key: 'prepTime', group: 'RECIPE', question: 'How long does the prep take?', answerType: 'text', target: 'project.prepTime', priority: 'LATER', resolved: p.prepTime });
    add({ key: 'recipeSource', group: 'OTHER', question: 'Where did this recipe come from? (for credit)', answerType: 'text', target: 'project.recipeSource', priority: 'LATER', resolved: p.recipeSource });
  }
  for (const i of ings) {
    const used = scenes.some(s => (s.ingredients ?? '').toLowerCase().includes(i.name.toLowerCase()));
    if (!has(i.quantity) && !/to taste|pinch|water|oil spray|garnish/i.test(`${i.name} ${i.prepNote ?? ''}`)) add({ key: `ing:${i.id}:qty`, group: 'RECIPE', question: `How much ${i.name.toLowerCase()} does the recipe use?`, answerType: 'text', target: `ingredient.${i.id}.quantity`, priority: used ? 'SOON' : 'LATER', resolved: i.quantity });
    if (i.importance === 'PACKAGE_CRITICAL') {
      add({ key: `ing:${i.id}:brand`, group: 'RECIPE', question: `Which brand of ${i.name.toLowerCase()} should we use?`, answerType: 'text', target: `ingredient.${i.id}.brand`, priority: 'LATER', resolved: i.brand });
      add({ key: `ing:${i.id}:size`, group: 'RECIPE', question: `What size is the ${i.name.toLowerCase()} package?`, answerType: 'text', target: `ingredient.${i.id}.packageSize`, priority: 'LATER', resolved: i.packageSize });
    }
  }
  if (p.babyChef) {
    add({ key: 'chef:voice', group: 'BABY CHEF', question: `How should ${p.babyChef.displayName} sound? (voice and accent)`, answerType: 'long', target: 'chef.voiceInstruction', priority: 'LATER', resolved: p.babyChef.voiceInstruction });
    add({ key: 'chef:style', group: 'BABY CHEF', question: `How does ${p.babyChef.displayName} usually talk? (dialogue style)`, answerType: 'long', target: 'chef.dialogueStyle', priority: 'LATER', resolved: p.babyChef.dialogueStyle });
  }
  add({ key: 'longDuration', group: 'VIDEO STYLE', question: 'How long should the full video be?', hint: 'For example: 7-9 minutes', answerType: 'text', target: 'project.longDuration', priority: 'LATER', resolved: p.longDuration });
  add({ key: 'mainHook', group: 'VIDEO STYLE', question: 'What is the hook — the first few seconds that make people keep watching?', answerType: 'long', target: 'project.mainHook', priority: 'LATER', resolved: p.mainHook });
  add({ key: 'finishedFood', group: 'VIDEO STYLE', question: 'What does the finished food look like?', answerType: 'long', target: 'project.finishedFood', priority: 'LATER', resolved: p.finishedFood });
  add({ key: 'cta', group: 'VIDEO STYLE', question: 'What should Baby Chef say at the end? (call to action)', answerType: 'long', target: 'project.ctaCustom', priority: 'LATER', resolved: p.ctaCustom || (p.ctaPreference && p.ctaPreference !== 'Custom' ? p.ctaPreference : null) });
  const sl = sceneLabels(scenes);
  scenes.forEach((s, n) => {
    const early = n < 2;
    if (!has(s.narrative) && !has(s.mainAction)) add({ key: `scene:${s.id}:what`, group: 'SCENES', question: `What happens in Scene ${sl.get(s.id)} (“${s.title}”)?`, answerType: 'long', target: `scene.${s.id}.narrative`, priority: early ? 'SOON' : 'LATER' });
    if (s.adultAssist === 'YES' && !has(s.adultNotes)) add({ key: `scene:${s.id}:adult`, group: 'SCENES', question: `What does the adult do in Scene ${sl.get(s.id)} (“${s.title}”)?`, hint: 'Safety steps like hot pans or knives.', answerType: 'long', target: `scene.${s.id}.adultNotes`, priority: 'SOON' });
    if (has(s.narrative) || has(s.mainAction)) if (!has(s.foodAfter)) add({ key: `scene:${s.id}:after`, group: 'SCENES', question: `What does the food look like at the end of Scene ${sl.get(s.id)} (“${s.title}”)?`, answerType: 'long', target: `scene.${s.id}.foodAfter`, priority: 'LATER' });
  });

  // placeholders left in text
  const srcs: Src[] = [{ where: 'recipe', text: recipeText }, { where: 'video info', text: [p.description, p.mainHook, p.finishedFood, p.recipeYield, p.cookTime, p.prepTime].filter(has).join('\n') }];
  for (const s of scenes) srcs.push({ where: `scene “${s.title}”`, text: [s.narrative, s.mainAction, s.dialogue, s.notes, s.foodBefore, s.foodDuring, s.foodAfter].filter(has).join('\n') });
  const seen = new Set<string>();
  for (const src of srcs) for (const m of src.text.matchAll(PLACEHOLDER)) {
    const ph = m[0];
    if (!isPlaceholder(ph) || seen.has(ph.toLowerCase())) continue;
    seen.add(ph.toLowerCase());
    const q = phQuestion(m[1] ?? ph, src.where);
    add({ key: `ph:${slug(ph)}`, group: src.where.startsWith('scene') ? 'SCENES' : 'RECIPE', question: q.question, hint: `Found “${ph}” in the ${src.where}.`, answerType: q.type, target: `replace:${ph}`, priority: 'SOON', resolved: null });
  }
  // contradictions
  const cs: Src[] = [{ where: 'recipe', text: recipeText }, ...(has(p.cookTime) ? [{ where: 'cook time', text: `cook ${p.cookTime}` }] : [])];
  for (const c of findContradictions(cs)) add({ key: `contra:${c.verb}`, group: 'RECIPE', question: `The project has different ${c.verb} times: ${c.values.slice(0, -1).join(', ')} and ${c.values[c.values.length - 1]}. Which one should be used?`, answerType: 'choice', choices: [...c.values, 'Other'], target: `decide:${c.verb}`, priority: 'SOON', resolved: null });
  return out;
}

/** Create new auto questions, auto-close ones whose answer now exists elsewhere. Manual questions and your answers are never touched. */
const locks = new Map<string, Promise<void>>();
/** Safe to call from several places at once (Home asks for many projects in parallel): runs one at a time per project. */
export async function syncQuestions(projectId: string) {
  const prev = locks.get(projectId) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(() => syncQuestionsNow(projectId));
  locks.set(projectId, run.then(() => undefined, () => undefined));
  return run;
}

async function syncQuestionsNow(projectId: string) {
  const want = await desiredQuestions(projectId);
  const have = await db.projectQuestion.findMany({ where: { projectId } });
  const byKey = new Map(have.map(h => [h.key, h]));
  const wantKeys = new Set(want.map(w => w.key));
  for (const w of want) {
    const h = byKey.get(w.key);
    if (!h) {
      if (w.resolved) continue; // already known — nothing to ask
      await db.projectQuestion.create({ data: { projectId, key: w.key, group: w.group, question: w.question, hint: w.hint ?? null, answerType: w.answerType, choices: w.choices ? JSON.stringify(w.choices) : null, target: w.target ?? null, priority: w.priority, blocksText: w.blocksText ?? null, source: 'AUTO' } }).catch((e: any) => { if (e?.code !== 'P2002') throw e; });
    } else if (h.status === 'OPEN' || h.status === 'UNKNOWN') {
      if (w.resolved) await db.projectQuestion.update({ where: { id: h.id }, data: { status: 'ANSWERED', answer: w.resolved === 'in recipe' ? 'Already in the recipe' : w.resolved, answeredAt: new Date() } });
      else await db.projectQuestion.update({ where: { id: h.id }, data: { question: w.question, hint: w.hint ?? null, priority: h.status === 'UNKNOWN' ? 'LATER' : w.priority, blocksText: w.blocksText ?? null, choices: w.choices ? JSON.stringify(w.choices) : null } });
    }
  }
  // auto questions that no longer apply (deleted scene, placeholder removed…) and are still open
  for (const h of have) if (h.source === 'AUTO' && h.status === 'OPEN' && !wantKeys.has(h.key)) await db.projectQuestion.delete({ where: { id: h.id } });
}
