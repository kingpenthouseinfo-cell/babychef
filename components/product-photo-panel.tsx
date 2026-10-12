'use client';
import { useState } from 'react';
import { addProductPhoto } from '@/lib/actions/project';
import { SubmitBtn } from './client';
import { INGREDIENT_IMPORTANCE, INGREDIENT_REF_TYPES } from '@/lib/constants';

export type IngOpt = { id: string; label: string; brand: string; product: string; packageSize: string; importance: string; packageVisible: boolean; photos: number };

/** One place to give a product's brand, label details and photo: choose any ingredient from the recipe first. */
export function ProductPhotoPanel({ projectId, ings, initial }: { projectId: string; ings: IngOpt[]; initial?: string }) {
  const [id, setId] = useState(initial || '');
  const cur = ings.find(i => i.id === id);
  return (
    <form action={addProductPhoto} className="space-y-3" key={id}>
      <input type="hidden" name="projectId" value={projectId} /><input type="hidden" name="ingredientId" value={id} /><input type="hidden" name="_pv" value="1" />
      <label className="block"><span className="label">Which ingredient?</span>
        <select className="input" value={id} onChange={e => setId(e.target.value)} aria-label="Which ingredient?">
          <option value="">— choose an ingredient from your recipe —</option>
          {ings.map(i => <option key={i.id} value={i.id}>{i.label}{i.photos ? ` ✓ ${i.photos} photo${i.photos > 1 ? 's' : ''}` : ''}</option>)}
        </select></label>
      {cur ? (<>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block"><span className="label">Brand</span><input name="brand" className="input" defaultValue={cur.brand} placeholder="e.g. Grace" /></label>
          <label className="block"><span className="label">Exact product / label name</span><input name="product" className="input" defaultValue={cur.product} placeholder="e.g. Coconut Milk, Original" /></label>
          <label className="block"><span className="label">Package size</span><input name="packageSize" className="input" defaultValue={cur.packageSize} placeholder="e.g. 13.5 oz can" /></label>
          <label className="block"><span className="label">How much does it matter on camera?</span><select name="importance" className="input" defaultValue={cur.importance}>{Object.entries(INGREDIENT_IMPORTANCE).map(([k, v]) => <option key={k} value={k}>{k === 'PACKAGE_CRITICAL' ? 'Package must look exactly right' : k === 'TEXTURE_CRITICAL' ? 'Texture / look matters' : 'Not important'}</option>)}</select></label>
          <label className="flex items-end gap-2 pb-2 text-[13px]"><input type="checkbox" name="packageVisible" defaultChecked={cur.packageVisible} className="accent-[#4C6B52]" /> The package appears on camera</label>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block sm:col-span-2"><span className="label">Product photo (front label, back label, the food itself…)</span><input type="file" name="file" accept="image/png,image/jpeg,image/webp,image/gif" className="input" /></label>
          <label className="block"><span className="label">What is in the photo?</span><select name="category" className="input">{INGREDIENT_REF_TYPES.map(c => <option key={c}>{c}</option>)}</select></label>
          <label className="block"><span className="label">Title (optional)</span><input name="title" className="input" placeholder="e.g. Front label" /></label>
        </div>
        <SubmitBtn pendingText="Saving…">SAVE & ADD PRODUCT PHOTO</SubmitBtn>
      </>) : <p className="text-[13px] text-ink-secondary">Pick an ingredient to add its brand, label details and photo.</p>}
    </form>
  );
}
