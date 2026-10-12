import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProjectBySlug, projectStats } from '@/lib/queries';
import { ProjectTabs } from '@/components/project-tabs';
import { Chip } from '@/components/ui';

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: { slug: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const s = await projectStats(p.id);
  return (
    <>
      <div className="-mt-5 md:-mt-7"><ProjectTabs slug={p.slug} title={p.title} progress={s.progress} /></div>
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 md:hidden"><Link href="/projects" className="text-xs text-ink-secondary underline">Projects</Link><h1 className="text-[22px]">{p.title}</h1><Chip>{p.status}</Chip></div>
      {children}
    </>
  );
}
