import { db } from './db';

/** Permanent sentences added to every picture prompt (e.g. "Make sure the image is not too contrasty and the baby's skin has realistic texture."). */
export type AddonKind = 'IMAGE' | 'VIDEO';
export type AddonRow = { id: string; kind: AddonKind; text: string; position: 'START' | 'END'; projectIds: string[]; enabled: boolean; createdAt: Date };

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
export const parseIds = (j: string | null | undefined): string[] => { try { const a = j ? JSON.parse(j) : []; return Array.isArray(a) ? a.filter(x => typeof x === 'string') : []; } catch { return []; } };

export async function listAddons(kind: AddonKind = 'IMAGE'): Promise<AddonRow[]> {
  const rows = (await db.promptAddon.findMany({ orderBy: { createdAt: 'asc' } })).filter(r => ((r as any).kind === 'VIDEO' ? 'VIDEO' : 'IMAGE') === kind);
  return rows.map(r => ({ id: r.id, kind, text: r.text, position: r.position === 'START' ? 'START' : 'END', projectIds: parseIds(r.projectIds), enabled: r.enabled, createdAt: r.createdAt }));
}
export const appliesTo = (a: Pick<AddonRow, 'projectIds' | 'enabled'>, projectId: string) => a.enabled && (a.projectIds.length === 0 || a.projectIds.includes(projectId));

/** Put the sentences into a prompt (beginning ones first, end ones after). A sentence that is already in the prompt is not added twice. */
export function withAddons(prompt: string, addons: Pick<AddonRow, 'text' | 'position'>[]): string {
  if (!prompt.trim()) return prompt;
  let out = prompt.trimEnd();
  const have = (t: string) => norm(out).includes(norm(t));
  const start = addons.filter(a => a.position === 'START' && !have(a.text)).map(a => a.text.trim());
  const end = addons.filter(a => a.position === 'END' && !have(a.text)).map(a => a.text.trim());
  if (start.length) out = `${start.join('\n\n')}\n\n${out}`;
  if (end.length) out = `${out}\n\n${end.join('\n\n')}`;
  return out;
}

/** Take a sentence back out of a prompt (exactly as it was added). */
export function withoutAddon(prompt: string, text: string): string {
  const t = text.trim(); if (!t) return prompt;
  return prompt.split(t).join('').replace(/\n{3,}/g, '\n\n').replace(/^\s+/, '').trimEnd();
}

/** The add-ons that apply to a project's prompts (used when a prompt is written or rewritten, so the sentences stay in). */
export async function addonsFor(projectId: string, kind: AddonKind = 'IMAGE'): Promise<AddonRow[]> { return (await listAddons(kind)).filter(a => appliesTo(a, projectId)); }
/** A video prompt with the permanent video sentences put in (never throws: the prompt is returned unchanged if anything goes wrong). */
export async function withVideoAddons(projectId: string, prompt: string): Promise<string> { try { return withAddons(prompt, await addonsFor(projectId, 'VIDEO')); } catch (e) { console.error('[addons]', e); return prompt; } }
