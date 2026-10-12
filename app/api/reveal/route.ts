import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { db } from '@/lib/db';
import { storage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/** “Show in Finder”: the app runs locally, so the server can reveal the file on this Mac. */
export async function POST(req: NextRequest) {
  const { assetId, projectFolder: folder } = (await req.json().catch(() => ({}))) as { assetId?: string; projectFolder?: string };
  let rel: string | null = null;
  if (assetId) rel = (await db.asset.findUnique({ where: { id: assetId } }))?.relPath ?? null;
  else if (folder) rel = folder.replace(/\.\./g, '');
  if (!rel) return NextResponse.json({ ok: false, message: 'Nothing to show' }, { status: 400 });
  const abs = await storage.absolute(rel);
  if (process.platform === 'darwin') {
    await new Promise<void>(r => execFile('open', assetId ? ['-R', abs] : [abs], () => r()));
    return NextResponse.json({ ok: true, path: abs });
  }
  return NextResponse.json({ ok: false, path: abs, message: 'Finder reveal only works on macOS — the path was copied instead.' });
}
