/**
 * PromptBuilderService — assembles copy-ready TEXT prompts for ChatGPT / Claude.
 * It never calls an AI. It collects database context into blocks, resolves the
 * editable task template, and returns the final text plus a context preview.
 */
import { negativeStates, DEFAULT_NEGATIVE } from './negative-states';
import { db } from './db';
import { bibleText, chefProductionText, currentBibleVersion, OVERRIDE_FIELDS } from './bible';
import { buildVars, render } from './template-engine';
import { imageInclude, buildChecklist, relevantCorrections } from './queries';
import { imageCode, klingCode, lines, parseJson, ratioLabel, sceneCode } from './util';
import { CONTINUITY_FIELDS, INGREDIENT_IMPORTANCE } from './constants';
import { expectedFilename, fileBlock, nextVersion } from './naming';

export type BuilderType = 'plan' | 'script' | 'script-revision' | 'scenes' | 'image-plan' | 'image-full' | 'image-cont' | 'image-redo' | 'continuity' | 'kling-group' | 'kling-final' | 'kling-redo';
export type Target = 'CHATGPT' | 'CLAUDE' | 'GENERIC AI';
export const TARGETS: Target[] = ['CHATGPT', 'CLAUDE', 'GENERIC AI'];

export type BuilderDef = {
  label: string; purpose: string; template: string; help: string;
  blocks: string[];            // default-included blocks, in output order
  extra: string[];             // available but off by default
  required: string[];          // cannot be removed
  needs?: 'image' | 'kling' | 'attempt' | 'klingAttempt';
  bible?: string[];            // which Production Bible sections apply (undefined = all)
  group: 'Planning' | 'Images' | 'Kling';
};

const IMG_BIBLE = ['still-images', 'camera', 'crop', 'food-state', 'food-realism', 'food-physics', 'cooking-action', 'references', 'product-refs', 'character', 'kitchen', 'safety', 'never', 'custom'];

export const BUILDERS: Record<BuilderType, BuilderDef> = {
  plan: { group: 'Planning', label: 'Production Plan', purpose: 'PRODUCTION PLAN PROMPT', template: 'TPL-PLAN-OUTPUT', help: 'Recipe → full production plan (script strategy, scenes, food states, shots, Kling grouping, SHORT KEEP).', blocks: ['bible', 'chef', 'recipe', 'ingredients', 'productRefs', 'overrides', 'notes', 'specs'], extra: ['continuityDoc'], required: ['recipe'] },
  script: { group: 'Planning', label: 'Script', purpose: 'SCRIPT PROMPT', template: 'TPL-SCRIPT', help: 'Ask the AI to write the Baby Chef script.', blocks: ['bible', 'chef', 'recipe', 'ingredients', 'overrides', 'notes', 'specs'], extra: ['productRefs', 'continuityDoc'], required: ['recipe'], bible: ['philosophy', 'recipe-planning', 'script', 'dialogue', 'humor', 'hook', 'asmr', 'pacing', 'long-form', 'short-form', 'safety', 'never', 'custom'] },
  'script-revision': { group: 'Planning', label: 'Script revision', purpose: 'SCRIPT REVISION PROMPT', template: 'TPL-SCRIPT-REV', help: 'Revise the current script.', blocks: ['bible', 'chef', 'scriptCurrent', 'ingredients', 'overrides', 'specs'], extra: ['recipe', 'notes'], required: ['scriptCurrent'], bible: ['script', 'dialogue', 'humor', 'hook', 'asmr', 'pacing', 'short-form', 'safety', 'never', 'custom'] },
  scenes: { group: 'Planning', label: 'Scene breakdown', purpose: 'SCENE BREAKDOWN PROMPT', template: 'TPL-SCENES', help: 'Approved script → production scenes with food states.', blocks: ['bible', 'chef', 'scriptCurrent', 'recipe', 'ingredients', 'overrides', 'specs'], extra: ['productRefs', 'notes'], required: ['scriptCurrent'], bible: ['recipe-planning', 'scene-breakdown', 'cooking-action', 'food-state', 'food-realism', 'camera', 'crop', 'asmr', 'pacing', 'long-form', 'short-form', 'hook', 'kling', 'safety', 'never', 'custom'] },
  'image-plan': { group: 'Images', label: 'Image plan', purpose: 'IMAGE PLAN PROMPT', template: 'TPL-IMGPLAN', help: 'Decide which still images anchor the scenes.', blocks: ['bible', 'chef', 'scenesList', 'ingredients', 'productRefs', 'overrides', 'continuityDoc', 'corrections', 'specs'], extra: ['approvedImages', 'scriptCurrent'], required: ['scenesList'], bible: ['still-images', 'camera', 'crop', 'food-state', 'food-realism', 'food-physics', 'cooking-action', 'references', 'product-refs', 'character', 'kitchen', 'safety', 'kling', 'never', 'custom'] },
  'image-full': { group: 'Images', label: 'Full image prompt', purpose: 'IMAGE PROMPT WRITING PROMPT', template: 'TPL-IMG-FULL-WRITER', help: 'Assemble the context so the AI writes the final, detailed still-image prompt.', blocks: ['bible', 'chef', 'continuityDoc', 'scene', 'image', 'refs', 'corrections', 'overrides', 'file'], extra: ['history', 'specs'], required: ['image', 'file'], needs: 'image', bible: IMG_BIBLE },
  'image-cont': { group: 'Images', label: 'Continuation prompt', purpose: 'CONTINUATION PROMPT WRITING PROMPT', template: 'TPL-IMG-CONT-WRITER', help: 'Short prompt for a ChatGPT chat that already has the baby + previous frame.', blocks: ['bible', 'scene', 'image', 'refs', 'corrections', 'file'], extra: ['chef', 'continuityDoc', 'history', 'overrides'], required: ['image', 'file'], needs: 'image', bible: ['food-state', 'food-physics', 'food-realism', 'references', 'crop', 'never', 'custom'] },
  'image-redo': { group: 'Images', label: 'Redo prompt', purpose: 'IMAGE REDO PROMPT', template: 'TPL-IMG-REDO', help: 'Fix ONLY the failed problem; preserve approved elements.', blocks: ['image', 'attempt', 'refs', 'corrections', 'bible', 'file'], extra: ['chef', 'scene', 'history'], required: ['image', 'attempt', 'file'], needs: 'attempt', bible: ['references', 'food-physics', 'food-realism', 'never', 'custom'] },
  continuity: { group: 'Images', label: 'Continuity review', purpose: 'CONTINUITY REVIEW PROMPT', template: 'TPL-CONTREV', help: 'Have the AI review food progression and continuity.', blocks: ['bible', 'continuityDoc', 'scenesList', 'approvedImages', 'corrections'], extra: ['chef'], required: ['scenesList'], bible: ['food-state', 'food-realism', 'character', 'kitchen', 'references', 'never'] },
  'kling-group': { group: 'Kling', label: 'Kling grouping', purpose: 'KLING GROUPING PROMPT', template: 'TPL-KLING-GROUP', help: 'Decide how approved stills group into clips.', blocks: ['bible', 'scenesList', 'approvedImages', 'specs'], extra: ['chef', 'existingClips'], required: ['approvedImages'], bible: ['kling', 'pacing', 'cooking-action', 'food-state', 'short-form', 'safety', 'custom'] },
  'kling-final': { group: 'Kling', label: 'Final Kling prompt', purpose: 'KLING PROMPT WRITING PROMPT', template: 'TPL-KLING-WRITER', help: 'Ordered @image references + action, voice, physics, camera, ASMR → the AI writes the Kling prompt.', blocks: ['bible', 'chef', 'kling', 'klingScenes', 'corrections', 'overrides'], extra: ['continuityDoc'], required: ['kling'], needs: 'kling', bible: ['kling', 'cooking-action', 'food-physics', 'food-state', 'food-realism', 'asmr', 'camera', 'crop', 'character', 'kitchen', 'safety', 'never', 'custom'] },
  'kling-redo': { group: 'Kling', label: 'Kling redo prompt', purpose: 'KLING REDO PROMPT', template: 'TPL-KLING-REDO', help: 'Revise a Kling prompt after a failed generation.', blocks: ['bible', 'kling', 'klingAttempt'], extra: ['chef', 'klingScenes', 'corrections'], required: ['kling', 'klingAttempt'], needs: 'klingAttempt', bible: ['kling', 'food-physics', 'never', 'custom'] },
};

