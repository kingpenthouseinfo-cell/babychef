type Img = { startingComposition: string | null; ingredientState: string | null; actionMoment: string | null; cameraAngle: string | null; cameraDistance: string | null; mustBeVisible: string | null; continuity: string | null; mustNotChange: string | null; mustNotAppear: string | null; restrictions: string | null; fullPrompt: string; contPrompt: string };

/** Warning-only prompt-quality checklist shown before an image is marked READY. */
export function imagePromptWarnings(i: Img): string[] {
  const w: string[] = [];
  const e = (s: string | null | undefined) => !s || !s.trim();
  if (e(i.startingComposition)) w.push('Starting composition is missing.');
  if (e(i.ingredientState)) w.push('Current food state (ingredient state) is missing.');
  if (e(i.actionMoment)) w.push('Exact action moment is missing.');
  if (e(i.cameraAngle) && e(i.cameraDistance)) w.push('Camera is missing.');
  if (e(i.mustBeVisible)) w.push('“What must be visible” is empty.');
  if (e(i.continuity) && e(i.mustNotChange)) w.push('Continuity requirements are missing.');
  if (e(i.restrictions) && e(i.mustNotAppear)) w.push('Restrictions (what must not appear) are missing.');
  if (e(i.fullPrompt) && e(i.contPrompt)) w.push('No Full or Continuation prompt has been written yet.');
  return w;
}
