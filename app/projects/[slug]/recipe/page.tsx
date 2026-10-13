import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { DirtyForm, SubmitBtn, CopyButton } from '@/components/client';
import { Area, Section, Text } from '@/components/ui';
import { saveRecipe } from '@/lib/actions/project';
import { fmtDate } from '@/lib/util';
import Link from 'next/link';
import { fileUrl } from '@/components/ui';
import { quickAddIngredients, deleteIngredient } from '@/lib/actions/project';
import { ConfirmForm } from '@/components/client';
import { ProductPhotoPanel } from '@/components/product-photo-panel';
import { loadMethod } from '@/lib/recipe-store';
import { effectiveCode } from '@/lib/project-code';

export default async function Recipe({ params }: { params: { slug: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const versions = await db.recipeVersion.findMany({ where: { projectId: p.id }, orderBy: { version: 'desc' } });
  const ings = await db.ingredient.findMany({ where: { projectId: p.id }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }], include: { references: { where: { deletedAt: null }, include: { asset: true }, orderBy: { createdAt: 'asc' } } } });
  const opts = ings.map(i => ({ id: i.id, label: [i.quantity, i.unit, i.name].filter(Boolean).join(' '), brand: i.brand ?? '', product: i.product ?? '', packageSize: i.packageSize ?? '', importance: i.importance, packageVisible: i.packageVisible, photos: i.references.length }));
  const withPhotos = ings.filter(i => i.references.length > 0);
  const sections = await loadMethod(p.id);
  const hasText = !!(p.recipeAdapted || p.recipeOriginal || '').trim();
  const fact = (label: string, value: string | null | undefined, ask?: string) => <div><div className="text-[13px] text-ink-secondary">{label}</div>{value ? <div className="mt-1 font-medium">{value}</div> : <Link href={`/projects/${p.slug}/questions`} className="mt-1 block font-semibold text-[#8E6720]">{ask ?? 'Answer in Missing Info'}</Link>}</div>;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
    <div className="space-y-5">
      <section className="rounded-[18px] border p-6" style={{ background: 'linear-gradient(135deg,#EAF4EC,#F1F7E8)', borderColor: '#CFE3D3' }}>
        <div className="flex items-center justify-between gap-3"><h2 className="text-[26px]">Recipe</h2><Link href={`/projects/${p.slug}/fill`} className="btn btn-sm">Fill from text</Link></div>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">{fact('Cuisine', p.cuisine, 'Add cuisine')}{fact('Makes', p.recipeYield)}{fact('Total time', [p.prepTime, p.cookTime].filter(Boolean).join(' + ') || null)}{fact('Source', p.recipeSource, 'Add source')}</div>
      </section>
      <section className="card">
        <div className="flex items-baseline justify-between"><h2 className="text-[24px]">Ingredients</h2><span className="text-[13px] text-ink-secondary">{ings.length}</span></div>
        <form action={quickAddIngredients} className="mt-4 flex gap-2"><input type="hidden" name="projectId" value={p.id} /><input name="text" aria-label="Quick add ingredient" className="input" placeholder="Quick add — e.g. 1 lb ground beef" /><SubmitBtn className="btn-primary" pendingText="Adding…">Add</SubmitBtn></form>
        <ul className="mt-3 divide-y divide-line">
          {ings.length === 0 && <li className="py-4 text-[14px] text-ink-secondary">No ingredients yet — add one above, or use Fill from text.</li>}
          {ings.map((i, n) => (
            <li key={i.id} className="py-2.5">
              {i.group && (n === 0 || ings[n - 1].group !== i.group) && <div className="eyebrow pb-2 pt-1" data-testid="ing-group">{i.group}</div>}
              <details>
                <summary className="flex cursor-pointer list-none items-center gap-4 text-[14.5px]">
                  <span className="w-20 shrink-0 text-ink-secondary">{[i.quantity, i.unit].filter(Boolean).join(' ')}</span>
                  <span className="min-w-0 flex-1"><b className="font-semibold">{i.name}</b>{i.brand && <span className="text-ink-secondary"> {i.brand}</span>}{i.prepNote && <span className="text-ink-secondary"> {i.prepNote}</span>}</span>
                  {i.references.length > 0 && <span className="hidden rounded-full bg-[#E6EEE3] px-2.5 py-0.5 text-[12px] font-semibold text-[#46704F] sm:inline">{i.brand ? `${i.brand} · ` : ''}photo ✓</span>}
                  <span className="shrink-0 text-[13px] font-semibold text-blue-deep">Brand / product info</span>
                </summary>
                <div className="mt-3 rounded-2xl border border-line bg-[#FAF9FC] p-4"><ProductPhotoPanel projectId={p.id} ings={[opts[n]]} initial={i.id} fixed /><ConfirmForm action={deleteIngredient} message={`Delete ingredient "${i.name}"? Its product photos are unlinked, not erased.`} className="mt-3"><input type="hidden" name="id" value={i.id} /><button className="btn btn-sm btn-danger">Delete ingredient</button></ConfirmForm></div>
              </details>
            </li>
          ))}
        </ul>
        <div className="mt-3"><Link href={`/projects/${p.slug}/ingredients`} className="text-[13px] font-semibold text-blue-deep">Open the full ingredients list →</Link></div>
      </section>
      {sections && sections.length > 0 ? (
        <section className="card" aria-label="Method"><h2 className="text-[24px]">Method</h2>
          {sections.map((sec, si) => (
            <div key={si} className="mt-4" data-testid="method-section"><h3 className="eyebrow">{sec.title}</h3>
              <ol className="mt-1 divide-y divide-line">{sec.steps.map((l, i) => <li key={i} className="flex gap-4 py-3 text-[14.5px]"><span className="w-6 shrink-0 font-serif text-[20px] leading-none text-blue-deep">{i + 1}</span><span>{l}</span></li>)}</ol></div>
          ))}
        </section>
      ) : hasText ? (
        <section className="card" aria-label="Method"><h2 className="text-[24px]">Method</h2>
          <p className="mt-2 text-[14px] text-ink-secondary">Method could not be separated from the pasted recipe.</p>
          <Link href={`/projects/${p.slug}/recipe/reparse`} className="btn btn-approve mt-3 inline-flex">RE-PARSE RECIPE</Link>
        </section>
      ) : null}
      <details className="card"><summary className="cursor-pointer text-[15px] font-semibold">Edit the recipe</summary><div className="mt-4">
      <Section title={`Recipe (version ${p.recipeVersion})`} right={<span className="flex items-center gap-3"><a href={`/projects/${p.slug}/fill`} className="btn btn-sm btn-copy-secondary">FILL FROM TEXT</a><span className="text-xs text-ink-secondary">Last modified {fmtDate(p.updatedAt)}</span></span>}>
        <DirtyForm action={saveRecipe} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={p.id} />
          <Text name="recipeName" label="Recipe title" v={p.recipeName} />
          <Text name="code" label="Short code for file names (2–5 letters)" v={effectiveCode(p)} />
          <Text name="cuisine" label="Cuisine" v={p.cuisine} />
          <Text name="recipeSource" label="Source" v={p.recipeSource} />
          <Text name="recipeYield" label="Yield / servings" v={p.recipeYield} />
          <Text name="prepTime" label="Preparation time" v={p.prepTime} />
          <Text name="cookTime" label="Cooking time" v={p.cookTime} />
          <Area name="recipeOriginal" label="Original recipe text" v={p.recipeOriginal} rows={14} className="sm:col-span-2" mono />
          <Area name="recipeAdapted" label="Adapted recipe text" v={p.recipeAdapted} rows={14} className="sm:col-span-2" mono />
          <Area name="recipeNotes" label="Notes" v={p.recipeNotes} className="sm:col-span-2" />
          <div className="flex flex-wrap gap-2 sm:col-span-2"><SubmitBtn>SAVE</SubmitBtn><CopyButton text={p.recipeAdapted || p.recipeOriginal || ''} label="COPY RECIPE" /></div>
        </DirtyForm>
      </Section>
      {versions.length > 0 && (
        <Section title="Previous recipe versions">
          {versions.map(v => <details key={v.id} className="border-b border-line py-2"><summary className="cursor-pointer text-sm font-medium">Version {v.version} · {fmtDate(v.createdAt)}</summary><pre className="mono mt-2 whitespace-pre-wrap">{v.adapted || v.original}</pre></details>)}
        </Section>
      )}
      </div></details>
    </div>
    <aside className="space-y-4">
      <section className="card"><h2 className="text-[22px]">Product Details</h2><p className="mt-2 text-[13px] text-ink-secondary">Product photos are added to every picture that shows the product.</p>
        <ul className="mt-4 space-y-3">{withPhotos.length === 0 && <li className="text-[13px] text-ink-secondary">No product photos yet. Open “Brand / product info” on an ingredient to add one.</li>}{withPhotos.map(i => <li key={i.id} className="flex items-center gap-3"><img src={fileUrl(i.references[0].asset.id, 120)} alt="" className="h-[52px] w-[52px] rounded-xl object-cover" /><span className="text-[14px]"><b className="block font-semibold">{[i.brand, i.name].filter(Boolean).join(' ')}</b><span className="text-[12.5px] text-ink-secondary">{i.references.length} photo{i.references.length > 1 ? 's' : ''}</span></span></li>)}</ul>
      </section>
    </aside>
    </div>
  );
}
