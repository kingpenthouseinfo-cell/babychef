import { NextResponse } from 'next/server';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { isLocalRequest } from '@/lib/local-only';

export const dynamic = 'force-dynamic';
const appDir = process.cwd();
const env = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH ?? ''}` };
const git = (args: string[]) => spawnSync('git', args, { cwd: appDir, env, encoding: 'utf8', timeout: 20000 });

/** Is a newer version waiting on GitHub? */
export async function GET(req: Request) {
  if (!isLocalRequest(req)) return NextResponse.json({ error: 'Only from this computer' }, { status: 403 });
  if (!fs.existsSync(path.join(appDir, '.git'))) return NextResponse.json({ canUpdate: false, reason: 'This copy was not installed from GitHub, so it cannot update itself.' });
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
  const f = git(['fetch', 'origin', branch]);
  if (f.status !== 0) return NextResponse.json({ canUpdate: true, behind: null, reason: 'Could not reach GitHub right now.' });
  const behind = parseInt(git(['rev-list', '--count', `HEAD..origin/${branch}`]).stdout.trim() || '0', 10);
  return NextResponse.json({ canUpdate: true, behind });
}

/** Update now: stop, pull, install, rebuild, start again (your data is never touched). */
export async function POST(req: Request) {
  if (!isLocalRequest(req)) return NextResponse.json({ error: 'Only from this computer' }, { status: 403 });
  const script = path.join(appDir, 'scripts', 'self-update.sh');
  if (!fs.existsSync(script) || !fs.existsSync(path.join(appDir, '.git'))) return NextResponse.json({ ok: false, error: 'This copy cannot update itself.' }, { status: 400 });
  const child = spawn('/bin/bash', [script], { cwd: appDir, env, detached: true, stdio: 'ignore' });
  child.unref();
  return NextResponse.json({ ok: true });
}
