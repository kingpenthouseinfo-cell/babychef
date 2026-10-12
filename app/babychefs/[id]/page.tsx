import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { BabyChefForm, ChefPart } from '@/components/babychef-form';
import { ReferenceCard, UploadReferenceForm } from '@/components/refs';
import { Gallery } from '@/components/gallery';
import { Empty, Thumb, GoldBadge, Chip } from '@/components/ui';
import { ConfirmForm } from '@/components/client';
import { deleteBabyChef } from '@/lib/actions/babychef';
import { REF_CATEGORIES } from '@/lib/constants';
import { imageCode } from '@/lib/util';

const TABS: [string, string][] = [['details', 'Character Details'], ['voice', 'Voice & Personality'], ['kitchen', 'Kitchen'], ['rules', 'Production Rules'], ['refs', 'Master References'], ['gold', 'Gold Standard'], ['corrections', 'Corrections']];

export default async function BabyChefPage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string; cat?: string } }) {
  const b = await db.babyChef.findFirst({
    where: { id: params.id, deletedAt: null },
    include: { references: { where: { deletedAt: null }, include: { asset: true, babyChef: true }, orderBy: [{ isGold: 'desc' }, { createdAt: 'asc' }] }, projects: { where: { deletedAt: null } }, corrections: { orderBy: { createdAt: 'desc' } } },
  });
  if (!b) notFound();
  const [library, targets] = await Promise.all([
    db.babyChef.findMany({ where: { deletedAt: null }, orderBy: { displayName: 'asc' }, include: { references: { where: { deletedAt: null }, orderBy: [{ isGold: 'desc' }, { createdAt: 'asc' }], take: 1, include: { asset: true } }, _count: { select: { projects: true } } } }),
    db.plannedImage.findMany({ where: { project: { deletedAt: null } }, orderBy: [{ projectId: 'asc' }, { seq: 'asc' }], take: 300, include: { project: true } }),
  ]);
  const tab = TABS.some(t => t[0] === searchParams.tab) ? searchParams.tab! : 'refs';
  const masters = b.references.filter(r => r.kind === 'MASTER');
  const gold = masters.filter(r => r.isGold);
  const cats = [...new Set(masters.map(r => r.category))];
  const shown = masters.filter(r => (!searchParams.cat || r.category === searchParams.cat) && (tab !== 'gold' || r.isGold));
  const hero = gold[0] ?? masters[0];
  const href = (t: string, extra = '') => `/babychefs/${b.id}?tab=${t}${extra}`;
  const card = (title: string, text: string | null) => <div className="rounded-lg border border-sage-mid bg-surface p-3.5"><div className="eyebrow text-sage-deep">{title}</div><p className="mt-1.5 line-clamp-4 text-[13px] leading-snug">{text || <span className="text-ink-muted">Not filled in yet.</span>}</p></div>;
  return (
    <>
      {/* library strip */}
      <div className="-mt-1 mb-5 flex items-center gap-3 overflow-x-auto rounded-lg border border-line bg-surface p-2.5">
        <span className="eyebrow shrink-0 px-2">LIBRARY</span>
        {library.map(c => (
          <Link key={c.id} href={`/babychefs/${c.id}`} className={`flex shrink-0 items-center gap-2.5 rounded-lg border px-2.5 py-1.5 transition ${c.id === b.id ? 'border-sage-mid bg-sage-tint' : 'border-line hover:border-ink/30'}`}>
            {c.references[0] ? <img src={`/api/files/${c.references[0].assetId}?w=120`} alt="" className="h-9 w-9 rounded-md object-cover" /> : <span className="h-9 w-9 rounded-md bg-[repeating-linear-gradient(135deg,#E4F0E4_0_6px,#D5E6D6_6px_12px)]" />}
            <span><span className="block text-[13px] font-semibold leading-tight">{c.displayName}</span><span className="text-[11px] text-ink-secondary">{c._count.projects} project{c._count.projects === 1 ? '' : 's'}</span></span>
          </Link>
        ))}
        <Link href="/babychefs/new" className="btn btn-approve btn-sm ml-auto shrink-0">+ New Baby Chef</Link>
      </div>

      <div className="grid gap-0 overflow-hidden rounded-lg border border-line bg-surface lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* left: hero + profile summary (sage zone) */}
        <aside className="zone-sage space-y-4 border-b p-5 lg:border-b-0 lg:border-r">
          <div className="relative overflow-hidden rounded-lg border border-sage-mid bg-surface shadow-md">
            {hero ? <img src={`/api/files/${hero.assetId}?w=800`} alt={b.displayName} className="aspect-[4/5] w-full object-cover" /> : <div className="flex aspect-[4/5] items-center justify-center bg-[repeating-linear-gradient(135deg,#E4F0E4_0_10px,#D5E6D6_10px_20px)] font-mono text-[11px] text-ink-secondary">master character portrait · 4:5</div>}
            {hero?.isGold && <span className="absolute right-2.5 top-2.5"><GoldBadge /></span>}
          </div>
          <div>
            <h1 className="text-[28px]">{b.displayName}</h1>
            <div className="text-[13px] text-sage-deep">{[b.seriesName, b.cuisine].filter(Boolean).join(' · ') || 'No series yet'}{!b.active && <span className="ml-2"><Chip>INACTIVE</Chip></span>}</div>
            <p className="mt-2 text-[13px] leading-snug text-ink-secondary">{b.personality || 'Add a personality on the Voice & Personality tab.'}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[[b.projects.length, 'Projects'], [masters.length, 'References'], [gold.length, 'Gold std']].map(([n, l]) => <div key={String(l)} className="rounded-lg border border-sage-mid bg-surface p-3"><div className="font-mono text-[22px] font-medium leading-none">{n}</div><div className="mt-1 text-[11px] text-ink-secondary">{l}</div></div>)}
          </div>
          {card('Character details', [b.age, b.appearance, b.outfit].filter(Boolean).join('. '))}
          {card('Voice & personality', [b.voiceInstruction, b.dialogueStyle].filter(Boolean).join(' '))}
          {card('Kitchen', b.kitchen)}
          {card('Production rules', [b.safetyRules, b.continuityRules].filter(Boolean).join(' '))}
          <Link href={`/projects/new?chef=${b.id}`} className="btn btn-primary w-full">+ NEW RECIPE VIDEO</Link>
        </aside>

        {/* right: tabs */}
        <div className="min-w-0 p-5">
          <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Baby Chef sections">
            {TABS.map(([k, l]) => <Link key={k} href={href(k)} role="tab" aria-selected={tab === k} className={`rounded-full px-3.5 py-1.5 text-[13px] transition ${tab === k ? 'bg-sage-tint font-semibold text-sage-deep ring-1 ring-sage-mid' : 'text-ink-secondary ring-1 ring-line hover:text-ink'}`}>{l}</Link>)}
          </div>

          {(tab === 'refs' || tab === 'gold') && (
            <>
              <div className="mb-1 rounded-lg bg-ink px-4 py-2 text-[12px] font-semibold tracking-wide text-white">REFERENCE IMAGE = SOURCE OF TRUTH <span className="font-normal opacity-70">— approved images override older written descriptions.</span></div>
              <div className="mb-3 mt-3 flex flex-wrap items-baseline gap-3"><h2>{tab === 'gold' ? 'Gold Standard' : 'References'}</h2><span className="font-mono text-[12px] text-ink-secondary">{shown.length} of {masters.length}</span></div>
              <div className="mb-4 flex flex-wrap gap-1.5">
                <Link href={href(tab)} className={`rounded-full px-3 py-1 text-[12px] ${!searchParams.cat ? 'bg-sage-deep text-white' : 'text-ink-secondary ring-1 ring-line'}`}>All</Link>
                {cats.map(c => <Link key={c} href={href(tab, `&cat=${encodeURIComponent(c)}`)} className={`rounded-full px-3 py-1 text-[12px] ${searchParams.cat === c ? 'bg-sage-deep text-white' : 'text-ink-secondary ring-1 ring-line'}`}>{c}</Link>)}
              </div>
              {shown.length === 0 ? <Empty title={tab === 'gold' ? 'No Gold Standard references yet.' : 'No references yet.'} hint="Add face, outfit and kitchen images below, then mark your best ones Gold Standard." /> : (
                <Gallery tiles={shown.map(r => ({ id: r.id, assetId: r.assetId, title: r.title, category: r.category, version: r.version, gold: r.isGold, hasNotes: !!r.notes, code: r.code }))} targets={targets.map(t => ({ id: t.id, label: `${t.project.title} · ${imageCode(t.seq)} ${t.title}` }))} />
              )}
              <details className="mt-5 rounded-lg border border-sage-mid p-3" open={masters.length === 0}><summary className="cursor-pointer font-semibold">+ Add reference image</summary><div className="mt-3"><UploadReferenceForm babyChefId={b.id} mode="master" /></div></details>
              <details className="mt-3 rounded-lg border border-line p-3"><summary className="cursor-pointer text-[13px] font-semibold">Manage references — edit, replace, delete</summary>
                <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{shown.map(r => <ReferenceCard key={r.id} r={r} cats={REF_CATEGORIES} showOrigin={false} />)}</div></details>
            </>
          )}

          {['details', 'voice', 'kitchen', 'rules'].includes(tab) && (
            <div className="max-w-[860px]"><BabyChefForm b={b} part={tab as ChefPart} /></div>
          )}

          {tab === 'corrections' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between"><h2>Corrections</h2><Link href="/corrections" className="btn btn-sm">Open corrections library →</Link></div>
              {b.corrections.length === 0 ? <Empty title="No corrections for this Baby Chef yet." hint="When an image fails, record what went wrong — it appears here and in future prompts." /> : b.corrections.map(c => (
                <div key={c.id} className="rounded-lg border border-line p-3 text-[13px]"><div className="flex items-center gap-2"><span className="font-mono text-[11px] text-ink-muted">{c.code}</span><b>{c.title}</b><Chip tone={c.severity === 'HIGH' ? 'HIGH' : undefined}>{c.severity}</Chip></div>{c.wrong && <p className="mt-1"><b className="text-[#A8513F]">Wrong:</b> {c.wrong}</p>}{c.correct && <p><b className="text-[#3B6448]">Should be:</b> {c.correct}</p>}</div>
              ))}
            </div>
          )}
          <div className="mt-8 border-t border-line pt-4 text-[13px] text-ink-secondary">Projects using this chef: {b.projects.length ? b.projects.map((p, i) => <span key={p.id}>{i > 0 && ', '}<Link className="underline" href={`/projects/${p.slug}`}>{p.title}</Link></span>) : 'none'}</div>
          <ConfirmForm action={deleteBabyChef} message={`Delete Baby Chef "${b.displayName}"? (It is soft-deleted; projects using it block deletion.)`} className="mt-3"><input type="hidden" name="id" value={b.id} /><button className="btn btn-danger btn-sm">Delete Baby Chef…</button></ConfirmForm>
        </div>
      </div>
    </>
  );
}
void Thumb;
