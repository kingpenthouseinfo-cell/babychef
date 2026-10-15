import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { getSettings } from '@/lib/settings';
import { SCENE_ORDER, IMAGE_ORDER, backfillPositions } from '@/lib/order';
import { sceneLabels } from '@/lib/scene-label';
import { cardStatus, imageLabel, type CardStatus } from '@/lib/image-gen';
import { expectedFilename, nextVersion, withFilename } from '@/lib/naming';
import { imageCode } from '@/lib/util';
import { planImages, rewritePrompt, approveLatest, needsRevision } from '@/lib/actions/generate';
import { SubmitBtn, CopyButton } from '@/components/client';
import { MakePictureButton } from '@/components/make-picture';
import { CardUpload } from '@/components/card-upload';
import { InsertTile } from '@/components/story-bits';
import { AiReferences } from '@/components/ai-references';
import { PictureArrange } from '@/components/picture-arrange';
import { FlagButton } from '@/components/flag-button';
import { ImageDrop } from '@/components/drop-zone';
import { aiReferencesForProject, aiRefOptions } from '@/lib/ai-refs';
import { Empty, Thumb, fileUrl } from '@/components/ui';

export const dynamic = 'force-dynamic';

const BADGE: Record<CardStatus, string> = {
  'PROMPT READY': 'bg-[#E3EAF2] text-[#46638A]', 'IMAGE NEEDED': 'bg-[#F4E8CF] text-[#8E6720]', 'IMAGE UPLOADED': 'bg-[#EFE6F7] text-[#6A4E98]', APPROVED: 'bg-[#DDEBDD] text-[#3F6B47]', 'NEEDS REVISION': 'bg-[#F5E1DB] text-[#A5473A]',
};
const FILTERS: [string, string][] = [['ALL', 'All'], ['NEEDS IMAGE', 'Needs image'], ['UPLOADED', 'Uploaded'], ['APPROVED', 'Approved'], ['NEEDS REVISION', 'Needs revision'], ['SHORT KEEP', 'Short keep'], ['VERTICAL CRITICAL', 'Vertical critical']];
const vLabel = (c: string) => (c === 'CRITICAL' ? 'VERTICAL CRITICAL' : c === 'PREFERRED' ? 'VERTICAL PREFERRED' : 'NOT IMPORTANT');

