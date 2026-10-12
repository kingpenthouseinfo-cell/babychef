import { wordCount, parseJson } from './util';

export type Warning = { level: 'warn' | 'info'; text: string };

/** Approximate toddler delivery: ~2 words per second (deliberately slow). */
export const WORDS_PER_SECOND = 2.0;

export function dialogueWarning(dialogue: string | null | undefined, seconds: number | null | undefined): string | null {
  const words = wordCount(dialogue);
  if (!words || !seconds) return null;
  if (words / seconds > WORDS_PER_SECOND) return 'Dialogue may be too long for a natural toddler delivery in this clip.';
  return null;
}

type ClipLike = {
  durationTarget: number | null; dialogue: string | null; foodState: string | null; continuity: string | null;
  majorActions: string; endingComposition: string | null; useProfileVoice: boolean; voiceOverride: string | null;
  asmrLines: string | null; ambient: string | null; safety: string | null; actionSequence: string | null;
  foodPhysics: string | null; finalPrompt: string;
};
type RefLike = { approved: boolean; label: string; orientation: string; hasAsset: boolean };

export function preflight(c: ClipLike, refs: RefLike[], profileVoice: string | null | undefined, adultNeeded: boolean): Warning[] {
  const w: Warning[] = [];
  const add = (text: string, level: 'warn' | 'info' = 'warn') => w.push({ level, text });
  const approved = refs.filter(r => r.approved);
  if (refs.length === 0 || approved.length === 0) add('No approved reference image attached.');
  for (const r of refs) if (!r.approved) add(`${r.label} is not approved.`);
  const ors = new Set(refs.map(r => r.orientation).filter(o => o !== 'UNKNOWN'));
  if (ors.size > 1) add('Reference image orientations do not match (mix of landscape / portrait / square).');
  const d = dialogueWarning(c.dialogue, c.durationTarget);
  if (d) add(d);
  if (!c.foodState) add('Food state is missing.');
  if (!c.continuity) add('Continuity constraints are blank.');
  if (!c.durationTarget) add('Duration is blank.');
  const acts = parseJson<string[]>(c.majorActions, []).filter(Boolean);
  if (acts.length > 4) add(`More than 4 major actions are listed (${acts.length}). Clip may contain too many physical transformations.`);
  if (!c.endingComposition) add('No ending frame description.');
  if (!(c.useProfileVoice ? profileVoice : c.voiceOverride)) add('No voice instruction.');
  if (!c.asmrLines && !c.ambient) add('No ASMR information.');
  if (adultNeeded && !c.safety) add('Safety assistance may be needed (a linked scene requires adult assistance) but no safety note is set.');
  if (!c.actionSequence && acts.length === 0) add('No action sequence described.');
  if (!c.finalPrompt.trim()) add('Final Kling prompt is empty.', 'info');
  return w;
}
