import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { SCENE_ORDER, IMAGE_ORDER, backfillPositions } from '@/lib/order';
import { sceneLabels } from '@/lib/scene-label';
import { imageCode } from '@/lib/util';
import { Empty, Thumb } from '@/components/ui';
import { FlagNote } from '@/components/flag-note';

export const dynamic = 'force-dynamic';

/** NEED TO FIX: everything you flagged with the red flag, pictures and scenes. */
export default async function NeedToFix({ params }: { params: { slug: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  await backfillPositions();
  const [scenes, imgs] = await Promise.all([
    db.scene.findMany({ where: { projectId: p.id }, orderBy: [...SCENE_ORDER] }),
    db.plannedImage.findMany({ where: { projectId: p.id }, orderBy: [...IMAGE_ORDER], include: { scene: true, approvedAttempt: true, attempts: { orderBy: { number: 'desc' }, take: 1 } } }),
  ]);
  const lab = sceneLabels(scenes);
  const flaggedScenes = scenes.filter(s => s.flagged);
  const flaggedImgs = imgs.filter(i => i.flagged);
  const b = `/projects/${p.slug}`;
  const total = flaggedScenes.length + flaggedImgs.length;
  return (
    <div className="max-w-[900px] space-y-5">
      <div><div className="eyebrow">NEED TO FIX</div><h1 className="text-[34px] md:text-[40px]">Need to fix</h1>
        <p className="mt-1 text-[14px] text-ink-secondary">{total === 0 ? 'Nothing is flagged.' : `${total} thing${total === 1 ? '' : 's'} flagged with the red flag.`} Flag a picture with the little flag on its preview in the Picture List.</p></div>
      {total === 0 && <Empty title="Nothing to fix." hint="Click the red flag in the top right of any picture preview to put it here." />}
      {flaggedScenes.length > 0 && (
        <section aria-label="Flagged scenes"><h2 className="eyebrow mb-2">SCENES</h2>
          <ul className="space-y-3">{flaggedScenes.map(s => (
            <li key={s.id} className="card" data-testid="flagged-scene"><div className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E5493A] text-white">⚑</span>
              <div className="min-w-0 flex-1"><div className="font-semibold">Scene {lab.get(s.id)} · {s.title}</div></div>
              <Link className="btn btn-sm" href={`${b}/story#scene-${s.id}`}>Open scene</Link></div>
              <FlagNote kind="scene" id={s.id} note={s.flagNote ?? ''} /></li>))}</ul></section>
      )}
      {flaggedImgs.length > 0 && (
        <section aria-label="Flagged pictures"><h2 className="eyebrow mb-2">PICTURES</h2>
          <ul className="space-y-3">{flaggedImgs.map(i => (
            <li key={i.id} className="card" data-testid="flagged-image"><div className="flex items-start gap-3">
              <div className="w-[120px] shrink-0"><Thumb id={i.approvedAttempt?.assetId ?? i.attempts[0]?.assetId ?? null} alt={i.title} w={300} /></div>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-bold">{imageCode(i.seq)}</span><span className="text-[12px] text-ink-secondary">Scene {lab.get(i.sceneId)} · {i.scene.title}</span></div>
                <div className="font-semibold">{i.title}</div>
                <div className="mt-1 flex flex-wrap gap-1.5"><Link className="btn btn-sm" href={`${b}/images/${i.id}`}>Open</Link><Link className="btn btn-sm" href={`${b}/images/${i.id}/references`}>Reference pack</Link></div></div></div>
              <FlagNote kind="image" id={i.id} note={i.flagNote ?? ''} /></li>))}</ul></section>
      )}
    </div>
  );
}
