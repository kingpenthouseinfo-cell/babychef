import { parseIngredientLines, type ParsedIngredient } from './ingredient-parse';
import { PLACEHOLDER, isPlaceholder } from './questions';
import { parseRecipeText, hasRecipeStructure, titleCase, type RecipeParse } from './recipe-parse';

/** FILL FROM TEXT — deterministic parser for human-readable "LABEL: value" text (no AI). Pure, so it can be previewed safely. */
export type ParsedScene = { title: string; anchors?: string; klingNote?: string; mainShot?: string; insertShots?: string; duration?: string; purpose?: string; mainAction?: string; adultNotes?: string; cameraAngle?: string; asmr?: string; shortKeep?: boolean | string; narrative?: string; dialogue?: string; babyReaction?: string; foodBefore?: string; foodDuring?: string; foodAfter?: string; notes?: string; images: ParsedImage[] };
export type ParsedImage = { title: string; purpose?: string; fullPrompt?: string; contPrompt?: string; shotType?: string; foodState?: string; cameraAngle?: string; mustBeVisible?: string; mustNotAppear?: string; sceneRef?: number; sceneTitle?: string };
export type ParsedImport = {
  babyChef?: string;
  fields: Partial<Record<'title' | 'recipeName' | 'cuisine' | 'description' | 'mainHook' | 'finishedFood' | 'recipeYield' | 'prepTime' | 'cookTime' | 'longDuration' | 'shortDuration' | 'recipeSource' | 'ctaCustom', string>>;
  recipe?: string; method?: string; ingredients: ParsedIngredient[]; scenes: ParsedScene[]; strayImages: ParsedImage[]; publishing?: string;
  warnings: string[]; found: string[];
  recipeStructured?: RecipeParse; suspicious?: boolean;
};

// label (lower-case) -> canonical key. Aliases keep the format forgiving.
const TOP: Record<string, string> = {
  'project': 'title', 'project name': 'title', 'recipe video': 'title', 'recipe video name': 'title', 'title': 'title', 'video title': 'title', 'name': 'title',
  'recipe name': 'recipeName', 'dish': 'recipeName', 'cuisine': 'cuisine', 'description': 'description', 'summary': 'description',
  'hook': 'mainHook', 'main hook': 'mainHook', 'video hook': 'mainHook', 'finished food': 'finishedFood', 'finished dish': 'finishedFood', 'final dish': 'finishedFood',
  'yield': 'recipeYield', 'makes': 'recipeYield', 'serves': 'recipeYield', 'servings': 'recipeYield', 'prep time': 'prepTime', 'prep': 'prepTime', 'cook time': 'cookTime', 'cooking time': 'cookTime', 'bake time': 'cookTime',
  'long video': 'longDuration', 'long duration': 'longDuration', 'video length': 'longDuration', 'short video': 'shortDuration', 'short duration': 'shortDuration', 'short length': 'shortDuration',
  'source': 'recipeSource', 'recipe source': 'recipeSource', 'credit': 'recipeSource', 'cta': 'ctaCustom', 'call to action': 'ctaCustom',
  'baby chef': 'babyChef', 'chef': 'babyChef', 'character': 'babyChef',
  'recipe': 'recipe', 'full recipe': 'recipe', 'ingredients': 'ingredients', 'ingredient list': 'ingredients', 'method': 'method', 'steps': 'method', 'instructions': 'method', 'directions': 'method',
  'posting notes': 'publishing', 'publishing notes': 'publishing', 'publishing': 'publishing', 'post notes': 'publishing',
};
const SCENE_SUB: Record<string, keyof ParsedScene> = { 'planned image anchors': 'anchors', 'image anchors': 'anchors', 'kling grouping note': 'klingNote', 'video clip grouping note': 'klingNote', 'main shot': 'mainShot', 'insert shots': 'insertShots', 'estimated duration': 'duration', 'title': 'title', 'purpose': 'purpose', 'baby action': 'mainAction', 'adult action': 'adultNotes', 'camera': 'cameraAngle', 'asmr': 'asmr', 'short keep': 'shortKeep', 'action': 'narrative', 'what happens': 'narrative', 'scene action': 'narrative', 'narrative': 'narrative', 'description': 'narrative', 'dialogue': 'dialogue', 'dialog': 'dialogue', 'says': 'dialogue', 'reaction': 'babyReaction', 'baby reaction': 'babyReaction', 'food before': 'foodBefore', 'before': 'foodBefore', 'food during': 'foodDuring', 'during': 'foodDuring', 'food after': 'foodAfter', 'after': 'foodAfter', 'notes': 'notes', 'note': 'notes' };
const IMG_SUB: Record<string, keyof ParsedImage | 'sceneRef'> = { 'title': 'title', 'shot type': 'shotType', 'food state': 'foodState', 'camera': 'cameraAngle', 'must show': 'mustBeVisible', 'must not show': 'mustNotAppear', 'full image prompt': 'fullPrompt', 'next image prompt': 'contPrompt', 'action moment': 'purpose', 'purpose': 'purpose', 'action': 'purpose', 'what': 'purpose', 'description': 'purpose', 'prompt': 'fullPrompt', 'image prompt': 'fullPrompt', 'scene': 'sceneRef' };

