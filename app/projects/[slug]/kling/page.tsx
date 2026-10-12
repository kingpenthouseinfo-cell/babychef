import { sceneLabels } from '@/lib/scene-label';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { Chip, Empty, Section, Text, Thumb } from '@/components/ui';
import { SubmitBtn } from '@/components/client';
import { createKling } from '@/lib/actions/kling';
import { klingCode, sceneCode } from '@/lib/util';
import { SCENE_ORDER, IMAGE_ORDER, backfillPositions } from '@/lib/order';
import { makeClipForScene } from '@/lib/actions/kling';
import { fileUrl } from '@/components/ui';

export default async function KlingList({ params }: { params: { slug: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  await backfillPositions();
  const [clips, scenes, imgs] = await Promise.all([
    db.klingClip.findMany({ where: { projectId: p.id }, orderBy: { order: 'asc' }, include: { refs: { orderBy: { order: 'asc' }, include: { image: { include: { approvedAttempt: true } } } }, scenes: { include: { scene: true } } } }),
    db.scene.findMany({ where: { projectId: p.id }, orderBy: [...SCENE_ORDER] }),
    db.plannedImage.findMany({ where: { projectId: p.id }, orderBy: [...IMAGE_ORDER], include: { approvedAttempt: true } }),
  ]);
  const lab = sceneLabels(scenes);
  const linked = new Set(clips.flatMap(c => c.scenes.map(x => x.sceneId)));
  const other = clips.filter(c => c.scenes.length === 0 || c.scenes.some(x => !scenes.some(sc => sc.id === x.sceneId)));
  let opened = false;
  return (
    <div className="max-w-[1000px] space-y-4">
      <div><h1 className="text-[34px] md:text-[40px]">Video Clips</h1><p className="mt-1 text-[14px] text-ink-secondary">Each scene gathers the pictures that look good. Make the prompt, then make the clip in Kling.</p></div>
      {scenes.length === 0 && <Empty title="No scenes yet." hint="Add scenes first — each scene becomes one video clip." />}
      {scenes.map((sc, i) => {
        const pics = imgs.filter(x => x.sceneId === sc.id);
        const good = pics.filter(x => x.approvedAttemptId);
        const fix = pics.filter(x => x.status === 'REDO').length;
        const rest = pics.length - good.length;
        const ready = pics.length > 0 && rest === 0;
        const clip = clips.find(c => c.scenes.some(x => x.sceneId === sc.id));
        const chip = ready ? [`${good.length} pictures ready`, 'bg-[#E3EAF2] text-[#46638A]'] : fix ? [`${fix} picture${fix > 1 ? 's' : ''} need${fix > 1 ? '' : 's'} fixing first`, 'bg-[#F5E1DB] text-[#A5473A]'] : good.length ? [`${rest} picture${rest > 1 ? 's' : ''} still to make`, 'bg-[#F0EEF3] text-[#6F6A75]'] : ['Pictures not made yet', 'bg-[#F0EEF3] text-[#6F6A75]'];
        const open = ready && !opened && !clip?.status.match(/APPROVED/); if (open) opened = true;
        const clipName = `${p.slug}_${sceneCode(sc.order)}_CLIP_v1.mp4`;
        return (
          <section key={sc.id} className="overflow-hidden rounded-[16px] border border-line bg-white" style={{ boxShadow: '0 14px 34px -28px rgba(40,36,60,.4)' }}>
            <details open={open}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1"><h2 className="text-[22px]">Scene {lab.get(sc.id)} video</h2><div className="text-[13.5px] text-ink-secondary">{sc.title}</div></div>
                <div className="flex items-center gap-1.5" aria-hidden>{pics.slice(0, 5).map(x => <span key={x.id} className="h-7 w-9 overflow-hidden rounded-md bg-sunken">{x.approvedAttempt && <img src={fileUrl(x.approvedAttempt.assetId, 80)} alt="" className="h-full w-full object-cover" />}</span>)}</div>
                <span className={`rounded-full px-3 py-1 text-[12.5px] font-semibold ${clip?.status === 'APPROVED' ? 'bg-[#E6EEE3] text-[#46704F]' : chip[1]}`}>{clip?.status === 'APPROVED' ? '✓ Looks good' : chip[0]}</span>
              </summary>
              {ready && (
                <div className="border-t px-5 py-5" style={{ background: 'linear-gradient(135deg,#F1EAFB,#F6ECF8)', borderColor: '#DCCDEF' }}>
                  <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[14.5px]">The pictures that look good are already gathered in order.</p>
                    {clip ? <Link href={`/projects/${p.slug}/kling/${clip.id}`} className="btn btn-purple min-h-[46px] px-6">Open video prompt</Link> : <form action={makeClipForScene}><input type="hidden" name="sceneId" value={sc.id} /><SubmitBtn className="btn-purple min-h-[46px] px-6" pendingText="Gathering…">Make video prompt</SubmitBtn></form>}</div>
                  <div className="eyebrow mt-4 !text-[#6A4E98]">PICTURES USED</div>
                  <div className="mt-2 flex flex-wrap gap-3">{good.map(x => <div key={x.id} className="w-[120px]"><div className="aspect-[4/3] overflow-hidden rounded-xl bg-white">{x.approvedAttempt && <img src={fileUrl(x.approvedAttempt.assetId, 240)} alt={x.title} className="h-full w-full object-cover" />}</div><div className="mt-1 truncate text-[12.5px]"><b className="text-[#46704F]">✓</b> {x.title}</div></div>)}</div>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ink-secondary"><span>Save clip as <code className="font-mono text-[12.5px] text-ink">{clipName}</code></span><a href="https://klingai.com/" target="_blank" rel="noreferrer" className="font-semibold text-[#6A4E98]">Open Kling ↗</a>{clip && <Link href={`/projects/${p.slug}/kling/${clip.id}`} className="font-semibold text-blue-deep" title={klingCode(clip.order)}>More details</Link>}</div>
                </div>
              )}
              {!ready && <div className="border-t border-line px-5 py-3 text-[13.5px] text-ink-secondary">{fix ? 'Fix the picture first — then this clip is ready to make.' : 'Make the pictures first — they are gathered here automatically.'}</div>}
            </details>
          </section>
        );
      })}
      {other.length > 0 && (<>
        <div className="eyebrow pt-3">OTHER VIDEO CLIPS</div>
        <div className="space-y-3">{other.map((c, ci) => (
          <Link key={c.id} href={`/projects/${p.slug}/kling/${c.id}`} className="block rounded-[16px] border border-line bg-white px-5 py-4 hover:border-ink/30" title={klingCode(c.order)}>
            <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-serif text-[20px]">{c.title}</div><div className="text-[13px] text-ink-secondary">{c.refs.length} pictures{c.durationTarget ? ` · ${c.durationTarget}s` : ''}</div></div><Chip>{c.status}</Chip></div>
            {c.refs.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{c.refs.slice(0, 6).map((r, i) => <div key={r.id} className="w-[84px]"><Thumb id={r.image.approvedAttempt?.assetId} alt={r.image.title} w={200} ratio="aspect-[4/3]" /><div className="mt-1 truncate text-[11px] text-ink-secondary">@image{i + 1}</div></div>)}</div>}
          </Link>))}</div>
      </>)}
      <div className="flex flex-wrap gap-2"><Link href={`/projects/${p.slug}/builder?type=kling-group`} className="btn btn-purple">Make the grouping prompt</Link></div>
      <Section title="Add a video clip">
        <form action={createKling} className="grid gap-3 sm:grid-cols-3"><input type="hidden" name="projectId" value={p.id} />
          <Text name="title" label="Title *" required className="sm:col-span-2" /><Text name="durationTarget" label="Target duration (sec)" type="number" />
          <div className="sm:col-span-3"><SubmitBtn pendingText="Creating…">ADD VIDEO CLIP (next: {klingCode((clips[clips.length - 1]?.order ?? 0) + 1)})</SubmitBtn></div></form>
      </Section>
    </div>
  );
}
