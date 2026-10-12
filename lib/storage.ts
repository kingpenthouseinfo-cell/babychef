import fs from 'fs/promises';
import { createReadStream } from 'fs';
import os from 'os';
import path from 'path';
import { db } from './db';

/**
 * Local-first storage. Files live as normal, human-readable files under a
 * configurable root folder (default ~/Documents/Baby Chef Studio). The database
 * stores only metadata and RELATIVE paths, so the folder can be moved/backed up.
 * No cloud provider is used; this interface exists only so the implementation
 * could be swapped in a future version.
 */
export interface StorageProvider {
  root(): Promise<string>;
  put(relPath: string, data: Buffer): Promise<void>;
  read(relPath: string): Promise<Buffer>;
  exists(relPath: string): Promise<boolean>;
  remove(relPath: string): Promise<void>;
  move(fromRel: string, toRel: string): Promise<void>;
  absolute(relPath: string): Promise<string>;
}

export const DEFAULT_ROOT_LABEL = '~/Documents/Baby Chef Studio';

export function expandHome(p: string): string {
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

export async function getStorageRoot(): Promise<string> {
  if (process.env.STORAGE_DIR) return path.resolve(expandHome(process.env.STORAGE_DIR));
  let configured: string | undefined;
  try { configured = (await db.setting.findUnique({ where: { key: 'storageRoot' } }))?.value; } catch { /* db not ready */ }
  return path.resolve(expandHome(configured?.trim() || DEFAULT_ROOT_LABEL));
}

async function safe(rel: string): Promise<string> {
  const root = await getStorageRoot();
  const full = path.resolve(root, rel);
  if (full !== root && !full.startsWith(root + path.sep)) throw new Error('Invalid storage path');
  return full;
}

export const LocalStorage: StorageProvider = {
  root: getStorageRoot,
  async put(rel, data) {
    const full = await safe(rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  },
  async read(rel) { return fs.readFile(await safe(rel)); },
  async exists(rel) { try { await fs.access(await safe(rel)); return true; } catch { return false; } },
  async remove(rel) { try { await fs.unlink(await safe(rel)); } catch { /* ignore */ } },
  async move(from, to) {
    const a = await safe(from), b = await safe(to);
    await fs.mkdir(path.dirname(b), { recursive: true });
    await fs.rename(a, b);
  },
  async absolute(rel) { return safe(rel); },
};

export const storage: StorageProvider = LocalStorage;

/** Thumbnails are a disposable cache kept OUTSIDE the user's project folders. */
export const THUMB_DIR = path.resolve(process.cwd(), '.cache', 'thumbs');

/** Verify a candidate root can be created and written to. */
export async function testRoot(p: string): Promise<{ ok: boolean; abs: string; error?: string }> {
  const abs = path.resolve(expandHome(p.trim() || DEFAULT_ROOT_LABEL));
  try {
    await fs.mkdir(abs, { recursive: true });
    const probe = path.join(abs, '.bcs-write-test');
    await fs.writeFile(probe, 'ok'); await fs.unlink(probe);
    return { ok: true, abs };
  } catch (e: any) { return { ok: false, abs, error: e?.message || 'Cannot write to that folder' }; }
}
void createReadStream;