export const BLOCK_LABELS: Record<string, string> = {
  bible: 'Production Bible', chef: 'Baby Chef profile', recipe: 'Recipe', ingredients: 'Ingredients', productRefs: 'Product reference summary', overrides: 'Project production overrides',
  notes: 'Project notes', specs: 'Durations, aspect ratio & crop', continuityDoc: 'Continuity Bible', scriptCurrent: 'Current script', scenesList: 'Scenes & food states', scene: 'Scene', image: 'Planned image',
  refs: 'Reference images & instructions', file: 'Required result filename', corrections: 'Known corrections', attempt: 'Failed attempt & correction', approvedImages: 'Approved images', history: 'Earlier prompt versions', kling: 'Kling clip & ordered references',
  klingScenes: 'Related scenes & food states', klingAttempt: 'Failed Kling generation', existingClips: 'Existing Kling clips',
};

export type LinkParams = { imageId?: string | null; klingId?: string | null; attemptId?: string | null; klingAttemptId?: string | null; sceneId?: string | null };
export type BuildOptions = { target?: Target; off?: string[]; on?: string[]; bibleKeys?: string[] | null; note?: string };
export type BlockPreview = { key: string; label: string; on: boolean; required: boolean; detail: string; empty: boolean };
export type BuildResult = {
  type: BuilderType; purpose: string; target: Target; text: string; blocks: BlockPreview[]; warnings: string[];
  bibleSections: { key: string; title: string; included: boolean }[];
  meta: Record<string, unknown>; templateName: string | null;
};