export default async function Generate({ params, searchParams }: { params: { slug: string }; searchParams: { f?: string; x?: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  await backfillPositions();
  const [scenes, imgs, settings] = await Promise.all([
    db.scene.findMany({ where: { projectId: p.id }, orderBy: [...SCENE_ORDER] }),
    db.plannedImage.findMany({ where: { projectId: p.id }, orderBy: [...IMAGE_ORDER], include: { approvedAttempt: true, attempts: { orderBy: { number: 'desc' } } } }),
    getSettings(),
  ]);
  const chatgpt = settings.url_ChatGPT || 'https://chatgpt.com/';
  const [aiMap, aiOpts] = await Promise.all([aiReferencesForProject(p.id), aiRefOptions(p.id)]);
  const lab = sceneLabels(scenes);
  const f = searchParams.f || 'ALL';
  const shortKeep = new Set(scenes.filter(s => s.shortKeep).map(s => s.id));
  const pass = (i: (typeof imgs)[number]) => {
    const st = cardStatus(i);
    return f === 'ALL' || (f === 'NEEDS IMAGE' && (st === 'PROMPT READY' || st === 'IMAGE NEEDED')) || (f === 'UPLOADED' && st === 'IMAGE UPLOADED') || (f === 'APPROVED' && st === 'APPROVED') || (f === 'NEEDS REVISION' && st === 'NEEDS REVISION') || (f === 'SHORT KEEP' && shortKeep.has(i.sceneId)) || (f === 'VERTICAL CRITICAL' && i.cropImportance === 'CRITICAL');
  };
  const total = imgs.length;
  const ready = imgs.filter(i => (i.fullPrompt ?? '').trim()).length;
  const uploaded = imgs.filter(i => i.attempts.length > 0).length;
  const approved = imgs.filter(i => i.status === 'APPROVED').length;
  const pct = total ? Math.round((approved / total) * 100) : 0;
  const b = `/projects/${p.slug}`;
  const nextPic = imgs.find(i => i.status !== 'APPROVED' && i.status !== 'SKIPPED' && i.status !== 'REJECTED');
  const q = (o: { f?: string; x?: string }) => `${b}/generate?${new URLSearchParams({ f: o.f ?? f, ...(o.x ?? searchParams.x ? { x: (o.x ?? searchParams.x)! } : {}) }).toString()}`;
  let firstOpen = true;

  return (
    <div className="max-w-[1100px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><div className="eyebrow">IMAGES TO GENERATE</div><h1 className="text-[34px] md:text-[40px]">{p.title}</h1>
          <p className="mt-1 text-[14px] text-ink-secondary">{approved} / {total} images approved</p></div>
        <div className="flex flex-wrap gap-2">
          <form action={planImages}><input type="hidden" name="projectId" value={p.id} /><SubmitBtn className="btn btn-primary" pendingText="Planning…">PLAN IMAGES FOR MY SCENES</SubmitBtn></form>
        </div>
      </div>

      <section className="rounded-[16px] border border-line bg-white p-5" style={{ boxShadow: '0 14px 34px -28px rgba(40,36,60,.4)' }} aria-label="Image progress">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 text-[13px]">
          {([['Total images', total], ['Prompts ready', ready], ['Images uploaded', uploaded], ['Images approved', approved], ['Images remaining', total - approved]] as const).map(([l, n]) => <div key={l}><div className="eyebrow">{l}</div><div className="font-display text-[26px]">{n}</div></div>)}
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#ECEAF0]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-[#7FA687]" style={{ width: `${pct}%` }} /></div>
        {nextPic && <div className="mt-3 text-[13.5px] text-ink-secondary">Next: <a className="font-semibold text-ink underline" href={`#pic-${nextPic.id}`}>{nextPic.title}</a></div>}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(([k, l]) => <Link key={k} href={q({ f: k })} aria-current={f === k ? 'true' : undefined} className={`rounded-full border px-3 py-1 text-[13px] ${f === k ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-secondary hover:text-ink'}`}>{l}</Link>)}
        <span className="mx-1 h-5 w-px bg-line-strong" />
        <Link href={q({ x: 'all' })} className="btn btn-sm">Expand all scenes</Link><Link href={q({ x: 'none' })} className="btn btn-sm">Collapse all scenes</Link>
      </div>

      {scenes.length === 0 ? <Empty title="No scenes yet." hint="Import or add the scene breakdown first. The pictures are planned from it." /> : scenes.map(s => {
        const all = imgs.filter(i => i.sceneId === s.id);
        const list = all.filter(pass);
        if (f !== 'ALL' && !list.length) return null;
        const ok = all.filter(i => i.status === 'APPROVED').length;
        const up = all.filter(i => i.attempts.length).length;
        const done = all.length > 0 && ok === all.length;
        const open = searchParams.x === 'all' ? true : searchParams.x === 'none' ? false : (!done && firstOpen ? (firstOpen = false, true) : false);
        return (
          <section key={s.id} id={`scene-${s.id}`} className="overflow-hidden rounded-[16px] border border-line bg-white" style={{ boxShadow: '0 14px 34px -28px rgba(40,36,60,.4)' }}>
            <details open={open}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1"><div className="eyebrow">SCENE {lab.get(s.id)?.padStart(2, '0')}</div><h2 className="text-[22px]">{s.title}</h2></div>
                <div className="text-right text-[13px] text-ink-secondary"><div>{all.length} image{all.length === 1 ? '' : 's'}</div><div>{ok} / {all.length} approved{done ? ' ✓' : ''}</div>{up > ok && <div>{up} uploaded</div>}</div>
              </summary>
              <div className="space-y-4 border-t border-line p-4">
                {all.length === 0 && <div className="rounded-lg bg-sunken p-4 text-[14px] text-ink-secondary">No images planned for this scene yet.
                  <form action={planImages} className="mt-2"><input type="hidden" name="projectId" value={p.id} /><input type="hidden" name="sceneId" value={s.id} /><SubmitBtn className="btn btn-sm btn-primary" pendingText="Planning…">PLAN THIS SCENE</SubmitBtn></form></div>}
                {list.map(i => {
                  const st = cardStatus(i);
                  const idx = all.findIndex(x => x.id === i.id) + 1;
                  const nextV = nextVersion(i.attempts.map(a => a.number));
                  const filename = expectedFilename({ slug: p.slug, code: p.code, sceneOrder: s.order, seq: i.seq, title: i.title, version: nextV });
                  const text = withFilename(i.fullPrompt ?? '', filename);
                  const shown = i.approvedAttempt ?? i.attempts[0] ?? null;
                  return (
                    <ImageDrop key={i.id} imageId={i.id} id={`pic-${i.id}`} data-testid="gen-card" hint={`Drop the picture here to add it to ${imageCode(i.seq)}`} className="rounded-[14px] border border-line bg-white p-4">
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2"><span className="eyebrow" title={imageCode(i.seq)}>IMAGE {imageLabel(lab.get(s.id) ?? '', idx)}</span><span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${BADGE[st]}`}>{st}{st === 'APPROVED' ? ' ✓' : ''}</span><FlagButton kind="image" id={i.id} flagged={i.flagged} className="!h-7 !w-7" /></div>
                          <h3 className="mt-1 text-[19px]"><Link href={`${b}/images/${i.id}`} className="hover:underline">{i.title}</Link></h3>
                          <dl className="mt-2 grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
                            <div><dt className="eyebrow">IMAGE TYPE</dt><dd>{i.shotType}</dd></div>
                            <div><dt className="eyebrow">VERTICAL IMPORTANCE</dt><dd>{vLabel(i.cropImportance)}</dd></div>
                            {i.why && <div className="sm:col-span-2"><dt className="eyebrow">WHY NEEDED</dt><dd>{i.why}</dd></div>}
                            {i.foodState && <div className="sm:col-span-2"><dt className="eyebrow">FOOD STATE</dt><dd>{i.foodState}</dd></div>}
                          </dl>
                        </div>
                        {shown && <div className="w-[170px] shrink-0"><Thumb id={shown.assetId} alt={i.title} w={400} /><div className="mt-1 break-all font-mono text-[10.5px] text-ink-muted">{filename.replace(/_v\d+(\.\w+)$/, `_v${shown.number}$1`)}</div></div>}
                      </div>
                      <div className="mt-3">
                        <div className="eyebrow">CHATGPT IMAGE PROMPT</div>
                        <div className="mt-1 max-h-[150px] overflow-y-auto whitespace-pre-wrap rounded-lg border border-line bg-surface p-3 text-[13px] leading-relaxed" data-testid="gen-prompt">{(i.fullPrompt ?? '').trim() || 'No prompt yet.'}</div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-start gap-2">
                        <CopyButton text={text} label="COPY PROMPT" variant="secondary" />
                        <MakePictureButton imageId={i.id} text={text} chatgpt={chatgpt} mark={i.status === 'READY'} label="OPEN CHATGPT + COPY PROMPT" className="btn btn-accent" />
                        <CardUpload imageId={i.id} label={shown ? 'REPLACE IMAGE' : 'UPLOAD GENERATED IMAGE'} />
                        {shown && <a className="btn" href={fileUrl(shown.assetId)} target="_blank" rel="noreferrer">VIEW LARGE</a>}
                        {i.attempts.length > 0 && i.status !== 'APPROVED' && <form action={approveLatest}><input type="hidden" name="imageId" value={i.id} /><SubmitBtn className="btn btn-approve" pendingText="Saving…">MARK APPROVED</SubmitBtn></form>}
                        {i.attempts.length > 0 && i.status !== 'REDO' && <form action={needsRevision}><input type="hidden" name="imageId" value={i.id} /><SubmitBtn className="btn" pendingText="Saving…">MARK NEEDS REVISION</SubmitBtn></form>}
                        <form action={rewritePrompt}><input type="hidden" name="imageId" value={i.id} /><SubmitBtn className="btn btn-ghost" pendingText="Writing…">REGENERATE PROMPT</SubmitBtn></form>
                        <Link className="btn btn-ghost" href={`${b}/images/${i.id}`}>EDIT / MORE</Link>
                      </div>
                      <div className="mt-2"><PictureArrange imageId={i.id} sceneId={i.sceneId} scenes={scenes.map(sc => ({ id: sc.id, label: `Scene ${lab.get(sc.id)} · ${sc.title}` }))} pictures={imgs.map((x, n) => ({ id: x.id, label: `Picture ${n + 1} · ${x.title}` }))} /></div>
                      {aiMap.get(i.id) && <div className="mt-3"><AiReferences set={aiMap.get(i.id)!} opts={aiOpts} projectSlug={p.slug} /></div>}
                    </ImageDrop>
                  );
                })}
                <InsertTile projectId={p.id} sceneId={s.id} afterImageId={all.length ? all[all.length - 1].id : ''} ctx={{ slug: p.slug, code: p.code, sceneOrder: s.order, nextSeq: imgs.reduce((m, i) => Math.max(m, i.seq), 0) + 1 }} />
              </div>
            </details>
          </section>
        );
      })}
    </div>
  );
}
