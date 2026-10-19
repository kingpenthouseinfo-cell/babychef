import { NextResponse } from 'next/server';
import { getExport, resolutionLabel } from '@/lib/video-export';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { slug: string; id: string } }) {
  const r = await getExport(params.id);
  if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ id: r.id, status: r.status, progress: r.progress, stage: r.stage, error: r.error, resolution: r.resolution, resolutionLabel: resolutionLabel(r.resolution), fps: r.fps, clipCount: r.clipCount, version: r.version, encoder: r.encoder, assetId: r.assetId, durationSeconds: r.durationSeconds, fileName: r.outputRelPath ? r.outputRelPath.split('/').pop() : null });
}
