/**
 * Local project-folder watcher (polling, so it is reliable on macOS and survives restarts).
 *
 * Watches `<storage root>/<Project>/02 Images/` (and the project folder itself) for new image files.
 * Files are INDEXED IN PLACE (never copied). A file is matched only when its name carries the stable IDs:
 *   {CODE}-S{##}-IMG{###}[_description]_v{n}.png|jpg|jpeg|webp  (older {project-slug}_SC##_IMG-###… names still work)
 * and those IDs are consistent with the folder's project, an existing planned image, that image's scene,
 * and a version that does not exist yet. Anything else goes to UNMATCHED FILES — the watcher never guesses,
 * never deletes, never overwrites, and ignores partial downloads. It rescans on startup.
 */
import fs from 'fs/promises';
import path from 'path';
import { db } from './db';
import { getStorageRoot } from './storage';
import { parseResultFilename, RESULT_EXTS } from './naming';
import { effectiveCode } from './project-code';
import { exifAwareSize } from './files';
import { orientationOf, imageCode, sceneCode } from './util';
import { registerAttempt } from './results';
import { snapshotPrompts } from './prompt-versions';
import { logActivity } from './activity';

export type WatchEvent = { id: number; kind: 'matched' | 'unmatched'; text: string; href: string };
type State = { started: boolean; scanning: boolean; seen: Map<string, { size: number; mtimeMs: number }>; events: WatchEvent[]; counter: number; lastScan: number; timer?: ReturnType<typeof setInterval> };
const g = globalThis as unknown as { __bcsWatch?: State };
const st = (): State => (g.__bcsWatch ??= { started: false, scanning: false, seen: new Map(), events: [], counter: 0, lastScan: 0 });

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
const TEMP = /(\.crdownload|\.part|\.partial|\.tmp|\.download|\.opdownload)$|^~\$|^\./i;
const STABLE_MS = 3000;

function push(kind: WatchEvent['kind'], text: string, href: string) {
  const s = st();
  s.events.push({ id: ++s.counter, kind, text, href });
  if (s.events.length > 30) s.events.shift();
}

async function enabled(): Promise<boolean> {
  const v = (await db.setting.findUnique({ where: { key: 'watchProjectFolders' } }))?.value;
  return v !== 'false';
}

type Proj = { id: string; slug: string; code?: string | null; title: string; folderName: string | null };

async function handleFile(p: Proj, sub: string, name: string, rel: string, size: number) {
  const unmatched = async (reason: string) => {
    const abs = path.join(await getStorageRoot(), rel);
    const buf = await fs.readFile(abs).catch(() => null);
    const dim = buf ? await exifAwareSize(buf) : null;
    const ext = path.extname(name).slice(1).toLowerCase();
    const asset = await db.asset.create({ data: { displayName: name, originalName: name, internalName: name, relPath: rel, mime: MIME[ext] ?? 'application/octet-stream', size, width: dim?.width ?? null, height: dim?.height ?? null, orientation: orientationOf(dim?.width, dim?.height), kind: 'UNMATCHED', projectSlug: p.slug, status: 'UNMATCHED' } });
    await db.unmatchedFile.create({ data: { relPath: rel, name, folder: sub || '(project folder)', reason, assetId: asset.id, size } });
    push('unmatched', `Unmatched file: ${name} — ${reason}`, '/unmatched');
  };

  const parsed = parseResultFilename(name);
  if (!parsed) return unmatched('The filename does not contain the project, scene, image and version IDs.');
  if (parsed.slug && parsed.slug !== p.slug) return unmatched(`The filename says project “${parsed.slug}” but it is in the “${p.slug}” folder.`);
  if (parsed.code && parsed.code !== effectiveCode(p)) return unmatched(`The filename says project “${parsed.code}” but this folder's project code is “${effectiveCode(p)}”.`);
  const img = await db.plannedImage.findFirst({ where: { projectId: p.id, seq: parsed.seq }, include: { scene: true, attempts: { select: { number: true } } } });
  if (!img) return unmatched(`This project has no planned image ${imageCode(parsed.seq)}.`);
  if (img.scene.order !== parsed.sceneOrder) return unmatched(`The filename says ${sceneCode(parsed.sceneOrder)} but ${imageCode(img.seq)} is in ${sceneCode(img.scene.order)}.`);
  if (img.attempts.some(a => a.number === parsed.version)) return unmatched(`Version v${parsed.version} already exists for ${imageCode(img.seq)} (not overwritten).`);

  const abs = path.join(await getStorageRoot(), rel);
  const buf = await fs.readFile(abs);
  const dim = await exifAwareSize(buf);
  await snapshotPrompts(img.id, 'Snapshot when result was detected');
  const asset = await db.asset.create({ data: { displayName: name, originalName: name, internalName: name, relPath: rel, mime: MIME[parsed.ext] ?? 'image/png', size, width: dim?.width ?? null, height: dim?.height ?? null, orientation: orientationOf(dim?.width, dim?.height), kind: 'GENERATED', projectSlug: p.slug, version: parsed.version } });
  await registerAttempt({ imageId: img.id, assetId: asset.id, number: parsed.version, sourceTool: 'Other', promptType: 'FULL', notes: `Detected automatically in ${sub || 'the project folder'}`, activity: `${imageCode(img.seq)} v${parsed.version} detected in folder → Review` });
  push('matched', `Detected ${imageCode(img.seq)} v${parsed.version} → now in Review`, `/projects/${p.slug}/images/${img.id}#review`);
}

