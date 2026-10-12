import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { DirtyForm, SubmitBtn } from '@/components/client';
import { Area, Section, Thumb, Chip, GoldBadge } from '@/components/ui';
import { saveDoc, copyDefaultsToContinuity } from '@/lib/actions/project';
import { CONTINUITY_FIELDS, INGREDIENT_IMPORTANCE } from '@/lib/constants';
import { parseJson, sceneCode, imageCode } from '@/lib/util';

export default async function Continuity({ params }: { params: { slug: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const [doc, masters, scenes, ings, corr, approved] = await Promise.all([
    db.projectDoc.findUnique({ where: { projectId_key: { projectId: p.id, key: 'continuity' } } }),
    p.babyChefId ? db.reference.findMany({ where: { babyChefId: p.babyChefId, kind: 'MASTER', deletedAt: null, active: true }, include: { asset: true }, orderBy: [{ isGold: 'desc' }] }) : [],
    db.scene.findMany({ where: { projectId: p.id }, orderBy: { order: 'asc' } }),
    db.ingredient.findMany({ where: { projectId: p.id }, orderBy: { order: 'asc' }, include: { references: { where: { deletedAt: null }, include: { asset: true } } } }),
    db.correction.findMany({ where: { OR: [{ projectId: p.id }, { babyChefId: p.babyChefId ?? '__' }] }, orderBy: { createdAt: 'desc' } }),
    db.plannedImage.findMany({ where: { projectId: p.id, approvedAttemptId: { not: null } }, orderBy: { seq: 'asc' }, include: { approvedAttempt: true, scene: true } }),
  ]);
  const data = parseJson<Record<string, string>>(doc?.data, {});
  const b = p.babyChef;
  return (
    <div className="space-y-5">
      <Section title="Keep It Consistent">
        <DirtyForm action={saveDoc} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="projectId" value={p.id} /><input type="hidden" name="key" value="continuity" />
          {CONTINUITY_FIELDS.map(f => <Area key={f} name={`f:${f}`} label={f} v={data[f]} rows={2} />)}
          <div className="sm:col-span-2"><SubmitBtn>SAVE CONTINUITY BIBLE</SubmitBtn></div>
        </DirtyForm>
        <form action={copyDefaultsToContinuity} className="mt-3 border-t border-line pt-3"><input type="hidden" name="projectId" value={p.id} /><SubmitBtn className="btn-sm" pendingText="Copying…">Copy production defaults from Settings into “General restrictions”</SubmitBtn></form>
      </Section>
      <Section title="Approved image sequence">
        {approved.length === 0 ? <p className="text-sm text-ink-secondary">No approved images yet.</p> : (
          <div className="flex gap-3 overflow-x-auto pb-2">{approved.map(i => (
            <Link key={i.id} href={`/projects/${p.slug}/images/${i.id}`} className="w-40 shrink-0"><Thumb id={i.approvedAttempt!.assetId} alt={i.title} w={320} /><div className="mt-1 text-xs font-semibold">{imageCode(i.seq)} · {sceneCode(i.scene.order)}</div><div className="truncate text-xs text-ink-secondary">{i.title}</div></Link>
          ))}</div>
        )}
      </Section>
      <Section title="Baby Chef & master references" right={b && <Link href={`/babychefs/${b.id}`} className="btn btn-sm">Open profile</Link>}>
        {b ? <div className="mb-3 text-sm"><b>{b.displayName}</b> — {[b.age, b.appearance, b.outfit].filter(Boolean).join(' · ')}<div className="mt-1 text-ink-secondary">Kitchen: {b.kitchen || '—'}</div></div> : <p className="text-sm text-ink-secondary">No Baby Chef selected.</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">{masters.map(r => <div key={r.id}><Thumb id={r.assetId} alt={r.title} w={320} />{r.isGold && <GoldBadge />}<div className="truncate text-xs">{r.title}</div></div>)}</div>
      </Section>
      <Section title="Ingredient product references">
        {ings.map(i => <div key={i.id} className="mb-3 border-b border-line pb-3 last:border-0"><div className="flex flex-wrap items-center gap-2 font-medium">{i.name} {i.brand && <span className="text-ink-secondary">({i.brand})</span>} {i.importance === 'PACKAGE_CRITICAL' ? <Chip tone="PACKAGE CRITICAL">PACKAGE CRITICAL</Chip> : <Chip>{INGREDIENT_IMPORTANCE[i.importance]}</Chip>}</div>
          <div className="mt-2 flex gap-2">{i.references.map(r => <div key={r.id} className="w-20"><Thumb id={r.assetId} alt={r.title} w={200} /><div className="truncate text-[10px]">{r.category}</div></div>)}</div></div>)}
      </Section>
      <Section title="Food progression" right={<Link href={`/projects/${p.slug}/scenes?view=progression`} className="btn btn-sm">Full view</Link>}>
        <ul className="space-y-1 text-sm">{scenes.map(s => <li key={s.id}><b>{sceneCode(s.order)}</b> {s.title}: <span className="text-ink-secondary">{s.foodBefore || '?'} → {s.foodAfter || '?'}</span></li>)}</ul>
      </Section>
      <Section title="Known corrections">
        {corr.length === 0 ? <p className="text-sm text-ink-secondary">None.</p> : <ul className="space-y-1 text-sm">{corr.map(c => <li key={c.id}><b>{c.title}</b> — {c.correct}</li>)}</ul>}
      </Section>
    </div>
  );
}
