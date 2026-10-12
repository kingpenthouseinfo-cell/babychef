import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { backfillPositions, IMAGE_ORDER, SCENE_ORDER } from '@/lib/order';
import { getNotices } from '@/lib/notices';
import { imageCode, sceneCode } from '@/lib/util';
import { statusWords } from '@/lib/words';
import { Empty } from '@/components/ui';
import { InsertPicture, InsertScene, NoticeCard, PictureMenu, SceneMenu } from '@/components/story-bits';

const ICON: Record<string, string> = { APPROVED: '✓', REVIEW: '●', REDO: '!', READY: '○', WAITING: '⏳', GENERATING: '●', PLANNED: '○', 'PROMPT DRAFT': '○', REJECTED: '✕', SKIPPED: '–' };
const TONE: Record<string, string> = { APPROVED: 'text-[#3B6448]', REVIEW: 'text-[#33507A]', REDO: 'text-[#A8513F]', WAITING: 'text-[#8A6216]', READY: 'text-ink', GENERATING: 'text-[#33507A]' };

export default async function Story({ params }: { params: { slug: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  await backfillPositions();
  const [scenes, imgs, notices] = await Promise.all([
    db.scene.findMany({ where: { projectId: p.id }, orderBy: [...SCENE_ORDER] }),
    db.plannedImage.findMany({ where: { projectId: p.id }, orderBy: [...IMAGE_ORDER], include: { dependsOn: { select: { id: true, status: true } } } }),
    getNotices(p.id),
  ]);
  const num = new Map(imgs.map((i, n) => [i.id, n + 1]));
  const b = `/projects/${p.slug}`;
  const done = imgs.filter(i => i.status === 'APPROVED').length;
  const scenesDone = scenes.filter(s => { const l = imgs.filter(i => i.sceneId === s.id); return l.length > 0 && l.every(i => ['APPROVED', 'SKIPPED', 'REJECTED'].includes(i.status)); }).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h1 className="text-[26px]">Scenes & Pictures</h1><p className="text-[13px] text-ink-secondary">Scenes {scenesDone} of {scenes.length} · Pictures {done} of {imgs.length} look good</p></div>
        <div className="flex gap-2"><Link href={`${b}/fill`} className="btn btn-sm btn-copy-secondary">FILL FROM TEXT</Link><Link href={`${b}/scenes`} className="btn btn-sm btn-ghost">Scene details</Link><Link href={`${b}/images`} className="btn btn-sm btn-ghost">Picture list</Link></div>
      </div>
      {notices.map(n => <NoticeCard key={n.id} projectId={p.id} id={n.id} text={n.text} yes={n.kind === 'CLIP_ADD' ? 'ADD TO VIDEO CLIP' : 'YES'} no={n.kind === 'CLIP_ADD' ? 'NOT NOW' : 'KEEP CURRENT'} />)}
      {scenes.length === 0 ? <Empty title="No scenes yet." hint="Add the first scene to start planning your pictures."><InsertScene projectId={p.id} label="ADD FIRST SCENE" /></Empty> : (
        <>
          <InsertScene projectId={p.id} beforeSceneId={scenes[0].id} label="+ ADD SCENE HERE" />
          {scenes.map((s, si) => {
            const list = imgs.filter(i => i.sceneId === s.id);
            const ok = list.filter(i => i.status === 'APPROVED').length;
            const fixing = list.filter(i => i.status === 'REDO').length;
            const state = list.length === 0 ? 'NOT STARTED' : ok === list.length ? 'DONE' : fixing ? 'NEEDS FIXING' : 'IN PROGRESS';
            const sTone = { DONE: 'text-[#3B6448]', 'NEEDS FIXING': 'text-[#A8513F]', 'IN PROGRESS': 'text-[#33507A]', 'NOT STARTED': 'text-ink-muted' }[state];
            return (
              <div key={s.id}>
                <section id={`scene-${s.id}`} className="card scroll-mt-24">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="eyebrow">SCENE {si + 1}</div>
                      <h2 className="text-[18px]" title={sceneCode(s.order)}>{s.title}</h2>
                      <div className={`text-[12px] font-semibold ${sTone}`}>{state === 'DONE' ? '✓ Done' : state === 'NEEDS FIXING' ? '! Needs fixing' : state === 'IN PROGRESS' ? `● ${ok} of ${list.length} pictures done` : '○ Not started'}</div>
                    </div>
                    <SceneMenu projectId={p.id} scene={{ id: s.id, title: s.title }} images={list.map(i => ({ id: i.id, label: `Picture ${num.get(i.id)} — ${i.title}` }))} first={si === 0} last={si === scenes.length - 1} />
                  </div>
                  <ul className="mt-3 divide-y divide-line">
                    {list.map((i, k) => {
                      const waitingFor = i.dependsOn && i.dependsOn.status !== 'APPROVED' && ['READY', 'PLANNED', 'PROMPT DRAFT'].includes(i.status) ? num.get(i.dependsOn.id) : null;
                      const word = waitingFor ? 'Waiting' : statusWords(i.status);
                      const icon = waitingFor ? '⏳' : ICON[i.status] ?? '○';
                      const href = `${b}/images/${i.id}`;
                      const act = waitingFor ? null : i.status === 'REVIEW' ? ['CHECK PICTURE', `${href}#review`, 'btn-accent'] : i.status === 'REDO' ? ['FIX IT', href, 'btn-danger'] : i.status === 'READY' ? ['MAKE THIS PICTURE', href, 'btn-copy'] : i.status === 'APPROVED' ? null : ['OPEN', href, ''];
                      return (
                        <li key={i.id} id={`pic-${i.id}`} className="scroll-mt-24 py-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className={`w-5 text-center text-[16px] ${waitingFor ? TONE.WAITING : TONE[i.status] ?? 'text-ink-muted'}`} aria-hidden>{icon}</span>
                            <Link href={href} className="min-w-0 flex-1" title={`${imageCode(i.seq)} · ${sceneCode(s.order)}`}>
                              <span className="block text-[14px] font-semibold">Picture {num.get(i.id)}</span><span className="block truncate text-[13px] text-ink-secondary">{i.title}</span>
                            </Link>
                            <span className={`text-[12px] font-semibold ${waitingFor ? TONE.WAITING : TONE[i.status] ?? 'text-ink-muted'}`}>{word}{waitingFor ? ` for Picture ${waitingFor}` : ''}</span>
                            {act && <Link href={act[1]} className={`btn btn-sm ${act[2]}`}>{act[0]}</Link>}
                            <PictureMenu id={i.id} first={k === 0} last={k === list.length - 1} href={href} code={`${imageCode(i.seq)} · ${sceneCode(s.order)}`} />
                          </div>
                          <div className="ml-8 flex flex-wrap gap-2"><InsertPicture projectId={p.id} sceneId={s.id} afterImageId={i.id} /><InsertPicture projectId={p.id} sceneId={s.id} afterImageId={i.id} label="+ QUICK ADD" quick /></div>
                        </li>
                      );
                    })}
                    {list.length === 0 && <li className="py-3 text-[13px] text-ink-secondary">No pictures yet.</li>}
                  </ul>
                  <div className="mt-2 flex flex-wrap gap-2">{list.length === 0 && <InsertPicture projectId={p.id} sceneId={s.id} afterImageId="" label="+ ADD FIRST PICTURE" />}{list.length === 0 && <InsertPicture projectId={p.id} sceneId={s.id} afterImageId="" label="+ QUICK ADD" quick />}</div>
                </section>
                <InsertScene projectId={p.id} afterSceneId={s.id} label={si === scenes.length - 1 ? '+ ADD NEXT SCENE' : '+ ADD SCENE HERE'} />
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
