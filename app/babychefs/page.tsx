import Link from 'next/link';
import { db } from '@/lib/db';
import { Empty, fileUrl } from '@/components/ui';

const GRADS = ['#E9C9A2,#A8774C', '#EBD2B4,#9E6E45', '#F1DECB,#B88E6B'];
const grad = (i: number) => `linear-gradient(135deg,${GRADS[i % GRADS.length].replace(',', ' 0%,')} 100%)`;

export default async function BabyChefs({ searchParams }: { searchParams: { chef?: string } }) {
  const chefs = await db.babyChef.findMany({
    where: { deletedAt: null }, orderBy: { displayName: 'asc' },
    include: { references: { where: { deletedAt: null }, orderBy: [{ isGold: 'desc' }, { createdAt: 'asc' }], include: { asset: true } }, _count: { select: { projects: true } } },
  });
  if (chefs.length === 0) return (<><h1>Baby Chefs</h1><div className="mt-6"><Empty title="No Baby Chefs yet." hint="Create your first Baby Chef to begin."><Link href="/babychefs/new" className="btn btn-primary">+ New Baby Chef</Link></Empty></div></>);
  const sel = chefs.find(c => c.id === searchParams.chef) ?? chefs[0];
  const hero = sel.references.find(r => r.kind === 'MASTER') ?? sel.references[0];
  const edit = (tab: string) => `/babychefs/${sel.id}?tab=${tab}`;
  const cards: [string, string | null, string][] = [
    ['What Baby Looks Like', [sel.appearance, sel.facialFeatures, sel.hair, sel.age].filter(Boolean).join(' · ') || null, 'details'],
    ['Outfit', [sel.outfit, sel.accessories].filter(Boolean).join(' · ') || null, 'details'],
    ['Personality', sel.personality, 'voice'], ['How Baby Talks', sel.dialogueStyle, 'voice'], ['Voice / Accent', sel.voiceInstruction, 'voice'],
    ['Funny Habits', [sel.recurringJokes, sel.humorPatterns, sel.recurringReacts].filter(Boolean).join(' · ') || null, 'voice'], ['Kitchen', sel.kitchen, 'kitchen'],
  ];
  const examples = sel.references.slice(0, 7);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside>
        <div className="eyebrow mb-3 px-1">BABY CHEFS</div>
        <ul className="space-y-1.5">{chefs.map((c, i) => (
          <li key={c.id}><Link href={`/babychefs?chef=${c.id}`} className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-[14.5px] ${c.id === sel.id ? 'bg-[#FBE9F0] font-semibold' : 'hover:bg-sunken'}`}>
            {c.references[0] ? <img src={fileUrl(c.references[0].assetId, 80)} alt="" className="h-[34px] w-[34px] rounded-full object-cover" /> : <span className="h-[34px] w-[34px] rounded-full" style={{ background: grad(i) }} />}{c.displayName}</Link></li>))}</ul>
        <Link href="/babychefs/new" className="btn mt-4 w-full">+ New Baby Chef</Link>
      </aside>
      <section className="min-w-0">
        <div className="flex flex-wrap items-end gap-6">
          <Link href={edit('refs')} className="block h-[320px] w-[260px] shrink-0 overflow-hidden rounded-[18px] border border-dashed border-[#D9C7E0]" style={{ background: hero ? undefined : 'linear-gradient(135deg,#F3DDE5,#E6DDF0)' }}>
            {hero ? <img src={fileUrl(hero.assetId, 640)} alt={sel.displayName} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center px-6 text-center text-[13.5px] text-[#7A6A82]">Drop the Baby Chef character picture</span>}
          </Link>
          <div className="min-w-0 pb-2"><h1 className="text-[34px] md:text-[44px]">{sel.displayName}</h1>
            <div className="mt-3 text-[15px] text-ink-secondary">{[sel.cuisine && `${sel.cuisine} cooking`, sel.seriesName && `${sel.seriesName} series`].filter(Boolean).join(' · ') || ' '}</div>
            <div className="mt-2 text-[13.5px] text-ink-secondary">Used in {sel._count.projects} recipe video{sel._count.projects === 1 ? '' : 's'}</div>
            <div className="mt-3 flex gap-2"><Link href={edit('details')} className="btn btn-sm">Edit everything</Link></div></div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map(([t, v, tab]) => (
            <div key={t} className="rounded-[18px] border border-line bg-white p-5"><div className="flex items-center justify-between"><span className="text-[15px] font-semibold">{t}</span><Link href={edit(tab)} className="text-[13px] text-ink-secondary hover:text-ink">Edit</Link></div>
              <p className="mt-2 text-[14px] leading-relaxed text-[#47434F]">{v || <span className="text-ink-muted">Not filled in yet.</span>}</p></div>))}
        </div>
        <h2 className="mb-3 mt-9 text-[26px]">Example Pictures</h2>
        <div className="flex flex-wrap gap-3">
          {examples.map(r => <Link key={r.id} href={edit('refs')} className="h-[155px] w-[155px] overflow-hidden rounded-[14px] bg-sunken"><img src={fileUrl(r.assetId, 320)} alt={r.title} className="h-full w-full object-cover" /></Link>)}
          <Link href={edit('refs')} className="flex h-[155px] w-[155px] items-center justify-center rounded-[14px] border border-dashed border-line-strong text-[13px] text-ink-secondary">+ Add from computer</Link>
        </div>
      </section>
    </div>
  );
}
