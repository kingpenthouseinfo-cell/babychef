import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProjectBySlug } from '@/lib/queries';
import { ProjectTabs } from '@/components/project-tabs';
import { Chip } from '@/components/ui';

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: { slug: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  return (
    <>
      <div className="mb-3 text-xs text-neutral-500"><Link href="/projects" className="underline">Projects</Link> / {p.slug}</div>
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="break-words">{p.title}</h1><Chip>{p.status}</Chip>
        <span className="text-sm text-neutral-500">{p.babyChef?.displayName ?? 'No Baby Chef'}</span>
      </div>
      <ProjectTabs slug={p.slug} />
      {children}
    </>
  );
}
