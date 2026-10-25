import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProjectBySlug } from '@/lib/queries';
import { db } from '@/lib/db';
import { getStorageRoot } from '@/lib/storage';
import { getSettings } from '@/lib/settings';
import { projectFolder } from '@/lib/files';
import { ProjectTabs } from '@/components/project-tabs';
import { RevealButton } from '@/components/image-workspace';
import { projectColor } from '@/lib/project-color';
import { ProjectColorPicker } from '@/components/project-color-picker';

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: { slug: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const [open, flaggedN, chef, root, s, folder, allProjects] = await Promise.all([
    db.projectQuestion.count({ where: { projectId: p.id, status: 'OPEN' } }),
    Promise.all([db.plannedImage.count({ where: { projectId: p.id, flagged: true } }), db.scene.count({ where: { projectId: p.id, flagged: true } })]).then(([a, b]) => a + b),
    p.babyChefId ? db.babyChef.findUnique({ where: { id: p.babyChefId } }) : null,
    getStorageRoot(), getSettings(), projectFolder(p.id),
    db.project.findMany({ select: { id: true, createdAt: true } }),
  ]);
  const color = projectColor(p as any, allProjects);
  const [looseFiles, clipAssets, usedClips] = await Promise.all([
    db.unmatchedFile.count({ where: { status: 'OPEN', relPath: { startsWith: `${folder}/` } } }),
    db.asset.findMany({ where: { kind: 'VIDEO_CLIP', projectSlug: p.slug }, select: { id: true } }),
    db.scene.findMany({ where: { projectId: p.id, videoAssetId: { not: null } } as any, select: { videoAssetId: true } as any }),
  ]);
  const used = new Set((usedClips as any[]).map(x => x.videoAssetId));
  const unassignedN = looseFiles + clipAssets.filter(c => !used.has(c.id)).length;
  const shown = `${root.replace(/^\/(Users|home)\/[^/]+\//, '').split('/').filter(Boolean).join(' / ')} / ${folder}`;
  const watching = s.watchProjectFolders !== 'false';
  return (
    <div data-testid="project-shell" data-project-color={color.key}>
      {/* the whole page behind this video is tinted in the video's colour */}
      <style>{`html, body { background: ${color.bg} !important; }`}</style>
      <div aria-hidden hidden data-testid="project-tint" data-bg={color.bg} />
      <div className="mb-1"><Link href="/projects" className="text-[13px] text-ink-secondary hover:text-ink">← Recipe Videos</Link></div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-3 text-[34px] md:text-[40px]"><ProjectColorPicker projectId={p.id} current={color.key} isAuto={!(p as any).color} /><span className="min-w-0">{p.title}</span></h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-secondary">
            {chef && <Link href={`/babychefs/${chef.id}`} className="flex items-center gap-2 text-ink-secondary hover:text-ink"><span className="h-[18px] w-[18px] rounded-full" style={{ background: 'linear-gradient(135deg,#E9C9A2,#A8774C)' }} aria-hidden />{chef.displayName}</Link>}
            <span className="min-w-0 break-words">{shown}</span>
            <RevealButton projectFolder={folder} label="Show in folder" className="text-[13px] font-semibold text-blue-deep hover:underline" />
          </div>
        </div>
        {watching && <span className="hidden items-center gap-2 whitespace-nowrap rounded-full border border-line-strong px-3 py-1.5 text-[12.5px] text-ink-secondary sm:inline-flex"><span className="h-[7px] w-[7px] rounded-full bg-[#6E9A76]" />Watching Pictures folder</span>}
      </div>
      <ProjectTabs slug={p.slug} missing={open} flagged={flaggedN} unassigned={unassignedN} />
      {children}
    </div>
  );
}