const SCENE_HEAD = /^\s*(?:#+\s*)?scene\s*(\d+)?\s*[:.\-–—]\s*(.*)$/i;
const IMG_HEAD = /^\s*(?:#+\s*)?(?:image|picture|pic|shot)\s*(\d+)?\s*[:.\-–—]\s*(.*)$/i;
const BARE_SCENE = /^\s*SCENE\s*$/, BARE_PIC = /^\s*(?:PICTURE|IMAGE)\s*$/;
const LABEL = /^\s*(?:#+\s*)?([A-Za-z][A-Za-z /&]{1,30}?)\s*:\s*(.*)$/;
const HEADING_ONLY = /^\s*(?:#+\s*)?([A-Za-z][A-Za-z /&]{1,30}?)\s*:?\s*$/;

export function parseImport(raw: string): ParsedImport {
  const out: ParsedImport = { fields: {}, ingredients: [], scenes: [], strayImages: [], warnings: [], found: [] };
  const lines = raw.replace(/\r/g, '').split('\n');
  type Cur = { kind: 'top'; key: string } | { kind: 'scene'; sub: keyof ParsedScene | null } | { kind: 'image'; sub: keyof ParsedImage | 'sceneRef' | null } | null;
  let cur: Cur = null;
  const buf: Record<string, string[]> = {};
  const push = (key: string, text: string) => { (buf[key] ??= []).push(text); };
  let scene: ParsedScene | null = null, image: ParsedImage | null = null;
  const appendScene = (sub: keyof ParsedScene, text: string) => { if (!scene || sub === 'images') return; if (sub === 'title') { if (text.trim()) scene.title = text.trim(); return; } (scene as any)[sub] = ((scene as any)[sub] ? (scene as any)[sub] + '\n' : '') + text; };
  const appendImage = (sub: keyof ParsedImage | 'sceneRef', text: string) => { if (!image) return; if (sub === 'sceneRef') { const n = parseInt(text.replace(/\D+/g, ''), 10); if (!isNaN(n) && /^\s*(scene\s*)?\d+\s*$/i.test(text)) image.sceneRef = n; else if (text.trim()) image.sceneTitle = text.trim(); return; } if (sub === 'title') { if (text.trim()) image.title = text.trim(); return; } (image as any)[sub] = ((image as any)[sub] ? (image as any)[sub] + '\n' : '') + text; };

  for (const line of lines) {
    if (BARE_SCENE.test(line)) { scene = { title: '', images: [] }; out.scenes.push(scene); image = null; cur = { kind: 'scene', sub: null }; continue; }
    if (BARE_PIC.test(line)) { image = { title: '' }; if (scene) scene.images.push(image); else out.strayImages.push(image); cur = { kind: 'image', sub: null }; continue; }
    if (/^\s*(SCENES|PICTURES|VIDEO CLIPS|POSTING NOTES)\s*$/.test(line)) { scene = null; image = null; cur = /POSTING/.test(line) ? { kind: 'top', key: 'publishing' } : null; continue; }
    if (cur?.kind === 'image' && /^\s*scene\s*:/i.test(line)) { const v = line.replace(/^\s*scene\s*:\s*/i, ''); appendImage('sceneRef', v); continue; }
    const sh = line.match(SCENE_HEAD), ih = line.match(IMG_HEAD);
    if (sh && (sh[2] || sh[1])) { scene = { title: sh[2].trim() || `Scene ${sh[1] ?? out.scenes.length + 1}`, images: [] }; out.scenes.push(scene); image = null; cur = { kind: 'scene', sub: null }; continue; }
    if (ih && (ih[2] || ih[1])) { image = { title: ih[2].trim() || `Picture ${ih[1] ?? ''}`.trim() }; if (scene) scene.images.push(image); else out.strayImages.push(image); cur = { kind: 'image', sub: null }; continue; }
    const m = line.match(LABEL) ?? null;
    const key = m ? m[1].trim().toLowerCase() : null;
    // inside a scene / image block: sub-labels first
    if (cur?.kind === 'scene' && m && key! in SCENE_SUB) { cur = { kind: 'scene', sub: SCENE_SUB[key!] }; if (m[2].trim()) appendScene(SCENE_SUB[key!], m[2].trim()); continue; }
    if (cur?.kind === 'image' && m && key! in IMG_SUB) { cur = { kind: 'image', sub: IMG_SUB[key!] as any }; if (m[2].trim()) appendImage(IMG_SUB[key!] as any, m[2].trim()); continue; }
    if (m && key! in TOP) { scene = null; image = null; cur = { kind: 'top', key: TOP[key!] }; if (m[2].trim()) push(TOP[key!], m[2].trim()); continue; }
    const h = line.match(HEADING_ONLY);
    if (h && h[1].trim().toLowerCase() in TOP && /:\s*$|^[A-Z #]/.test(line.trim()) && line.trim().length < 40) { scene = null; image = null; cur = { kind: 'top', key: TOP[h[1].trim().toLowerCase()] }; continue; }
    if (!line.trim()) { if (cur?.kind === 'top') push(cur.key, ''); else if (cur?.kind === 'scene' && cur.sub) appendScene(cur.sub, ''); continue; }
    if (cur?.kind === 'top') push(cur.key, line.replace(/\s+$/, ''));
    else if (cur?.kind === 'scene') { if (cur.sub !== 'title') appendScene(cur.sub ?? 'narrative', line.trim()); }
    else if (cur?.kind === 'image') { if (cur.sub !== 'title') appendImage(cur.sub ?? 'purpose', line.trim()); }
    else if (!out.fields.title && line.trim() && !m) { /* first free line may be a title */ push('title', line.trim()); cur = null; }
  }
  const val = (k: string) => (buf[k] ?? []).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  for (const k of Object.keys(buf)) {
    if (k === 'recipe') out.recipe = val(k);
    else if (k === 'method') out.method = val(k);
    else if (k === 'ingredients') out.ingredients = parseIngredientLines(val(k));
    else if (k === 'babyChef') out.babyChef = val(k).split('\n')[0];
    else if (k === 'publishing') out.publishing = val(k);
    else if (val(k)) (out.fields as any)[k] = val(k).split('\n')[0] && ['mainHook', 'finishedFood', 'description', 'ctaCustom'].includes(k) ? val(k) : val(k).split('\n')[0];
  }
  out.scenes.forEach((sc, n) => { if (!sc.title) sc.title = `Scene ${n + 1}`; if (typeof sc.shortKeep === 'string') sc.shortKeep = /^\s*(y|yes|true)/i.test(sc.shortKeep); });
  for (const im of [...out.strayImages, ...out.scenes.flatMap(sc => sc.images)]) if (!im.title) im.title = (im.purpose || 'Picture').split('\n')[0].slice(0, 60);
  for (const im of [...out.strayImages]) if (im.sceneTitle) { const t = out.scenes.find(sc => sc.title.toLowerCase() === im.sceneTitle!.toLowerCase()); if (t) { t.images.push(im); out.strayImages.splice(out.strayImages.indexOf(im), 1); } }
  for (const s of out.scenes) for (const k of ['narrative', 'dialogue', 'babyReaction', 'foodBefore', 'foodDuring', 'foodAfter', 'notes', 'anchors', 'klingNote'] as const) if (s[k]) s[k] = s[k]!.trim();
  // images with an explicit scene number move into that scene
  for (const im of out.strayImages) if (im.sceneRef && out.scenes[im.sceneRef - 1]) out.scenes[im.sceneRef - 1].images.push(im);
  out.strayImages = out.strayImages.filter(im => !(im.sceneRef && out.scenes[im.sceneRef - 1]));
  for (const s of out.scenes) for (const im of [...s.images]) if (im.sceneRef && im.sceneRef !== out.scenes.indexOf(s) + 1 && out.scenes[im.sceneRef - 1]) { s.images.splice(s.images.indexOf(im), 1); out.scenes[im.sceneRef - 1].images.push(im); }
  // structured recipe: title / yield / ingredient groups / method sections (the free-text recipe region is everything before the first scene or picture)
  const firstBlock = lines.findIndex(l => (SCENE_HEAD.test(l) && (RegExp.$2 || RegExp.$1)) || (IMG_HEAD.test(l) && (RegExp.$2 || RegExp.$1)));
  // a production plan (Title:/Dialogue:/Baby Action:/FOOD DURING: …) is never part of the recipe, so the recipe region stops at its first marker
  const PLAN_MARK = /^\s*(?:[-*•]\s*)?(?:title|purpose|dialogue|baby action|adult action|food (?:before|during|after)(?: rest)?|camera|asmr|short keep)\s*:/i;
  const firstPlan = lines.findIndex(l => PLAN_MARK.test(l));
  const cutAt = [firstBlock, firstPlan].filter(n => n > -1).reduce((a, n) => Math.min(a, n), Infinity);
  const region = (cutAt !== Infinity ? lines.slice(0, cutAt) : lines).join('\n');
  const rp = parseRecipeText(region);
  if (hasRecipeStructure(rp)) {
    out.recipeStructured = rp; out.suspicious = rp.suspicious;
    out.ingredients = rp.groups.flatMap(g => g.items.map(i => ({ ...i, group: g.name })));
    out.recipe = region.trim(); out.method = undefined;
    if (rp.title && (!out.fields.title || out.fields.title === out.fields.title.toUpperCase())) out.fields.title = rp.title === rp.title.toUpperCase() ? titleCase(rp.title) : rp.title;
    if (rp.yield) out.fields.recipeYield = rp.yield;
    out.warnings.push(...rp.warnings);
  }
  // summary + warnings
  if (out.fields.title) out.found.push('Name'); if (out.babyChef) out.found.push('Baby Chef');
  if (out.recipe || out.method) out.found.push('Recipe'); if (out.ingredients.length) out.found.push(`${out.ingredients.length} ingredients`);
  if (out.recipeStructured) out.found.push(`${out.recipeStructured.counts.groups} ingredient group${out.recipeStructured.counts.groups === 1 ? '' : 's'}`, `${out.recipeStructured.counts.sections} method section${out.recipeStructured.counts.sections === 1 ? '' : 's'}`);
  if (out.scenes.length) out.found.push(`${out.scenes.length} scenes`); const nImg = out.scenes.reduce((a, s) => a + s.images.length, 0) + out.strayImages.length; if (nImg) out.found.push(`${nImg} pictures`);
  for (const i of out.ingredients) if (i.uncertain) out.warnings.push(`I wasn’t sure how to split “${i.original}” — I’ll keep it as written.`);
  if (out.strayImages.length) out.warnings.push(`${out.strayImages.length} picture${out.strayImages.length > 1 ? 's don’t' : ' doesn’t'} say which scene they belong to — they’ll go in a scene called “Imported pictures”.`);
  const all = [raw].join('');
  const phs = [...new Set([...all.matchAll(PLACEHOLDER)].map(m => m[0]).filter(isPlaceholder))];
  if (phs.length) out.warnings.push(`Found ${phs.length} blank spot${phs.length > 1 ? 's' : ''} (${phs.slice(0, 4).join(', ')}) — I’ll ask about ${phs.length > 1 ? 'them' : 'it'} in Missing Info.`);
  if (!out.found.length) out.warnings.push('I couldn’t find anything I recognise. Check the labels (for example “RECIPE:”, “INGREDIENTS:”, “SCENE 1:”).');
  return out;
}

export const IMPORT_TEMPLATE = `NAME: Jamaican Beef Patties
BABY CHEF: Jamaican Baby Chef
CUISINE: Jamaican
YIELD: 8 patties
PREP TIME: 45 minutes
COOK TIME: 35 minutes
HOOK: Baby breaks open a finished patty, steam rises, then says LOOK PON DAT!
FINISHED FOOD: Golden flaky patty with spiced beef filling

RECIPE:
Paste the full recipe text here, exactly as you have it.

INGREDIENTS:
- 2 cups flour, sifted
- 1 lb ground beef | Brand: Example Brand
- 1 tsp salt

METHOD:
1. Mix the dough.
2. Cook the filling.

SCENE 1: Finished Patty Hook
ACTION: Baby breaks open a hot patty.
DIALOGUE: Look pon dat!
FOOD AFTER: Golden patty split open, steam rising.

IMAGE 1: Close-up of the split patty
PURPOSE: Hero shot for the thumbnail.

SCENE 2: Ingredients
ACTION: Baby shows each ingredient.
`;

export const IMPORT_PROMPT = `CREATE BABY CHEF STUDIO IMPORT

Turn the recipe and video idea below into plain text I can paste into Baby Chef Studio.
Use EXACTLY these labels, one per line, in this order. Leave a label out if you don't know it. Use [TBD] for anything you are unsure about — do not guess.

NAME:
BABY CHEF:
CUISINE:
YIELD:
PREP TIME:
COOK TIME:
HOOK:
FINISHED FOOD:

RECIPE:
(the full recipe text)

INGREDIENTS:
- one ingredient per line, for example: 2 cups flour, sifted
- add " | Brand: Name" after an ingredient when the brand matters

METHOD:
(numbered steps)

SCENE 1: (scene name)
ACTION:
DIALOGUE:
FOOD BEFORE:
FOOD AFTER:

IMAGE 1: (picture name)
PURPOSE:

(repeat SCENE / IMAGE blocks as needed)

Here is my recipe and idea:
[paste here]`;
