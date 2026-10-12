import Link from 'next/link';
import { db } from '@/lib/db';
import { actionCenter, projectStats } from '@/lib/queries';
import { Chip, Empty, fileUrl } from '@/components/ui';
import { ProjectCard } from '@/components/project-card';
import { fmtDate, klingCode } from '@/lib/util';

const BAR: Record<string, string> = { READY: '#3E6290', REVIEW: '#9A4A60', REDO: '#C8705C', WAITING: '#C99A3A', KLING: '#6A55A2', PUB: '#6A55A2' };
const CTA_COLOR: Record<string, string> = { READY: 'text-blue-deep', REVIEW: 'text-pink-deep', REDO: 'text-[#A8513F]', WAITING: 'text-[#8A6216]', KLING: 'text-purple-deep', PUB: 'text-purple-deep' };

export default async function Dashboard() {
  const projects = await db.project.findMany({ where: { deletedAt: null }, orderBy: { updatedAt: 'desc' }, include: { babyChef: true } });
  const live = projects.filter(p => p.status !== 'ARCHIVED');
  const active = live.filter(p => p.status !== 'COMPLETE');
  const pids = { projectId: { in: live.map(p => p.id) } };
  const [ready, waitingImgs, reviewImgs, klingReady, klingReview, pubAssets, items, chefs] = await Promise.all([
    db.plannedImage.count({ where: { ...pids, status: 'READY' } }), db.plannedImage.findMany({ where: { ...pids, status: 'WAITING' }, select: { waitingReason: true } }),
    db.plannedImage.count({ where: { ...pids, status: 'REVIEW' } }), db.klingClip.findMany({ where: { ...pids, status: 'READY' }, orderBy: { order: 'asc' } }),
    db.klingClip.count({ where: { ...pids, status: 'REVIEW' } }), db.publishingAsset.findMany({ where: { ...pids, status: { notIn: ['SELECTED', 'PUBLISHED', 'SKIPPED'] } }, include: { project: true } }),
    actionCenter(8), db.babyChef.count({ where: { deletedAt: null } }),
  ]);
  const recent = live.slice(0, 6);
  const [stats, thumbs] = await Promise.all([
    Promise.all(recent.map(p => projectStats(p.id))),
    Promise.all(recent.map(p => db.plannedImage.findFirst({ where: { projectId: p.id, approvedAttemptId: { not: null } }, orderBy: { updatedAt: 'desc' }, include: { approvedAttempt: true } }))),
  ]);
  const reason = waitingImgs[0]?.waitingReason ?? '';
  const pubProjects = [...new Set(pubAssets.map(a => a.project.title))];
  const now = new Date();
  const cards: { label: string; value: number; sub: string; href: string; cls: string; val?: string }[] = [
    { label: 'Active Projects', value: active.length, sub: `${active.filter(p => p.status === 'IMAGE PRODUCTION').length} in image production`, href: '/projects', cls: 'bg-grad-pink border-pink-mid text-pink-deep' },
    { label: 'Images Ready', value: ready, sub: 'for ChatGPT', href: '/queue?show=ready', cls: 'bg-grad-blue border-blue-mid text-blue-deep' },
    { label: 'Waiting', value: waitingImgs.length, sub: reason || 'nothing waiting', href: '/queue?show=waiting', cls: 'bg-surface border-[#E7D3A0] text-[#8A6216]' },
    { label: 'Needs Review', value: reviewImgs + klingReview, sub: `${reviewImgs} image${reviewImgs === 1 ? '' : 's'} · ${klingReview} clip${klingReview === 1 ? '' : 's'}`, href: '/queue?show=review', cls: 'bg-grad-pink border-pink-mid text-pink-deep' },
    { label: 'Kling Ready', value: klingReady.length, sub: klingReady.slice(0, 2).map(k => klingCode(k.order)).join(', ') || 'none ready', href: live[0] ? `/projects/${live[0].slug}/kling` : '/projects', cls: 'bg-grad-purple border-purple-mid text-purple-deep' },
    { label: 'Publishing Tasks', value: pubAssets.length, sub: pubProjects.slice(0, 2).join(', ') || 'all caught up', href: '/projects', cls: 'bg-grad-purple border-purple-mid text-purple-deep' },
  ];
  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div><div className="text-[13px] text-ink-secondary">{now.toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' })} · {active.length} active project{active.length === 1 ? '' : 's'}</div><h1 className="mt-1 text-[34px]">Dashboard</h1><p className="text-[14px] text-ink-secondary">Answers “what needs my attention right now?”</p></div>
        <Link href="/projects/new" className="btn btn-primary min-h-[44px] px-5">+ New Project</Link>
      </div>
      {chefs === 0 && <div className="mb-5"><Empty title="No Baby Chefs yet." hint="Create your first Baby Chef to begin."><Link href="/babychefs/new" className="btn btn-primary">+ ADD BABY CHEF</Link></Empty></div>}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map(c => (
          <Link key={c.label} href={c.href} className={`block rounded-lg border p-4 transition hover:-translate-y-px ${c.cls}`}>
            <div className="text-[12px] font-semibold">{c.label}</div><div className="my-1 font-mono text-[30px] font-medium leading-none text-ink">{c.value}</div><div className="text-[12px] text-ink-secondary">{c.sub}</div>
          </Link>
        ))}
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <section>
          <div className="mb-3 flex items-baseline gap-2"><h2>Action Center</h2><span className="text-[12px] text-ink-secondary">sorted by what unblocks the most</span></div>
          {items.length === 0 ? <Empty title="You're all caught up." hint="Nothing needs you right now." /> : (
            <ul className="space-y-2">
              {items.map(i => (
                <li key={i.kind + i.key}>
                  <Link href={i.href} className="flex items-stretch gap-3 rounded-lg border border-line bg-surface p-3 transition hover:border-ink/30">
                    <span className="w-1 shrink-0 rounded-full" style={{ background: BAR[i.kind] }} aria-hidden />
                    <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="font-mono text-[12px] font-medium">{i.code}</span><Chip>{i.chip}</Chip></span><span className="mt-0.5 block truncate text-[13px]">{i.title}</span><span className="block truncate text-[12px] text-ink-secondary">{i.desc}</span></span>
                    <span className={`self-center whitespace-nowrap text-[13px] font-semibold ${CTA_COLOR[i.kind]}`}>{i.cta} →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <div className="mb-3 flex items-baseline justify-between"><h2>Recent Projects</h2><Link href="/projects" className="text-[13px] font-medium text-blue-deep">All projects</Link></div>
          {recent.length === 0 ? <Empty title="No projects yet." hint="Create a project to start a new Baby Chef video."><Link href="/projects/new" className="btn btn-primary">+ NEW PROJECT</Link></Empty> : (
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
