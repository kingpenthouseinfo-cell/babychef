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
