import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { Chip, Empty, Section, Text, Thumb } from '@/components/ui';
import { SubmitBtn } from '@/components/client';
import { createKling } from '@/lib/actions/kling';
import { imageCode, klingCode, sceneCode } from '@/lib/util';

export default async function KlingList({ params }: { params: { slug: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const clips = await db.klingClip.findMany({ where: { projectId: p.id }, orderBy: { order: 'asc' }, include: { refs: { orderBy: { order: 'asc' }, include: { image: { include: { approvedAttempt: true } } } }, scenes: { include: { scene: true } } } });
  return (
    <div className="max-w-[1000px] space-y-5">
      <div><h1 className="text-[34px] md:text-[40px]">Video Clips</h1><p className="mt-1 text-[14px] text-ink-secondary">Each clip gathers the pictures that look good. Make the prompt, then make the clip in Kling.</p></div>
      {clips.length === 0 ? <Empty title="No video clips yet." hint="Add a clip, choose its pictures, and make the prompt." /> : (
        <div className="space-y-3">{clips.map((c, ci) => {
          const ok = c.refs.filter(r => r.image.approvedAttemptId).length;
          const st = c.status === 'APPROVED' ? ['Looks good', 'bg-[#E6EEE3] text-[#46704F]'] : c.status === 'REDO' ? ['Needs fixing', 'bg-[#F5E1DB] text-[#A5473A]'] : ['READY', 'REVIEW'].includes(c.status) ? ['Ready to make', 'bg-[#E3EAF2] text-[#46638A]'] : c.refs.length && ok < c.refs.length ? [`${c.refs.length - ok} picture${c.refs.length - ok > 1 ? 's' : ''} not ready`, 'bg-[#F5E1DB] text-[#A5473A]'] : c.refs.length ? ['Pictures ready', 'bg-[#E3EAF2] text-[#46638A]'] : ['Not started', 'bg-[#F0EEF3] text-[#6F6A75]'];
          return (
          <Link key={c.id} href={`/projects/${p.slug}/kling/${c.id}`} className="block overflow-hidden rounded-[18px] border border-line bg-white hover:border-ink/30" style={{ boxShadow: '0 14px 30px -26px rgba(40,36,60,.5)' }} title={klingCode(c.order)}>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0"><h2 className="text-[22px]">Video Clip {ci + 1}</h2><div className="text-[13.5px] text-ink-secondary">{c.title}{c.scenes.length ? ` · ${c.scenes.map(s => s.scene.title).join(', ')}` : ''}</div></div>
              <div className="flex items-center gap-2">{c.refs.slice(0, 5).map(r => <span key={r.id} className="h-7 w-9 overflow-hidden rounded-md bg-sunken">{r.image.approvedAttempt?.assetId && <img src={`/api/files/${r.image.approvedAttempt.assetId}?w=80`} alt="" className="h-full w-full object-cover" />}</span>)}<span className={`rounded-full px-3 py-1 text-[12.5px] font-semibold ${st[1]}`}>{st[0]}</span></div>
            </div>
            {c.refs.length > 0 && <div className="flex flex-wrap gap-3 border-t border-line bg-[#FAF8FD] px-5 py-3">{c.refs.slice(0, 6).map((r, i) => <div key={r.id} className="w-[88px]"><Thumb id={r.image.approvedAttempt?.assetId} alt={r.image.title} w={200} ratio="aspect-[4/3]" /><div className="mt-1 truncate text-[11.5px] text-ink-secondary">@image{i + 1} · {r.image.title}</div></div>)}</div>}
          </Link>); })}</div>
      )}
      <div className="flex flex-wrap gap-2"><Link href={`/projects/${p.slug}/builder?type=kling-group`} className="btn btn-purple">Make the grouping prompt</Link></div>
      <Section title="Add a video clip">
        <form action={createKling} className="grid gap-3 sm:grid-cols-3"><input type="hidden" name="projectId" value={p.id} />
          <Text name="title" label="Title *" required className="sm:col-span-2" /><Text name="durationTarget" label="Target duration (sec)" type="number" />
          <div className="sm:col-span-3"><SubmitBtn pendingText="Creating…">ADD VIDEO CLIP (next: {klingCode((clips[clips.length - 1]?.order ?? 0) + 1)})</SubmitBtn></div></form>
      </Section>
    </div>
  );
}
