import { db } from './db';
import { BIBLE_DEFAULTS } from './bible-defaults';
import { getSettings, setSetting } from './settings';

/** Seed any missing sections (never overwrites edits). */
export async function ensureBible() {
  const n = await db.bibleSection.count();
  if (n >= BIBLE_DEFAULTS.length) return;
  for (const [i, d] of BIBLE_DEFAULTS.entries()) {
    const ex = await db.bibleSection.findUnique({ where: { key: d.key } });
    if (!ex) await db.bibleSection.create({ data: { key: d.key, title: d.title, content: d.content, defaultContent: d.content, order: i } });
  }
  if ((await db.bibleVersion.count()) === 0) await snapshotBible('Initial rules');
}

export async function currentBibleVersion(): Promise<number> {
  const v = await db.bibleVersion.findFirst({ orderBy: { version: 'desc' } });
  return v?.version ?? 0;
}

export async function snapshotBible(note: string | null) {
  const secs = await db.bibleSection.findMany({ orderBy: { order: 'asc' } });
  const v = (await currentBibleVersion()) + 1;
  await db.bibleVersion.create({ data: { version: v, note, snapshot: JSON.stringify(secs.map(s => ({ key: s.key, title: s.title, content: s.content, active: s.active, order: s.order, notes: s.notes }))) } });
  await setSetting('bibleVersion', String(v));
  return v;
}

export async function bibleText(only?: string[]): Promise<string> {
  const secs = await db.bibleSection.findMany({ where: { active: true }, orderBy: { order: 'asc' } });
  return secs.filter(s => s.content.trim() && (!only || only.includes(s.key))).map(s => `### ${s.title.toUpperCase()}\n${s.content.trim()}`).join('\n\n');
}

export const OVERRIDE_FIELDS = ['Pacing override', 'Dialogue override', 'Camera override', 'Short-form override', 'Safety override', 'Ingredient presentation override', 'Special family recipe notes', 'Things that must be shown', 'Things that must not be shown', 'Custom production instruction'];

export function chefProductionText(b: any): string {
  if (!b) return '';
  const rows: [string, any][] = [
    ['Name', b.displayName], ['Series', b.seriesName], ['Cuisine', b.cuisine], ['Age', b.age], ['Gender', b.gender], ['Appearance', b.appearance], ['Skin tone', b.skinTone], ['Face', b.facialFeatures], ['Hair', b.hair], ['Body / proportions', b.bodyNotes],
    ['Chef outfit', b.outfit], ['Accessories', b.accessories], ['Personality', b.personality], ['Dialogue style', b.dialogueStyle], ['Voice / accent', b.voiceInstruction], ['Humor patterns', b.humorPatterns],
    ['Recurring jokes', b.recurringJokes], ['Recurring reactions', b.recurringReacts], ['Typical expressions', b.typicalExpressions], ['Ingredient reactions', b.ingredientReactions], ['CTA behavior', b.ctaBehavior],
    ['Cultural language notes', b.culturalNotes], ['Behavior notes', b.behaviorNotes], ['Kitchen', b.kitchen], ['Lighting', b.lighting], ['Cinematography', b.cinematography], ['Safety rules', b.safetyRules], ['Continuity rules', b.continuityRules],
  ];
  return rows.filter(([, v]) => v && String(v).trim()).map(([k, v]) => `${k}: ${v}`).join('\n');
}
void getSettings;
