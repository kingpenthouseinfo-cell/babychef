import { sceneClipIds } from './scene-clips';
import { spawn, type ChildProcess } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { db } from './db';
import { storage } from './storage';
import { projectFolder } from './files';
import { SCENE_ORDER } from './order';
import { sceneLabels } from './scene-label';
import { shortDesc } from './naming';
import { ffmpegPath, hasVideoToolbox, probe } from './ffmpeg';
import { logActivity } from './activity';

/** EXPORT FULL VIDEO: joins a recipe video's clips (in the saved storyboard order) into one MP4 with FFmpeg, on this Mac. No cloud, no API.
 *  Each clip is first made to the same size / frame rate / sound (clean, no stretching), then the pieces are joined and the sound is encoded once, so picture and sound stay in sync. */
export type Resolution = '1080p' | '4k';
export type ExportOptions = { resolution: Resolution; fps: 24 | 30 | 60; includeUnassigned: boolean };
export const DEFAULT_OPTIONS: ExportOptions = { resolution: '1080p', fps: 30, includeUnassigned: false };
const SIZE: Record<Resolution, { w: number; h: number; label: string; tag: string }> = { '1080p': { w: 1920, h: 1080, label: '1080p', tag: '1080p' }, '4k': { w: 3840, h: 2160, label: '4K UHD', tag: '4k' } };
export const resolutionLabel = (r: string) => SIZE[r as Resolution]?.label ?? r;

export type PlanClip = {
  order: number; kind: 'scene' | 'unassigned'; included: boolean; assetId: string; sceneId?: string; sceneLabel?: string; title: string; name: string; rel: string; abs: string;
  missing: boolean; duration: number; width: number; height: number; fps: number; hasAudio: boolean; warn?: string;
};
export type ExportPlan = {
  project: { id: string; title: string; slug: string }; clips: PlanClip[]; assignedCount: number; unassignedCount: number; includedCount: number; totalSeconds: number;
  missing: string[]; warnings: string[]; ffmpeg: boolean; saved: ExportOptions;
};

export async function loadSettings(projectId: string): Promise<ExportOptions> {
  const p = await db.project.findUnique({ where: { id: projectId }, select: { exportSettings: true } });
  try { const j = p?.exportSettings ? JSON.parse(p.exportSettings) : {}; return { resolution: j.resolution === '4k' ? '4k' : '1080p', fps: [24, 30, 60].includes(j.fps) ? j.fps : 30, includeUnassigned: !!j.includeUnassigned }; } catch { return { ...DEFAULT_OPTIONS }; }
}

