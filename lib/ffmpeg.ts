import { execFile } from 'node:child_process';
import { promises as fs, constants as fsc } from 'node:fs';
import path from 'node:path';

/** Locating and running FFmpeg / ffprobe. Always spawned with an argument list (never a shell string), so odd file names can't cause trouble. */
const cache: { ffmpeg?: string | null; ffprobe?: string | null; encoders?: string } = {};

async function executable(p?: string | null): Promise<string | null> {
  if (!p) return null;
  try { await fs.access(p, fsc.X_OK); return p; } catch { return null; }
}
async function onPath(name: string): Promise<string | null> {
  const dirs = [...(process.env.PATH || '').split(path.delimiter), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin'];
  for (const d of dirs) { const f = await executable(path.join(d, name)); if (f) return f; }
  return null;
}
async function bundled(pkg: 'ffmpeg-static' | 'ffprobe-static'): Promise<string | null> {
  try {
    // the copies that come with the app (installed by npm); kept out of the bundle, loaded at run time
    const m: any = pkg === 'ffmpeg-static' ? await import('ffmpeg-static') : await import(/* webpackIgnore: false */ 'ffprobe-static' as string);
    const d = m?.default ?? m;
    return await executable(typeof d === 'string' ? d : d?.path);
  } catch { return null; }
}

/** ffmpeg: FFMPEG_PATH, then one installed on this Mac (Homebrew etc.), then the copy that comes with the app. */
export async function ffmpegPath(): Promise<string | null> {
  if (cache.ffmpeg !== undefined) return cache.ffmpeg;
  return (cache.ffmpeg = (await executable(process.env.FFMPEG_PATH)) ?? (await onPath('ffmpeg')) ?? (await bundled('ffmpeg-static')));
}
export async function ffprobePath(): Promise<string | null> {
  if (cache.ffprobe !== undefined) return cache.ffprobe;
  return (cache.ffprobe = (await executable(process.env.FFPROBE_PATH)) ?? (await onPath('ffprobe')) ?? (await bundled('ffprobe-static')));
}

export function run(bin: string, args: string[], opts: { timeout?: number } = {}): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise(resolve => {
    execFile(bin, args, { timeout: opts.timeout ?? 60000, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ code: err ? ((err as any).code && typeof (err as any).code === 'number' ? (err as any).code : 1) : 0, stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  });
}

export type ProbeInfo = { duration: number; hasAudio: boolean; width: number; height: number; fps: number; codec: string };

/** What is really in a video file. Returns null when ffprobe cannot read it. */
export async function probe(file: string): Promise<ProbeInfo | null> {
  const bin = await ffprobePath(); if (!bin) return null;
  const r = await run(bin, ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file]);
  if (r.code !== 0) return null;
  try {
    const j = JSON.parse(r.stdout);
    const v = (j.streams || []).find((s: any) => s.codec_type === 'video');
    const a = (j.streams || []).find((s: any) => s.codec_type === 'audio');
    if (!v) return null;
    const [n, d] = String(v.avg_frame_rate && v.avg_frame_rate !== '0/0' ? v.avg_frame_rate : v.r_frame_rate || '30/1').split('/').map(Number);
    // the length of the PICTURE (a file's sound track can be longer; the export follows the picture)
    const dur = parseFloat(v.duration ?? j.format?.duration ?? '0') || parseFloat(j.format?.duration ?? '0') || 0;
    return { duration: dur, hasAudio: !!a, width: v.width || 0, height: v.height || 0, fps: d ? n / d : n || 30, codec: v.codec_name || '' };
  } catch { return null; }
}

/** Is the Apple hardware H.264 encoder available (Macs)? */
export async function hasVideoToolbox(): Promise<boolean> {
  if (process.platform !== 'darwin') return false;
  const bin = await ffmpegPath(); if (!bin) return false;
  cache.encoders ??= (await run(bin, ['-hide_banner', '-encoders'])).stdout;
  return /h264_videotoolbox/.test(cache.encoders);
}
