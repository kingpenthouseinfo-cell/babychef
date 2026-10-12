import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';

/**
 * Storage abstraction. Version 1 uses local disk under ./storage.
 * Swap LocalStorage for a cloud implementation (e.g. Supabase) later
 * without touching callers.
 */
export interface StorageProvider {
  put(relPath: string, data: Buffer): Promise<void>;
  read(relPath: string): Promise<Buffer>;
  stream(relPath: string): ReadableStream<Uint8Array>;
  exists(relPath: string): Promise<boolean>;
  remove(relPath: string): Promise<void>;
  root(): string;
}

const ROOT = path.resolve(process.env.STORAGE_DIR || path.join(process.cwd(), 'storage'));

function safe(rel: string): string {
  const full = path.resolve(ROOT, rel);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) throw new Error('Invalid storage path');
  return full;
}

export const LocalStorage: StorageProvider = {
  async put(rel, data) {
    const full = safe(rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  },
  async read(rel) { return fs.readFile(safe(rel)); },
  stream(rel) {
    const s = createReadStream(safe(rel));
    return new ReadableStream<Uint8Array>({
      start(c) {
        s.on('data', ch => c.enqueue(new Uint8Array(ch as Buffer)));
        s.on('end', () => c.close());
        s.on('error', e => c.error(e));
      },
      cancel() { s.destroy(); },
    });
  },
  async exists(rel) { try { await fs.access(safe(rel)); return true; } catch { return false; } },
  async remove(rel) { try { await fs.unlink(safe(rel)); } catch { /* ignore */ } },
  root() { return ROOT; },
};

export const storage: StorageProvider = LocalStorage;