/** The clips in export order: scene clips in the SAVED storyboard order, then (only if asked) clips not on a scene, in file-name order. Nothing is guessed or moved. */
export async function planExport(projectId: string, includeUnassigned: boolean): Promise<ExportPlan> {
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId }, select: { id: true, title: true, slug: true } });
  const [scenes, assets] = await Promise.all([
    db.scene.findMany({ where: { projectId }, orderBy: [...SCENE_ORDER], select: { id: true, order: true, pos: true, inserted: true, title: true, videoAssetId: true, clipIds: true } }),
    db.asset.findMany({ where: { kind: 'VIDEO_CLIP', projectSlug: project.slug } }),
  ]);
  const labels = sceneLabels(scenes);
  const byId = new Map(assets.map(a => [a.id, a]));
  const seen = new Set<string>(), seenPath = new Set<string>();
  const clips: PlanClip[] = [];
  const warnings: string[] = [];
  const w = scenes.length > 99 ? 3 : 2;
  const make = async (a: (typeof assets)[number], kind: PlanClip['kind'], extra: Partial<PlanClip>): Promise<PlanClip | null> => {
    if (seen.has(a.id) || seenPath.has(a.relPath)) return null; // never twice
    seen.add(a.id); seenPath.add(a.relPath);
    const abs = await storage.absolute(a.relPath);
    let exists = true; try { await fs.access(abs); } catch { exists = false; }
    const info = exists ? await probe(abs) : null;
    return { order: 0, kind, included: false, assetId: a.id, title: a.displayName, name: a.displayName, rel: a.relPath, abs, missing: !exists || !info, duration: info?.duration ?? 0, width: info?.width ?? 0, height: info?.height ?? 0, fps: info?.fps ?? 0, hasAudio: !!info?.hasAudio, ...(exists && !info ? { warn: 'This file could not be read as a video' } : {}), ...extra };
  };
  for (const [i, sc] of scenes.entries()) {
    const ids = sceneClipIds(sc as any);
    for (const [k, id] of ids.entries()) {
      const a = byId.get(id);
      if (!a) { warnings.push(`Scene ${labels.get(sc.id)} points to a clip that is no longer in the project.`); continue; }
      const c = await make(a, 'scene', { sceneId: sc.id, sceneLabel: labels.get(sc.id) ?? '', title: ids.length > 1 ? `${sc.title} (clip ${k + 1} of ${ids.length})` : sc.title });
      if (!c) continue;
      const m = /^(\d{2,3})(?:\.\d+)?_/.exec(a.displayName);
      if (m && parseInt(m[1], 10) !== i + 1) { c.warn = `The file name says ${m[1]} but this scene is number ${String(i + 1).padStart(w, '0')} in the storyboard — the storyboard order is used.`; warnings.push(`${a.displayName}: file number differs from the storyboard order (storyboard order is used).`); }
      c.included = true; clips.push(c);
    }
  }
  const loose = assets.filter(a => !seen.has(a.id)).sort((x, y) => x.displayName.localeCompare(y.displayName, undefined, { numeric: true }));
  for (const a of loose) { const c = await make(a, 'unassigned', {}); if (c) { c.included = includeUnassigned; clips.push(c); } }
  clips.forEach((c, i) => (c.order = i + 1));
  const inc = clips.filter(c => c.included);
  return {
    project, clips, assignedCount: clips.filter(c => c.kind === 'scene').length, unassignedCount: clips.filter(c => c.kind === 'unassigned').length, includedCount: inc.length,
    totalSeconds: inc.reduce((s, c) => s + c.duration, 0), missing: inc.filter(c => c.missing).map(c => c.name), warnings, ffmpeg: !!(await ffmpegPath()), saved: await loadSettings(projectId),
  };
}

// ------------------------------------------------------------------ running an export
type Job = { canceled: boolean; child?: ChildProcess };
const g = globalThis as unknown as { __bcsExports?: Map<string, Job> };
const jobs = (): Map<string, Job> => (g.__bcsExports ??= new Map());

const nameOf = (slug: string, res: Resolution, v: number) => `${slug}_full_${SIZE[res].tag}_v${v}.mp4`;

function runFfmpeg(bin: string, args: string[], job: Job, onTime: (sec: number) => void): Promise<{ code: number; err: string }> {
  return new Promise(resolve => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    job.child = child;
    let err = '', buf = '';
    child.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); const m = /^out_time_(?:us|ms)=(\d+)/.exec(line); if (m) onTime(parseInt(m[1], 10) / 1e6); } });
    child.stderr.on('data', d => { err = (err + d).slice(-4000); });
    child.on('error', e => resolve({ code: 1, err: String(e) }));
    child.on('close', code => { job.child = undefined; resolve({ code: code ?? 1, err }); });
  });
}

async function setRow(id: string, data: Record<string, unknown>) { try { await db.videoExport.update({ where: { id }, data }); } catch { /* row removed */ } }

