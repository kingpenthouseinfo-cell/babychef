import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { Empty, Section } from '@/components/ui';
import { ReferenceCard, UploadReferenceForm } from '@/components/refs';
import { PROJECT_REF_CATEGORIES, REF_CATEGORIES, INGREDIENT_REF_TYPES } from '@/lib/constants';

export default async function ProjectRefs({ params }: { params: { slug: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const inc = { asset: true, babyChef: true, project: true, ingredient: true };
  const [master, own] = await Promise.all([
    p.babyChefId ? db.reference.findMany({ where: { babyChefId: p.babyChefId, kind: 'MASTER', deletedAt: null }, include: inc, orderBy: [{ isGold: 'desc' }, { createdAt: 'asc' }] }) : [],
    db.reference.findMany({ where: { projectId: p.id, deletedAt: null }, include: inc, orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }] }),
  ]);
  const grid = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold tracking-wide text-white">REFERENCE IMAGE = SOURCE OF TRUTH</div>
      <Section title={`From Baby Chef master library${p.babyChef ? ' — ' + p.babyChef.displayName : ''}`} right={p.babyChef && <Link className="btn btn-sm" href={`/babychefs/${p.babyChef.id}`}>Manage master refs</Link>}>
        {master.length ? <div className={grid}>{master.map(r => <ReferenceCard key={r.id} r={r} cats={REF_CATEGORIES} />)}</div> : <Empty title="No master references." hint="Select a Baby Chef and upload master references on their page." />}
      </Section>
      <Section title="Example pictures for this recipe video (incl. product photos)">
        {own.length ? <div className={grid}>{own.map(r => <ReferenceCard key={r.id} r={r} cats={r.kind === 'INGREDIENT' ? INGREDIENT_REF_TYPES : PROJECT_REF_CATEGORIES} />)}</div> : <Empty title="No project references yet." />}
        <details className="mt-4 rounded-lg border border-line p-3"><summary className="cursor-pointer font-semibold">+ Add project reference</summary><div className="mt-3"><UploadReferenceForm projectId={p.id} babyChefId={p.babyChefId} mode="project" /></div></details>
      </Section>
    </div>
  );
}