/** One pass over all project folders. Safe to call repeatedly; never throws. */
export async function scanProjectFolders(): Promise<{ matched: number; unmatched: number; skipped?: boolean }> {
  const s = st();
  if (s.scanning) return { matched: 0, unmatched: 0, skipped: true };
  s.scanning = true;
  const before = s.counter;
  try {
    if (!(await enabled())) return { matched: 0, unmatched: 0, skipped: true };
    const root = await getStorageRoot();
    const projects = await db.project.findMany({ where: { deletedAt: null, folderName: { not: null } }, select: { id: true, slug: true, code: true, title: true, folderName: true } });
    for (const p of projects) {
      for (const sub of ['02 Images', '']) {
        const dir = path.join(root, p.folderName!, sub);
        let entries: import('fs').Dirent[];
        try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { continue; }
        for (const e of entries) {
          try {
            if (!e.isFile() || TEMP.test(e.name)) continue;
            const ext = path.extname(e.name).slice(1).toLowerCase();
            if (!RESULT_EXTS.includes(ext)) continue;
            const rel = [p.folderName!, sub, e.name].filter(Boolean).join('/');
            if (await db.asset.findFirst({ where: { relPath: rel }, select: { id: true } })) continue;
            if (await db.unmatchedFile.findFirst({ where: { relPath: rel }, select: { id: true } })) continue;
            const stat = await fs.stat(path.join(dir, e.name));
            if (stat.size === 0) continue;
            const prev = s.seen.get(rel);
            s.seen.set(rel, { size: stat.size, mtimeMs: stat.mtimeMs });
            // partial downloads / files still being written: must be settled and unchanged since the last look
            if (Date.now() - stat.mtimeMs < STABLE_MS || (prev && prev.size !== stat.size)) continue;
            await handleFile(p, sub, e.name, rel, stat.size);
            s.seen.delete(rel);
          } catch (err) { console.error('[watcher] file error', e.name, err); }
        }
      }
    }
  } catch (err) { console.error('[watcher] scan error', err); }
  finally { s.scanning = false; s.lastScan = Date.now(); }
  const fresh = s.events.filter(e => e.id > before);
  return { matched: fresh.filter(e => e.kind === 'matched').length, unmatched: fresh.filter(e => e.kind === 'unmatched').length };
}

/** Start once per server process: rescan immediately (files added while the app was closed), then keep polling. */
export function startProjectWatcher() {
  const s = st();
  if (s.started) return;
  s.started = true;
  setTimeout(() => { void scanProjectFolders().then(r => { if (r.matched || r.unmatched) void logActivity(`Startup scan: ${r.matched} matched, ${r.unmatched} unmatched`); }); }, 1500);
  s.timer = setInterval(() => { void scanProjectFolders(); }, 4000);
  s.timer.unref?.();
}

export function watcherStatus() {
  const s = st();
  return { started: s.started, lastScan: s.lastScan, events: s.events };
}
