import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { DirtyForm, SubmitBtn, ConfirmForm } from '@/components/client';
import { Area, Check, Chip, Empty, Section, Sel, Text } from '@/components/ui';
import { ReferenceCard, UploadReferenceForm } from '@/components/refs';
import { saveIngredient, deleteIngredient, moveIngredient, quickAddIngredients } from '@/lib/actions/project';
import { ProductPhotoPanel } from '@/components/product-photo-panel';
import { INGREDIENT_IMPORTANCE, INGREDIENT_REF_TYPES } from '@/lib/constants';

function IngForm({ projectId, i }: { projectId: string; i?: any }) {
  return (
    <DirtyForm action={saveIngredient} className="grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="projectId" value={projectId} />{i && <input type="hidden" name="id" value={i.id} />}
      <Text name="name" label="Ingredient *" v={i?.name} required />
      <Text name="quantity" label="Quantity" v={i?.quantity} /><Text name="unit" label="Unit" v={i?.unit} />
      <Text name="prepNote" label="Preparation note" v={i?.prepNote} /><Text name="stage" label="Recipe stage" v={i?.stage} />
      <Sel name="importance" label="On-camera importance" v={i?.importance ?? 'OPTIONAL'} options={Object.entries(INGREDIENT_IMPORTANCE)} />
      <Text name="brand" label="Brand" v={i?.brand} /><Text name="product" label="Specific product" v={i?.product} /><Text name="packageSize" label="Package size" v={i?.packageSize} />
      <div className="flex items-end"><Check name="packageVisible" label="Package visible on camera" v={i?.packageVisible} /></div>
      <Area name="appearance" label="Appearance / texture notes" v={i?.appearance} rows={2} className="sm:col-span-3" />
      <Area name="continuity" label="Continuity notes" v={i?.continuity} rows={2} className="sm:col-span-3" />
      <Area name="notes" label="Additional notes" v={i?.notes} rows={2} className="sm:col-span-3" />
      <div className="sm:col-span-3"><SubmitBtn>{i ? 'SAVE INGREDIENT' : 'ADD INGREDIENT'}</SubmitBtn></div>
    </DirtyForm>
  );
}

export default async function Ingredients({ params, searchParams }: { params: { slug: string }; searchParams: { pick?: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const ings = await db.ingredient.findMany({ where: { projectId: p.id }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }], include: { references: { where: { deletedAt: null }, include: { asset: true, ingredient: true }, orderBy: { createdAt: 'asc' } } } });
  const opts = ings.map(i => ({ id: i.id, label: [i.quantity, i.unit, i.name].filter(Boolean).join(' '), brand: i.brand ?? '', product: i.product ?? '', packageSize: i.packageSize ?? '', importance: i.importance, packageVisible: i.packageVisible, photos: i.references.length }));
  return (
    <div className="space-y-4">
      <Section title="Quick add ingredients"><form action={quickAddIngredients} className="space-y-2"><input type="hidden" name="projectId" value={p.id} />
        <label className="block"><span className="label">Paste or type your ingredients — one per line</span><textarea name="text" rows={5} className="input font-mono text-[13px]" placeholder={'2 cups flour, sifted\n1 can coconut milk | Brand: Grace\n1 tsp salt'} /></label>
        <p className="text-[12px] text-ink-secondary">I’ll split each line into amount, unit, ingredient and note. Add “| Brand: Grace” to a line to save the brand too. You can fix anything afterwards.</p>
        <SubmitBtn pendingText="Adding…">ADD THESE INGREDIENTS</SubmitBtn></form></Section>
      {ings.length > 0 && <Section title="Add a brand, label or product photo"><ProductPhotoPanel projectId={p.id} ings={opts} initial={searchParams.pick} /></Section>}
      <div className="rounded-lg bg-sunken p-3 text-sm"><b>Visual importance:</b> <b>PACKAGE CRITICAL</b> — exact brand/label matters when visible. <b>TEXTURE / APPEARANCE CRITICAL</b> — the real product defines how it should look. <b>OPTIONAL</b> — reference is useful but not required.</div>
      {ings.length === 0 && <Empty title="No ingredients yet." hint="Paste your list above, or add them one at a time." />}
      {ings.map((i, n) => (
        <section key={i.id} className="card">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-ink-secondary">ING-{String(n + 1).padStart(2, '0')}</span>
            <h2>{[i.quantity, i.unit].filter(Boolean).join(' ')} {i.name}</h2>
            {i.importance === 'PACKAGE_CRITICAL' ? <Chip tone="PACKAGE CRITICAL">PACKAGE CRITICAL</Chip> : <Chip>{INGREDIENT_IMPORTANCE[i.importance]}</Chip>}
            {i.packageVisible && <Chip>PACKAGE VISIBLE</Chip>}
            <div className="ml-auto flex gap-1">
              <form action={moveIngredient}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="dir" value="up" /><button className="btn btn-sm" aria-label="Move up">↑</button></form>
              <form action={moveIngredient}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="dir" value="down" /><button className="btn btn-sm" aria-label="Move down">↓</button></form>
            </div>
          </div>
          {i.references.length > 0 && <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{i.references.map(r => <ReferenceCard key={r.id} r={r} cats={INGREDIENT_REF_TYPES} showOrigin={false} />)}</div>}
          <details className="rounded-lg border border-line p-3"><summary className="cursor-pointer text-sm font-semibold">+ Add product photo ({i.references.length})</summary><div className="mt-3"><UploadReferenceForm ingredientId={i.id} mode="ingredient" /></div></details>
          <details className="mt-2 rounded-lg border border-line p-3"><summary className="cursor-pointer text-sm font-semibold">Edit ingredient</summary><div className="mt-3"><IngForm projectId={p.id} i={i} /></div>
            <ConfirmForm action={deleteIngredient} message={`Delete ingredient "${i.name}" and detach its product references?`} className="mt-3"><input type="hidden" name="id" value={i.id} /><button className="btn btn-sm btn-danger">Delete ingredient…</button></ConfirmForm></details>
        </section>
      ))}
      <Section title="Add one ingredient (with all the details)"><IngForm projectId={p.id} /></Section>
    </div>
  );
}
