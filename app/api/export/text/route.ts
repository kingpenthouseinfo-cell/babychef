import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { imageCode, sceneCode, klingCode } from '@/lib/util';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const type = u.searchParams.get('type') || '', id = u.searchParams.get('id') || '';
  let name = 'export', text = '';
  if (type === 'image-full' || type === 'image-cont') {
    const i = await db.plannedImage.findUnique({ where: { id }, include: { scene: true, project: true } });
    if (!i) return new NextResponse('Not found', { status: 404 });
    const field = type === 'image-full' ? 'fullPrompt' : 'contPrompt';
    const ver = await db.promptVersion.count({ where: { ownerId: id, type: type === 'image-full' ? 'FULL' : 'CONTINUATION' } });
    text = i[field]; name = `${i.project.slug}_${sceneCode(i.scene.order)}_${imageCode(i.seq)}_${type === 'image-full' ? 'full' : 'continuation'}-prompt_v${Math.max(ver, 1)}`;
  } else if (type === 'kling') {
    const k = await db.klingClip.findUnique({ where: { id }, include: { project: true } });
    if (!k) return new NextResponse('Not found', { status: 404 });
    const ver = await db.promptVersion.count({ where: { ownerId: id, type: 'KLING' } });
    text = k.finalPrompt; name = `${k.project.slug}_${klingCode(k.order)}_prompt_v${Math.max(ver, 1)}`;
  } else if (type === 'script') {
    const s = await db.scriptVersion.findUnique({ where: { id }, include: { project: true } });
    if (!s) return new NextResponse('Not found', { status: 404 });
    text = s.content; name = `${s.project.slug}_script_v${s.version}`;
  } else if (type === 'publishing') {
    const a = await db.publishingAsset.findUnique({ where: { id }, include: { project: true } });
    if (!a) return new NextResponse('Not found', { status: 404 });
    text = a.prompt; name = `${a.project.slug}_${a.platform}-${a.assetType}_prompt_v${Math.max(a.promptVersion, 1)}`.replace(/[^A-Za-z0-9._-]+/g, '-').toLowerCase();
  } else return new NextResponse('Unknown type', { status: 400 });
  return new NextResponse(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}.txt"` } });
}
