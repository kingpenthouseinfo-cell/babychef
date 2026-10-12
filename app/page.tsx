import Link from 'next/link';
import { db } from '@/lib/db';
import { projectStats } from '@/lib/queries';
import { Empty, PageHeader, Section, Stat } from '@/components/ui';
import { ProjectCard } from '@/components/project-card';
import { fmtDate } from '@/lib/util';

export default async function Dashboard() {
  const projects = await db.project.findMany({ where: { deletedAt: null }, orderBy: { updatedAt: 'desc' }, include: { babyChef: true } });
  const active = projects.filter(p => !['ARCHIVED', 'COMPLETE'].includes(p.status));
  const pids = { projectId: { in: projects.map(p => p.id) } };
  const [ready, waiting, review, redo, klingReady, pubTasks, act, chefs, firstReady] = await Promise.all([
    db.plannedImage.count({ where: { ...pids, status: 'READY' } }), db.plannedImage.count({ where: { ...pids, status: 'WAITING' } }),
    db.plannedImage.count({ where: { ...pids, status: 'REVIEW' } }), db.plannedImage.count({ where: { ...pids, status: 'REDO' } }),
    db.klingClip.count({ where: { ...pids, status: 'READY' } }), db.publishingAsset.count({ where: { ...pids, status: { notIn: ['SELECTED', 'PUBLISHED', 'SKIPPED'] } } }),
    db.activity.findMany({ orderBy: { createdAt: 'desc' }, take: 12 }), db.babyChef.count({ where: { deletedAt: null } }),
    db.klingClip.findFirst({ where: { ...pids, status: 'READY' }, include: { project: true } }),
  ]);
  const recent = projects.filter(p => p.status !== 'ARCHIVED').slice(0, 6);
  const stats = await Promise.all(recent.map(p => projectStats(p.id)));
  return (
    <>
      <PageHeader title="Dashboard" sub={`${active.length} project(s) in progress`}><Link href="/projects/new" className="btn btn-primary">+ NEW PROJECT</Link></PageHeader>
      {chefs === 0 && <div className="mb-5"><Empty title="No Baby Chefs yet." hint="Create your first Baby Chef to begin."><Link href="/babychefs/new" className="btn btn-primary">+ ADD BABY CHEF</Link></Empty></div>}
      <Section title="Action center">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Ready for ChatGPT" value={ready} href="/queue?show=ready" tone="text-emerald-800" />
          <Stat label="Waiting" value={waiting} href="/queue?show=waiting" tone="text-amber-800" />
          <Stat label="Needs review" value={review} href="/queue?show=review" tone="text-violet-800" />
          <Stat label="Redo" value={redo} href="/queue?show=redo" tone="text-orange-800" />
          <Stat label="Kling ready" value={klingReady} href={firstReady ? `/projects/${firstReady.project.slug}/kling` : '/projects'} />
          <Stat label="Publishing tasks" value={pubTasks} href="/projects" />
        </div>
      </Section>
      <h2 className="mb-3 mt-8">Recent projects</h2>
      {recent.length === 0 ? <Empty title="No projects yet." hint="Create a project to start a new Baby Chef video."><Link href="/projects/new" className="btn btn-primary">+ NEW PROJECT</Link></Empty> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{recent.map((p, i) => <ProjectCard key={p.id} p={p} s={stats[i]} />)}</div>
      )}
      <h2 className="mb-3 mt-8">Recent activity</h2>
      {act.length === 0 ? <p className="text-sm text-neutral-500">Nothing yet.</p> : <ul className="card divide-y divide-line p-0 text-sm">{act.map(a => <li key={a.id} className="flex justify-between gap-3 px-4 py-2">{a.href ? <Link href={a.href} className="hover:underline">{a.message}</Link> : <span>{a.message}</span>}<span className="shrink-0 text-xs text-neutral-400">{fmtDate(a.createdAt)}</span></li>)}</ul>}
    </>
  );
}
