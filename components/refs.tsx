import Link from 'next/link';
import { BigImage, Chip, Field, GoldBadge, Text, Area, Sel, Check } from './ui';
import { SubmitBtn, ConfirmForm } from './client';
import { updateReference, toggleGold, replaceReference, deleteReference, uploadReference } from '@/lib/actions/babychef';
import { ratioLabel } from '@/lib/util';
import { REF_CATEGORIES, PROJECT_REF_CATEGORIES, INGREDIENT_REF_TYPES } from '@/lib/constants';

export function ReferenceCard({ r, cats, showOrigin = true }: { r: any; cats: string[]; showOrigin?: boolean }) {
  const a = r.asset;
  const origin = r.kind === 'MASTER' ? `Baby Chef master${r.babyChef ? ': ' + r.babyChef.displayName : ''}` : r.kind === 'INGREDIENT' ? `Ingredient${r.ingredient ? ': ' + r.ingredient.name : ''}` : `Project upload${r.project ? ': ' + r.project.title : ''}`;
  return (
    <div className={`card flex flex-col gap-2 ${!r.active ? 'opacity-60' : ''}`}>
      <BigImage id={a.id} alt={a.altText || r.title} />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-xs text-ink-secondary">{r.code}</span>
        {r.isGold && <GoldBadge />}
        {!r.active && <Chip>INACTIVE</Chip>}
        {r.ingredient?.importance === 'PACKAGE_CRITICAL' && <Chip tone="PACKAGE CRITICAL">PACKAGE CRITICAL</Chip>}
      </div>
      <div className="font-semibold leading-tight">{r.title}</div>
      <div className="text-xs text-ink-secondary">{r.category}{showOrigin && <> · {origin}</>} · v{r.version}</div>
      <div className="break-all text-[11px] text-ink-secondary" title={a.originalName}>{a.displayName}</div>
      <div className="text-[11px] text-ink-secondary">{a.orientation}{a.width ? ` · ${a.width}×${a.height} (${ratioLabel(a.width, a.height)})` : ''}</div>
      {r.notes && <p className="text-sm text-ink-secondary">{r.notes}</p>}
      <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
        <form action={toggleGold}><input type="hidden" name="id" value={r.id} /><SubmitBtn className="btn-sm" pendingText="…">{r.isGold ? '★ Un-gold' : '☆ Gold'}</SubmitBtn></form>
        <a className="btn btn-sm" href={`/api/files/${a.id}?download=1`}>Download</a>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-ink-secondary">Edit / replace / delete</summary>
        <form action={updateReference} className="mt-2 space-y-2">
          <input type="hidden" name="id" value={r.id} />
          <Text name="title" label="Title" v={r.title} />
          <Sel name="category" label="Category" v={r.category} options={cats.includes(r.category) ? cats : [r.category, ...cats]} />
          <Area name="description" label="Description" v={r.description} rows={2} />
          <Area name="notes" label="Notes" v={r.notes} rows={2} />
          <div className="flex gap-4"><Check name="isGold" label="Gold Standard" v={r.isGold} /><Check name="active" label="Active" v={r.active} /></div>
          <SubmitBtn className="btn-sm btn-primary">Save</SubmitBtn>
        </form>
        <form action={replaceReference} className="mt-3 space-y-2 border-t border-line pt-2">
          <input type="hidden" name="id" value={r.id} />
          <Field label="Replace image (old file stays in the folder as the previous version)"><input type="file" name="file" accept="image/*" required className="input" /></Field>
          <SubmitBtn className="btn-sm" pendingText="Uploading…">Replace</SubmitBtn>
        </form>
        <ConfirmForm action={deleteReference} message={`Delete reference ${r.code} "${r.title}"? It will be removed from any image it is attached to.`} className="mt-3 border-t border-line pt-2">
          <input type="hidden" name="id" value={r.id} /><button className="btn btn-sm btn-danger">Delete…</button>
        </ConfirmForm>
      </details>
    </div>
  );
}

export function UploadReferenceForm({ babyChefId, projectId, ingredientId, mode }: { babyChefId?: string | null; projectId?: string | null; ingredientId?: string | null; mode: 'master' | 'project' | 'ingredient' }) {
  const cats = mode === 'ingredient' ? INGREDIENT_REF_TYPES : mode === 'project' ? PROJECT_REF_CATEGORIES : REF_CATEGORIES;
  return (
    <form action={uploadReference} className="space-y-2">
      {babyChefId && <input type="hidden" name="babyChefId" value={babyChefId} />}
      {projectId && <input type="hidden" name="projectId" value={projectId} />}
      {ingredientId && <input type="hidden" name="ingredientId" value={ingredientId} />}
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Image file (copied into your folder)"><input type="file" name="file" accept="image/*" required className="input" /></Field>
        <Text name="title" label="Title" placeholder={mode === 'ingredient' ? 'e.g. Front label' : 'e.g. Master face'} />
        <Sel name="category" label={mode === 'ingredient' ? 'Reference type' : 'Category'} options={cats} />
        <Text name="notes" label="Notes" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {mode !== 'ingredient' ? <Check name="isGold" label="Mark as Gold Standard" /> : <span />}
        <SubmitBtn pendingText="Uploading…">Add reference</SubmitBtn>
      </div>
    </form>
  );
}
