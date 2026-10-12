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
    <div className="space-y-5">
      <div className="rounded-xl bg-neutral-100 p-3 text-sm">A Kling clip is a video-generation unit. It can use several approved images (<b>@image1, @image2…</b>) and cover several closely related scenes. Baby Chef Studio never calls Kling — you copy the prompt.</div>
      {clips.length === 0 ? <Empty title="No Kling clips yet." hint="Create a clip, attach approved images, and write the prompt." /> : (
        <div className="grid gap-4 md:grid-cols-2">{clips.map(c => (
          <Link key={c.id} href={`/projects/${p.slug}/kling/${c.id}`} className="card block hover:border-ink">
            <div className="flex items-center justify-between gap-2"><span className="font-mono text-lg font-bold">{klingCode(c.order)}</span><Chip>{c.status}</Chip></div>
            <div className="font-semibold">{c.title}</div>
            <div className="text-xs text-neutral-500">{c.durationTarget ? `${c.durationTarget}s` : 'no duration'} · {c.refs.length} refs · {c.scenes.map(s => sceneCode(s.scene.order)).join(', ') || 'no scenes'}</div>
            <div className="mt-2 flex gap-1.5">{c.refs.slice(0, 5).map((r, i) => <div key={r.id} className="w-16"><Thumb id={r.image.approvedAttempt?.assetId} alt={r.image.title} w={160} ratio="aspect-square" /><div className="text-[10px] font-semibold">@image{i + 1} {imageCode(r.image.seq)}</div></div>)}</div>
          </Link>))}</div>
      )}
      <Section title="+ New Kling clip">
        <form action={createKling} className="grid gap-3 sm:grid-cols-3"><input type="hidden" name="projectId" value={p.id} />
          <Text name="title" label="Title *" required className="sm:col-span-2" /><Text name="durationTarget" label="Target duration (sec)" type="number" />
          <div className="sm:col-span-3"><SubmitBtn pendingText="Creating…">CREATE CLIP (next: {klingCode((clips[clips.length - 1]?.order ?? 0) + 1)})</SubmitBtn></div></form>
      </Section>
    </div>
  );
}
