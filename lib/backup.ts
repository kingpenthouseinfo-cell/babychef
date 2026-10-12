import fs from 'node:fs';
import path from 'node:path';
import { db } from './db';

const KEEP = 30;

/** Where the database file is (from DATABASE_URL) and where its dated backups go. */
export function dbPaths() {
  const m = (process.env.DATABASE_URL || 'file:./dev.db').match(/^file:(.*)$/);
  const file = path.isAbsolute(m?.[1] ?? '') ? m![1] : path.resolve(process.cwd(), 'prisma', m?.[1] ?? 'dev.db');
  const dir = path.dirname(file);
  const backups = path.basename(dir) === 'Data' ? path.join(path.dirname(dir), 'Backups') : path.join(dir, 'backups');
  return { file, backups };
}
const stamp = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function listBackups() {
  const { backups } = dbPaths();
  try { return fs.readdirSync(backups).filter(f => /^baby-chef-studio_.*\.db$/.test(f)).map(f => { const st = fs.statSync(path.join(backups, f)); return { name: f, size: st.size, mtime: st.mtimeMs }; }).sort((a, b) => b.mtime - a.mtime); } catch { return []; }
}

/** A consistent copy of the database (SQLite VACUUM INTO). "auto" makes at most one per day; "manual" always makes one. Keeps the newest 30. */
export async function backupDatabase(kind: 'auto' | 'manual' = 'auto') {
  const { backups } = dbPaths();
  fs.mkdirSync(backups, { recursive: true });
  const now = new Date();
  let name = `baby-chef-studio_${stamp(now)}.db`;
  if (kind === 'manual') name = `baby-chef-studio_${stamp(now)}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}.db`;
  const target = path.join(backups, name);
  if (fs.existsSync(target)) return { name, created: false };
  await db.$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  const all = listBackups();
  for (const old of all.slice(KEEP)) { try { fs.unlinkSync(path.join(backups, old.name)); } catch { /* ignore */ } }
  return { name, created: true };
}
