import Link from 'next/link';
import { Chip, ProgressBar } from './ui';
import { fmtDay } from '@/lib/util';
import type { projectStats } from '@/lib/queries';

export function ProjectCard({ p, s }: { p: any; s: Awaited<ReturnType<typeof projectStats>> }) {
  return (
    <Link href={`/projects/${p.slug}`} className="card block hover:border-ink">
      <div className="flex items-start justify-between gap-2"><div className="font-semibold leading-tight">{p.title}</div><Chip>{p.status}</Chip></div>
      <div className="mt-1 text-sm text-ink-secondary">{p.babyChef?.displayName ?? 'No Baby Chef'} · {p.recipeName || 'No recipe name'}</div>
      <div className="mt-3"><ProgressBar pct={s.progress} /></div>
      <div className="mt-1.5 flex justify-between text-xs text-ink-secondary"><span>{s.approved}/{s.images} images approved</span><span>Kling {s.clipsApproved}/{s.clips}</span></div>
      <div className="mt-1 text-xs text-ink-secondary">Edited {fmtDay(p.updatedAt)}</div>
    </Link>
  );
}