async function loadCtx(projectId: string, link: LinkParams) {
  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      babyChef: true,
      ingredients: { orderBy: { order: 'asc' }, include: { references: { where: { deletedAt: null, active: true } } } },
      notes: { orderBy: { createdAt: 'asc' } }, docs: true,
      scripts: { where: { isCurrent: true }, take: 1 },
      scenes: { orderBy: [{ pos: 'asc' }, { order: 'asc' }], include: { images: { orderBy: [{ pos: 'asc' }, { seq: 'asc' }], include: { approvedAttempt: { include: { asset: true } } } } } },
      clips: { orderBy: { order: 'asc' }, include: { refs: { orderBy: { order: 'asc' }, include: { image: true } } } },
    },
  });
  const img = link.imageId ? await db.plannedImage.findUnique({ where: { id: link.imageId }, include: imageInclude }) : null;
  const attempt = img ? (img.attempts.find(a => a.id === link.attemptId) ?? [...img.attempts].reverse().find(a => a.status === 'REDO') ?? img.attempts[img.attempts.length - 1] ?? null) : null;
  const kl = link.klingId ? await db.klingClip.findUnique({ where: { id: link.klingId }, include: { refs: { orderBy: { order: 'asc' }, include: { image: { include: { scene: true, approvedAttempt: { include: { asset: true } }, attempts: { include: { asset: true }, orderBy: { number: 'desc' }, take: 1 } } } } }, scenes: { include: { scene: true } }, attempts: { orderBy: { number: 'desc' } } } }) : null;
  const kAttempt = kl ? (kl.attempts.find(a => a.id === link.klingAttemptId) ?? kl.attempts.find(a => a.status === 'REDO') ?? kl.attempts[0] ?? null) : null;
  const corrections = await db.correction.findMany({ where: { OR: [{ projectId }, { babyChefId: project.babyChefId ?? '__none__' }, { AND: [{ projectId: null }, { babyChefId: null }] }] }, orderBy: { createdAt: 'desc' } });
  const scene = img ? project.scenes.find(s => s.id === img.sceneId) ?? null : link.sceneId ? project.scenes.find(s => s.id === link.sceneId) ?? null : null;
  const vars = await buildVars(projectId, { sceneId: scene?.id, imageId: img?.id, klingId: kl?.id });
  return { project, img, attempt, kl, kAttempt, corrections, scene, vars };
}
type Ctx = Awaited<ReturnType<typeof loadCtx>>;
type Block = { text: string; detail: string };
const H = (t: string, body: string) => `=== ${t.toUpperCase()} ===\n${body}`;
const val = (s: string | null | undefined) => (s ?? '').trim();
const kv = (rows: [string, string | null | undefined][]) => rows.filter(([, v]) => val(v)).map(([k, v]) => `${k}: ${val(v)}`).join('\n');

function docOf(c: Ctx, key: string) { return parseJson<Record<string, string>>(c.project.docs.find(d => d.key === key)?.data, {}); }

function correctionLines(list: { title: string; wrong: string | null; correct: string | null; severity: string }[]) {
  return list.map(x => `- ${x.title}${x.correct ? `: ${x.correct}` : ''}${x.wrong ? ` (previous failure: ${x.wrong})` : ''}`).join('\n');
}

function productInstruction(i: { name: string; brand: string | null; product: string | null; importance: string }, attached: string[]) {
  const nm = `${i.name}${i.brand ? ` (${i.brand}${i.product ? ' ' + i.product : ''})` : ''}`;
  if (i.importance === 'PACKAGE_CRITICAL') return `PACKAGE CRITICAL — ${nm}: A real product reference is supplied${attached.length ? ` (${attached.join(', ')})` : ''}. When the package is visible, preserve the actual product's brand, package shape, label colors, cap/lid, major visible text placement and overall proportions. Do not replace it with a different brand.`;
  if (i.importance === 'TEXTURE_CRITICAL') return `TEXTURE / APPEARANCE CRITICAL — ${nm}: The package itself does not need to appear. Use the product reference only to guide the ingredient's color, thickness, texture, pour behavior and consistency.`;
  return `OPTIONAL — ${nm}: the reference is supplementary only.`;
}

