import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { db } from '@/lib/db';
import fs from 'fs/promises';
import { storage, THUMB_DIR } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const a = await db.asset.findUnique({ where: { id: params.id } });
  if (!a) return new NextResponse('Not found', { status: 404 });
  const url = new URL(req.url);
  const w = parseInt(url.searchParams.get('w') || '0', 10);
  const download = url.searchParams.get('download') === '1';
  const nameOverride = (url.searchParams.get('name') || '').replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 150);
  const filename = nameOverride ? nameOverride + path.extname(a.displayName) : a.displayName;
  const headers: Record<string, string> = { 'Content-Type': a.mime, 'Cache-Control': 'private, max-age=3600' };
  if (download) headers['Content-Disposition'] = `attachment; filename="${filename}"`;
  try {
    if (w > 0 && a.mime.startsWith('image/') && a.mime !== 'image/gif') {
      const thumbPath = path.join(THUMB_DIR, `${a.id}_${w}.webp`);
      let data: Buffer;
      try { data = await fs.readFile(thumbPath); }
      catch {
        const sharp = (await import('sharp')).default;
        data = await sharp(await storage.read(a.relPath)).rotate().resize({ width: Math.min(w, 1600), withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
        await fs.mkdir(THUMB_DIR, { recursive: true }); await fs.writeFile(thumbPath, data);
      }
      return new NextResponse(data, { headers: { ...headers, 'Content-Type': 'image/webp' } });
    }
    return new NextResponse(await storage.read(a.relPath), { headers });
  } catch {
    // thumbnail failed -> fall back to the original
    try { return new NextResponse(await storage.read(a.relPath), { headers }); } catch { return new NextResponse('File missing on disk', { status: 404 }); }
  }
}
