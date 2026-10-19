/** Each recipe video gets its own light pastel colour, used as the page background on all of its screens so you never mistake one project for another. */
export const PROJECT_COLORS = [
  { key: 'mint', label: 'Mint', bg: '#EAF7EF', dot: '#7CC79A' },
  { key: 'sky', label: 'Sky', bg: '#EAF2FC', dot: '#7FA8DD' },
  { key: 'lavender', label: 'Lavender', bg: '#F1ECFB', dot: '#A48BD6' },
  { key: 'butter', label: 'Butter', bg: '#FFF7DC', dot: '#E0BE55' },
  { key: 'rose', label: 'Rose', bg: '#FDEDF3', dot: '#E58BAA' },
  { key: 'aqua', label: 'Aqua', bg: '#E6F6F7', dot: '#6CC3C9' },
  { key: 'sage', label: 'Sage', bg: '#EEF3E6', dot: '#9DBB78' },
  { key: 'lilac', label: 'Lilac', bg: '#F7EAF7', dot: '#CB8FCB' },
  { key: 'sand', label: 'Sand', bg: '#F6F0E6', dot: '#C9AE84' },
  { key: 'periwinkle', label: 'Periwinkle', bg: '#ECEFFC', dot: '#8C9AE0' },
] as const;
export type ProjectColor = (typeof PROJECT_COLORS)[number];

/** The project's colour: the one chosen for it, otherwise one picked automatically by the project's place in the list (so neighbours differ). */
export function projectColor(p: { id: string; color?: string | null }, all: { id: string; createdAt: Date }[]): ProjectColor {
  const chosen = PROJECT_COLORS.find(c => c.key === p.color);
  if (chosen) return chosen;
  const sorted = [...all].sort((a, b) => +a.createdAt - +b.createdAt || a.id.localeCompare(b.id));
  const i = Math.max(0, sorted.findIndex(x => x.id === p.id));
  return PROJECT_COLORS[i % PROJECT_COLORS.length];
}
