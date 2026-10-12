/** Deterministic (no AI) picture-title maker: "Close-up of Baby Chef rubbing the butter into the flour" → "Butter Rubbed Into Flour". */
const PAST: Record<string, string> = { rubbing: 'rubbed', pouring: 'poured', stirring: 'stirred', mixing: 'mixed', adding: 'added', cutting: 'cut', chopping: 'chopped', slicing: 'sliced', kneading: 'kneaded', rolling: 'rolled', folding: 'folded', pressing: 'pressed', placing: 'placed', putting: 'put', tasting: 'tasted', holding: 'held', showing: 'shown', sprinkling: 'sprinkled', spreading: 'spread', crimping: 'crimped', sealing: 'sealed', brushing: 'brushed', whisking: 'whisked', frying: 'fried', baking: 'baked', cooking: 'cooked', browning: 'browned', seasoning: 'seasoned', filling: 'filled', draining: 'drained', measuring: 'measured', squeezing: 'squeezed', peeling: 'peeled', grating: 'grated', mashing: 'mashed', cracking: 'cracked', flipping: 'flipped', serving: 'served', eating: 'eaten' };
const SHOT = /^(?:(?:an?|the)\s+)?(?:extreme\s+)?(?:close[- ]?up|closeup|wide|medium|overhead|top[- ]down|low[- ]angle|high[- ]angle|macro|side|front|over[- ]the[- ]shoulder|detail)(?:\s+(?:shot|view|angle))?\s*(?:of|on|showing)?\s*/i;
const LEAD = /^(?:(?:an?|the)\s+)?(?:picture|image|photo|shot|scene)\s+(?:of|showing|where)\s*/i;
const WHO = /^(?:the\s+)?(?:baby\s+chef|baby|chef|adult(?:\s+helper)?|mom|dad|helper)(?:'s)?\s*/i;
const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'while', 'as', 'then', 'is', 'are', 'his', 'her', 'their', 'its', 'to', 'at', 'for', 'some', 'little', 'tiny', 'small']);
const LINK = new Set(['into', 'onto', 'over', 'with', 'in', 'on', 'from', 'beside', 'next']);
const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

export function autoTitle(text: string | null | undefined, n: number): string {
  const fallback = `Picture ${n}`;
  let t = (text ?? '').trim().replace(/[\r\n]+/g, ' ').split(/[.!?;]/)[0].trim();
  if (!t) return fallback;
  t = t.replace(SHOT, '').replace(LEAD, '').replace(WHO, '').trim();
  const words = t.toLowerCase().replace(/[^a-z0-9' -]/g, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return fallback;
  let verb = '';
  if (PAST[words[0]]) verb = PAST[words.shift()!];
  const out: string[] = [];
  let placed = false;
  for (const w of words) {
    if (STOP.has(w)) continue;
    if (LINK.has(w) && out.length === 0) continue;
    if (verb && !placed && LINK.has(w)) { out.push(verb); placed = true; }
    out.push(w);
    if (out.length >= 6) break;
  }
  if (verb && !placed) out.push(verb);
  while (out.length && LINK.has(out[out.length - 1])) out.pop();
  if (!out.length) return fallback;
  return out.map(cap).join(' ').slice(0, 60).trim() || fallback;
}
