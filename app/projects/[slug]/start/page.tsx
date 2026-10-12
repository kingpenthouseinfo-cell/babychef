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
    <div className="max-w-[760px] space-y-5">
      <div className="flex items-start justify-between gap-3"><div><h1 className="text-[34px] md:text-[40px]">Start to Finish</h1><p className="mt-1 text-[14px] text-ink-secondary">Updates itself from your pictures, clips and answers.</p></div>
        <Link href={hide ? `/projects/${p.slug}/start` : `/projects/${p.slug}/start?hide=done`} className="btn btn-sm">{hide ? 'Show done' : 'Hide done'}</Link></div>
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-line bg-white p-5" style={{ boxShadow: '0 14px 30px -26px rgba(40,36,60,.5)' }} aria-label="What should I do next?">
        <div className="min-w-0"><div className="eyebrow text-blue-deep">WHAT TO DO NEXT</div>{ns.next ? <div className="mt-1 font-serif text-[24px] leading-tight">{ns.next.title}</div> : <div className="mt-1 font-serif text-[22px]">Nothing needs you right now.</div>}{ns.next?.body && <div className="mt-0.5 text-[13px] text-ink-secondary">{ns.next.body}</div>}</div>
        {ns.next && <Link href={ns.next.href} className="btn btn-primary min-h-[46px] px-6">Continue</Link>}
      </section>
      <section className="card" aria-label="Overall progress">
        <div className="eyebrow">OVERALL PROGRESS</div>
        <ul className="mt-2 grid gap-x-8 gap-y-1 text-[14px] sm:grid-cols-2">
          <li>Recipe {s.recipe ? '✓' : '○'}</li><li>Planning {s.planning ? '✓' : '○'}</li>
          <li>Pictures {s.pictures[0]} / {s.pictures[1]}</li><li>Video Clips {s.clips[0]} / {s.clips[1]}</li>
          <li>Short / Reel {word(s.short)}</li><li>Posting {word(s.posting)}</li>
        </ul>
      </section>
      <JourneyList sections={j.sections} hideDone={hide} />
    </div>
  );
}
