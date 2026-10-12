import Link from 'next/link';
import { db } from '@/lib/db';
import { Chip, Empty, PageHeader, ProgressBar } from '@/components/ui';
import { projectStats } from '@/lib/queries';
import { fmtDay } from '@/lib/util';
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

export function ProjectCard({ p, s }: { p: any; s: Awaited<ReturnType<typeof projectStats>> }) {
  return (
    <Link href={`/projects/${p.slug}`} className="card block hover:border-ink">
      <div className="flex items-start justify-between gap-2"><div className="font-semibold leading-tight">{p.title}</div><Chip>{p.status}</Chip></div>
      <div className="mt-1 text-sm text-neutral-500">{p.babyChef?.displayName ?? 'No Baby Chef'} · {p.recipeName || 'No recipe name'}</div>
      <div className="mt-3"><ProgressBar pct={s.progress} /></div>
      <div className="mt-1.5 flex justify-between text-xs text-neutral-500"><span>{s.approved}/{s.images} images approved</span><span>Kling {s.clipsApproved}/{s.clips}</span></div>
      <div className="mt-1 text-xs text-neutral-400">Edited {fmtDay(p.updatedAt)}</div>
    </Link>
  );
}
