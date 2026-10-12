import { parseIngredientLine, type ParsedIngredient } from './ingredient-parse';

/** Recipe text → title, yield, ingredient groups, method sections. Deterministic (no AI), pure, so it can be previewed safely. */
export type RecipeGroup = { name: string; items: ParsedIngredient[] };
export type MethodSection = { title: string; steps: string[] };
export type RecipeParse = {
  title?: string; yield?: string; groups: RecipeGroup[]; sections: MethodSection[];
  warnings: string[]; duplicate: boolean; suspicious: boolean;
  counts: { groups: number; ingredients: number; sections: number; steps: number };
  source: string;
};

const SMALL = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with']);
export const titleCase = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim().split(' ').map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
const clean = (l: string) => l.replace(/\*\*|__/g, '').replace(/^\s*#+\s*/, '').replace(/\s+$/, '');
const YIELD = /^(yield|serves|makes|servings?)\s*:\s*(.*)$/i;
const YIELD_BARE = /^(yield|serves|makes|servings?)\s*$/i;
const METHOD_HEAD = /^(method|directions|instructions|steps|preparation)\s*:?\s*$/i;
const ING_HEAD = /^(.*\bingredients?)\s*:?\s*$/i;
const BULLET = /^\s*(?:[-•*▪●☐☑✓]|•)\s+/;
const QTYLINE = /^\s*(?:(?:[-•*▪●]\s+)?(?:\d|[½¼¾⅓⅔⅛]|a pinch|pinch|a dash|dash|a few|few|some|salt|pepper))/i;
const NUM_HEAD = /^\s*(\d{1,2})[.)]\s+([A-Z0-9][A-Z0-9 ,'&/()\-–—]{2,80})\s*$/; // "1. MAKE THE DOUGH"
const NUM_STEP = /^\s*\d{1,3}[.)]\s+(.*)$/;
const upperish = (s: string) => /[A-Z]/.test(s) && s === s.toUpperCase();

export function parseRecipeText(raw: string): RecipeParse {
  const lines = raw.replace(/\r/g, '').split('\n').map(clean);
  const out: RecipeParse = { groups: [], sections: [], warnings: [], duplicate: false, suspicious: false, counts: { groups: 0, ingredients: 0, sections: 0, steps: 0 }, source: raw };
  type Zone = 'head' | 'ing' | 'method' | 'dup';
  let zone: Zone = 'head';
  let group: RecipeGroup | null = null, section: MethodSection | null = null;
  let pending: 'title' | 'yield' | 'group' | 'section' | null = null;
  const nextNonEmpty = (i: number) => { for (let j = i + 1; j < lines.length; j++) if (lines[j].trim()) return j; return -1; };
  const titleKey = () => (out.title ?? '').toLowerCase();
  const startGroup = (name: string) => { group = { name: titleCase(name.replace(/[:]+$/, '')), items: [] }; out.groups.push(group); };
  const startSection = (name: string) => { section = { title: titleCase(name.replace(/^\d{1,2}[.)]\s*/, '').replace(/[:]+$/, '')), steps: [] }; out.sections.push(section); };
  const looksIngredientBlock = (i: number) => { const j = nextNonEmpty(i); return j > -1 && (QTYLINE.test(lines[j]) || BULLET.test(lines[j])); };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) { continue; }
    if (pending) {
      const p = pending; pending = null;
      if (p === 'title') { if (!out.title) out.title = line; continue; }
      if (p === 'yield') { if (!out.yield) out.yield = line; continue; }
      if (p === 'group') { startGroup(line); zone = zone === 'dup' ? 'dup' : 'ing'; continue; }
      if (p === 'section') { startSection(line); zone = 'method'; continue; }
    }
    if (/^recipe title\s*:?\s*$/i.test(line)) { if (out.title && zone !== 'head') { out.duplicate = true; zone = 'dup'; } pending = 'title'; continue; }
    const ym = line.match(YIELD);
    if (ym || YIELD_BARE.test(line)) {
      if (zone === 'method' || zone === 'dup' || (zone === 'ing' && out.yield)) { out.duplicate = true; zone = 'dup'; if (ym && ym[2].trim()) continue; pending = 'yield'; continue; }
      if (ym && ym[2].trim()) { if (!out.yield) out.yield = ym[2].trim(); } else pending = 'yield';
      continue;
    }
    if (/^ingredient group\s*:?\s*$/i.test(line)) { if (zone === 'method' || zone === 'dup') { out.duplicate = true; zone = 'dup'; } pending = 'group'; continue; }
    if (/^method section\s*:?\s*$/i.test(line)) { pending = 'section'; if (zone === 'dup') zone = 'method'; continue; }
    if (METHOD_HEAD.test(line)) { section = null; if (zone === 'dup') { zone = 'dup'; continue; } zone = 'method'; if (!out.sections.length) { /* sections start on first heading or first step */ } continue; }
    const ih = line.match(ING_HEAD);
    const lowerLabel = /^[A-Za-z][A-Za-z &\-/']{2,60}:$/.test(line) && !/^\d/.test(line);
    const isGroupHead = (!!ih && !/\d/.test(line.slice(0, 3)) && line.length < 70 && !/[.]$/.test(line) && (zone !== 'method' || upperish(line.replace(/:$/, '')) || /:$/.test(line)) && !BULLET.test(line) && !/^\d/.test(line))
      || (lowerLabel && (zone === 'ing' || zone === 'head') && looksIngredientBlock(i));
    if (isGroupHead) {
      if (zone === 'method' || zone === 'dup') { if (zone === 'method' && out.sections.length && looksIngredientBlock(i)) { out.duplicate = true; zone = 'dup'; } else if (zone === 'dup') { /* stay */ } else { /* label like "Ingredients:" inside method is just a heading */ } if (zone === 'dup') continue; }
      startGroup((ih ? ih[1] : line)); zone = 'ing'; continue;
    }
    // numbered ALL-CAPS heading = method section (also ends an ingredient list that had no METHOD heading)
    const nh = line.match(NUM_HEAD);
    if (nh && upperish(nh[2]) && !/\d\s*(cups?|tsp|tbsp|oz|lb)/i.test(nh[2]) && zone !== 'dup') { zone = 'method'; startSection(nh[2]); continue; }
    if (zone === 'dup') continue;
    if (zone === 'head') {
      // first free line is the title; label-ish lines (NAME: …) are the master-import header, not recipe content
      if (/^[A-Za-z][A-Za-z /&]{1,30}:\s*\S?/.test(line)) { const m = line.match(/^(name|title|recipe name|project)\s*:\s*(.+)$/i); if (m && !out.title) out.title = m[2].trim(); continue; }
      if (!out.title) { out.title = line; continue; }
      if (line.toLowerCase() === titleKey()) { continue; } // duplicated title
      continue;
    }
    if (zone === 'ing') {
      if (line.toLowerCase() === titleKey()) continue;
      if (!group) startGroup('Ingredients');
      const ing = parseIngredientLine(line);
      if (ing) group!.items.push(ing);
      continue;
    }
    // method zone
    if (line.toLowerCase() === titleKey()) { out.duplicate = true; continue; }
    if (!section) startSection('Method');
    const step = line.replace(NUM_STEP, '$1').replace(BULLET, '').trim();
    if (step) section!.steps.push(step);
  }
  out.groups = out.groups.filter(g => g.items.length);
  out.sections = out.sections.filter(s => s.steps.length);
  out.counts = { groups: out.groups.length, ingredients: out.groups.reduce((a, g) => a + g.items.length, 0), sections: out.sections.length, steps: out.sections.reduce((a, s) => a + s.steps.length, 0) };
  const bad = out.sections.some(s => s.steps.some(t => /^(yield|serves|makes)\s*:/i.test(t) || /\bingredients?\s*:?\s*$/i.test(t)));
  out.suspicious = bad || (out.counts.ingredients === 0 && out.counts.steps >= 20);
  if (out.duplicate) out.warnings.push('The recipe text repeats itself (a second title, yield or ingredient list). I ignored the repeated part.');
  if (out.counts.ingredients === 0 && out.counts.steps > 0) out.warnings.push('I found method steps but no ingredients. This recipe may not have been separated correctly.');
  if (out.counts.steps === 0 && out.counts.ingredients > 0) out.warnings.push('I found ingredients but no method steps.');
  if (bad) out.warnings.push('Some ingredient or yield headings ended up inside the method. This recipe may not have been separated correctly.');
  return out;
}

export const hasRecipeStructure = (r: RecipeParse) => r.counts.ingredients > 0 || r.counts.steps > 0;
