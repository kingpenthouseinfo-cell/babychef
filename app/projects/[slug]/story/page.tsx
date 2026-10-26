import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { backfillPositions, IMAGE_ORDER, SCENE_ORDER } from '@/lib/order';
import { getNotices } from '@/lib/notices';
import { imageCode, sceneCode } from '@/lib/util';
import { statusWords } from '@/lib/words';
import { Empty, fileUrl } from '@/components/ui';
import { sceneLabels } from '@/lib/scene-label';
import { FlagButton } from '@/components/flag-button';
import { ImageDrop } from '@/components/drop-zone';
import { InsertPicture, InsertScene, InsertTile, NoticeCard, PictureMenu, SceneMenu } from '@/components/story-bits';
import { Sortable, Handle } from '@/components/sortable';
import { PictureNotes, QuickApprove } from '@/components/picture-notes';
import { stepInfosForScene } from '@/lib/step-dialogue';
import { PictureMerge } from '@/components/picture-merge';
import { unskipPicture } from '@/lib/actions/pictures';
import { reorderPictures, reorderScenes } from '@/lib/actions/insert';

const PILL: Record<string, string> = { APPROVED: 'bg-[#E6EEE3] text-[#46704F]', REVIEW: 'bg-[#E5EFFB] text-[#3E6290]', REDO: 'bg-[#F5E1DB] text-[#A5473A]', READY: 'bg-[#E3EAF2] text-[#46638A]', WAITING: 'bg-[#F4E8CF] text-[#8E6720]', GENERATING: 'bg-[#E3EAF2] text-[#46638A]' };
const ICON: Record<string, string> = { APPROVED: '✓ ', REVIEW: '? ', REDO: '! ', WAITING: '◷ ', READY: '● ', GENERATING: '● ' };

