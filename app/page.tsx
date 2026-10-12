import Link from 'next/link';
import { db } from '@/lib/db';
import { actionCenter, projectStats } from '@/lib/queries';
import { Chip, Empty, fileUrl } from '@/components/ui';
import { ProjectCard } from '@/components/project-card';
import { fmtDate } from '@/lib/util';
import { nextStep } from '@/lib/next-step';

const BAR: Record<string, string> = { READY: '#3E6290', REVIEW: '#9A4A60', REDO: '#C8705C', WAITING: '#C99A3A', KLING: '#6A55A2', PUB: '#6A55A2' };
const CTA_COLOR: Record<string, string> = { READY: 'text-blue-deep', REVIEW: 'text-pink-deep', REDO: 'text-[#A8513F]', WAITING: 'text-[#8A6216]', KLING: 'text-purple-deep', PUB: 'text-purple-deep' };

export default async function Dashboard() {
  const projects = await db.project.findMany({ where: { deletedAt: null }, orderBy: { updatedAt: 'desc' }, include: { babyChef: true } });
  const live = projects.filter(p => p.status !== 'ARCHIVED');
  const active = live.filter(p => p.status !== 'COMPLETE');
  const [items, chefs] = await Promise.all([actionCenter(8), db.babyChef.count({ where: { deletedAt: null } })]);
  const recent = live.slice(0, 6);
  const [stats, thumbs] = await Promise.all([
    Promise.all(recent.map(p => projectStats(p.id))),
    Promise.all(recent.map(p => db.plannedImage.findFirst({ where: { projectId: p.id, approvedAttemptId: { not: null } }, orderBy: { updatedAt: 'desc' }, include: { approvedAttempt: true } }))),
  ]);
  const now = new Date();
  const steps = await Promise.all(active.slice(0, 3).map(p => nextStep(p.id, p.slug)));
  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div><div className="text-[13px] text-ink-secondary">{now.toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' })} · {active.length} recipe video{active.length === 1 ? '' : 's'} in progress</div><h1 className="mt-1 text-[34px]">Home</h1></div>
        <Link href="/projects/new" className="btn btn-primary min-h-[44px] px-5">+ New Recipe Video</Link>
      </div>
      {chefs === 0 && <div className="mb-5"><Empty title="No Baby Chefs yet." hint="Create your first Baby Chef to begin."><Link href="/babychefs/new" className="btn btn-primary">+ ADD BABY CHEF</Link></Empty></div>}
      <section className="mb-8" aria-label="What are you working on?">
        <h2 className="mb-3">What are you working on?</h2>
        {active.length === 0 ? <Empty title="No recipe videos yet." hint="Start one and I'll show you what to do next."><Link href="/projects/new" className="btn btn-primary">+ NEW RECIPE VIDEO</Link></Empty> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {active.slice(0, 3).map((p, i) => (
              <div key={p.id} className="rounded-xl border-2 border-ink bg-white p-5">
                <div className="text-[17px] font-semibold">{p.title}</div>
                <div className="eyebrow mt-3 text-ink-secondary">NEXT</div>
                <div className="text-[18px] font-semibold leading-snug">{steps[i].next?.title ?? 'Nothing needs you right now'}</div>
                <Link href={steps[i].next?.href ?? `/projects/${p.slug}`} className="btn btn-primary mt-3 min-h-[44px] w-full">{steps[i].next ? 'CONTINUE' : 'OPEN'}</Link>
                <div className="mt-3 space-y-0.5 text-[12px] text-ink-secondary">
                  {steps[i].fixing.length > 0 && <div className="text-[#A8513F]">Needs fixing: {steps[i].fixing.length}</div>}
                  {steps[i].todo.slice(0, 3).map((t, j) => <div key={j}>Still to do: {t.text}</div>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <section>
          <div className="mb-3 flex items-baseline gap-2"><h2>Needs your attention</h2></div>
          {items.length === 0 ? <Empty title="You're all caught up." hint="Nothing needs you right now." /> : (
            <ul className="space-y-2">
              {items.map(i => (
                <li key={i.kind + i.key}>
                  <Link href={i.href} className="flex items-stretch gap-3 rounded-lg border border-line bg-surface p-3 transition hover:border-ink/30">
                    <span className="w-1 shrink-0 rounded-full" style={{ background: BAR[i.kind] }} aria-hidden />
                    <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="font-mono text-[12px] font-medium">{i.code}</span><Chip tone={i.chip}>{i.chip}</Chip></span><span className="mt-0.5 block truncate text-[13px]">{i.title}</span><span className="block truncate text-[12px] text-ink-secondary">{i.desc}</span></span>
                    <span className={`self-center whitespace-nowrap text-[13px] font-semibold ${CTA_COLOR[i.kind]}`}>{i.cta} →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <div className="mb-3 flex items-baseline justify-between"><h2>My Recipe Videos</h2><Link href="/projects" className="text-[13px] font-medium text-blue-deep">See all</Link></div>
          {recent.length === 0 ? <Empty title="No recipe videos yet." hint="Create a project to start a new Baby Chef video."><Link href="/projects/new" className="btn btn-primary">+ NEW RECIPE VIDEO</Link></Empty> : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{recent.map((p, i) => <ProjectCard key={p.id} p={p} s={stats[i]} thumb={thumbs[i]?.approvedAttempt?.assetId} />)}</div>
          )}
        </section>
      </div>
      <RecentActivity />
    </>
  );
}

async function RecentActivity() {
  const act = await db.activity.findMany({ orderBy: { createdAt: 'desc' }, take: 8 });
  if (!act.length) return null;
  return (
    <section className="mt-10"><h2 className="mb-3">Recent activity</h2>
      <ul className="card divide-y divide-line p-0 text-[13px]">{act.map(a => <li key={a.id} className="flex justify-between gap-3 px-4 py-2">{a.href ? <Link href={a.href} className="hover:underline">{a.message}</Link> : <span>{a.message}</span>}<span className="shrink-0 text-xs text-ink-muted">{fmtDate(a.createdAt)}</span></li>)}</ul></section>
  );
}
void fileUrl;
