import { NextResponse } from 'next/server';
import { cancelExport } from '@/lib/video-export';

export const dynamic = 'force-dynamic';

/** Stop an export (FFmpeg is stopped, the unfinished file is removed, the original clips are never touched). */
export async function POST(_req: Request, { params }: { params: { slug: string; id: string } }) {
  await cancelExport(params.id);
  return NextResponse.json({ ok: true });
}
