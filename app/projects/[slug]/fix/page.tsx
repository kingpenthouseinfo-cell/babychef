import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { SCENE_ORDER, IMAGE_ORDER, backfillPositions } from '@/lib/order';
import { sceneLabels } from '@/lib/scene-label';
import { imageCode } from '@/lib/util';
import { Empty, Thumb } from '@/components/ui';
import { FlagNote } from '@/components/flag-note';
import { FixWorkspace } from '@/components/fix-workspace';
import { CardUpload } from '@/components/card-upload';
import { ImageDrop } from '@/components/drop-zone';
import { SubmitBtn } from '@/components/client';
import { fixCandidates } from '@/lib/fix-refs';
import { resolveFlagged } from '@/lib/actions/flags';
import { getSettings } from '@/lib/settings';
import { fileUrl } from '@/components/ui';

export const dynamic = 'force-dynamic';

/** NEED TO FIX: everything you flagged with the red flag, pictures and scenes. */
export default async function NeedToFix({ params, searchParams }: { params: { slug: string }; searchParams: { pick?: string } }) {
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
  const cur = flaggedImgs.find(i => i.id === searchParams.pick) ?? null;
  const [cands, settings] = cur ? await Promise.all([fixCandidates(p.id, cur.id), getSettings()]) : [[], {} as Record<string, string>];
  const chatgpt = (settings as any).url_ChatGPT || 'https://chatgpt.com/';
  const shown = cur ? (cur.approvedAttempt ?? cur.attempts[0] ?? null) : null;
  const total = flaggedScenes.length + flaggedImgs.length;
  return (
    <div className="max-w-[1100px] space-y-5">
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
      {!cur && flaggedImgs.length > 0 && (
        <section aria-label="Flagged pictures"><h2 className="text-[20px] font-semibold">Pick one to fix</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="fix-queue">{flaggedImgs.map(i => { const sh = i.approvedAttempt ?? i.attempts[0] ?? null; return (
            <li key={i.id}><Link href={`${b}/fix?pick=${i.id}`} data-testid="flagged-image" className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3 hover:border-[#E5493A]">
              <span className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-sunken">{sh && <img src={fileUrl(sh.assetId, 240)} alt="" className="h-full w-full object-cover" />}</span>
              <span className="min-w-0"><span className="block font-mono text-[12px] font-bold">{imageCode(i.seq)}</span><span className="block truncate text-[15px] font-semibold">{i.title}</span>{i.flagNote && <span className="block truncate text-[12px] text-ink-secondary">{i.flagNote}</span>}</span></Link></li>); })}</ul></section>
      )}
      {cur && (
        <section aria-label="Fix this picture">
          <Link href={`${b}/fix`} className="text-[14px] font-semibold text-blue-deep" data-testid="fix-back">← All flagged pictures ({flaggedImgs.length})</Link>
          <div className="card mt-3" data-testid="fix-panel">
            <div className="flex items-start gap-3">
              <div className="w-[130px] shrink-0">{shown ? <img src={fileUrl(shown.assetId, 400)} alt={cur.title} className="w-full rounded-lg" /> : <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-sunken text-[12px] text-ink-secondary">No picture yet</div>}</div>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-bold">{imageCode(cur.seq)}</span><span className="text-[12px] text-ink-secondary">Scene {lab.get(cur.sceneId)} · {cur.scene.title}</span></div>
                <div className="text-[18px] font-semibold">{cur.title}</div>
                <FlagNote kind="image" id={cur.id} note={cur.flagNote ?? ''} /></div>
            </div>
            <FixWorkspace key={cur.id} imageId={cur.id} prompt={cur.fullPrompt ?? ''} chatgpt={chatgpt} refs={cands} final={
              <ImageDrop imageId={cur.id} hint="Drop the finished picture here" className="rounded-2xl border-2 border-dashed border-line bg-white p-4" data-testid="fix-final">
                <h3 className="text-[20px] font-semibold">3 · Final image</h3>
                <p className="mt-1 text-[13px] text-ink-secondary">Drag the fixed picture here, or choose it. It is saved with the right name automatically.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <CardUpload imageId={cur.id} label={shown ? 'REPLACE IMAGE' : 'UPLOAD FINAL IMAGE'} className="btn btn-copy min-h-[52px] w-full px-6 text-[15px]" />
                  {cur.attempts.length > 0 && <form action={resolveFlagged}><input type="hidden" name="id" value={cur.id} /><SubmitBtn className="btn-approve min-h-[52px] w-full px-6 text-[15px]" pendingText="Saving…">FIXED — APPROVE &amp; NEXT FLAGGED</SubmitBtn></form>}
                </div>
              </ImageDrop>} />
          </div>
        </section>
      )}
    </div>
  );
}
