/** Short 3-letter project code used in file names (JBP-S04-IMG014_...). Pure, so it works on the server and in the browser. */
const FILLER = new Set(['traditional', 'authentic', 'homemade', 'home', 'made', 'easy', 'quick', 'classic', 'best', 'simple', 'the', 'a', 'an', 'of', 'and', 'with', 'in', 'my', 'our', 'recipe', 'style', 'for', 'to', 'on']);
const NATIONS = new Set(['sri', 'lankan', 'jamaican', 'indian', 'thai', 'italian', 'mexican', 'chinese', 'japanese', 'korean', 'french', 'greek', 'spanish', 'american', 'british', 'caribbean', 'african', 'nigerian', 'ghanaian', 'filipino', 'vietnamese', 'turkish', 'lebanese', 'moroccan', 'ethiopian', 'cuban', 'brazilian', 'peruvian', 'german', 'polish', 'russian', 'hawaiian', 'southern', 'cajun', 'creole', 'trinidadian', 'bajan', 'haitian', 'persian', 'pakistani', 'bangladeshi', 'nepali', 'malaysian', 'indonesian', 'irish', 'scottish', 'english', 'swedish', 'danish', 'dutch']);

const words = (s: string) => s.toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/[\s-]+/).filter(w => w && !FILLER.has(w));

/** "Traditional Sri Lankan Wattalappam" → WAT · "Jamaican Beef Patties" → JBP · "Beef Stew" → BST */
export function deriveCode(nameOrSlug: string): string {
  const all = words(nameOrSlug.replace(/-\d+$/, ''));
  if (!all.length) return 'BCS';
  const noNation = all.filter(w => !NATIONS.has(w));
  let code: string;
  if (noNation.length === 1) code = noNation[0].slice(0, 3);
  else if (all.length >= 3) code = all.slice(0, 3).map(w => w[0]).join('');
  else if (all.length === 2) code = all[0][0] + all[1].slice(0, 2);
  else code = all[0].slice(0, 3);
  return code.toUpperCase().padEnd(3, 'X').slice(0, 3);
}

/** The code a project uses today: the one saved on it, or the one derived from its name. */
export const effectiveCode = (p: { slug: string; code?: string | null }) => (p.code && /^[A-Za-z0-9]{2,5}$/.test(p.code) ? p.code.toUpperCase() : deriveCode(p.slug));

/** Pick a code nobody else is using (WAT, then WAA…, then WA2…). */
export function uniqueCode(base: string, taken: Set<string>): string {
  const b = base.toUpperCase();
  if (!taken.has(b)) return b;
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const c of letters) { const t = b.slice(0, 2) + c; if (!taken.has(t)) return t; }
  for (let n = 2; n < 100; n++) { const t = b.slice(0, 2) + n; if (!taken.has(t)) return t; }
  return b;
}
