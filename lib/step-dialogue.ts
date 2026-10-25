/** Which step and which dialogue each picture is for. Pure helpers (safe in server and client code). */
export const trim = (s: string | null | undefined, n = 140) => { const t = (s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };

/** Split a scene's dialogue into its lines/sentences. */
export function dialogueLines(d: string | null | undefined): string[] {
  const t = (d ?? '').replace(/\r/g, '').trim();
  if (!t) return [];
  const byLine = t.split(/\n+/).map(x => x.trim()).filter(Boolean);
  const parts = byLine.length > 1 ? byLine : (t.match(/[^.!?]+[.!?]+["”')\]]*|[^.!?]+$/g) ?? [t]).map(x => x.trim()).filter(Boolean);
  return parts.map(x => x.replace(/^["“]|["”]$/g, '').replace(/^(baby|chef|baby chef|narrator|voice|dialogue)\s*:\s*/i, '').trim()).filter(Boolean);
}

export type StepInfo = { stepNo: number; stepOf: number; step: string; says: string; saysKind: 'set' | 'suggested' | 'scene' | 'none' };

/** For the picture at `index` of `count` pictures in a scene: the step it shows and the dialogue it goes with.
 *  A line you wrote for the picture always wins. Otherwise, when the scene has at least one line per picture, the lines are shared out in order (marked "suggested"). Otherwise the whole scene dialogue is shown as the scene's. */
export function stepInfo(pic: { stepNote?: string | null; dialogueLine?: string | null; purpose?: string | null; why?: string | null; actionMoment?: string | null; title: string }, scene: { dialogue?: string | null }, index: number, count: number): StepInfo {
  const step = trim(pic.stepNote || pic.purpose || pic.why || pic.actionMoment || pic.title, 160);
  let says = '', saysKind: StepInfo['saysKind'] = 'none';
  if ((pic.dialogueLine ?? '').trim()) { says = trim(pic.dialogueLine, 220); saysKind = 'set'; }
  else {
    const lines = dialogueLines(scene.dialogue);
    if (lines.length && lines.length >= count && count > 0) {
      const per = lines.length / count;
      const from = Math.round(index * per), to = Math.max(from + 1, Math.round((index + 1) * per));
      says = trim(lines.slice(from, to).join(' '), 220); saysKind = 'suggested';
    } else if (lines.length) { says = trim(lines.join(' '), 220); saysKind = 'scene'; }
  }
  return { stepNo: index + 1, stepOf: count, step, says, saysKind };
}
