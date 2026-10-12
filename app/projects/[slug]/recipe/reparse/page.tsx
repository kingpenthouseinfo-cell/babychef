import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { parseRecipeText } from '@/lib/recipe-parse';
import { reparseRecipe } from '@/lib/actions/recipe';
import { SubmitBtn } from '@/components/client';

export const dynamic = 'force-dynamic';

export default async function Reparse({ params }: { params: { slug: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const text = (p.recipeOriginal || p.recipeAdapted || '').trim();
  const rp = parseRecipeText(text);
  const have = await db.ingredient.count({ where: { projectId: p.id } });
  const b = `/projects/${p.slug}`;
  return (
    <div className="max-w-[860px] space-y-4">
      <div><div className="eyebrow">RE-PARSE RECIPE</div><h1 className="text-[32px]">Fix the recipe sections</h1>
        <p className="mt-1 text-[14px] text-ink-secondary">I re-read the recipe text you saved and split it into title, yield, ingredient groups and method sections. Nothing is deleted, and your original text stays as it is.</p></div>
      {!text ? <div className="card text-[14px]">There is no saved recipe text yet. <Link className="font-semibold underline" href={`${b}/fill`}>Fill from text</Link></div> : (
        <section className="card space-y-3" aria-label="What I found">
          <div className="eyebrow">FOUND</div>
          <dl className="grid grid-cols-2 gap-3 text-[14px] sm:grid-cols-5">
            <div><dt className="text-ink-secondary">Title</dt><dd className="font-semibold">{rp.title || '—'}</dd></div>
            <div><dt className="text-ink-secondary">Yield</dt><dd className="font-semibold">{rp.yield || '—'}</dd></div>
            <div><dt className="text-ink-secondary">Ingredient groups</dt><dd className="font-semibold">{rp.counts.groups}</dd></div>
            <div><dt className="text-ink-secondary">Ingredients</dt><dd className="font-semibold">{rp.counts.ingredients}</dd></div>
            <div><dt className="text-ink-secondary">Method sections</dt><dd className="font-semibold">{rp.counts.sections} · {rp.counts.steps} steps</dd></div>
          </dl>
          {(rp.suspicious || rp.warnings.length > 0) && <div className="rounded-lg border border-[#E7D3A0] bg-[#F8EFD9] p-3 text-[13px] text-[#6F4E10]">⚠ This recipe may not have been separated correctly.{rp.warnings.map((w, i) => <div key={i}>{w}</div>)}<Link className="mt-1 inline-block font-semibold underline" href={`${b}/fill`}>View format help</Link></div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div><div className="eyebrow">INGREDIENTS</div>{rp.groups.map(g => <div key={g.name} className="mt-2"><div className="text-[13px] font-semibold">{g.name}</div><ul className="list-disc pl-5 text-[13px] text-ink-secondary">{g.items.map((i, n) => <li key={n}>{i.original}</li>)}</ul></div>)}</div>
            <div><div className="eyebrow">METHOD</div>{rp.sections.map(s => <div key={s.title} className="mt-2"><div className="text-[13px] font-semibold">{s.title}</div><ol className="list-decimal pl-5 text-[13px] text-ink-secondary">{s.steps.map((t, n) => <li key={n}>{t}</li>)}</ol></div>)}</div>
          </div>
          <div className="text-[12.5px] text-ink-secondary">{have > 0 ? `You already have ${have} ingredient${have === 1 ? '' : 's'}; only the missing ones will be added.` : 'No ingredients are saved yet; they will all be created.'}</div>
          <form action={reparseRecipe} className="flex flex-wrap gap-2"><input type="hidden" name="projectId" value={p.id} /><SubmitBtn className="btn btn-approve" pendingText="Fixing…" >{rp.counts.ingredients + rp.counts.steps === 0 ? 'NOTHING TO FIX' : 'FIX RECIPE SECTIONS'}</SubmitBtn><Link className="btn" href={`${b}/recipe`}>Cancel</Link></form>
        </section>
      )}
    </div>
  );
}
