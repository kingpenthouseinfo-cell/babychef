import { db } from '@/lib/db';
import { Area, Empty, PageHeader, Chip, Sel, Text, Field, Section } from '@/components/ui';
import { SubmitBtn, ConfirmForm } from '@/components/client';
import { saveCorrection, deleteCorrection } from '@/lib/actions/babychef';
import { CORRECTION_CATEGORIES, SEVERITIES } from '@/lib/constants';
import { BigImage } from '@/components/ui';
import { fmtDay } from '@/lib/util';

export default async function Corrections({ searchParams }: { searchParams: { chef?: string; q?: string } }) {
  const [list, chefs, projects] = await Promise.all([
    db.correction.findMany({ include: { asset: true, babyChef: true, project: true }, orderBy: { createdAt: 'desc' } }),
    db.babyChef.findMany({ where: { deletedAt: null }, orderBy: { displayName: 'asc' } }),
    db.project.findMany({ where: { deletedAt: null }, orderBy: { title: 'asc' } }),
  ]);
  const q = (searchParams.q || '').toLowerCase();
  const rows = list.filter(c => (!searchParams.chef || c.babyChefId === searchParams.chef) && (!q || `${c.title} ${c.wrong} ${c.correct} ${c.ingredient} ${c.action}`.toLowerCase().includes(q)));
  return (
    <>
      <PageHeader title="Corrections / Don't Do This" sub="Learn from failed generations. Reference these while writing prompts." />
      <form className="mb-4 flex flex-wrap gap-2"><input name="q" defaultValue={searchParams.q} placeholder="Search corrections…" className="input max-w-xs" aria-label="Search corrections" />
        <select name="chef" defaultValue={searchParams.chef || ''} className="input max-w-[200px]" aria-label="Filter by Baby Chef"><option value="">All Baby Chefs</option>{chefs.map(c => <option key={c.id} value={c.id}>{c.displayName}</option>)}</select>
        <button className="btn">Filter</button></form>
      <details className="card mb-6" open={list.length === 0}><summary className="cursor-pointer font-semibold">+ Add correction</summary>
        <form action={saveCorrection} className="mt-3 grid gap-3 sm:grid-cols-2">
          <Text name="title" label="Title *" required placeholder="Too much oil in pan" />
          <Sel name="category" label="Category" options={CORRECTION_CATEGORIES} />
          <Area name="wrong" label="What went wrong" />
          <Area name="correct" label="What it SHOULD look like" />
          <Sel name="babyChefId" label="Applicable Baby Chef" options={[['', '— any —'], ...chefs.map(c => [c.id, c.displayName] as [string, string])]} />
          <Sel name="projectId" label="Applicable project" options={[['', '— any —'], ...projects.map(c => [c.id, c.title] as [string, string])]} />
          <Text name="ingredient" label="Applicable ingredient" placeholder="e.g. sunflower oil" />
          <Text name="action" label="Applicable cooking action" placeholder="e.g. tempering" />
          <Sel name="severity" label="Severity" v="MEDIUM" options={SEVERITIES} />
          <Field label="Bad image (optional)"><input type="file" name="file" accept="image/*" className="input" /></Field>
          <div className="sm:col-span-2"><SubmitBtn>Add correction</SubmitBtn></div>
        </form></details>
      {rows.length === 0 ? <Empty title="No corrections yet." hint="When an image fails, record what went wrong and what it should look like." /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map(c => (
            <div key={c.id} className="card flex gap-3">
              {c.asset && <div className="w-28 shrink-0"><BigImage id={c.asset.id} alt={c.title} /></div>}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5"><span className="font-mono text-xs text-neutral-500">{c.code}</span><Chip tone={c.severity === 'HIGH' ? 'HIGH' : undefined}>{c.severity}</Chip><span className="text-xs text-neutral-500">{c.category}</span></div>
                <div className="font-semibold">{c.title}</div>
                {c.wrong && <p className="text-sm"><b className="text-red-700">Wrong:</b> {c.wrong}</p>}
                {c.correct && <p className="text-sm"><b className="text-green-800">Should be:</b> {c.correct}</p>}
                <div className="text-xs text-neutral-500">{[c.babyChef?.displayName, c.project?.title, c.ingredient, c.action].filter(Boolean).join(' · ')} · {fmtDay(c.createdAt)}</div>
                <ConfirmForm action={deleteCorrection} message={`Delete correction ${c.code}?`}><input type="hidden" name="id" value={c.id} /><button className="btn btn-sm btn-danger">Delete</button></ConfirmForm>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
