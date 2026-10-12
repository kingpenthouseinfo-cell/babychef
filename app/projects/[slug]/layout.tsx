import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProjectBySlug } from '@/lib/queries';
import { db } from '@/lib/db';
import { getStorageRoot } from '@/lib/storage';
import { getSettings } from '@/lib/settings';
import { projectFolder } from '@/lib/files';
import { ProjectTabs } from '@/components/project-tabs';
import { RevealButton } from '@/components/image-workspace';

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: { slug: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const [open, chef, root, s, folder] = await Promise.all([
    db.projectQuestion.count({ where: { projectId: p.id, status: 'OPEN' } }),
    p.babyChefId ? db.babyChef.findUnique({ where: { id: p.babyChefId } }) : null,
    getStorageRoot(), getSettings(), projectFolder(p.id),
  ]);
  const shown = `${root.replace(/^\/(Users|home)\/[^/]+\//, '').split('/').filter(Boolean).join(' / ')} / ${folder}`;
  const watching = s.watchProjectFolders !== 'false';
  return (
    <>
      <div className="mb-1"><Link href="/projects" className="text-[13px] text-ink-secondary hover:text-ink">← Recipe Videos</Link></div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[34px] md:text-[40px]">{p.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-secondary">
            {chef && <Link href={`/babychefs/${chef.id}`} className="flex items-center gap-2 text-ink-secondary hover:text-ink"><span className="h-[18px] w-[18px] rounded-full" style={{ background: 'linear-gradient(135deg,#E9C9A2,#A8774C)' }} aria-hidden />{chef.displayName}</Link>}
            <span className="min-w-0 break-words">{shown}</span>
            <RevealButton projectFolder={folder} label="Show in folder" className="text-[13px] font-semibold text-blue-deep hover:underline" />
          </div>
        </div>
        {watching && <span className="hidden items-center gap-2 whitespace-nowrap rounded-full border border-line-strong px-3 py-1.5 text-[12.5px] text-ink-secondary sm:inline-flex"><span className="h-[7px] w-[7px] rounded-full bg-[#6E9A76]" />Watching Pictures folder</span>}
      </div>
      <ProjectTabs slug={p.slug} missing={open} />
      {children}
    </>
  );
}
