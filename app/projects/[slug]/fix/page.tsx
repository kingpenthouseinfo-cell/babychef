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
import { HEAD, BODY, PINK_BTN, MINT_BTN } from '@/lib/fix-style';
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
    db.plannedImage.findMany({ where: { projectId: p.id }, orderBy: [...IMAGE_ORDER], include: { scene: true, approvedAttempt: { include: { asset: true } }, attempts: { orderBy: { number: 'desc' }, take: 1, include: { asset: true } } } }),
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
  const picNo = (i: { sceneId: string; id: string }) => 1 + imgs.filter(x => x.sceneId === i.sceneId).findIndex(x => x.id === i.id);
  const sceneLine = (i: (typeof imgs)[number]) => `Scene ${lab.get(i.sceneId)} · ${i.scene.title} · Picture ${picNo(i)}`;
  const card = 'rounded-[28px] bg-white p-3 shadow-[0_20px_50px_-30px_rgba(120,90,160,.5)]';
  return (
    <div className="rounded-[32px] bg-gradient-to-br from-[#FFF7FB] via-[#F7F3FE] to-[#F1FAF4] p-3 md:p-6" style={BODY}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&family=Nunito:wght@400;600;700&display=swap" />
      {!cur && (
        <div>
          <h1 className="text-[36px] font-semibold md:text-[44px]" style={HEAD}>Little fix-ups</h1>
          <p className="mt-1 text-[#8A8093]">{total === 0 ? 'Nothing is flagged. Tap the little flag on any picture to put it here.' : `${total} thing${total === 1 ? '' : 's'} want another try. Pick one to start.`}</p>
          {total === 0 && <div className={`${card} mt-4 p-8 text-center`} data-testid="fix-empty"><div className="text-[44px]">🌸</div><div className="text-[22px] font-semibold" style={HEAD}>Nothing to fix.</div><div className="text-[#8A8093]">Nothing is flagged right now.</div></div>}
          {flaggedImgs.length > 0 && <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="fix-queue" aria-label="Flagged pictures">{flaggedImgs.map(i => { const sh = i.approvedAttempt ?? i.attempts[0] ?? null; return (
            <li key={i.id} className={card} data-testid="flagged-image-card">
              <Link href={`${b}/fix?pick=${i.id}`} data-testid="flagged-image" className="block">
                <span className="relative block aspect-[4/3] overflow-hidden rounded-[22px] bg-gradient-to-br from-[#FFE3EE] to-[#EDE6FB]">{sh && <img src={fileUrl(sh.assetId, 500)} alt={i.title} className="h-full w-full object-cover" />}<span className="absolute right-2 top-2 rounded-full bg-white px-3 py-1 text-[12px] font-bold text-[#C2577E] shadow">⚑ Flagged</span></span>
                <span className="mt-2 block px-1 text-[11.5px] font-bold uppercase tracking-wide text-[#A79CB0]">{sceneLine(i)}</span>
                <span className="block px-1 text-[19px] font-semibold" style={HEAD}>{i.title}</span>
                {i.flagNote && <span className="block px-1 text-[13px] font-semibold text-[#C2577E]">{i.flagNote}</span>}
                <span className={`${PINK_BTN} mt-3 w-full`} style={HEAD}>Fix this one →</span>
              </Link>
            </li>); })}</ul>}
          {flaggedScenes.length > 0 && (
            <section aria-label="Flagged scenes" className="mt-6"><h2 className="text-[22px] font-semibold" style={HEAD}>Scenes</h2>
              <ul className="mt-2 space-y-3">{flaggedScenes.map(s => (
                <li key={s.id} className={`${card} p-4`} data-testid="flagged-scene"><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FCC8DA] text-[#9A3E62]">⚑</span>
                  <div className="min-w-0 flex-1 text-[17px] font-semibold" style={HEAD}>Scene {lab.get(s.id)} · {s.title}</div>
                  <Link className={MINT_BTN.replace('min-h-[56px]', 'min-h-[44px]').replace('px-8', 'px-5')} href={`${b}/story#scene-${s.id}`}>Open scene</Link></div>
                  <FlagNote kind="scene" id={s.id} note={s.flagNote ?? ''} /></li>))}</ul></section>
          )}
        </div>
      )}
      {cur && (
        <section aria-label="Fix this picture" data-testid="fix-panel">
          <Link href={`${b}/fix`} className="mb-3 inline-block text-[15px] font-semibold text-[#6F93C9]" data-testid="fix-back">← All fix-ups ({flaggedImgs.length})</Link>
          <FixWorkspace key={cur.id} imageId={cur.id} title={cur.title} sceneLine={sceneLine(cur)} current={shown ? { assetId: shown.assetId, fileName: shown.asset?.displayName ?? '' } : null} flagNote={cur.flagNote ?? ''} prompt={cur.fullPrompt ?? ''} chatgpt={chatgpt} refs={cands} final={
            <div>
              <h2 className="text-[32px] font-semibold" style={HEAD}>Drop in the new picture</h2>
              <p className="text-[#8A8093]">It’s saved with the right name automatically.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-[200px_1fr]">
                <div><div className="text-[11px] font-bold uppercase tracking-wide text-[#A79CB0]">Before</div><div className="mt-1 overflow-hidden rounded-[20px] bg-gradient-to-br from-[#FFE3EE] to-[#EDE6FB]">{shown && <img src={fileUrl(shown.assetId, 400)} alt="Before" className="w-full object-cover" />}</div></div>
                <ImageDrop imageId={cur.id} hint="Drop the new picture here" className="flex min-h-[220px] flex-col items-center justify-center rounded-[26px] border-[3px] border-dashed border-[#9FD6B3] bg-gradient-to-b from-[#F3FCF6] to-[#E3F6EA] p-6 text-center" data-testid="fix-final">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#C2EBD0] text-[28px] text-[#3F7D55]">+</div>
                  <div className="mt-2 text-[22px] font-semibold text-[#2F6B46]" style={HEAD}>Drag the new picture here</div>
                  <div className="mb-3 text-[14px] text-[#5F8F72]">or choose a file</div>
                  <CardUpload imageId={cur.id} label="Choose a file" className={MINT_BTN} />
                </ImageDrop>
              </div>
              {cur.attempts.length > 0 && <form action={resolveFlagged} className="mt-4"><input type="hidden" name="id" value={cur.id} /><SubmitBtn className={`${MINT_BTN} w-full`} pendingText="Saving…">Fixed! Approve &amp; go to the next one</SubmitBtn></form>}
            </div>} />
        </section>
      )}
    </div>
  );
}
