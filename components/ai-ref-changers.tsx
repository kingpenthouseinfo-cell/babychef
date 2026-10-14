'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setAiRef, addAiExtra, removeAiExtra } from '@/lib/actions/ai-refs';

type Opts = { images: { value: string; label: string }[]; refs: { value: string; label: string }[] };

/** CHANGE (before / after) and + ADD EXTRA REFERENCE. Plain buttons (not forms) so they work inside the batch-selection form on the Images page. */
export function AiRefChangers({ imageId, extras, opts }: { imageId: string; extras: { key: string; title: string }[]; opts: Opts }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [prev, setPrev] = useState(''), [next, setNext] = useState(''), [extra, setExtra] = useState('');
  const run = (fn: (fd: FormData) => Promise<void>, data: Record<string, string>) => start(async () => { const fd = new FormData(); fd.set('imageId', imageId); for (const [k, v] of Object.entries(data)) fd.set(k, v); await fn(fd); router.refresh(); });
  const sel = 'input h-9 min-w-[160px] max-w-[260px] text-[12.5px]';
  const others = opts.images.filter(o => o.value !== imageId);
  return (
    <div className="mt-2 space-y-2">
      {([['previous', 'CHANGE BEFORE', prev, setPrev], ['next', 'CHANGE AFTER', next, setNext]] as const).map(([w, label, val, set]) => (
        <div key={w} className="flex flex-wrap items-center gap-2"><span className="w-24 text-[12px] font-semibold">{label}</span>
          <select className={sel} aria-label={`Change ${w} reference`} value={val} onChange={e => set(e.target.value)}><option value="">Automatic (closest approved)</option>{others.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          <button type="button" className="btn btn-sm" disabled={pending} onClick={() => run(setAiRef, { which: w, pick: val })}>CHANGE</button></div>
      ))}
      <div className="flex flex-wrap items-center gap-2"><span className="w-24 text-[12px] font-semibold">+ ADD EXTRA</span>
        <select className={sel} aria-label="Add extra reference" value={extra} onChange={e => setExtra(e.target.value)}><option value="">Choose a picture…</option>
          <optgroup label="Approved pictures">{others.map(o => <option key={o.value} value={`img:${o.value}`}>{o.label}</option>)}</optgroup>
          {opts.refs.length > 0 && <optgroup label="Reference pictures">{opts.refs.map(o => <option key={o.value} value={`ref:${o.value}`}>{o.label}</option>)}</optgroup>}</select>
        <button type="button" className="btn btn-sm" disabled={pending || !extra} onClick={() => { run(addAiExtra, { pick: extra }); setExtra(''); }}>+ ADD EXTRA REFERENCE</button></div>
      {extras.map(r => <div key={r.key} className="flex items-center gap-2 text-[12px]"><span>Extra: {r.title}</span><button type="button" className="btn btn-sm btn-ghost" disabled={pending} aria-label={`Remove extra ${r.title}`} onClick={() => run(removeAiExtra, { key: r.key })}>✕ remove</button></div>)}
    </div>
  );
}
