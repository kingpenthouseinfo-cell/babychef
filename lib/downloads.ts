import fs from 'fs/promises';
import os from 'os';
import path from 'path';

/** The user's ~/Downloads folder (the app runs locally on their Mac). */
export const downloadsDir = () => path.join(process.env.DOWNLOADS_DIR || path.join(os.homedir(), 'Downloads'));
const IMG_EXT: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

export type DownloadItem = { name: string; size: number; mtime: number };

/** Newest image files in ~/Downloads (last 3 days), so a fresh ChatGPT download can be added in one click. */
export async function listRecentDownloads(limit = 6): Promise<DownloadItem[]> {
  try {
    const dir = downloadsDir();
    const names = await fs.readdir(dir);
    const items: DownloadItem[] = [];
    for (const name of names) {
      if (name.startsWith('.') || !IMG_EXT[path.extname(name).toLowerCase()]) continue;
      const st = await fs.stat(path.join(dir, name)).catch(() => null);
      if (st?.isFile() && Date.now() - st.mtimeMs < 3 * 86400_000) items.push({ name, size: st.size, mtime: st.mtimeMs });
    }
    return items.sort((a, b) => b.mtime - a.mtime).slice(0, limit);
  } catch { return []; }
}

/** Resolve a bare file name inside ~/Downloads only (no path separators / traversal). */
export function downloadPath(name: string): string {
  const base = path.basename(name);
  if (base !== name || base.startsWith('.')) throw new Error('Invalid file name');
  const dir = downloadsDir();
  const full = path.resolve(dir, base);
  if (!full.startsWith(path.resolve(dir) + path.sep)) throw new Error('Invalid file');
  return full;
}

export async function readDownload(name: string): Promise<{ file: File; path: string }> {
  const p = downloadPath(name);
  const mime = IMG_EXT[path.extname(p).toLowerCase()];
  if (!mime) throw new Error('Only image files can be added');
  const buf = await fs.readFile(p);
  return { file: new File([new Uint8Array(buf)], path.basename(p), { type: mime }), path: p };
}
export async function removeDownload(p: string) { await fs.unlink(p).catch(() => undefined); }
