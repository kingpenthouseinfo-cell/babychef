import Link from 'next/link';
import { db } from '@/lib/db';
import { Empty, fileUrl } from '@/components/ui';
import { nextStep } from '@/lib/next-step';
import { buildJourney } from '@/lib/journey';
import { ZONE, zoneOf } from '@/lib/words';
import { StartNewVideo, AddChefOrKitchen } from '@/components/home-boxes';

const GRADS = ['#E9C9A2,#A8774C', '#EBD2B4,#9E6E45', '#F1E3A8,#C9A64A', '#EBD3B8,#B08A5E', '#F0D6C0,#C98F6A'];
const grad = (id: string) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `linear-gradient(150deg,${GRADS[h % GRADS.length].replace(',', ' 0%,')} 100%)`; };

export default async function Home() {
  const projects = await db.project.findMany({ where: { deletedAt: null, status: { notIn: ['ARCHIVED', 'COMPLETE'] } }, orderBy: { updatedAt: 'desc' }, include: { babyChef: true } });
  const chefs = await db.babyChef.findMany({ where: { deletedAt: null, active: true }, orderBy: { displayName: 'asc' }, select: { id: true, displayName: true } });
  const info = await Promise.all(projects.map(async p => {
    const [ns, j, thumb] = await Promise.all([nextStep(p.id, p.slug), buildJourney(p.id, p.slug), db.plannedImage.findFirst({ where: { projectId: p.id, approvedAttemptId: { not: null } }, orderBy: { updatedAt: 'desc' }, include: { approvedAttempt: true } })]);
    const all = j.sections.flatMap(s => s.steps);
    return { p, ns, pct: all.length ? Math.round(all.filter(x => x.state === 'DONE').length / all.length * 100) : 0, thumb: thumb?.approvedAttempt?.assetId ?? null };
  }));
  const active = info.slice(0, 2), others = info.slice(2);
  const th = (x: (typeof info)[number], w: number, h: number, r: number) => x.thumb ? <img src={fileUrl(x.thumb, 200)} alt="" className="shrink-0 object-cover" style={{ width: w, height: h, borderRadius: r }} /> : <span className="shrink-0" style={{ width: w, height: h, borderRadius: r, background: grad(x.p.id) }} />;
  const chefOpts = chefs.map(c => ({ id: c.id, name: c.displayName }));
  return (
    <div className="flex flex-wrap items-start gap-9">
      <div className="min-w-0 flex-[1_1_560px]">
        <h1>My Recipe Videos</h1>
        <div className="mt-6 border-t border-line">
          {info.length === 0 && <div className="py-8"><Empty title="No recipe videos yet." hint="Paste a recipe on the right and press Create video." /></div>}
          {active.map((x, idx) => (
            <div key={x.p.id} className="border-b border-line py-5">
              <div className="flex items-center gap-5">
                <Link href={`/projects/${x.p.slug}`}>{th(x, 96, 72, 14)}</Link>
                <div className="min-w-0 flex-1">
                  {idx === 0 && <span className="mb-1 inline-block rounded-md bg-[#FBE9F0] px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9A4A64]">Working on now</span>}
                  <Link href={`/projects/${x.p.slug}`}><h2 className="text-[26px]">{x.p.title}</h2></Link>
                  <div className="mt-1 text-[14px] text-ink-secondary">{x.p.babyChef?.displayName ?? 'No Baby Chef yet'} · Next: <b className="font-semibold text-ink">{x.ns.next?.title ?? 'nothing needs you'}</b></div>
                </div>
                <div className="text-center"><div className="font-serif text-[30px] leading-none">{x.pct}%</div><div className="text-[12px] text-ink-secondary">done</div></div>
                <Link href={x.ns.next?.href ?? `/projects/${x.p.slug}`} className={`btn ${idx === 0 ? 'btn-primary' : ''} min-h-[48px] px-6`}>{idx === 0 ? 'Continue' : 'Open'}</Link>
              </div>
              <details className="group mt-2 pl-[116px]">
                <summary className="cursor-pointer list-none text-[13px] font-semibold text-blue-deep"><span className="group-open:hidden">▸ Show next steps</span><span className="hidden group-open:inline">▾ Hide next steps</span></summary>
                <div className="eyebrow mt-3">NEXT STEPS IN THIS VIDEO</div>
                <ol className="mt-3 space-y-2.5">{x.ns.steps.slice(0, 6).map((st, i) => { const z = zoneOf(st.href); const Z = z.label === 'Pictures' && /^Fix/.test(st.title) ? { bg: 'linear-gradient(135deg,#FDEEEA,#FBF0EC)', bd: '#F0CFC6', ink: '#A5473A' } : ZONE[z.zone]; const lab = z.label === 'Pictures' && /^Fix/.test(st.title) ? 'Needs fixing' : z.label; return (
                  <li key={i}><Link href={st.href} className="flex items-center gap-4 rounded-xl border px-4 py-3.5" style={{ background: Z.bg, borderColor: Z.bd }}>
                    <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-white text-[13px] font-semibold shadow-sm">{i + 1}</span>
                    <span className="min-w-0 flex-1"><b className="block text-[15px] font-semibold">{st.title}</b>{st.body && <span className="block truncate text-[13px] text-ink-secondary">{st.body}</span>}</span>
                    <span className="text-[11.5px] font-bold uppercase tracking-[0.12em]" style={{ color: Z.ink }}>{lab}</span></Link></li>); })}</ol>
              </details>
            </div>
          ))}
        </div>
        {others.length > 0 && (
          <details className="mt-5"><summary className="cursor-pointer list-none text-[14px] font-semibold text-ink-secondary">▸ Other recipe videos ({others.length})</summary>
            <div className="mt-3 divide-y divide-line rounded-2xl border border-line">{others.map(x => (
              <Link key={x.p.id} href={`/projects/${x.p.slug}`} className="flex items-center gap-4 px-4 py-3">{th(x, 46, 36, 8)}<span className="min-w-0 flex-1"><b className="block text-[15px] font-semibold">{x.p.title}</b><span className="text-[13px] text-ink-secondary">{x.p.babyChef?.displayName ?? 'No Baby Chef yet'}</span></span><span className="font-serif text-[18px]">{x.pct}%</span><span className="text-ink-muted">›</span></Link>))}</div></details>
        )}
        <div className="mt-6"><Link href="/projects" className="text-[13px] font-semibold text-blue-deep">All recipe videos →</Link></div>
      </div>
      <aside className="flex min-w-0 flex-[0_1_340px] flex-col gap-5">
        <StartNewVideo chefs={chefOpts} />
        <AddChefOrKitchen chefs={chefOpts} />
      </aside>
    </div>
  );
}