export default async function Story({ params, searchParams }: { params: { slug: string }; searchParams: { view?: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  await backfillPositions();
  const compact = searchParams.view === 'compact';
  const [scenes, imgs, notices] = await Promise.all([
    db.scene.findMany({ where: { projectId: p.id }, orderBy: [...SCENE_ORDER] }),
    db.plannedImage.findMany({ where: { projectId: p.id }, orderBy: [...IMAGE_ORDER], include: { dependsOn: { select: { id: true, status: true } }, approvedAttempt: true, attempts: { orderBy: { number: 'desc' }, take: 1 }, _count: { select: { attempts: true } } } }),
    getNotices(p.id),
  ]);
  const num = new Map(imgs.map((i, n) => [i.id, n + 1]));
  const lab = sceneLabels(scenes);
  const nextSeq = imgs.reduce((m, i) => Math.max(m, i.seq), 0) + 1;
  const ctxOf = (s: { order: number }) => ({ slug: p.slug, code: p.code, sceneOrder: s.order, nextSeq });
  const b = `/projects/${p.slug}`;
  const done = imgs.filter(i => i.status === 'APPROVED').length;
  const thumbOf = (i: (typeof imgs)[number]) => i.approvedAttempt?.assetId ?? i.attempts[0]?.assetId ?? null;
  const tab = (label: string, active: boolean, href: string) => <Link href={href} className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${active ? 'bg-white text-ink shadow-sm' : 'text-ink-secondary'}`}>{label}</Link>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-[34px] md:text-[40px]">Scenes & Pictures</h1><p className="mt-1 text-[14px] text-ink-secondary">{scenes.length} scenes · {imgs.length} pictures · {done} look good · drag to reorder</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-0.5 rounded-xl bg-[#F4F2F7] p-1" role="group" aria-label="View">{tab('Large pictures', !compact, `${b}/story`)}{tab('Compact list', compact, `${b}/story?view=compact`)}</div>
          <Link href={`${b}/fill`} className="btn btn-sm btn-copy">Fill from text</Link><Link href="/queue" className="btn">Pictures to make</Link>
        </div>
      </div>
      {notices.map(n => <NoticeCard key={n.id} projectId={p.id} id={n.id} text={n.text} yes={n.kind === 'CLIP_ADD' ? 'ADD TO VIDEO CLIP' : 'YES'} no={n.kind === 'CLIP_ADD' ? 'NOT NOW' : 'KEEP CURRENT'} />)}
      {scenes.length === 0 ? <Empty title="No scenes yet." hint="Add the first scene to start planning your pictures."><InsertScene projectId={p.id} label="ADD FIRST SCENE" /></Empty> : (
        <>
          <div className="flex items-center gap-3"><span className="h-px flex-1 bg-line" /><InsertScene projectId={p.id} beforeSceneId={scenes[0].id} label="+ Add scene here" /><span className="h-px flex-1 bg-line" /></div>
          <Sortable onSave={reorderScenes.bind(null, p.id)}>
            {scenes.map((s, si) => {
              const list = imgs.filter(i => i.sceneId === s.id);
              const active = list.filter(i => i.status !== 'SKIPPED'); // pictures marked "don't use" do not count
              const infos = stepInfosForScene(list as any, s as any);
              const stepOf = (i: (typeof imgs)[number]) => infos.get(i.id) ?? null;
              const mergeProps = (i: (typeof imgs)[number]) => ({ siblings: list.filter(y => y.id !== i.id && y.status !== 'SKIPPED' && !(y as any).mergedInto).map(y => ({ id: y.id, label: `${imageCode(y.seq)} · ${y.title}` })), merged: list.filter(y => (y as any).mergedInto === i.id).map(y => ({ id: y.id, label: imageCode(y.seq) })) });
              const ok = active.filter(i => i.status === 'APPROVED').length;
              const fixing = list.filter(i => i.status === 'REDO').length;
              const allDone = active.length > 0 && ok === active.length;
              const pill = list.length === 0 ? 'bg-[#F0EEF3] text-[#6F6A75]' : allDone ? 'bg-[#E6EEE3] text-[#46704F]' : fixing ? 'bg-[#F5E1DB] text-[#A5473A]' : 'bg-[#F0EEF3] text-[#6F6A75]';
              return (
                <div key={s.id} data-sort-id={s.id}>
                  <section id={`scene-${s.id}`} className="relative scroll-mt-24 rounded-[16px] border border-line bg-white" style={{ boxShadow: '0 14px 34px -28px rgba(40,36,60,.4)' }}>
                    <details open={!allDone}>
                      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 py-4 pl-3 pr-16">
                        <Handle label={s.title} />
                        <div className="min-w-[200px] flex-1"><div className="eyebrow" title={sceneCode(s.order)}>SCENE {lab.get(s.id)}</div><h2 className="mt-1.5 text-[22px]">{s.title}</h2>{(s.narrative || s.purpose) && <div className="mt-0.5 line-clamp-1 text-[13.5px] text-ink-secondary">{(s.narrative || s.purpose || '').split('\n')[0]}</div>}</div>
                        <div className="flex items-center gap-1.5" aria-hidden>{list.slice(0, 4).map(i => { const t = thumbOf(i); return t ? <img key={i.id} src={fileUrl(t, 80)} alt="" className="h-7 w-9 rounded-md object-cover" /> : <span key={i.id} className="h-7 w-9 rounded-md border border-dashed border-line-strong" />; })}</div>
                        <span className={`rounded-full px-3 py-1 text-[12.5px] font-semibold ${pill}`}>{list.length === 0 ? 'No pictures yet' : `${ok} of ${active.length} look good`}</span>
                      </summary>
                      {compact ? (
                        <div className="px-4 pb-4">
                          <Sortable className="divide-y divide-line border-t border-line" onSave={reorderPictures.bind(null, s.id)}>
                            {list.map((i, k) => {
                              const waitingFor = i.dependsOn && i.dependsOn.status !== 'APPROVED' && ['READY', 'PLANNED', 'PROMPT DRAFT'].includes(i.status) ? num.get(i.dependsOn.id) : null;
                              const st = waitingFor ? 'WAITING' : i.status; const href = `${b}/images/${i.id}`; const t = thumbOf(i);
                              const act = waitingFor ? null : i.status === 'REVIEW' ? ['Check picture', `${href}#review`, 'btn-copy'] : i.status === 'REDO' ? ['Fix it', href, 'btn-danger'] : i.status === 'READY' ? ['Make picture', href, 'btn-accent'] : null;
                              return (
                                <ImageDrop key={i.id} imageId={i.id} id={`pic-${i.id}`} data-sort-id={i.id} hint="Drop the picture here" className={`relative flex flex-wrap items-center gap-3 py-2.5 ${i.status === 'SKIPPED' ? 'opacity-55' : ''}`}>
                                  <Handle label={i.title} />
                                  <span className="h-9 w-12 shrink-0 overflow-hidden rounded-md bg-sunken">{t && <img src={fileUrl(t, 100)} alt="" className="h-full w-full object-cover" />}</span>
                                  <Link href={href} title={`${imageCode(i.seq)} · ${sceneCode(s.order)}`} className="min-w-0 flex-1"><span className="block text-[12px] text-ink-secondary">Picture {num.get(i.id)}</span><span className="block truncate text-[14px] font-semibold">{i.title}</span></Link>
                                  <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${PILL[st] ?? 'bg-[#F0EEF3] text-[#6F6A75]'}`}>{ICON[st] ?? ''}{waitingFor ? `Waiting for Picture ${waitingFor}` : statusWords(i.status)}</span>
                                  {act && <Link href={act[1]} className={`btn btn-sm ${act[2]}`}>{act[0]}</Link>}
                                  <QuickApprove id={i.id} status={i.status} versions={(i as any)._count.attempts} />
                                  <PictureMenu id={i.id} first={k === 0} last={k === list.length - 1} href={href} code={`${imageCode(i.seq)} · ${sceneCode(s.order)}`} projectId={p.id} sceneId={s.id} prevId={k > 0 ? list[k - 1].id : null} ctx={ctxOf(s)} status={i.status} versions={(i as any)._count.attempts} />
                                  {stepOf(i) ? <PictureNotes id={i.id} info={stepOf(i)!} stepNote={(i as any).stepNote} dialogueLine={(i as any).dialogueLine} compact /> : <div className="basis-full pl-[4.5rem] text-[12.5px] text-ink-muted">Not used — <form action={unskipPicture} className="inline"><input type="hidden" name="id" value={i.id} /><button className="font-semibold text-blue-deep hover:underline">use it again</button></form></div>}
                                  {stepOf(i) && <div className="basis-full pl-[4.5rem]"><PictureMerge imageId={i.id} {...mergeProps(i)} /></div>}
                                </ImageDrop>);
                            })}
                          </Sortable>
                          <div className="mt-2"><InsertPicture projectId={p.id} sceneId={s.id} afterImageId={list.length ? list[list.length - 1].id : ''} label="+ Add picture here" ctx={ctxOf(s)} /></div>
                        </div>
                      ) : (
                        <Sortable className="grid grid-cols-2 gap-3 px-4 pb-4 md:grid-cols-3 xl:grid-cols-5" onSave={reorderPictures.bind(null, s.id)}>
                          {list.map((i, k) => {
                            const waitingFor = i.dependsOn && i.dependsOn.status !== 'APPROVED' && ['READY', 'PLANNED', 'PROMPT DRAFT'].includes(i.status) ? num.get(i.dependsOn.id) : null;
                            const st = waitingFor ? 'WAITING' : i.status;
                            const word = waitingFor ? `Waiting for Picture ${waitingFor}` : statusWords(i.status);
                            const href = `${b}/images/${i.id}`;
                            const act = waitingFor ? null : i.status === 'REVIEW' ? ['Check picture', `${href}#review`, 'btn-copy'] : i.status === 'REDO' ? ['Fix it', href, 'btn-danger'] : i.status === 'READY' ? ['Make picture', href, 'btn-accent'] : null;
                            const t = thumbOf(i);
                            return (
                              <ImageDrop key={i.id} imageId={i.id} id={`pic-${i.id}`} data-sort-id={i.id} hint="Drop the picture here" className={`relative flex scroll-mt-24 flex-col rounded-[14px] border border-line p-2.5 ${i.status === 'SKIPPED' ? 'opacity-55' : ''}`}>
                                <Link href={href} title={`${imageCode(i.seq)} · ${sceneCode(s.order)}`} className="block">
                                  <div className={`aspect-[4/3] overflow-hidden rounded-[10px] ${t ? (i.status === 'REDO' ? 'ring-2 ring-inset ring-[#E9A99B]' : '') : 'border border-dashed border-line-strong bg-[#FAF9FC]'}`}>{t ? <img src={fileUrl(t, 400)} alt={i.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center font-serif text-[34px] text-[#C9C5D1]">{num.get(i.id)}</div>}</div>
                                  <div className="mt-2 text-[12px] text-ink-secondary">Picture {num.get(i.id)}</div>
                                  <div className="text-[14px] font-semibold leading-snug">{i.title}</div>
                                </Link>
                                {stepOf(i) ? <PictureNotes id={i.id} info={stepOf(i)!} stepNote={(i as any).stepNote} dialogueLine={(i as any).dialogueLine} /> : <div className="mt-1 text-[12.5px] text-ink-muted">Not used — <form action={unskipPicture} className="inline"><input type="hidden" name="id" value={i.id} /><button className="font-semibold text-blue-deep hover:underline">use it again</button></form></div>}
                                {stepOf(i) && <div className="mt-1"><PictureMerge imageId={i.id} {...mergeProps(i)} /></div>}
                                <div className="absolute left-3.5 top-3.5 rounded-md bg-white/85 backdrop-blur"><Handle label={i.title} /></div>
                                <div className="absolute right-4 top-4 [&_summary]:bg-white/90 [&_summary]:backdrop-blur"><PictureMenu id={i.id} first={k === 0} last={k === list.length - 1} href={href} code={`${imageCode(i.seq)} · ${sceneCode(s.order)}`} projectId={p.id} sceneId={s.id} prevId={k > 0 ? list[k - 1].id : null} ctx={ctxOf(s)} status={i.status} versions={(i as any)._count.attempts} /></div>
                                <div className="mt-2 flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${PILL[st] ?? 'bg-[#F0EEF3] text-[#6F6A75]'}`}>{ICON[st] ?? ''}{word}</span>{act && <Link href={act[1]} className={`btn btn-sm ${act[2]}`}>{act[0]}</Link>}<QuickApprove id={i.id} status={i.status} versions={(i as any)._count.attempts} /></div>
                              </ImageDrop>
                            );
                          })}
                          <InsertTile projectId={p.id} sceneId={s.id} afterImageId={list.length ? list[list.length - 1].id : ''} ctx={ctxOf(s)} />
                        </Sortable>
                      )}
                    </details>
                    <div className="absolute right-14 top-3.5"><FlagButton kind="scene" id={s.id} flagged={s.flagged} /></div>
                    <div className="absolute right-3 top-3.5"><SceneMenu projectId={p.id} scene={{ id: s.id, title: s.title }} images={list.map(i => ({ id: i.id, label: `Picture ${num.get(i.id)} — ${i.title}` }))} first={si === 0} last={si === scenes.length - 1} /></div>
                  </section>
                  <div className="my-3 flex items-center gap-3"><span className="h-px flex-1 bg-line" /><InsertScene projectId={p.id} afterSceneId={s.id} label={si === scenes.length - 1 ? '+ Add next scene' : '+ Add scene here'} /><span className="h-px flex-1 bg-line" /></div>
                </div>
              );
            })}
          </Sortable>
        </>
      )}
    </div>
  );
}
