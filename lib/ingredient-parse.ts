/** Deterministic ingredient-line parser (no AI). Pure: shared by Quick add and Fill from text. */
export type ParsedIngredient = { name: string; quantity?: string; unit?: string; prepNote?: string; brand?: string; importance?: 'PACKAGE_CRITICAL' | 'TEXTURE_CRITICAL' | 'OPTIONAL'; original: string; group?: string; package?: string; uncertain: boolean };

const UNITS = ['cups', 'cup', 'c', 'tablespoons', 'tablespoon', 'tbsp', 'tbs', 'tbl', 'teaspoons', 'teaspoon', 'tsp', 'ounces', 'ounce', 'oz', 'pounds', 'pound', 'lbs', 'lb', 'grams', 'gram', 'g', 'kilograms', 'kilogram', 'kg', 'milliliters', 'ml', 'liters', 'liter', 'l', 'cloves', 'clove', 'pinch', 'pinches', 'dash', 'cans', 'can', 'packages', 'package', 'pkg', 'sticks', 'stick', 'slices', 'slice', 'bunch', 'bunches', 'sprigs', 'sprig', 'pieces', 'piece', 'large', 'medium', 'small', 'handful'];
const FRAC: Record<string, string> = { '½': '1/2', '¼': '1/4', '¾': '3/4', '⅓': '1/3', '⅔': '2/3', '⅛': '1/8' };
const QTY = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?\s*[½¼¾⅓⅔⅛]?|[½¼¾⅓⅔⅛])(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?(?:\/\d+)?))?\s*/i;

export const importanceFrom = (s: string): ParsedIngredient['importance'] | undefined => {
  const t = s.toLowerCase();
  if (/package|label|brand\s*critical/.test(t)) return 'PACKAGE_CRITICAL';
  if (/texture|appearance/.test(t)) return 'TEXTURE_CRITICAL';
  if (/optional|not important/.test(t)) return 'OPTIONAL';
  return undefined;
};

export function parseIngredientLine(raw: string): ParsedIngredient | null {
  let line = raw.replace(/^\s*(?:[-•*▪●☐☑✓]|\d+[.)])\s+/, '').trim();
  if (!line) return null;
  const original = line;
  let brand: string | undefined, importance: ParsedIngredient['importance'], pkg: string | undefined, extraPrep: string | undefined, grp: string | undefined;
  const parts = line.split('|').map(x => x.trim());
  line = parts.shift() || '';
  for (const p of parts) {
    const m = p.match(/^(brand|reference|ref|importance|package|preparation|group|product photo important|texture important)\s*[:=-]\s*(.+)$/i);
    if (!m) continue;
    const k = m[1].toLowerCase();
    if (k === 'brand') brand = m[2].trim();
    else if (k === 'package') pkg = m[2].trim();
    else if (k === 'preparation') extraPrep = m[2].trim();
    else if (k === 'group') grp = m[2].trim();
    else if (k === 'product photo important') { if (/^(y|yes|true)/i.test(m[2].trim())) importance = 'PACKAGE_CRITICAL'; }
    else if (k === 'texture important') { if (/^(y|yes|true)/i.test(m[2].trim())) importance = 'TEXTURE_CRITICAL'; }
    else importance = importanceFrom(m[2]);
  }
  let quantity: string | undefined, unit: string | undefined;
  const qm = line.match(QTY);
  if (qm) {
    quantity = qm[1].trim().replace(/[½¼¾⅓⅔⅛]/g, c => (/\d\s*$/.test(qm[1].slice(0, qm[1].indexOf(c))) ? ' ' : '') + FRAC[c]).trim();
    if (qm[2]) quantity += `-${qm[2]}`;
    line = line.slice(qm[0].length);
    const um = line.match(/^([A-Za-z]+)\.?\s+/);
    if (um && UNITS.includes(um[1].toLowerCase())) { unit = um[1]; line = line.slice(um[0].length); }
    line = line.replace(/^of\s+/i, '');
  }
  let prepNote: string | undefined;
  const pm = line.match(/\(([^)]*)\)/);
  if (pm) { prepNote = pm[1].trim(); line = line.replace(pm[0], ' '); }
  const ci = line.indexOf(',');
  if (ci > -1) { prepNote = [line.slice(ci + 1).trim(), prepNote].filter(Boolean).join(', '); line = line.slice(0, ci); }
  if (extraPrep) prepNote = [prepNote, extraPrep].filter(Boolean).join(', ');
  const name = line.replace(/\s+/g, ' ').trim();
  if (!name) return { name: original, original, uncertain: true };
  return { name, quantity, unit, prepNote, brand, importance, original, ...(grp ? { group: grp } : {}), ...(pkg ? { package: pkg } : {}), uncertain: !quantity && name.split(' ').length > 5 };
}

export const parseIngredientLines = (text: string) => text.split(/\r?\n/).map(parseIngredientLine).filter((x): x is ParsedIngredient => !!x);
