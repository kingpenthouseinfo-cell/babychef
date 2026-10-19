import { imageCode, pad, sceneCode, slugify } from './util';
import { effectiveCode } from './project-code';

/**
 * Result-file naming. Pure functions (safe to import in client components).
 *   [{###}_]{CODE}-S{##}-IMG{###}_{short-description}_v{n}.{ext}      e.g. 014_JBP-S04-IMG014_butter-rubbed-into-flour_v1.png
 * (the optional leading 3 digits = place in the storyboard, so the folder lists pictures in storyboard order; the app keeps it up to date)
 * (older files named {project-slug}_{SC##}_{IMG-###}_{description}_v{n}.{ext} are still recognised)
 * The stable IDs (slug, scene, image, version) control matching; the description is only for readability.
 */
export const RESULT_EXTS = ['png', 'jpg', 'jpeg', 'webp'];

export const shortDesc = (title: string, max = 40) => (title.trim() ? slugify(title).slice(0, max).replace(/-+$/, '') : '');

export type NameParts = { slug: string; code?: string | null; sceneOrder: number; seq: number; title?: string; version: number; /** place in the storyboard (1, 2, 3 …): puts the file in the same order in the folder */ pos?: number };

export function resultBase(o: NameParts): string {
  const d = o.title ? shortDesc(o.title) : '';
  return `${o.pos ? pad(o.pos, 3) + '_' : ''}${effectiveCode({ slug: o.slug, code: o.code })}-S${pad(o.sceneOrder)}-IMG${pad(o.seq, 3)}${d ? '_' + d : ''}_v${o.version}`;
}
export function expectedFilename(o: NameParts & { ext?: string }): string {
  return `${resultBase(o)}.${(o.ext || 'png').replace(/^\./, '').toLowerCase()}`;
}
/** Next available version = highest existing attempt number + 1 (v1 if none). */
export const nextVersion = (attemptNumbers: number[]) => Math.max(0, ...attemptNumbers) + 1;

export type ParsedName = { slug?: string; code?: string; sceneOrder: number; seq: number; version: number; ext: string };

/** Parse an organized result filename (new JBP-S04-IMG014_… or older slug_SC04_IMG-014_…). Returns null if it does not carry all the stable IDs. */
export function parseResultFilename(name: string): ParsedName | null {
  const n = name.trim();
  const m = /^(?:\d{2,4}_)?(?<code>[A-Za-z0-9]{2,5})-S(?<sc>\d{1,3})-IMG(?<img>\d{1,4})(?:_[a-z0-9][a-z0-9-]*)?_v(?<v>\d{1,3})(?: \(\d+\))?(?:_\d+)?\.(?<ext>png|jpe?g|webp)$/i.exec(n);
  if (m && m.groups) return { code: m.groups.code.toUpperCase(), sceneOrder: parseInt(m.groups.sc, 10), seq: parseInt(m.groups.img, 10), version: parseInt(m.groups.v, 10), ext: m.groups.ext.toLowerCase() };
  const o = /^(?:\d{2,4}_)?(?<slug>[a-z0-9][a-z0-9-]*)_SC(?<sc>\d{1,3})_IMG-(?<img>\d{1,4})(?:_[a-z0-9][a-z0-9-]*)?_v(?<v>\d{1,3})(?: \(\d+\))?\.(?<ext>png|jpe?g|webp)$/i.exec(n);
  if (!o || !o.groups) return null;
  return { slug: o.groups.slug.toLowerCase(), sceneOrder: parseInt(o.groups.sc, 10), seq: parseInt(o.groups.img, 10), version: parseInt(o.groups.v, 10), ext: o.groups.ext.toLowerCase() };
}

export const fileBlock = (name: string) => `FILE ORGANIZATION

REQUIRED OUTPUT FILENAME:
${name}

When saving/downloading the generated image, use this exact filename:
${name}

Save/download this generated image using the exact filename above so Baby Chef Studio can automatically detect it and attach it to the correct project, scene and image. Do not alter the project code, scene number, image number or version number.`;

/** Remove a previously appended FILE ORGANIZATION section (so the filename is always the CURRENT one). */
export const stripFileBlock = (text: string) => text.replace(/\n*FILE ORGANIZATION\s*\n[\s\S]*$/i, '').trimEnd();

/** Prompt text to copy into ChatGPT: the prompt + a fresh FILE ORGANIZATION section with the exact next filename. */
export function withFilename(text: string, filename: string): string {
  const base = stripFileBlock(text || '');
  return base ? `${base}\n\n${fileBlock(filename)}` : '';
}
void pad;