/** Start an export. Returns at once; the work continues in the background (FFmpeg runs as its own process). */
export async function startExport(projectId: string, o: ExportOptions): Promise<{ id: string }> {
  const bin = await ffmpegPath();
  if (!bin) throw new Error('FFmpeg was not found. Update Baby Chef Studio (it comes with the app) or install FFmpeg, then try again.');
  const busy = await db.videoExport.findFirst({ where: { projectId, status: 'RUNNING' } });
  if (busy && jobs().has(busy.id)) throw new Error('An export is already running for this video.');
  const plan = await planExport(projectId, o.includeUnassigned);
  const inc = plan.clips.filter(c => c.included);
  if (!inc.length) throw new Error('There are no video clips to export yet. Drop clips on their scenes on the Storyboard first.');
  if (plan.missing.length) throw new Error(`These clips are missing or cannot be read: ${plan.missing.join(', ')}. Nothing was exported.`);
  const folder = await projectFolder(projectId);
  const dirRel = `${folder}/Final Videos`;
  let v = ((await db.videoExport.aggregate({ where: { projectId, resolution: o.resolution }, _max: { version: true } }))._max.version ?? 0) + 1;
  while (await storage.exists(`${dirRel}/${nameOf(plan.project.slug, o.resolution, v)}`)) v++;
  const row = await db.videoExport.create({ data: { projectId, resolution: o.resolution, fps: o.fps, includeUnassigned: o.includeUnassigned, clipCount: inc.length, totalSeconds: plan.totalSeconds, version: v, stage: 'Starting', outputRelPath: `${dirRel}/${nameOf(plan.project.slug, o.resolution, v)}` } });
  await db.project.update({ where: { id: projectId }, data: { exportSettings: JSON.stringify(o) } as any });
  const job: Job = { canceled: false }; jobs().set(row.id, job);
  void runExport(row.id, bin, plan, o, job).catch(e => console.error('[export]', e));
  return { id: row.id };
}

