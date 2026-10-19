import { ProjectCard } from '@/components/project-card';
import Link from 'next/link';
import { db } from '@/lib/db';
import { Empty, PageHeader } from '@/components/ui';
import { projectStats } from '@/lib/queries';
import { nextStep } from '@/lib/next-step';
import { projectColor } from '@/lib/project-color';

import { PROJECT_STATUSES } from '@/lib/constants';

export default async function Projects({ searchParams }: { searchParams: { status?: string; q?: string } }) {
  const ps = await db.project.findMany({
    where: { deletedAt: null, ...(searchParams.status ? { status: searchParams.status } : searchParams.q ? {} : { status: { not: 'ARCHIVED' } }) },
    orderBy: { updatedAt: 'desc' }, include: { babyChef: true },
  });
  const everyone = await db.project.findMany({ select: { id: true, createdAt: true } });
  const q = (searchParams.q || '').toLowerCase();
  const list = ps.filter(p => !q || `${p.title} ${p.recipeName} ${p.cuisine}`.toLowerCase().includes(q));
  const stats = await Promise.all(list.map(p => projectStats(p.id)));
  const nexts = await Promise.all(list.map(p => nextStep(p.id, p.slug)));
  const thumbs = await Promise.all(list.map(p => db.plannedImage.findFirst({ where: { projectId: p.id, approvedAttemptId: { not: null } }, orderBy: { updatedAt: 'desc' }, include: { approvedAttempt: true } })));
  return (
    <>
      <PageHeader title="Recipe Videos"><Link href="/projects/new" className="btn btn-primary min-h-[44px] px-5">+ New recipe video</Link></PageHeader>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href="/projects" className={`btn btn-sm ${!searchParams.status ? 'btn-primary' : ''}`}>Active</Link>
        {PROJECT_STATUSES.map(s => <Link key={s} href={`/projects?status=${encodeURIComponent(s)}`} className={`btn btn-sm ${searchParams.status === s ? 'btn-primary' : ''}`}>{s}</Link>)}
      </div>
      {list.length === 0 ? <Empty title="No recipe videos yet." hint="Add a title and recipe to start a new Baby Chef video."><Link href="/projects/new" className="btn btn-primary">+ NEW RECIPE VIDEO</Link></Empty> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{list.map((p, i) => <ProjectCard key={p.id} p={p} color={projectColor(p as any, everyone)} s={stats[i]} thumb={thumbs[i]?.approvedAttempt?.assetId} next={nexts[i].next} />)}</div>
      )}
    </>
  );
}

