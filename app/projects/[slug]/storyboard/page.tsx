import '@/app/storyboard.css';
import '@/app/storyboard-clips.css';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { SCENE_ORDER, IMAGE_ORDER, backfillPositions } from '@/lib/order';
import { stepInfosForScene } from '@/lib/step-dialogue';
import { Empty } from '@/components/ui';
import { StoryboardPage } from '@/components/storyboard/StoryboardPage';
import type { SbBoard, PictureStatus } from '@/lib/storyboard-order';

export const dynamic = 'force-dynamic';

const status = (s: string): PictureStatus => {
  const t = s.toUpperCase();
  if (t === 'APPROVED') return 'approved';
  if (t === 'REDO' || t === 'REJECTED') return 'redo';
  if (t === 'NEEDS REVISION') return 'needs-revision';
  if (t === 'REVIEW' || t === 'IMAGE UPLOADED' || t === 'RESULT ADDED') return 'review';
  if (t === 'GENERATING' || t === 'WAITING') return 'generating';
  return 'not-made';
};

/** STORYBOARD: all pictures in folder order (no scene grouping), plus a scene storyboard underneath. Everything is a draft until "Save order". */
export default async function Storyboard({ params }: { params: { slug: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  await backfillPositions();
  const [scenes, imgs] = await Promise.all([
    db.scene.findMany({ where: { projectId: p.id }, orderBy: [...SCENE_ORDER] }),
    db.plannedImage.findMany({ where: { projectId: p.id }, orderBy: [...IMAGE_ORDER], include: { approvedAttempt: true, attempts: { orderBy: { number: 'desc' }, take: 1 }, _count: { select: { attempts: true } } } }),
  ]);
  const board: SbBoard = scenes.map(s => ({
    id: s.id, title: s.title,
    pictures: (() => { const mine = imgs.filter(i => i.sceneId === s.id); const infos = stepInfosForScene(mine as any, s as any); return mine.map((i, _n, all) => {
      const a = i.approvedAttempt ?? i.attempts[0] ?? null;
      const si = infos.get(i.id) ?? null;
      const info = si ? `${si.stepEnd && si.stepEnd > si.stepNo ? `Steps ${si.stepNo}–${si.stepEnd}` : `Step ${si.stepNo}`} of ${si.stepOf}: ${si.step}${si.says ? `\n${si.saysKind === 'scene' ? 'Scene says' : 'Says'}: “${si.says}”` : ''}` : 'Not used';
      return { id: i.id, title: i.title, status: status(i.status), imageUrl: a ? `/api/files/${a.assetId}?w=400` : null, assetId: a?.assetId ?? null, skipped: i.status === 'SKIPPED', versions: (i as any)._count.attempts, info };
    }); })(),
  }));
  const clipAssets = await db.asset.findMany({ where: { kind: 'VIDEO_CLIP', projectSlug: p.slug }, orderBy: { createdAt: 'asc' } });
  const sceneClips: Record<string, { id: string; name: string }> = {};
  for (const sc of scenes) { const a = clipAssets.find(c => c.id === (sc as any).videoAssetId); if (a) sceneClips[sc.id] = { id: a.id, name: a.displayName }; }
  const used = new Set(Object.values(sceneClips).map(c => c.id));
  const tray = clipAssets.filter(c => !used.has(c.id)).map(c => ({ id: c.id, name: c.displayName }));
  if (!scenes.length) return <Empty title="No scenes yet." hint="Add scenes first — then rearrange them here." />;
  return <StoryboardPage projectId={p.id} slug={p.slug} board={board} sceneClips={sceneClips} tray={tray} />;
}
