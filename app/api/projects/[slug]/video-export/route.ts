import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { planExport, startExport, loadSettings, resolutionLabel, type ExportOptions } from '@/lib/video-export';

export const dynamic = 'force-dynamic';

const exportJson = (r: any) => r && ({ id: r.id, status: r.status, progress: r.progress, stage: r.stage, error: r.error, resolution: r.resolution, resolutionLabel: resolutionLabel(r.resolution), fps: r.fps, includeUnassigned: r.includeUnassigned, clipCount: r.clipCount, version: r.version, encoder: r.encoder, assetId: r.assetId, durationSeconds: r.durationSeconds, createdAt: r.createdAt, finishedAt: r.finishedAt, fileName: r.outputRelPath ? String(r.outputRelPath).split('/').pop() : null });

/** The plan (which clips, in which order, any problems) + past exports of this video. */
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const p = await db.project.findUnique({ where: { slug: params.slug }, select: { id: true } });
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const q = req.nextUrl.searchParams.get('includeUnassigned');
  const saved = await loadSettings(p.id);
  const include = q === null ? saved.includeUnassigned : q === '1';
  const plan = await planExport(p.id, include);
  const history = await db.videoExport.findMany({ where: { projectId: p.id }, orderBy: { createdAt: 'desc' }, take: 8 });
  const running = history.find(h => h.status === 'RUNNING');
  return NextResponse.json({
    project: plan.project, clips: plan.clips.map(c => ({ order: c.order, kind: c.kind, included: c.included, sceneLabel: c.sceneLabel ?? null, title: c.title, name: c.name, missing: c.missing, duration: c.duration, width: c.width, height: c.height, fps: c.fps, hasAudio: c.hasAudio, warn: c.warn ?? null })),
    assignedCount: plan.assignedCount, unassignedCount: plan.unassignedCount, includedCount: plan.includedCount, totalSeconds: plan.totalSeconds, missing: plan.missing, warnings: plan.warnings, ffmpeg: plan.ffmpeg, saved,
    running: running ? exportJson(running) : null, history: history.filter(h => h.status === 'DONE').map(exportJson),
  });
}

/** Start an export. Returns at once with the export's id; poll /export/<id> for progress. */
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const p = await db.project.findUnique({ where: { slug: params.slug }, select: { id: true } });
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as Partial<ExportOptions>;
  const o: ExportOptions = { resolution: b.resolution === '4k' ? '4k' : '1080p', fps: ([24, 30, 60] as number[]).includes(Number(b.fps)) ? (Number(b.fps) as 24 | 30 | 60) : 30, includeUnassigned: !!b.includeUnassigned };
  try { return NextResponse.json(await startExport(p.id, o)); } catch (e: any) { return NextResponse.json({ error: e?.message || 'Could not start the export' }, { status: 400 }); }
}
