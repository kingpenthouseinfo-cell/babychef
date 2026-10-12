/** Visible scene labels: Scene 4, Scene 4A, Scene 4B, Scene 5. Derived from visible order; stable codes (SCnn) are never touched. */
export type LabelScene = { id: string; pos: number; order: number; inserted?: boolean | null };

export function sceneLabels(scenes: LabelScene[]): Map<string, string> {
  const sorted = [...scenes].sort((a, b) => a.pos - b.pos || a.order - b.order);
  const out = new Map<string, string>();
  let n = 0, k = 0;
  for (const s of sorted) {
    if (s.inserted && n > 0) out.set(s.id, `${n}${letters(++k)}`);
    else { n++; k = 0; out.set(s.id, String(n)); }
  }
  return out;
}
function letters(i: number): string { let s = ''; while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; }
