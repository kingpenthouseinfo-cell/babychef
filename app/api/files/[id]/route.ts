import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { db } from '@/lib/db';
import { storage } from '@/lib/storage';

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
      const thumbRel = `_thumbs/${a.id}_${w}.webp`;
      if (!(await storage.exists(thumbRel))) {
        const sharp = (await import('sharp')).default;
        const out = await sharp(await storage.read(a.relPath)).rotate().resize({ width: Math.min(w, 1600), withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
        await storage.put(thumbRel, out);
      }
      return new NextResponse(await storage.read(thumbRel), { headers: { ...headers, 'Content-Type': 'image/webp' } });
    }
    return new NextResponse(await storage.read(a.relPath), { headers });
  } catch {
    // thumbnail failed -> fall back to the original
    try { return new NextResponse(await storage.read(a.relPath), { headers }); } catch { return new NextResponse('File missing on disk', { status: 404 }); }
  }
}
