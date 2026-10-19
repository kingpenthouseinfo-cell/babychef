// Starts Baby Chef Studio with its database in your permanent data folder (not in the code folder):
//   ~/Documents/Baby Chef Studio/Data/baby-chef-studio.db      (backups: ~/Documents/Baby Chef Studio/Backups/)
// First run moves an existing prisma/dev.db there (the old file is left in place as a copy). Usage: node scripts/start.mjs [start|dev]
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] === 'dev' ? 'dev' : 'start';
const root = process.env.STORAGE_DIR || path.join(os.homedir(), 'Documents', 'Baby Chef Studio');
const dataDir = path.join(root, 'Data');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(path.join(root, 'Backups'), { recursive: true });
const dbFile = process.env.BCS_DB || path.join(dataDir, 'baby-chef-studio.db');
const legacy = path.join(appDir, 'prisma', 'dev.db');
if (!fs.existsSync(dbFile) && fs.existsSync(legacy)) {
  fs.copyFileSync(legacy, dbFile);
  console.log(`\nMoved your data to ${dbFile}\n(the old copy at ${legacy} was left where it was)\n`);
}
// before the database structure changes (an update added something), keep a copy of your data
try {
  const crypto = await import('node:crypto');
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(appDir, 'prisma', 'schema.prisma'))).digest('hex');
  const stampFile = path.join(dataDir, '.schema-hash');
  const before = fs.existsSync(stampFile) ? fs.readFileSync(stampFile, 'utf8').trim() : '';
  if (fs.existsSync(dbFile) && before !== hash) {
    const when = new Date().toISOString().replace(/[:.]/g, '-');
    const copy = path.join(root, 'Backups', `before-update-${when}.db`);
    fs.copyFileSync(dbFile, copy);
    if (fs.statSync(copy).size === fs.statSync(dbFile).size) console.log(`\nBacked up your data to ${copy}\n`);
    else { console.error('Backup copy did not match; stopping so nothing is changed.'); process.exit(1); }
  }
  fs.writeFileSync(stampFile, hash);
} catch (e) { console.error('Could not make the safety backup:', e?.message || e); process.exit(1); }
const env = { ...process.env, DATABASE_URL: `file:${dbFile}` };
console.log(`Database: ${dbFile}`);
const push = spawnSync('npx', ['prisma', 'db', 'push', '--skip-generate'], { cwd: appDir, env, stdio: 'inherit' });
if (push.status !== 0) { console.error('Could not prepare the database.'); process.exit(push.status ?? 1); }
if (mode === 'start' && !fs.existsSync(path.join(appDir, '.next', 'BUILD_ID'))) {
  console.log('First start: building the app (a few minutes)…');
  const b = spawnSync('npx', ['next', 'build'], { cwd: appDir, env, stdio: 'inherit' });
  if (b.status !== 0) process.exit(b.status ?? 1);
}
const child = spawn('npx', ['next', mode, ...(process.env.PORT ? ['-p', process.env.PORT] : [])], { cwd: appDir, env, stdio: 'inherit' });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
child.on('exit', code => process.exit(code ?? 0));
