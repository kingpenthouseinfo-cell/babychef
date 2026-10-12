/** Automatic image plan (no AI): turns a scene breakdown into the minimum useful set of still-image anchors. */
export type Cam = 'medium' | 'three-quarter' | 'elevated' | 'straight' | 'closeup' | 'macro' | 'overhead' | 'counter' | 'reaction' | 'beauty';
export type Anchor = { title: string; text: string; shotType: string; cam: Cam; crop: 'CRITICAL' | 'PREFERRED' | 'NOT IMPORTANT'; why: string; foodState: string; stage: 'before' | 'during' | 'after' };
export type PlanScene = { title: string; purpose?: string | null; recipeStep?: string | null; narrative?: string | null; mainAction?: string | null; babyReaction?: string | null; dialogue?: string | null; foodBefore?: string | null; foodDuring?: string | null; foodAfter?: string | null; mainShot?: string | null; insertShots?: string | null; asmr?: string | null; cameraAngle?: string | null; anchors?: string | null; shortKeep?: boolean; hook?: boolean; beauty?: boolean };

const clean = (s?: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();
const MACRO = /(macro|sizzl|pour|falling|cascad|crumb|steam|crack|melt|sprinkl|shimmer|grat|texture|curl|flak|absorb|compress|crimp|peel|drip|bubbl)/i;
const REACT = /(react|tast|bite|smile|laugh|surpris|delight|proud|giggl|stares|looks at (the )?camera|expression)/i;
const OVER = /(overhead|top[- ]down|from above|laid out|arranged|layout|tray|assembl|shap)/i;
const BEAUTY = /(beauty|finished|whole|hero|golden|plated|reveal|ready to serve|hook)/i;
const COUNTER = /(counter[- ]level|rolling|thickness|low angle)/i;

export function classify(text: string, idx: number, total: number): { shotType: string; cam: Cam; crop: Anchor['crop'] } {
  if (/reaction/i.test(text) || (REACT.test(text) && !MACRO.test(text))) return { shotType: 'REACTION SHOT', cam: 'reaction', crop: 'CRITICAL' };
  if (/macro|asmr/i.test(text) || (MACRO.test(text) && /(close|detail|insert)/i.test(text))) return { shotType: 'MACRO ASMR', cam: 'macro', crop: 'NOT IMPORTANT' };
  if (OVER.test(text)) return { shotType: 'OVERHEAD', cam: 'overhead', crop: 'PREFERRED' };
  if (BEAUTY.test(text) && idx === 0 && total > 1 || /beauty/i.test(text)) return { shotType: 'BEAUTY SHOT', cam: 'beauty', crop: 'PREFERRED' };
  if (COUNTER.test(text)) return { shotType: 'CINEMATIC INSERT', cam: 'counter', crop: 'PREFERRED' };
  if (/close[- ]?up|insert/i.test(text)) return { shotType: 'CINEMATIC INSERT', cam: 'closeup', crop: 'PREFERRED' };
  const cams: Cam[] = ['three-quarter', 'medium', 'elevated', 'straight'];
  return { shotType: 'MAIN NARRATIVE SHOT', cam: cams[idx % cams.length], crop: 'CRITICAL' };
}

function titleOf(line: string): string {
  let t = line.replace(/^(\s*[-*•]|\s*\d+[.)])\s*/, '').replace(/^(image|img|picture|anchor)\s*\d+(\.\d+)?\s*[:—–-]\s*/i, '').trim();
  const head = t.split(/\s[—–]\s|:\s/)[0];
  t = (head.length >= 4 && head.length <= 70 ? head : t).replace(/[.;]+$/, '');
  return t.length > 60 ? t.slice(0, 57).replace(/\s+\S*$/, '') + '…' : t;
}

const TRANSFORM = /(brown|mix|fold|bak|melt|knead|roll|cook|fry|stir|simmer|absorb|assembl|crimp|season|blend|cool|chill|rest)/i;

function stateFor(s: PlanScene, stage: Anchor['stage']): string {
  return clean(stage === 'before' ? s.foodBefore || s.foodDuring : stage === 'after' ? s.foodAfter || s.foodDuring : s.foodDuring || s.foodAfter || s.foodBefore);
}

export function planScene(s: PlanScene): Anchor[] {
  const lines = (s.anchors ?? '').split(/\r?\n/).map(clean).filter(l => l.length > 2 && !/^(none|n\/a)$/i.test(l));
  const list: { title: string; text: string; why?: string; stage: Anchor['stage'] }[] = [];
  lines.forEach((l, i) => list.push({ title: titleOf(l), text: l.replace(/^(\s*[-*•]|\s*\d+[.)])\s*/, ''), stage: i === 0 && lines.length > 1 ? 'before' : i === lines.length - 1 && lines.length > 1 ? 'after' : 'during' }));
  if (!list.length) {
    const main = clean(s.mainShot) || clean(s.mainAction) || clean(s.narrative) || s.title;
    list.push({ title: titleOf(clean(s.mainShot) ? s.mainShot! : s.title), text: main, stage: 'during' });
    const changes = clean(s.foodBefore) && clean(s.foodAfter) && clean(s.foodBefore).toLowerCase() !== clean(s.foodAfter).toLowerCase() && TRANSFORM.test(`${s.mainAction} ${s.narrative} ${s.foodAfter}`);
    if (changes) list.push({ title: `${titleOf(s.title)} — Result`, text: `${clean(s.foodAfter)}`, stage: 'after' });
    if (clean(s.insertShots) || clean(s.asmr)) list.push({ title: titleOf(clean(s.insertShots) || clean(s.asmr)), text: clean(s.insertShots) || clean(s.asmr), stage: 'during' });
    if ((s.shortKeep || s.hook) && clean(s.babyReaction)) list.push({ title: 'Baby Chef Reaction', text: clean(s.babyReaction), stage: 'after' });
  }
  const seen = new Set<string>();
  return list.filter(a => { const k = a.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 6).map((a, idx, arr) => {
    const c = classify(`${a.title} ${a.text}`, idx, arr.length);
    const why = a.why ?? (c.cam === 'reaction' ? 'Shows the Baby Chef reaction that supports the dialogue.' : c.cam === 'macro' ? 'A close detail insert for the food texture and sound moment.' : c.cam === 'beauty' ? 'The finished-food payoff shot.' : idx === 0 ? `Establishes ${s.title.toLowerCase()} so later pictures and the video clip have a clear starting point.` : 'Shows the next important change in the food so the sequence stays continuous.');
    return { title: a.title, text: a.text, shotType: c.shotType, cam: c.cam, crop: c.crop, why, foodState: stateFor(s, a.stage), stage: a.stage };
  });
}
