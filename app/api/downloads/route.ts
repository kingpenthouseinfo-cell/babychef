import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { downloadPath } from '@/lib/downloads';

export const dynamic = 'force-dynamic';

/** Small thumbnail of a file in ~/Downloads (for the Add-result dialog). */
export async function GET(req: NextRequest) {
  try {
    const p = downloadPath(new URL(req.url).searchParams.get('name') || '');
    const sharp = (await import('sharp')).default;
    const buf = await sharp(await fs.readFile(p)).rotate().resize({ width: 320, withoutEnlargement: true }).webp({ quality: 70 }).toBuffer();
    return new NextResponse(buf, { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'no-store' } });
  } catch { return new NextResponse('Not found', { status: 404 }); }
}