async function runExport(id: string, bin: string, plan: ExportPlan, o: ExportOptions, job: Job) {
  const row = await db.videoExport.findUniqueOrThrow({ where: { id } });
  const inc = plan.clips.filter(c => c.included);
  const { w, h } = SIZE[o.resolution];
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'bcs-export-'));
  const finalRel = row.outputRelPath!, finalAbs = await storage.absolute(finalRel), partial = `${finalAbs}.partial`;
  let lastWrite = 0;
  const progress = async (pct: number, stage: string) => { const now = Date.now(); if (now - lastWrite < 400 && pct < 99) return; lastWrite = now; await setRow(id, { progress: Math.min(99, Math.max(0, Math.floor(pct))), stage }); };
  let useVT = await hasVideoToolbox();
  const encoder = () => (useVT ? 'Apple hardware encoder' : 'Software encoder');
  try {
    await fs.mkdir(path.dirname(finalAbs), { recursive: true });
    const total = inc.reduce((s, c) => s + c.duration, 0) || 1;
    const segs: string[] = [];
    let done = 0;
    const vf = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=${o.fps},format=yuv420p`;
    for (const [i, c] of inc.entries()) {
      if (job.canceled) throw new Error('CANCELED');
      const out = path.join(tmp, `seg_${String(i).padStart(4, '0')}.mov`);
      const stage = `Preparing clip ${i + 1} of ${inc.length}`;
      const attempt = async (vt: boolean) => {
        const args = ['-y', '-hide_banner', '-loglevel', 'error', '-nostdin', '-progress', 'pipe:1', '-nostats', '-i', c.abs];
        if (!c.hasAudio) args.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
        args.push('-map', '0:v:0', '-map', c.hasAudio ? '0:a:0' : '1:a:0', '-vf', vf);
        args.push(...(vt ? ['-c:v', 'h264_videotoolbox', '-b:v', o.resolution === '4k' ? '45M' : '14M', '-profile:v', 'high'] : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', o.resolution === '4k' ? '20' : '18', '-profile:v', 'high']), '-pix_fmt', 'yuv420p', '-video_track_timescale', '90000');
        // sound: 48 kHz stereo, padded with silence so it is exactly as long as the picture (a clip without sound gets silence)
        args.push('-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2');
        if (c.hasAudio) args.push('-af', 'apad');
        args.push('-t', c.duration.toFixed(3), '-shortest', out); // stop exactly at the end of the picture
        return runFfmpeg(bin, args, job, sec => void progress(((done + Math.min(sec, c.duration)) / total) * 90, stage));
      };
      let r = await attempt(useVT);
      if (job.canceled) throw new Error('CANCELED');
      if (r.code !== 0 && useVT) { useVT = false; r = await attempt(false); } // hardware encoder refused: use the software one
      if (r.code !== 0) throw new Error(`Could not prepare “${c.name}”: ${r.err.trim().split('\n').slice(-2).join(' ') || 'FFmpeg stopped'}`);
      segs.push(out); done += c.duration;
      await progress((done / total) * 90, stage);
    }
    if (job.canceled) throw new Error('CANCELED');
    await setRow(id, { stage: 'Joining the clips', encoder: encoder() });
    const list = path.join(tmp, 'list.txt');
    await fs.writeFile(list, segs.map(s => `file '${s.replace(/'/g, `'\\''`)}'`).join('\n') + '\n');
    const mux = await runFfmpeg(bin, ['-y', '-hide_banner', '-loglevel', 'error', '-nostdin', '-progress', 'pipe:1', '-nostats', '-f', 'concat', '-safe', '0', '-i', list, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-f', 'mp4', partial], job, sec => void progress(90 + Math.min(sec / total, 1) * 8, 'Joining the clips'));
    if (job.canceled) throw new Error('CANCELED');
    if (mux.code !== 0) throw new Error(`Could not join the clips: ${mux.err.trim().split('\n').slice(-2).join(' ') || 'FFmpeg stopped'}`);
    await setRow(id, { stage: 'Checking the finished video', progress: 99 });
    const info = await probe(partial);
    const tol = inc.length / o.fps + 0.6;
    if (!info) throw new Error('The finished file could not be read back, so it was not saved.');
    if (info.width !== w || info.height !== h) throw new Error(`The finished video has the wrong size (${info.width}×${info.height}).`);
    if (!info.hasAudio) throw new Error('The finished video has no sound track.');
    if (Math.abs(info.duration - total) > tol + inc.length * 0.05) throw new Error(`The finished video is ${info.duration.toFixed(1)} seconds but should be about ${total.toFixed(1)}.`);
    if (job.canceled) throw new Error('CANCELED');
    await fs.rename(partial, finalAbs);
    const stat = await fs.stat(finalAbs);
    const name = path.basename(finalAbs);
    const asset = await db.asset.create({ data: { displayName: name, originalName: name, internalName: name, relPath: finalRel, mime: 'video/mp4', size: stat.size, width: w, height: h, orientation: 'LANDSCAPE', kind: 'FINAL_VIDEO', projectSlug: plan.project.slug, version: row.version } });
    await setRow(id, { status: 'DONE', progress: 100, stage: 'Done', assetId: asset.id, durationSeconds: info.duration, encoder: encoder(), finishedAt: new Date() });
    await logActivity(`Full video exported (${SIZE[o.resolution].label}, ${inc.length} clip${inc.length === 1 ? '' : 's'}): ${name}`, `/projects/${plan.project.slug}/kling`, row.projectId);
  } catch (e: any) {
    const canceled = job.canceled || e?.message === 'CANCELED';
    await setRow(id, canceled ? { status: 'CANCELED', stage: 'Canceled', finishedAt: new Date() } : { status: 'FAILED', error: String(e?.message || e).slice(0, 600), stage: 'Failed', finishedAt: new Date() });
  } finally {
    // only OUR temporary files are removed — the original clips are never touched
    await fs.rm(partial, { force: true }).catch(() => undefined);
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined);
    jobs().delete(id);
  }
}

/** Stop a running export: FFmpeg is stopped and the unfinished file is removed. Original clips are never touched. */
export async function cancelExport(id: string): Promise<void> {
  const j = jobs().get(id);
  if (j) { j.canceled = true; try { j.child?.kill('SIGKILL'); } catch { /* already gone */ } return; }
  await db.videoExport.updateMany({ where: { id, status: 'RUNNING' }, data: { status: 'CANCELED', stage: 'Canceled', finishedAt: new Date() } });
}

/** Current state of an export. A "running" export with no live process (the app was restarted) is marked failed. */
export async function getExport(id: string) {
  let r = await db.videoExport.findUnique({ where: { id } });
  if (r && r.status === 'RUNNING' && !jobs().has(id)) {
    r = await db.videoExport.update({ where: { id }, data: { status: 'FAILED', error: 'The export was interrupted (the app was restarted). Start it again.', stage: 'Failed', finishedAt: new Date() } });
    if (r.outputRelPath) await fs.rm(`${await storage.absolute(r.outputRelPath)}.partial`, { force: true }).catch(() => undefined);
  }
  return r;
}
void shortDesc;
