import Link from 'next/link';
import { db } from '@/lib/db';
import { projectStats } from '@/lib/queries';
import { Empty, fileUrl } from '@/components/ui';
import { nextStep } from '@/lib/next-step';
import { ZONE, zoneOf } from '@/lib/words';

const GRADS = ['#E9C9A2,#A8774C', '#EBD2B4,#9E6E45', '#F1E3A8,#C9A64A', '#EBD3B8,#B08A5E', '#F0D6C0,#C98F6A'];
const grad = (id: string) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `linear-gradient(150deg,${GRADS[h % GRADS.length].replace(',', ' 0%,')} 100%)`; };

export default async function Home() {
  const projects = await db.project.findMany({ where: { deletedAt: null, status: { not: 'ARCHIVED' } }, orderBy: { updatedAt: 'desc' }, include: { babyChef: true } });
  const chefs = await db.babyChef.count({ where: { deletedAt: null } });
  const list = projects.slice(0, 8);
  const [stats, nexts, thumbs] = await Promise.all([
    Promise.all(list.map(p => projectStats(p.id))),
    Promise.all(list.map(p => nextStep(p.id, p.slug))),
    Promise.all(list.map(p => db.plannedImage.findFirst({ where: { projectId: p.id, approvedAttemptId: { not: null } }, orderBy: { updatedAt: 'desc' }, include: { approvedAttempt: true } }))),
  ]);
  const thumb = (i: number, size: number, r: number) => thumbs[i]?.approvedAttempt?.assetId
    ? <img src={fileUrl(thumbs[i]!.approvedAttempt!.assetId, 160)} alt="" className="shrink-0 object-cover" style={{ width: size, height: size, borderRadius: r }} />
    : <span className="shrink-0" style={{ width: size, height: size, borderRadius: r, background: grad(list[i].id) }} />;
  const cards = list.map((p, i) => ({ p, i })).filter(({ i }) => nexts[i].next).slice(0, 3);
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-end justify-between gap-3"><h1>Home</h1><Link href="/projects/new" className="btn btn-primary min-h-[44px] px-5">+ New recipe video</Link></div>
      {chefs === 0 && <Empty title="No Baby Chefs yet." hint="Create your first Baby Chef to begin."><Link href="/babychefs/new" className="btn btn-primary">+ Add Baby Chef</Link></Empty>}
      {list.length === 0 ? <Empty title="No recipe videos yet." hint="Start one and I'll show you what to do next."><Link href="/projects/new" className="btn btn-primary">+ New recipe video</Link></Empty> : (<>
        {cards.length > 0 && (
          <section className="flex flex-col gap-3.5" aria-label="Next step in each video">
            <span className="eyebrow">NEXT STEP IN EACH VIDEO</span>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {cards.map(({ p, i }) => { const n = nexts[i].next!; const z = zoneOf(n.href); const Z = ZONE[z.zone]; return (
                <div key={p.id} className="flex flex-col overflow-hidden border border-line bg-white" style={{ borderRadius: 18, boxShadow: '0 14px 30px -26px rgba(40,36,60,.5)' }}>
                  <Link href={`/projects/${p.slug}`} className="flex items-center gap-3.5 px-[18px] py-4">{thumb(i, 56, 12)}<span className="min-w-0"><span className="block font-serif text-[22px] font-medium leading-[1.15] tracking-[-0.01em]">{p.title}</span><span className="block text-[13px] text-ink-secondary">{p.babyChef?.displayName ?? 'No Baby Chef yet'}</span></span></Link>
                  <div className="mx-2.5 mb-2.5 flex flex-1 flex-col gap-2.5 rounded-[14px] border p-4" style={{ background: Z.bg, borderColor: Z.bd }}>
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: Z.ink }}>Next · {z.label}</span>
                    <div><div className="text-[17px] font-semibold">{n.title}</div>{n.body && <div className="text-[13px] text-[#47434F]">{n.body}</div>}</div>
                    <div className="flex flex-wrap items-center gap-2.5"><Link href={n.href} className={`btn btn-primary`}>{n.cta.charAt(0) + n.cta.slice(1).toLowerCase()}</Link>{nexts[i].fixing.length > 0 && <Link href={nexts[i].fixing[0].href} className="rounded-full bg-[#F5E1DB] px-2.5 py-1 text-[12px] font-semibold text-[#A5473A]">! {nexts[i].fixing.length} {nexts[i].fixing.length > 1 ? 'pictures need' : 'picture needs'} fixing</Link>}</div>
                  </div>
                </div>); })}
            </div>
          </section>
        )}
        <section className="flex flex-col gap-3.5">
          <div className="flex items-baseline justify-between"><span className="eyebrow">RECIPE VIDEOS</span><Link href="/projects" className="text-[13px] font-semibold text-blue-deep">All recipe videos →</Link></div>
          <div className="overflow-hidden rounded-[18px] border border-line bg-white">
            {list.map((p, i) => { const s = stats[i]; const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0); return (
              <div key={p.id} className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-4 last:border-0">
                <Link href={`/projects/${p.slug}`} className="flex min-w-[220px] flex-1 items-center gap-3.5">{thumb(i, 46, 10)}<span className="min-w-0"><span className="block font-serif text-[20px] font-medium leading-tight">{p.title}</span><span className="block text-[13px] text-ink-secondary">{p.babyChef?.displayName ?? 'No Baby Chef yet'}</span></span></Link>
                <div className="hidden flex-[2] grid-cols-4 gap-4 lg:grid">
                  {([['Recipe', p.recipeOriginal || p.recipeAdapted ? 100 : 0, '#9CCBA5'], ['Pictures', pct(s.approved, s.images), '#F2AFC4'], ['Clips', pct(s.clipsApproved, s.clips), '#B9A3E6'], ['Posted', pct(s.publishingSelected, s.publishing), '#B6CBEA']] as const).map(([l, v, c]) => (
                    <div key={l}><div className="mb-1 text-[12px] text-ink-secondary">{l}</div><div className="h-[5px] overflow-hidden rounded-full bg-[#F0EEF3]"><div className="h-full rounded-full" style={{ width: `${v}%`, background: c }} /></div></div>))}
                </div>
                <div className="flex items-center gap-3"><span className="hidden text-[13.5px] text-ink-secondary sm:inline">{nexts[i].next?.title ?? 'Nothing needs you'}</span><Link href={nexts[i].next?.href ?? `/projects/${p.slug}`} className="btn">Continue</Link></div>
              </div>); })}
          </div>
        </section>
      </>)}
    </div>
  );
}
