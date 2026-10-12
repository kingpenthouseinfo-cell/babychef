import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProjectBySlug } from '@/lib/queries';
import { buildJourney } from '@/lib/journey';
import { nextStep } from '@/lib/next-step';
import { JourneyList } from '@/components/journey-view';

export default async function StartToFinish({ params, searchParams }: { params: { slug: string }; searchParams: { hide?: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const [j, ns] = await Promise.all([buildJourney(p.id, p.slug), nextStep(p.id, p.slug)]);
  const hide = searchParams.hide === 'done';
  const s = j.summary;
  const word = (x: string) => (x === 'DONE' ? 'Done' : x === 'NOT STARTED' ? 'Not started' : x === 'IN PROGRESS' ? 'In progress' : x === 'NEEDS FIXING' ? 'Needs fixing' : 'Waiting');
  return (
    <div className="space-y-5">
      <div><h1 className="text-[26px]">Start to Finish</h1><div className="text-[14px] font-semibold uppercase tracking-wide text-ink-secondary">{p.title}</div></div>
      <section className="rounded-xl border-2 border-ink bg-white p-5" aria-label="What should I do next?">
        <div className="eyebrow text-ink-secondary">WHAT SHOULD I DO NEXT?</div>
        {ns.next ? (<><h2 className="mt-1 text-[22px] font-semibold leading-tight">{ns.next.title}</h2>{ns.next.body && <p className="text-[13px] text-ink-secondary">{ns.next.body}</p>}<Link href={ns.next.href} className="btn btn-primary mt-3 min-h-[48px] px-6">CONTINUE</Link></>) : <h2 className="mt-1 text-[20px] font-semibold">Nothing needs you right now.</h2>}
      </section>
      <section className="card" aria-label="Overall progress">
        <div className="eyebrow">OVERALL PROGRESS</div>
        <ul className="mt-2 grid gap-x-8 gap-y-1 text-[14px] sm:grid-cols-2">
          <li>Recipe {s.recipe ? '✓' : '○'}</li><li>Planning {s.planning ? '✓' : '○'}</li>
          <li>Pictures {s.pictures[0]} / {s.pictures[1]}</li><li>Video Clips {s.clips[0]} / {s.clips[1]}</li>
          <li>Short / Reel {word(s.short)}</li><li>Posting {word(s.posting)}</li>
        </ul>
      </section>
      <div className="flex justify-end"><Link href={hide ? `/projects/${p.slug}/start` : `/projects/${p.slug}/start?hide=done`} className="btn btn-sm btn-ghost">{hide ? 'SHOW DONE' : 'HIDE DONE'}</Link></div>
      <JourneyList sections={j.sections} hideDone={hide} />
    </div>
  );
}
