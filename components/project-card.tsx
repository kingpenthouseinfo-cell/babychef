import Link from 'next/link';
import { Chip, ProgressBar, fileUrl } from './ui';
import { fmtDay } from '@/lib/util';
import type { projectStats } from '@/lib/queries';

export function ProjectCard({ p, s, thumb }: { p: any; s: Awaited<ReturnType<typeof projectStats>>; thumb?: string | null }) {
  return (
    <Link href={`/projects/${p.slug}`} className="block overflow-hidden rounded-lg border border-line bg-surface transition hover:border-ink/30">
      <div className="relative aspect-video w-full bg-[repeating-linear-gradient(135deg,#ECE9EC_0_8px,#E5E1E5_8px_16px)]">
        {thumb && <img src={fileUrl(thumb, 640)} alt="" loading="lazy" className="h-full w-full object-cover" />}
        <span className="absolute bottom-2 left-2"><Chip>{p.status}</Chip></span>
      </div>
      <div className="p-4">
        <div className="text-[15px] font-semibold leading-tight">{p.title}</div>
        <div className="mt-0.5 text-[13px] text-ink-secondary">{p.babyChef?.displayName ?? 'No Baby Chef'}</div>
        <div className="mt-3 flex items-center gap-2"><div className="flex-1"><ProgressBar pct={s.progress} /></div><span className="font-mono text-[11px] text-ink-muted">{s.progress}%</span></div>
        <div className="mt-2 flex items-center justify-between text-[12px] text-ink-secondary"><span><b className="font-mono text-pink-deep">{s.approved}/{s.images}</b> images · <b className="font-mono text-purple-deep">{s.clipsApproved}/{s.clips}</b> Kling</span><span>{fmtDay(p.updatedAt)}</span></div>
      </div>
    </Link>
  );
}
