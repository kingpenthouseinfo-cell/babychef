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

export type StepInfo = { stepNo: number; stepEnd?: number; merged?: number; stepOf: number; step: string; says: string; saysKind: 'set' | 'suggested' | 'scene' | 'none' };

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

type ScenePic = { id: string; status: string; mergedInto?: string | null; stepNote?: string | null; dialogueLine?: string | null; purpose?: string | null; why?: string | null; actionMoment?: string | null; title: string };
/** Step + dialogue for every picture of ONE scene (pass them in storyboard order).
 *  "Don't use" pictures are left out of the count, but a picture that was merged into another still holds its step number, so the
 *  picture it was merged into reads "Steps 3–5 of 5" and keeps the step text of all of them. Merged-away pictures get null. */
export function stepInfosForScene(pics: ScenePic[], scene: { dialogue?: string | null }): Map<string, StepInfo | null> {
  const out = new Map<string, StepInfo | null>();
  const counted = pics.filter(p => p.status !== 'SKIPPED' || p.mergedInto);
  const infos = counted.map((p, n) => stepInfo(p, scene, n, counted.length));
  for (const p of pics) {
    const n = counted.indexOf(p);
    if (n < 0 || p.mergedInto) { out.set(p.id, null); continue; }
    const members = counted.map((q, k) => ({ q, k })).filter(x => x.q.id === p.id || x.q.mergedInto === p.id);
    if (members.length === 1) { out.set(p.id, infos[n]); continue; }
    const mine = infos[n];
    const steps = members.map(m => infos[m.k].step).filter((t, i, a) => t && a.indexOf(t) === i);
    const says = [...new Set(members.map(m => infos[m.k].says).filter(Boolean))].join(' ');
    out.set(p.id, {
      stepNo: members[0].k + 1, stepEnd: members[members.length - 1].k + 1, merged: members.length, stepOf: counted.length,
      step: (p.stepNote ?? '').trim() ? mine.step : steps.join(' → '),
      says: (p.dialogueLine ?? '').trim() ? mine.says : trim(says, 260),
      saysKind: (p.dialogueLine ?? '').trim() ? 'set' : members.map(m => infos[m.k].saysKind).find(k => k !== 'none') ?? 'none',
    });
  }
  return out;
}
