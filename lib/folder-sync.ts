import path from 'node:path';
import { db } from './db';
import { storage } from './storage';
import { orderedPictures, SCENE_ORDER } from './order';
import { expectedFilename, parseResultFilename, shortDesc } from './naming';
import { effectiveCode } from './project-code';
import { pad } from './util';
import { logActivity } from './activity';
import { sceneClipIds } from './scene-clips';

/** The picture files in a project folder are named with their place in the storyboard (001_, 002_ …) so the folder lists them in the same order as the Storyboard.
 *  This renames files on disk (same folder, same picture, same version — only the name changes), updates the records, and keeps a log of every old → new name. */
export type FolderChange = { assetId: string; imageId: string; from: string; to: string };

const flag = globalThis as unknown as { __bcsFolderSync?: boolean };
export const folderSyncRunning = () => !!flag.__bcsFolderSync;

/** Video clips in the "06 Video Clips" folder: clips assigned to a scene are named with the scene's place in the storyboard (01_, 02_ …); unassigned ones are marked `unassigned_`. */
export async function planClipNames(projectId: string): Promise<FolderChange[]> {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { slug: true, code: true, folderName: true } });
  if (!project) return [];
  const [scenes, clips] = await Promise.all([
    db.scene.findMany({ where: { projectId }, orderBy: [...SCENE_ORDER], select: { id: true, order: true, title: true, videoAssetId: true, clipIds: true } }),
    db.asset.findMany({ where: { kind: 'VIDEO_CLIP', projectSlug: project.slug } }),
  ]);
  const code = effectiveCode({ slug: project.slug, code: project.code });
  const out: FolderChange[] = [], assigned = new Set<string>();
  const w = scenes.length > 99 ? 3 : 2;
  scenes.forEach((sc: any, i) => {
    const ids = sceneClipIds(sc).filter(id => clips.some(c => c.id === id));
    ids.forEach((id, k) => {
      const as = clips.find(c => c.id === id)!;
      assigned.add(as.id);
      const dir = path.posix.dirname(as.relPath), ext = path.posix.extname(as.relPath).toLowerCase();
      const d = shortDesc(sc.title);
      const to = `${dir}/${pad(i + 1, w)}.${k + 1}_${code}-S${pad(sc.order)}-CLIP${ids.length > 1 ? k + 1 : ''}${d ? '_' + d : ''}${ext}`;
      if (to !== as.relPath) out.push({ assetId: as.id, imageId: '', from: as.relPath, to });
    });
  });
  for (const as of clips) {
    if (assigned.has(as.id)) continue;
    const dir = path.posix.dirname(as.relPath), ext = path.posix.extname(as.relPath).toLowerCase();
    const base = (as.originalName || as.displayName).replace(/\.[^.]+$/, '').replace(/^unassigned_/, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'clip';
    const to = `${dir}/unassigned_${base}${ext}`;
    if (to !== as.relPath) out.push({ assetId: as.id, imageId: '', from: as.relPath, to });
  }
  return out;
}

/** What would be renamed (nothing is changed): pictures (and, when no single picture is asked for, video clips). */
export async function planFolderNames(projectId: string, opts: { imageIds?: string[] } = {}): Promise<FolderChange[]> {
  const pics = await planPictureNames(projectId, opts);
  return opts.imageIds ? pics : [...pics, ...(await planClipNames(projectId))];
}

async function planPictureNames(projectId: string, opts: { imageIds?: string[] } = {}): Promise<FolderChange[]> {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { slug: true, code: true } });
  if (!project) return [];
  const pics = await orderedPictures(projectId);
  const only = opts.imageIds ? new Set(opts.imageIds) : null;
  const out: FolderChange[] = [];
  for (const p of pics) {
    if (only && !only.has(p.id)) continue;
    const attempts = await db.attempt.findMany({ where: { imageId: p.id }, include: { asset: true }, orderBy: { number: 'asc' } });
    for (const a of attempts) {
      const as = a.asset; if (!as || !as.mime.startsWith('image/')) continue;
      const dir = path.posix.dirname(as.relPath), ext = path.posix.extname(as.relPath).slice(1).toLowerCase() || 'png';
      const name = expectedFilename({ slug: project.slug, code: project.code, sceneOrder: p.scene.order, seq: p.seq, title: p.title, version: a.number, ext, pos: p.n });
      const to = `${dir}/${name}`;
      if (to !== as.relPath) out.push({ assetId: as.id, imageId: p.id, from: as.relPath, to });
    }
  }
  return out;
}

/** Rename the files to match the storyboard order. Never overwrites anything; if a name is taken by some other file a _dup suffix is added. */
export async function syncFolderNames(projectId: string, opts: { imageIds?: string[] } = {}): Promise<{ renamed: number; log?: string }> {
  if (flag.__bcsFolderSync) return { renamed: 0 };
  const plan = await planFolderNames(projectId, opts);
  if (!plan.length) return { renamed: 0 };
  flag.__bcsFolderSync = true;
  const moved: { change: FolderChange; tmp: string; final: string }[] = [];
  try {
    const mine = new Set(plan.map(c => c.from));
    // phase 1: move everything out of the way (so swaps / shifts can never collide)
    for (const c of plan) {
      const tmp = `${path.posix.dirname(c.from)}/.__sync_${c.assetId}${path.posix.extname(c.from)}`;
      if (!(await storage.exists(c.from))) continue; // file missing on disk: leave the record alone
      await storage.move(c.from, tmp);
      moved.push({ change: c, tmp, final: c.to });
    }
    // phase 2: into the final names
    const taken = new Set<string>();
    for (const m of moved) {
      let final = m.change.to, n = 1;
      while (taken.has(final) || (await storage.exists(final) && !mine.has(final))) final = m.change.to.replace(/(\.[a-z0-9]+)$/i, `_dup${++n}$1`);
      await storage.move(m.tmp, final);
      taken.add(final); m.final = final;
      const nm = final.split('/').pop()!;
      await db.asset.update({ where: { id: m.change.assetId }, data: { relPath: final, displayName: nm, internalName: nm } });
    }
  } catch (e) {
    // put back anything that is still waiting under a temporary name
    for (const m of moved) { try { if (await storage.exists(m.tmp)) await storage.move(m.tmp, m.change.from); } catch { /* best effort */ } }
    throw e;
  } finally { flag.__bcsFolderSync = false; }
  const pj = await db.project.findUnique({ where: { id: projectId }, select: { folderName: true } });
  let log: string | undefined;
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    log = `${pj?.folderName ?? ''}/.rename-log/${stamp}.json`.replace(/^\//, '');
    await storage.put(log, Buffer.from(JSON.stringify({ when: new Date().toISOString(), why: 'Matched folder names to the Storyboard order', renames: moved.map(m => ({ from: m.change.from.split('/').pop(), to: m.final.split('/').pop(), folder: path.posix.dirname(m.final) })) }, null, 2)));
  } catch { log = undefined; }
  await logActivity(`Folder names updated to match the Storyboard (${moved.length} file${moved.length === 1 ? '' : 's'})`, null, projectId);
  return { renamed: moved.length, log };
}

/** Same, but never throws (used after reordering: the order is already saved, the rename is a follow-up). */
export async function syncFolderNamesSafe(projectId: string, opts: { imageIds?: string[] } = {}): Promise<number> {
  try { return (await syncFolderNames(projectId, opts)).renamed; } catch (e) { console.error('[folder-sync]', e); return 0; }
}
void parseResultFilename;
