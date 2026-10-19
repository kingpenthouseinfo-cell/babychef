import '@/app/storyboard.css';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { SCENE_ORDER, IMAGE_ORDER, backfillPositions } from '@/lib/order';
import { sceneLabels } from '@/lib/scene-label';
import { imageLabel } from '@/lib/image-gen';
import { Empty } from '@/components/ui';
import { Storyboard, type SbScene } from '@/components/storyboard';

export const dynamic = 'force-dynamic';

/** STORYBOARD: just the thumbnails, in video order, grouped by scene. Drag to rearrange, + to add in between. */
export default async function StoryboardPage({ params }: { params: { slug: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  await backfillPositions();
  const [scenes, imgs] = await Promise.all([
    db.scene.findMany({ where: { projectId: p.id }, orderBy: [...SCENE_ORDER] }),
    db.plannedImage.findMany({ where: { projectId: p.id }, orderBy: [...IMAGE_ORDER], include: { approvedAttempt: true, attempts: { orderBy: { number: 'desc' }, take: 1 } } }),
  ]);
  const lab = sceneLabels(scenes);
  const data: SbScene[] = scenes.map(s => {
    const mine = imgs.filter(i => i.sceneId === s.id);
    return { id: s.id, label: lab.get(s.id) ?? '?', title: s.title, pics: mine.map((i, n) => ({ id: i.id, seq: i.seq, code: imageLabel(lab.get(s.id) ?? '', n), title: i.title, assetId: (i.approvedAttempt ?? i.attempts[0])?.assetId ?? null, status: i.status })) };
  });
  return (
    <div className="storyboard-page">
      <header className="storyboard-page__head"><h1 className="storyboard-page__title">Storyboard</h1><p className="storyboard-page__sub">All the pictures in video order. Drag to rearrange, or press + to add one in between. A picture takes the scene of the picture it lands next to. What you see here is the saved order.</p></header>
      {scenes.length === 0 ? <Empty title="No scenes yet." hint="Add scenes first — they show up here with a place for each picture." /> : <Storyboard projectId={p.id} slug={p.slug} initial={data} />}
    </div>
  );
}
