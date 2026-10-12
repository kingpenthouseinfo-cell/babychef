import { ProjectCard } from '@/components/project-card';
import Link from 'next/link';
import { db } from '@/lib/db';
import { Empty, PageHeader } from '@/components/ui';
import { projectStats } from '@/lib/queries';

import { PROJECT_STATUSES } from '@/lib/constants';

export default async function Projects({ searchParams }: { searchParams: { status?: string; q?: string } }) {
  const ps = await db.project.findMany({
    where: { deletedAt: null, ...(searchParams.status ? { status: searchParams.status } : searchParams.q ? {} : { status: { not: 'ARCHIVED' } }) },
    orderBy: { updatedAt: 'desc' }, include: { babyChef: true },
  });
  const q = (searchParams.q || '').toLowerCase();
  const list = ps.filter(p => !q || `${p.title} ${p.recipeName} ${p.cuisine}`.toLowerCase().includes(q));
  const stats = await Promise.all(list.map(p => projectStats(p.id)));
  return (
    <>
      <PageHeader title="Projects" sub="One project = one cooking video"><Link href="/projects/new" className="btn btn-primary">+ NEW PROJECT</Link></PageHeader>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href="/projects" className={`btn btn-sm ${!searchParams.status ? 'btn-primary' : ''}`}>Active</Link>
        {PROJECT_STATUSES.map(s => <Link key={s} href={`/projects?status=${encodeURIComponent(s)}`} className={`btn btn-sm ${searchParams.status === s ? 'btn-primary' : ''}`}>{s}</Link>)}
      </div>
      {list.length === 0 ? <Empty title="No projects yet." hint="Create a project with a title and recipe to start a new Baby Chef video."><Link href="/projects/new" className="btn btn-primary">+ NEW PROJECT</Link></Empty> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{list.map((p, i) => <ProjectCard key={p.id} p={p} s={stats[i]} />)}</div>
      )}
    </>
  );
}

