import Link from 'next/link';
import { ProgressBar, fileUrl } from './ui';
import { ConfirmForm } from './client';
import { archiveProject } from '@/lib/actions/project';
import type { projectStats } from '@/lib/queries';

const GRADS = ['#E9C9A2,#A8774C', '#EBD2B4,#9E6E45', '#F1E3A8,#C9A64A', '#EBD3B8,#B08A5E', '#F0D6C0,#C98F6A'];
const grad = (id: string) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `linear-gradient(150deg,${GRADS[h % GRADS.length].replace(',', ' 0%,')} 100%)`; };

export function ProjectCard({ p, s, thumb, next }: { p: any; s: Awaited<ReturnType<typeof projectStats>>; thumb?: string | null; next?: { title: string; href: string } | null }) {
  return (
    <div className="relative flex flex-col overflow-hidden border border-line bg-white" style={{ borderRadius: 18, boxShadow: '0 14px 30px -26px rgba(40,36,60,.5)' }}>
      <Link href={`/projects/${p.slug}`} className="block">
        <div className="relative aspect-video w-full" style={{ background: grad(p.id) }}>{thumb && <img src={fileUrl(thumb, 640)} alt="" loading="lazy" className="h-full w-full object-cover" />}</div>
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/projects/${p.slug}`} className="min-w-0"><div className="font-serif text-[22px] font-medium leading-tight tracking-[-0.01em]">{p.title}</div><div className="text-[13px] text-ink-secondary">{p.babyChef?.displayName ?? 'No Baby Chef yet'}</div></Link>
          <details className="relative"><summary className="btn btn-sm btn-ghost list-none" aria-label={`Menu for ${p.title}`}>···</summary>
            <div className="absolute right-0 z-20 mt-1 w-44 rounded-[14px] border border-line bg-white p-1.5 shadow-md">
              <ConfirmForm action={archiveProject} message={`Delete "${p.title}"? It disappears from the app. The pictures and files already saved in its folder on your computer are not touched.`}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="mode" value="delete" /><button className="flex min-h-[36px] w-full items-center rounded-md px-3 text-left text-[13px] text-[#A8513F] hover:bg-sunken" aria-label={`Delete ${p.title}`}>Delete</button></ConfirmForm>
            </div></details>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[12.5px] text-ink-secondary"><span>Pictures {s.approved} / {s.images}</span>{s.redo > 0 && <span className="font-medium text-[#A8513F]">{s.redo} need fixing</span>}</div>
          <ProgressBar pct={s.images ? Math.round((s.approved / s.images) * 100) : 0} />
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3">
          <div className="min-w-0"><div className="eyebrow">NEXT</div><div className="truncate text-[14px] font-semibold">{next?.title ?? 'Nothing needs you'}</div></div>
          <Link href={next?.href ?? `/projects/${p.slug}`} className="btn btn-primary shrink-0">Continue</Link>
        </div>
      </div>
    </div>
  );
}
