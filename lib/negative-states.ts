/** Scene-aware negative states (no AI): what must NOT be visible in THIS picture, derived from the food-state timeline. */
export type NSScene = { id: string; pos: number; order: number; title: string; ingredients?: string | null; mainAction?: string | null; narrative?: string | null; foodBefore?: string | null; foodDuring?: string | null; foodAfter?: string | null };
export type NSImage = { title: string; purpose?: string | null; ingredients?: string | null; actionMoment?: string | null; foodTexture?: string | null; mustBeVisible?: string | null };

const low = (...a: (string | null | undefined)[]) => a.filter(Boolean).join(' \n ').toLowerCase();
const has = (t: string, re: RegExp) => re.test(t);

type Rule = { when: RegExp; unless?: RegExp; lines: string[] };
/** Stage rules: if this picture is in a stage (`when`), these exclusions apply. `unless` guards stages that already moved on. */
const STAGES: Rule[] = [
  { when: /(dry|crumbl\w*|pea[- ]sized|butter[^.]*(flour|rub|pinch|grat)|(rub|pinch|cut)\w*[^.]*butter)/, unless: /(water (has been )?added|shaggy|kneaded|dough (ball|forms|formed)|cohesive|smooth dough)/, lines: ['No liquid has been added yet.', 'No wet dough.', 'No smooth dough.', 'The mixture must stay dry and crumbly, not fully formed dough.'] },
  { when: /(shaggy|partially hydrated|water (is )?(poured|added))/, unless: /(smooth|kneaded|cohesive)/, lines: ['The dough must not yet look smooth, polished or fully kneaded.'] },
  { when: /(kneaded|cohesive dough|smooth dough)/, unless: /(rolled|rolling|chilled|portion)/, lines: ['No dry flour pockets or loose crumbs remaining in the dough.'] },
  { when: /(raw (pink )?(ground )?beef|beef (just )?added|raw beef)/, unless: /(browned|brown)/, lines: ['No browning on the beef yet.', 'No onion has been added yet.', 'No seasoning or stock added yet.'] },
  { when: /(partially (cooked|browned)|half (of the )?(meat|beef) (is )?browned)/, lines: ['The beef must not be fully browned yet; raw pink areas remain.', 'No onion has been added yet.'] },
  { when: /(fully|completely|all) browned|no raw pink|beef is browned|browned (into|beef)/, unless: /(onion (is |has been )?(added|softened|in the)|softened onion|finished filling|stock)/, lines: ['No raw pink beef remains.', 'No onion has been added yet.', 'No liquid in the skillet yet.'] },
  { when: /(finished|cooked|ready) (beef )?filling|filling (is )?(rich|cohesive|finished|done)|moist filling/, lines: ['No standing liquid or soupy sauce.', 'No dry breadcrumbs left on top.', 'No intact butter cubes.', 'The filling must not look dry, watery or crumbly.'] },
  { when: /(raw patt(y|ies)|crimp\w*|half[- ]moon|crescent|folded pastry|fork[- ]crimp)/, unless: /(baked|golden|out of the oven)/, lines: ['No cooked appearance yet.', 'No browning on the raw pastry.', 'The pastry must not look baked or flaky yet.'] },
  { when: /(baked|golden[- ]brown|out of the oven|flaky layers)/, lines: ['No raw or pale uncooked dough patches.', 'No burnt areas.'] },
  { when: /(rolled|rolling|roll out)/, unless: /(filled|filling placed)/, lines: ['No filling on the pastry yet.'] },
  { when: /(tray|raw patties arranged)/, unless: /(baked|golden)/, lines: ['No baking colour on the patties yet.'] },
];

/** Words that mean an ingredient in a later scene is NOT in this picture yet. */
function mentioned(text: string, name: string): boolean {
  const n = name.toLowerCase().trim();
  if (!n) return false;
  const base = n.replace(/s$/, '');
  return text.includes(n) || text.includes(base);
}

export function negativeStates(scene: NSScene | null | undefined, img: NSImage, scenes: NSScene[], ingredientNames: string[]): string[] {
  const out: string[] = [];
  const mine = low(img.title, img.purpose, img.ingredients, img.actionMoment, img.foodTexture, img.mustBeVisible, scene?.title, scene?.mainAction, scene?.narrative, scene?.foodDuring, scene?.foodAfter);
  const here = low(img.title, img.purpose, img.actionMoment, img.foodTexture, img.mustBeVisible, scene?.foodDuring, scene?.foodAfter, scene?.mainAction);
  const stateOnly = low(img.title, img.purpose, img.foodTexture, scene?.foodDuring);
  for (const r of STAGES) if (has(here, r.when) && !(r.unless && has(stateOnly || here, r.unless))) out.push(...r.lines);
  // ingredients that first appear LATER in the video must not show up yet
  if (scene) {
    const ordered = [...scenes].sort((a, b) => a.pos - b.pos || a.order - b.order);
    const at = ordered.findIndex(s => s.id === scene.id);
    const seen = low(...ordered.slice(0, at + 1).map(s => low(s.ingredients, s.mainAction, s.foodDuring, s.foodAfter)), img.ingredients, img.purpose);
    const later: string[] = [];
    for (const s of ordered.slice(at + 1)) {
      const t = low(s.ingredients, s.mainAction, s.narrative);
      for (const n of ingredientNames) if (!later.includes(n) && mentioned(t, n) && !mentioned(seen, n) && !mentioned(mine, n)) later.push(n);
      if (later.length >= 4) break;
    }
    for (const n of later.slice(0, 4)) out.push(`No ${n.toLowerCase()} has been added yet.`);
  }
  // never forbid something this picture needs
  const needs = low(img.ingredients, img.mustBeVisible, img.title, img.purpose);
  const filtered = out.filter(l => {
    const m = l.match(/^No ([a-z ]+?)( has been added yet| added yet| in the|\.|$)/i);
    return !(m && mentioned(needs, m[1].trim()) && /added yet/.test(l));
  });
  return [...new Set(filtered)];
}

export const DEFAULT_NEGATIVE = 'No text, no captions, no labels, no watermark. No duplicated ingredients, no duplicated hands, no extra fingers, no warped utensils, no deformed cookware, no distorted baby anatomy, no plastic-looking skin, no plastic-looking food, no cartoon styling.';
