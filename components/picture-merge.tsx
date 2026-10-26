'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { mergePictures, unmergePictures, unmergeOne } from '@/lib/actions/pictures';

/** Merge the other steps of a scene into this picture (you only need the photo for this one). Plain buttons so it works inside the batch form. */
export function PictureMerge({ imageId, siblings, merged }: { imageId: string; siblings: { id: string; label: string }[]; merged: { id: string; label: string }[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [pick, setPick] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const run = (fn: (fd: FormData) => Promise<void>, ids: string[]) => start(async () => { try { setErr(''); const fd = new FormData(); fd.set('keepId', imageId); ids.forEach(i => fd.append('otherIds', i)); await fn(fd); setPick([]); router.refresh(); } catch (e: any) { setErr(e?.message || 'That did not work.'); } });
  return (
    <div className="text-[12.5px]" data-testid="merge-box">
      {merged.length > 0 && (
        <div className="mb-1 rounded-md bg-[#EAF6EE] px-2 py-1.5" data-testid="merged-note">
          <b className="text-[#166534]">Also covers:</b> {merged.map(m => m.label).join(', ')}
          <button type="button" className="ml-2 font-semibold text-blue-deep hover:underline" disabled={busy} data-testid="unmerge" onClick={() => run(unmergePictures, [])}>Undo merge</button>
        </div>
      )}
      {siblings.length > 0 && (
        <details>
          <summary className="cursor-pointer font-semibold text-ink-secondary">Merge steps into this picture</summary>
          <div className="mt-2 space-y-1.5">
            <p className="text-ink-secondary">Tick the pictures you don’t need a separate photo for. They stay in your plan (nothing is deleted); this picture will say which steps it covers.</p>
            {siblings.map(s => <label key={s.id} className="flex items-center gap-2"><input type="checkbox" checked={pick.includes(s.id)} onChange={e => setPick(p => e.target.checked ? [...p, s.id] : p.filter(x => x !== s.id))} data-testid="merge-pick" /> {s.label}</label>)}
            <button type="button" className="btn btn-sm" disabled={busy || !pick.length} data-testid="merge-go" onClick={() => run(mergePictures, pick)}>MERGE {pick.length || ''} INTO THIS PICTURE</button>
            {err && <div className="text-red-700">{err}</div>}
          </div>
        </details>
      )}
    </div>
  );
}

/** Small, closed-by-default list of pictures that were merged away, with a button to add one back. */
export function MergedBack({ items }: { items: { id: string; label: string; into: string }[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  if (!items.length) return null;
  return (
    <details className="mt-2 text-[12.5px] text-ink-secondary" data-testid="merged-back">
      <summary className="cursor-pointer font-semibold">Merged pictures ({items.length}) — add one back</summary>
      <ul className="mt-1 space-y-1">
        {items.map(m => (
          <li key={m.id} className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1 truncate">{m.label} <span className="text-ink-muted">· merged into {m.into}</span></span>
            <button type="button" className="btn btn-sm" disabled={busy} data-testid="merged-add-back" onClick={() => start(async () => { const fd = new FormData(); fd.set('id', m.id); await unmergeOne(fd); router.refresh(); })}>Add back</button></li>
        ))}
      </ul>
    </details>
  );
}
