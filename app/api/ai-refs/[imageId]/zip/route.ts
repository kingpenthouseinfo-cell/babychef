import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildReferencePack } from '@/lib/ai-refs-pack';

export const dynamic = 'force-dynamic';

/** DOWNLOAD REFERENCES: all the continuity pictures for one picture, as one small ZIP. */
export async function GET(_req: Request, { params }: { params: { imageId: string } }) {
  const img = await db.plannedImage.findUnique({ where: { id: params.imageId }, select: { projectId: true } });
  if (!img) return new NextResponse('Not found', { status: 404 });
  const pack = await buildReferencePack(img.projectId, params.imageId);
  if (!pack) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(new Uint8Array(pack.data), { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${pack.name}"`, 'Cache-Control': 'no-store' } });
}