const BLOCKS: Record<string, (c: Ctx, o: { bibleKeys?: string[]; type: BuilderType }) => Promise<Block | null> | Block | null> = {
  bible: async (_c, o) => {
    const text = await bibleText(o.bibleKeys);
    if (!text) return null;
    const n = (text.match(/^### /gm) || []).length;
    return { text: H('LEVEL 1 — GLOBAL PRODUCTION BIBLE', text), detail: `${n} rule section(s)` };
  },
  chef: c => {
    const t = chefProductionText(c.project.babyChef);
    return t ? { text: H('LEVEL 2 — BABY CHEF PROFILE', t), detail: c.project.babyChef!.displayName } : null;
  },
  recipe: c => {
    const p = c.project;
    const body = p.recipeAdapted || p.recipeOriginal;
    if (!body) return null;
    return { text: H('RECIPE', `${kv([['Recipe', p.recipeName || p.title], ['Cuisine', p.cuisine], ['Yield', p.recipeYield], ['Prep', p.prepTime], ['Cook', p.cookTime]])}\n\n${body}`), detail: `recipe v${p.recipeVersion}` };
  },
  ingredients: c => {
    if (!c.project.ingredients.length) return null;
    const t = c.project.ingredients.map(i => `- ${[i.quantity, i.unit, i.name].filter(Boolean).join(' ')}${i.prepNote ? ', ' + i.prepNote : ''}${i.stage ? ` [stage: ${i.stage}]` : ''}${i.appearance ? ` — appearance: ${i.appearance}` : ''}${i.continuity ? ` — continuity: ${i.continuity}` : ''}`).join('\n');
    return { text: H('INGREDIENTS (preserve these exact quantities)', t), detail: `${c.project.ingredients.length} ingredients` };
  },
  productRefs: c => {
    const rows = c.project.ingredients.filter(i => i.brand || i.product || i.references.length || i.importance !== 'OPTIONAL');
    if (!rows.length) return null;
    const t = rows.map(i => `- ${i.name}${i.brand ? ` — ${i.brand}` : ''}${i.product ? ` ${i.product}` : ''}${i.packageSize ? ` (${i.packageSize})` : ''}: ${INGREDIENT_IMPORTANCE[i.importance]}${i.packageVisible ? '; package visible on camera' : ''}; reference photos: ${i.references.map(r => r.category).join(', ') || 'none uploaded'}`).join('\n');
    return { text: H('PRODUCT REFERENCE SUMMARY', t), detail: `${rows.length} product(s), ${rows.filter(r => r.importance === 'PACKAGE_CRITICAL').length} package-critical` };
  },
  overrides: c => {
    const d = docOf(c, 'overrides');
    const t = OVERRIDE_FIELDS.filter(f => val(d[f])).map(f => `${f}: ${d[f]}`).join('\n');
    return t ? { text: H('LEVEL 3 — PROJECT PRODUCTION OVERRIDES (these take priority)', t), detail: 'project overrides' } : null;
  },
  notes: c => {
    const n = [c.project.description && `Description: ${c.project.description}`, c.project.recipeNotes && `Recipe notes: ${c.project.recipeNotes}`, ...c.project.notes.map(x => `${x.category}: ${x.content}`)].filter(Boolean) as string[];
    return n.length ? { text: H('PROJECT NOTES', n.join('\n')), detail: `${n.length} note(s)` } : null;
  },
  specs: c => {
    const p = c.project;
    const t = kv([['Primary aspect ratio', `${p.aspectRatio}${p.verticalCrop ? ' (vertical 9:16 crop required — keep essential content in the central 55–60% of main narrative shots)' : ''}`], ['Long-form target', p.longDuration], ['Short-form target', p.shortDuration], ['Main hook idea', p.mainHook], ['Long-form hook', p.longHook], ['Short-form hook', p.shortHook], ['Finished food', p.finishedFood], ['CTA preference', p.ctaPreference === 'Custom' ? p.ctaCustom : p.ctaPreference]]);
    return { text: H('SPECIFICATIONS', t), detail: `${p.aspectRatio}, long ${p.longDuration || '—'}, short ${p.shortDuration || '—'}` };
  },
  continuityDoc: c => {
    const d = docOf(c, 'continuity');
    const t = CONTINUITY_FIELDS.filter(f => val(d[f])).map(f => `${f}: ${d[f]}`).join('\n');
    return t ? { text: H('CONTINUITY BIBLE', t), detail: 'project continuity bible' } : null;
  },
  scriptCurrent: c => {
    const s = c.project.scripts[0];
    return s?.content.trim() ? { text: H(`CURRENT SCRIPT (v${s.version}, ${s.status})`, s.content), detail: `script v${s.version}` } : null;
  },
  scenesList: c => {
    const sc = c.project.scenes;
    if (!sc.length) return null;
    const t = sc.map(s => `${sceneCode(s.order)} — ${s.title} [${s.shotPriority}${s.shortKeep ? ', SHORT KEEP' : ''}${s.adultAssist === 'YES' ? ', ADULT ASSIST' : ''}]\n  ingredients: ${val(s.ingredients) || '—'}\n  action: ${val(s.mainAction) || val(s.narrative) || '—'}\n  food BEFORE: ${val(s.foodBefore) || '?'}\n  food DURING: ${val(s.foodDuring) || '?'}\n  food AFTER: ${val(s.foodAfter) || '?'}${s.images.length ? `\n  images: ${s.images.map(i => `${imageCode(i.seq)} ${i.title}${i.approvedAttemptId ? ' (approved)' : ''}`).join('; ')}` : ''}`).join('\n');
    return { text: H('SCENES & FOOD-STATE PROGRESSION', t), detail: `${sc.length} scene(s)` };
  },
  scene: c => {
    const s = c.scene;
    if (!s) return null;
    const t = kv([['Scene', `${sceneCode(s.order)} — ${s.title}`], ['Purpose', s.purpose], ['Recipe step', s.recipeStep], ['Narrative', s.narrative], ['Dialogue', s.dialogue], ['Baby reaction', s.babyReaction], ['Main action', s.mainAction], ['Secondary action', s.secondaryAction], ['Ingredients', s.ingredients], ['Utensils', s.utensils], ['Cookware', s.cookware], ['Baby position', s.babyPosition], ['Adult assistance', `${s.adultAssist}${s.adultNotes ? ' — ' + s.adultNotes : ''}`], ['Camera angle', s.cameraAngle], ['Shot priority', s.shotPriority], ['Vertical crop importance', s.cropImportance], ['ASMR', s.asmr], ['Safety', s.safetyNotes], ['FOOD STATE BEFORE', s.foodBefore], ['FOOD STATE DURING', s.foodDuring], ['FOOD STATE AFTER', s.foodAfter], ['Continuity', s.continuity]]);
    return { text: H('SCENE CONTEXT & FOOD STATE', t), detail: `${sceneCode(s.order)} food state before/during/after` };
  },
  image: c => {
    const i = c.img;
    if (!i) return null;
    const t = kv([['Image', `${imageCode(i.seq)} — ${i.title}`], ['Purpose', i.purpose], ['Shot type', i.shotType], ['Preferred aspect ratio', i.aspectRatio || c.project.aspectRatio], ['Vertical crop importance', i.cropImportance], ['STARTING COMPOSITION', i.startingComposition], ['Character visibility', i.characterVisibility], ['Character expression', i.expression], ['Body positioning', i.bodyPosition], ['Hand positioning', i.handPosition], ['Ingredient(s)', i.ingredients], ['Ingredient quantity', i.ingredientQty], ['Ingredient current state', i.ingredientState], ['Food texture', i.foodTexture], ['Food color', i.foodColor], ['Cookware', i.cookware], ['Utensils', i.utensils], ['Object placement', i.objectPlacement], ['EXACT ACTION MOMENT', i.actionMoment], ['Physics notes', i.physics], ['Lighting', i.lighting], ['Camera angle', i.cameraAngle], ['Camera distance', i.cameraDistance], ['Lens / look', i.lens], ['Depth of field', i.depthOfField], ['Focus point', i.focusPoint], ['Background', i.background], ['Safety / adult assistance', i.safety], ['Continuity requirements', i.continuity], ['Special restrictions', i.restrictions]]);
    const lists = [['WHAT MUST BE VISIBLE', i.mustBeVisible], ['WHAT MUST NOT CHANGE', i.mustNotChange], ['WHAT MUST NOT APPEAR', i.mustNotAppear]].filter(([, v]) => val(v)).map(([k, v]) => `${k}:\n${lines(v).map(x => '- ' + x).join('\n')}`).join('\n');
    const neg = negativeStates(c.scene ?? null, i as any, c.project.scenes as any, c.project.ingredients.map(x => x.name));
    const manual = new Set(lines(i.mustNotAppear).map(x => x.toLowerCase()));
    const auto = neg.filter(x => !manual.has(x.toLowerCase()));
    const negBlock = `\nSCENE-SPECIFIC NEGATIVE STATES (work out from the food-state timeline; state these in the prompt):\n${(auto.length ? auto.map(x => '- ' + x).join('\n') : '- (nothing special for this moment)')}\nFINISH THE PROMPT WITH: ${DEFAULT_NEGATIVE} Only keep restrictions that make sense for this picture and never forbid something the picture needs.`;
    return { text: H('PLANNED IMAGE', `${t}\n${lists}${negBlock}`), detail: `${imageCode(i.seq)} planned-image fields${auto.length ? `; ${auto.length} negative state(s)` : ''}` };
  },
  refs: c => {
    const i = c.img;
    if (!i) return null;
    const list = buildChecklist(i);
    const roles = new Set(i.refs.map(r => r.role));
    const out: string[] = [];
    out.push(list.length ? 'UPLOAD THESE REFERENCE IMAGES WITH THE PROMPT (in this order):\n' + list.map((x, n) => `${n + 1}. ${x.label} — ${x.role} — ${x.required ? 'REQUIRED' : 'OPTIONAL'}${x.notes ? ` — ${x.notes}` : ''}${x.missing ? ' (NOT APPROVED YET)' : ''}`).join('\n') : 'No reference images are attached to this image yet.');
    out.push('ACTUAL APPROVED IMAGES ARE THE VISUAL SOURCE OF TRUTH. Inspect every supplied reference image carefully and identify: current cookware, current bowl, ingredients already present, food state, object positions, Baby Chef position, camera angle, lighting, visible clothing and current cooking stage. If an older text description conflicts with an approved image, FOLLOW THE APPROVED IMAGE. Do not reset the visual state from an older prompt.');
    const ctl: string[] = [];
    if (roles.has('PREVIOUS APPROVED FRAME')) ctl.push('Previous Approved Frame controls: current food state, cookware, object positions, camera composition and cooking progress.');
    if (roles.has('MASTER BABY')) ctl.push('Master Baby reference controls: Baby Chef identity (face, age, skin tone, hair, proportions, outfit, hands).');
    if (roles.has('MASTER KITCHEN')) ctl.push('Master Kitchen reference controls: kitchen architecture, cabinetry, countertop, lighting, background and stove environment.');
    if (ctl.length) out.push('REFERENCE HIERARCHY — which reference controls which property:\n' + ctl.map(x => '- ' + x).join('\n'));
    const prev = i.refs.find(r => r.role === 'PREVIOUS APPROVED FRAME' && r.sourceImage);
    if (prev) out.push(`The supplied previous approved image (${imageCode(prev.sourceImage!.seq)}) is the CURRENT VISUAL STATE. Continue from it. Do not reset the cookware, ingredient state, object positions, Baby Chef identity, kitchen or lighting unless explicitly instructed.`);
    if (roles.has('MASTER BABY')) out.push('Use the master Baby Chef reference only to preserve face, age, skin tone, hair, proportions, outfit and hands. Do not copy an old food state from the master image if the current approved frame shows a later recipe stage.');
    if (roles.has('MASTER KITCHEN')) out.push('Use the master kitchen reference to preserve architecture, cabinetry, countertop, lighting, background and stove environment. Do not override the current close-up composition from the previous approved frame.');
    // product instructions
    const att = new Map<string, string[]>();
    for (const r of i.refs) if (r.reference?.ingredient) { const k = r.reference.ingredient.id; att.set(k, [...(att.get(k) ?? []), r.reference.category]); }
    const prod: string[] = [];
    for (const ing of c.project.ingredients) {
      const attached = att.get(ing.id);
      if (attached) prod.push(productInstruction(ing, attached));
      else if (ing.importance === 'PACKAGE_CRITICAL' && val(i.ingredients).toLowerCase().includes(ing.name.toLowerCase())) prod.push(`WARNING: ${ing.name} is PACKAGE CRITICAL and appears in this image but no product reference is attached.`);
    }
    if (prod.length) out.push('PRODUCT REFERENCES:\n' + prod.map(x => '- ' + x).join('\n'));
    return { text: H('REFERENCE IMAGES & HOW TO USE THEM', out.join('\n\n')), detail: `${list.length} reference(s)${prev ? `; Previous Approved Frame ${imageCode(prev.sourceImage!.seq)}` : ''}${prod.length ? `; ${prod.length} product instruction(s)` : ''}` };
  },
  corrections: c => {
    let rel: typeof c.corrections;
    if (c.img) {
      const hay = `${val(c.img.ingredients)} ${val(c.img.actionMoment)} ${c.img.title} ${val(c.scene?.ingredients)} ${val(c.scene?.mainAction)}`.toLowerCase();
      rel = c.corrections.filter(x => { const keys = [x.ingredient, x.action].filter(Boolean).map(s => s!.toLowerCase()); return keys.length === 0 || keys.some(k => hay.includes(k) || k.split(/\s+/).some(w => w.length > 3 && hay.includes(w))); }).slice(0, 8);
    } else if (c.kl) {
      const hay = `${c.kl.title} ${val(c.kl.actionSequence)} ${val(c.kl.foodPhysics)} ${c.kl.scenes.map(s => `${val(s.scene.ingredients)} ${val(s.scene.mainAction)}`).join(' ')}`.toLowerCase();
      rel = c.corrections.filter(x => { const keys = [x.ingredient, x.action].filter(Boolean).map(s => s!.toLowerCase()); return keys.length > 0 && keys.some(k => hay.includes(k) || k.split(/\s+/).some(w => w.length > 3 && hay.includes(w))); }).slice(0, 8);
    } else rel = c.corrections.slice(0, 10);
    return rel.length ? { text: H('KNOWN CORRECTIONS TO RESPECT', correctionLines(rel)), detail: rel.map(x => `"${x.title}"`).slice(0, 3).join(', ') + (rel.length > 3 ? ` +${rel.length - 3}` : '') } : null;
  },
  file: c => {
    const i = c.img;
    if (!i) return null;
    const sc = c.project.scenes.find(s => s.id === i.sceneId);
    const name = expectedFilename({ slug: c.project.slug, sceneOrder: sc?.order ?? 1, seq: i.seq, title: i.title, version: nextVersion(i.attempts.map(a => a.number)) });
    return { text: H('REQUIRED RESULT FILENAME (must appear in the prompt you write)', `The final prompt you write MUST end with the following section, copied verbatim (do not change the filename):\n\n${fileBlock(name)}`), detail: name };
  },
  attempt: c => {
    const a = c.attempt, i = c.img;
    if (!a || !i) return null;
    const used = a.promptType === 'FULL' ? i.fullPrompt : i.contPrompt;
    const t = [kv([['Failed attempt', `#${a.number} (${a.sourceTool}, ${a.promptType} prompt${a.promptVersion ? ' v' + a.promptVersion : ''})`], ['Status', a.status], ['Correction category', a.corrCategory], ['Severity', a.severity], ['WHAT WENT WRONG', a.wrong], ['WHAT SHOULD CHANGE', a.change], ['WHAT MUST REMAIN UNCHANGED', a.keep], ['Notes', a.notes]]),
      !val(a.wrong) && !val(a.change) ? '(No correction was recorded for this attempt — describe the problem under SPECIAL INSTRUCTIONS.)' : '', val(used) ? `ORIGINAL PROMPT USED:\n${used}` : ''].filter(Boolean).join('\n');
    return { text: H('FAILED ATTEMPT & CORRECTION', t), detail: `attempt ${a.number}${a.wrong ? ': ' + a.wrong.slice(0, 40) : ''}` };
  },
  approvedImages: c => {
    const rows = c.project.scenes.flatMap(s => s.images.filter(i => i.approvedAttemptId).map(i => `- ${imageCode(i.seq)} (${sceneCode(s.order)} ${s.title}): ${i.title}${i.approvedAttempt?.asset?.width ? ` — ${ratioLabel(i.approvedAttempt.asset.width, i.approvedAttempt.asset.height)} ${i.approvedAttempt.asset.orientation}` : ''}${val(i.ingredientState) ? ` — state: ${i.ingredientState}` : ''}${val(i.actionMoment) ? ` — moment: ${i.actionMoment}` : ''}`));
    return rows.length ? { text: H('APPROVED IMAGES (in project order)', rows.join('\n')), detail: `${rows.length} approved image(s)` } : null;
  },
  history: c => {
    const i = c.img;
    if (!i) return null;
    const t = [val(i.fullPrompt) && `CURRENT FULL PROMPT DRAFT:\n${i.fullPrompt}`, val(i.contPrompt) && `CURRENT CONTINUATION PROMPT DRAFT:\n${i.contPrompt}`].filter(Boolean).join('\n\n');
    return t ? { text: H('EARLIER PROMPT DRAFTS', t), detail: 'existing prompt drafts' } : null;
  },
  kling: c => {
    const k = c.kl;
    if (!k) return null;
    const refs = k.refs.map((r, n) => {
      const im = r.image; const a = im.approvedAttempt?.asset ?? im.attempts[0]?.asset;
      return `@image${n + 1} = ${imageCode(im.seq)} "${im.title}" (${im.approvedAttemptId ? 'approved' : 'NOT approved'}${a?.width ? `, ${ratioLabel(a.width, a.height)} ${a.orientation}` : ''}; ${sceneCode(im.scene.order)})${val(im.startingComposition) ? `\n   composition: ${im.startingComposition}` : ''}${val(im.ingredientState) ? `\n   food state: ${im.ingredientState}` : ''}${val(im.actionMoment) ? `\n   moment: ${im.actionMoment}` : ''}`;
    }).join('\n');
    const voice = k.useProfileVoice ? val(c.project.babyChef?.voiceInstruction) : val(k.voiceOverride);
    const acts = parseJson<string[]>(k.majorActions, []).map((a, n) => `${n + 1}. ${a}`).join('\n');
    const t = `ORDERED REFERENCE IMAGES (@imageN):\n${refs || '(none attached)'}\n\n` + kv([['Clip', `${klingCode(k.order)} — ${k.title}`], ['Purpose', k.purpose], ['Duration', k.durationTarget ? `${k.durationTarget}s target${k.durationMin ? ` (min ${k.durationMin}` : ''}${k.durationMax ? `${k.durationMin ? ', ' : ' ('}max ${k.durationMax}` : ''}${k.durationMin || k.durationMax ? ')' : ''}` : null], ['Aspect ratio', k.aspectRatio || c.project.aspectRatio], ['Starting composition', k.startingComposition], ['Food state', k.foodState], ['Action sequence', k.actionSequence], ['Major actions', acts], ['Physical movement', k.physicalMovement], ['FOOD PHYSICS', k.foodPhysics], ['DIALOGUE', k.dialogue], ['Baby Chef voice', voice], ['Off-screen narration', k.offScreen ? 'yes (face not visible)' : ''], ['Lip-sync required', k.lipSync ? 'yes' : ''], ['Camera behavior', k.cameraBehavior], ['Focus behavior', k.focusBehavior], ['ASMR', k.asmrLines], ['Ambient audio', k.ambient], ['Lighting / style', k.lighting], ['Continuity constraints', k.continuity], ['Safety / adult assistance', k.safety], ['Restrictions', k.restrictions], ['ENDING COMPOSITION', k.endingComposition]]);
    return { text: H('KLING CLIP', t), detail: `${klingCode(k.order)} with ${k.refs.length} ordered reference(s)` };
  },
  klingScenes: c => {
    const k = c.kl;
    if (!k || !k.scenes.length) return null;
    const t = k.scenes.map(x => { const s = x.scene; return `${sceneCode(s.order)} — ${s.title}: food BEFORE ${val(s.foodBefore) || '?'} | DURING ${val(s.foodDuring) || '?'} | AFTER ${val(s.foodAfter) || '?'}${val(s.dialogue) ? ` | dialogue: ${s.dialogue}` : ''}`; }).join('\n');
    return { text: H('RELATED SCENES & FOOD STATES', t), detail: k.scenes.map(x => sceneCode(x.scene.order)).join(', ') };
  },
  klingAttempt: c => {
    const a = c.kAttempt, k = c.kl;
    if (!a || !k) return null;
    const t = [kv([['Failed generation', `#${a.number}${a.externalName ? ' (' + a.externalName + ')' : ''}`], ['WHAT WENT WRONG', a.wrong], ['WHAT MUST CHANGE', a.change], ['WHAT MUST REMAIN UNCHANGED', a.keep], ['Prompt revision notes', a.promptNotes], ['Notes', a.notes], ['Target duration', k.durationTarget ? `${k.durationTarget}s` : null]]), `ORIGINAL KLING PROMPT:\n${k.finalPrompt || '(empty — no final prompt saved yet)'}`].join('\n');
    return { text: H('FAILED KLING GENERATION', t), detail: `generation ${a.number}` };
  },
  existingClips: c => {
    const rows = c.project.clips.map(k => `- ${klingCode(k.order)} ${k.title}: ${k.refs.map((r, n) => `@image${n + 1}=${imageCode(r.image.seq)}`).join(', ') || 'no refs'} (${k.status})`);
    return rows.length ? { text: H('EXISTING KLING CLIPS', rows.join('\n')), detail: `${rows.length} clip(s)` } : null;
  },
};

export async function buildPrompt(projectId: string, type: BuilderType, link: LinkParams = {}, opts: BuildOptions = {}): Promise<BuildResult> {
  const def = BUILDERS[type];
  const c = await loadCtx(projectId, link);
  const target = opts.target ?? 'CHATGPT';
  const off = new Set(opts.off ?? []);
  const on = new Set(opts.on ?? []);
  const keys = [...def.blocks, ...def.extra];
  const previews: BlockPreview[] = [];
  const parts: string[] = [];
  const warnings: string[] = [];
  const allSections = await db.bibleSection.findMany({ where: { active: true }, orderBy: { order: 'asc' } });
  const bibleKeys = opts.bibleKeys ?? def.bible ?? undefined;
  for (const k of keys) {
    const required = def.required.includes(k);
    const defaultOn = def.blocks.includes(k);
    const enabled = required || (defaultOn ? !off.has(k) : on.has(k));
    const b = await BLOCKS[k](c, { bibleKeys, type });
    const empty = !b;
    if (enabled && b) parts.push(b.text);
    if (enabled && empty && required) warnings.push(`${BLOCK_LABELS[k]} is required but empty — fill it in first.`);
    previews.push({ key: k, label: BLOCK_LABELS[k] ?? k, on: enabled && !empty, required, detail: b?.detail ?? (enabled ? 'nothing to include yet' : 'not included'), empty });
  }
  if (def.needs === 'image' && !c.img) warnings.push('Choose a planned image.');
  if (def.needs === 'attempt' && !c.attempt) warnings.push('This image has no uploaded attempt to redo yet.');
  if (def.needs === 'kling' && !c.kl) warnings.push('Choose a Kling clip.');
  if (def.needs === 'klingAttempt' && !c.kAttempt) warnings.push('This clip has no recorded generation to redo yet.');
  const note = val(opts.note);
  if (note) parts.push(H('SPECIAL INSTRUCTIONS FOR THIS PROMPT', note));
  const tpl = await db.promptTemplate.findUnique({ where: { code: def.template } });
  if (tpl?.active) parts.push(render(tpl.text, c.vars).out);
  else warnings.push(`Task template ${def.template} is missing or inactive (see Prompt Templates).`);
  const head = `PURPOSE: ${def.purpose}\nPREPARED FOR: ${target}\nPROJECT: ${c.project.title}${c.img ? `\nIMAGE: ${imageCode(c.img.seq)} — ${c.img.title}` : ''}${c.kl ? `\nKLING CLIP: ${klingCode(c.kl.order)} — ${c.kl.title}` : ''}\n\nYou are helping plan a realistic AI-generated Baby Chef cooking video. Context is given in layers. PRIORITY: project-specific instructions override the Baby Chef profile, which overrides/specializes the global production bible. Approved reference images are always the visual source of truth.`;
  const text = [head, ...parts].join('\n\n');
  const included = previews.filter(p => p.on).map(p => p.key);
  const meta = {
    type, purpose: def.purpose, target, projectId, imageId: c.img?.id ?? null, klingId: c.kl?.id ?? null, attemptId: c.attempt?.id ?? null, klingAttemptId: c.kAttempt?.id ?? null,
    bibleVersion: await currentBibleVersion(), recipeVersion: c.project.recipeVersion, chefUpdatedAt: c.project.babyChef?.updatedAt ?? null, chefName: c.project.babyChef?.displayName ?? null,
    templateCode: def.template, templateUpdatedAt: tpl?.updatedAt ?? null, blocks: included, bibleSections: bibleKeys ?? 'all', createdAt: new Date().toISOString(),
  };
  return { type, purpose: def.purpose, target, text, blocks: previews, warnings, bibleSections: allSections.map(s => ({ key: s.key, title: s.title, included: !bibleKeys || bibleKeys.includes(s.key) })), meta, templateName: tpl?.name ?? null };
}

// Named wrappers (strongly-typed entry points)
export const buildProductionPlanPrompt = (projectId: string, o?: BuildOptions) => buildPrompt(projectId, 'plan', {}, o);
export const buildScriptPrompt = (projectId: string, o?: BuildOptions) => buildPrompt(projectId, 'script', {}, o);
export const buildSceneBreakdownPrompt = (projectId: string, o?: BuildOptions) => buildPrompt(projectId, 'scenes', {}, o);
export const buildImagePlanPrompt = (projectId: string, sceneId?: string, o?: BuildOptions) => buildPrompt(projectId, 'image-plan', { sceneId }, o);
export const buildFullImagePromptWriter = (projectId: string, imageId: string, o?: BuildOptions) => buildPrompt(projectId, 'image-full', { imageId }, o);
export const buildContinuationPromptWriter = (projectId: string, imageId: string, o?: BuildOptions) => buildPrompt(projectId, 'image-cont', { imageId }, o);
export const buildImageRedoPrompt = (projectId: string, imageId: string, attemptId?: string, o?: BuildOptions) => buildPrompt(projectId, 'image-redo', { imageId, attemptId }, o);
export const buildKlingGroupingPrompt = (projectId: string, o?: BuildOptions) => buildPrompt(projectId, 'kling-group', {}, o);
export const buildKlingPromptWriter = (projectId: string, klingId: string, o?: BuildOptions) => buildPrompt(projectId, 'kling-final', { klingId }, o);
export const buildKlingRedoPrompt = (projectId: string, klingId: string, klingAttemptId?: string, o?: BuildOptions) => buildPrompt(projectId, 'kling-redo', { klingId, klingAttemptId }, o);
void relevantCorrections;
