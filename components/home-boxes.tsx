'use client';
import Link from 'next/link';
import { useState } from 'react';
import { createFromHome } from '@/lib/actions/project';
import { addChefOrKitchen } from '@/lib/actions/babychef';
import { SubmitBtn } from './client';

export function StartNewVideo({ chefs }: { chefs: { id: string; name: string }[] }) {
  return (
    <form action={createFromHome} className="rounded-[16px] border p-6" style={{ background: 'linear-gradient(135deg,#EAF4EC 0%,#F1F7E8 100%)', borderColor: '#CFE3D3', boxShadow: '0 14px 34px -28px rgba(40,36,60,.4)' }}>
      <h2 className="text-[26px]">Start a new video</h2>
      <textarea name="recipe" rows={5} aria-label="Paste a recipe" placeholder="Paste a recipe…" className="input mt-4 !rounded-xl" />
      <select name="babyChefId" aria-label="Baby Chef" className="input mt-3 !rounded-xl">{chefs.length === 0 && <option value="">No Baby Chef yet</option>}{chefs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <SubmitBtn className="btn-approve mt-3 min-h-[46px] w-full" pendingText="Creating…">Create video</SubmitBtn>
      <div className="mt-3 text-center"><Link href="/projects/new" className="text-[13px] font-medium text-ink-secondary hover:text-ink">More options</Link></div>
    </form>
  );
}

export function AddChefOrKitchen({ chefs }: { chefs: { id: string; name: string }[] }) {
  const [kind, setKind] = useState<'chef' | 'kitchen'>('chef');
  const [n, setN] = useState(0);
  return (
    <form action={addChefOrKitchen} className="rounded-[16px] border p-6" style={{ background: 'linear-gradient(135deg,#FDECF1 0%,#F9EEF7 100%)', borderColor: '#F0CDDA', boxShadow: '0 14px 34px -28px rgba(40,36,60,.4)' }}>
      <h2 className="text-[26px]">Add a Baby Chef or kitchen</h2>
      <input type="hidden" name="kind" value={kind} />
      <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl border border-line-strong bg-white p-1" role="tablist" aria-label="What to add">
        {(['chef', 'kitchen'] as const).map(k => <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={`h-9 rounded-lg text-[14px] font-semibold ${kind === k ? 'bg-[#FBE9F0] text-[#7A2E48] shadow-sm' : 'text-ink-secondary'}`}>{k === 'chef' ? 'Baby Chef' : 'Kitchen'}</button>)}
      </div>
      {kind === 'kitchen' && <select name="babyChefId" aria-label="Which Baby Chef cooks here?" className="input mt-3 !rounded-xl">{chefs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
      <input name="name" aria-label="Name" required placeholder={kind === 'chef' ? 'Baby Chef name — e.g. Mexican Baby Chef' : 'Kitchen name — e.g. Island Kitchen'} className="input mt-3 !rounded-xl" />
      {kind === 'chef' && (
        <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#D9B9C8] bg-white/60 px-4 py-6 text-center text-[13px] text-ink-secondary">
          <b className="text-[14px] text-[#7A2E48]">Drop example pictures</b>
          <span>or <u className="font-semibold text-[#7A2E48]">add from computer</u> · they stay on this Mac{n ? ` · ${n} chosen` : ''}</span>
          <input type="file" name="files" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={e => setN(e.target.files?.length ?? 0)} />
        </label>
      )}
      <SubmitBtn className="btn-accent mt-3 min-h-[46px] w-full" pendingText="Adding…">{kind === 'chef' ? 'Add Baby Chef' : 'Add kitchen'}</SubmitBtn>
    </form>
  );
}
