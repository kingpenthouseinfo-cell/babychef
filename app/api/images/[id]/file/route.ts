import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isLocalRequest } from '@/lib/local-only';
import { verify } from '@/lib/signed-links';
import { GET as serveFile } from '../../../files/[id]/route';

export const dynamic = 'force-dynamic';

/**
 * Direct image file: the real picture bytes (image/png, image/jpeg, image/webp), never HTML.
 * `id` is a stored image (asset) id, or a planned picture id (then its approved/latest picture is served).
 * Allowed from this computer, or with a short-lived signed link (?exp=…&sig=…). Never public.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  let assetId = params.id;
  const asset = await db.asset.findUnique({ where: { id: assetId }, select: { id: true } });
  if (!asset) {
    const pic = await db.plannedImage.findUnique({ where: { id: params.id }, include: { approvedAttempt: true, attempts: { orderBy: { number: 'desc' }, take: 1 } } });
    const a = pic?.approvedAttempt ?? pic?.attempts[0];
    if (!a) return new NextResponse('Not found', { status: 404 });
    assetId = a.assetId;
  }
  const signedOk = verify(`img:${params.id}`, url.searchParams.get('exp'), url.searchParams.get('sig')) || verify(`img:${assetId}`, url.searchParams.get('exp'), url.searchParams.get('sig'));
  if (!signedOk && !isLocalRequest(req)) return new NextResponse('This link has expired or is not allowed. Open the picture from Baby Chef Studio again.', { status: 403 });
  return serveFile(req, { params: { id: assetId } });
}
