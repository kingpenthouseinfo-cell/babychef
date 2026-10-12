import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { BabyChefForm } from '@/components/babychef-form';
import { ReferenceCard, UploadReferenceForm } from '@/components/refs';
import { Empty, PageHeader, Section, Chip } from '@/components/ui';
import { ConfirmForm } from '@/components/client';
import { deleteBabyChef } from '@/lib/actions/babychef';
import { REF_CATEGORIES } from '@/lib/constants';
import { fmtDay } from '@/lib/util';

export default async function BabyChefPage({ params, searchParams }: { params: { id: string }; searchParams: { cat?: string } }) {
  const b = await db.babyChef.findFirst({
    where: { id: params.id, deletedAt: null },
    include: { references: { where: { deletedAt: null }, include: { asset: true, babyChef: true }, orderBy: [{ isGold: 'desc' }, { createdAt: 'asc' }] }, projects: { where: { deletedAt: null } }, corrections: true },
  });
  if (!b) notFound();
  const refs = b.references.filter(r => r.kind === 'MASTER' && (!searchParams.cat || r.category === searchParams.cat));
  return (
    <>
      <PageHeader title={b.displayName} sub={<>Created {fmtDay(b.createdAt)} · Updated {fmtDay(b.updatedAt)} {!b.active && <Chip>INACTIVE</Chip>}</>}>
        <Link href={`/projects/new?chef=${b.id}`} className="btn btn-primary">+ NEW PROJECT</Link>
      </PageHeader>
      <div className="mb-6 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold tracking-wide text-white">REFERENCE IMAGE = SOURCE OF TRUTH <span className="font-normal opacity-70">— approved images override older written descriptions.</span></div>
      <Section title="Master Reference Gallery" right={<span className="text-xs text-ink-secondary">{b.references.filter(r => r.kind === 'MASTER').length} images</span>}>
        <div className="mb-3 flex flex-wrap gap-1.5">
          <Link href={`/babychefs/${b.id}`} className={`btn btn-sm ${!searchParams.cat ? 'btn-primary' : ''}`}>All</Link>
          {REF_CATEGORIES.map(c => <Link key={c} href={`/babychefs/${b.id}?cat=${encodeURIComponent(c)}`} className={`btn btn-sm ${searchParams.cat === c ? 'btn-primary' : ''}`}>{c}</Link>)}
        </div>
        {refs.length === 0 ? <Empty title="No references yet." hint="Upload face, outfit, kitchen and Gold Standard images below." /> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{refs.map(r => <ReferenceCard key={r.id} r={r} cats={REF_CATEGORIES} showOrigin={false} />)}</div>
        )}
        <details className="mt-5 rounded-lg border border-line p-3" open={refs.length === 0}><summary className="cursor-pointer font-semibold">+ Add reference image</summary><div className="mt-3"><UploadReferenceForm babyChefId={b.id} mode="master" /></div></details>
      </Section>
      <h2 className="mb-3 mt-8">Profile</h2>
      <BabyChefForm b={b} />
      <div className="mt-8 text-sm text-ink-secondary">Projects using this chef: {b.projects.map(p => <Link key={p.id} className="underline" href={`/projects/${p.slug}`}>{p.title}</Link>).reduce<any[]>((a, x) => a.length ? [...a, ', ', x] : [x], []) || 'none'}</div>
      <ConfirmForm action={deleteBabyChef} message={`Delete Baby Chef "${b.displayName}"? (It is soft-deleted; projects using it block deletion.)`} className="mt-4"><input type="hidden" name="id" value={b.id} /><button className="btn btn-danger btn-sm">Delete Baby Chef…</button></ConfirmForm>
    </>
  );
}
