'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { SubmitBtn } from './client';
import { reorderKlingRefs, removeKlingRef, setKlingStatus } from '@/lib/actions/kling';

export type StripItem = { id: string; tag: string; code: string; title: string; assetId: string | null; approved: boolean; meta: string };

/** Ordered @image reference strip: drag to reorder (↑/↓ buttons for keyboard and touch). */
export function KlingRefStrip({ klingId, items }: { klingId: string; items: StripItem[] }) {
  const [list, setList] = useState(items);
  const [drag, setDrag] = useState<number | null>(null);
  const [, start] = useTransition();
  useEffect(() => setList(items), [items]);
  function commit(next: StripItem[]) { setList(next); start(() => { reorderKlingRefs(klingId, next.map(i => i.id)); }); }
  function move(from: number, to: number) { if (to < 0 || to >= list.length || from === to) return; const n = [...list]; const [x] = n.splice(from, 1); n.splice(to, 0, x); commit(n); }
  if (!list.length) return <p className="text-[13px] text-ink-secondary">No images attached yet. Attach approved images — their order becomes @image1, @image2, …</p>;
  return (
    <ol className="flex gap-3 overflow-x-auto pb-2" aria-label="Reference strip">
      {list.map((it, i) => (
        <li key={it.id} draggable onDragStart={() => setDrag(i)} onDragOver={e => e.preventDefault()} onDrop={() => { if (drag !== null) move(drag, i); setDrag(null); }} onDragEnd={() => setDrag(null)}
          className={`w-[190px] shrink-0 rounded-lg border bg-surface p-2 ${drag === i ? 'border-purple-deep opacity-60' : 'border-purple-mid'}`}>
          <div className="mb-1.5 flex items-center justify-between"><span className="rounded-sm bg-purple-tint px-2 py-1 font-mono text-[12px] font-medium text-purple-deep">@image{i + 1}</span><span className="cursor-grab select-none text-ink-muted" aria-hidden title="Drag to reorder">⋮⋮</span></div>
          {it.assetId ? <img src={`/api/files/${it.assetId}?w=400`} alt={`${it.code} ${it.title}`} className="aspect-video w-full rounded-sm border border-line bg-sunken object-cover" /> : <div className="flex aspect-video items-center justify-center rounded-sm bg-sunken text-xs text-ink-muted">no image</div>}
          <div className="mt-1.5 flex items-center gap-1.5"><span className="font-mono text-[12px] font-medium">{it.code}</span>{it.approved ? <span className="text-[11px] font-semibold text-[#3B6448]">✓ Approved</span> : <span className="text-[11px] font-semibold text-[#8A6216]">⚠ not approved</span>}</div>
          <div className="truncate text-[12px] text-ink-secondary" title={it.title}>{it.title}</div>
          <div className="text-[11px] text-ink-muted">{it.meta}</div>
          <div className="mt-1.5 flex gap-1">
            <button type="button" className="btn btn-sm px-2" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${it.code} earlier`}>←</button>
            <button type="button" className="btn btn-sm px-2" onClick={() => move(i, i + 1)} disabled={i === list.length - 1} aria-label={`Move ${it.code} later`}>→</button>
            <form action={removeKlingRef}><input type="hidden" name="id" value={it.id} /><button className="btn btn-sm btn-danger px-2" aria-label={`Remove ${it.code}`}>✕</button></form>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Collapsible prompt section with ⚠ marker (when a needed section is empty) and a one-line peek. */
export function Collapsible({ index, title, needed = true, children, defaultOpen = false }: { index: number; title: string; needed?: boolean; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [peek, setPeek] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const recompute = () => {
    const vals = [...(ref.current?.querySelectorAll('textarea, input[type=text], input[type=number]') ?? [])].map(e => (e as HTMLInputElement).value.trim()).filter(Boolean);
    setPeek(vals[0]?.replace(/\s+/g, ' ').slice(0, 90) ?? '');
  };
  useEffect(recompute, []);
  const warn = needed && !peek;
  return (
    <div ref={ref} onInput={recompute} className={`rounded-lg border bg-surface ${warn ? 'border-[#E7D3A0]' : 'border-line'}`}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="font-mono text-[12px] text-ink-muted">{String(index).padStart(2, '0')}</span>
        <span className="text-[14px] font-semibold">{title}</span>
        {warn && <span className="rounded-xs bg-[#F8EFD9] px-1.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8A6216]">⚠ check</span>}
        {!open && peek && <span className="hidden min-w-0 flex-1 truncate text-[12px] text-ink-secondary md:block">{peek}</span>}
        <span className="ml-auto text-ink-muted" aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      <div className={open ? 'space-y-3 border-t border-line px-4 py-3' : 'hidden'}>{children}</div>
    </div>
  );
}

/** Pre-flight (protects Kling credits): warnings never block; "Mark fixed" dismisses locally; "Mark ready anyway" sets READY. */
export function PreflightCard({ klingId, warnings, status }: { klingId: string; warnings: string[]; status: string }) {
  const [fixed, setFixed] = useState<Set<string>>(new Set());
  const open = warnings.filter(w => !fixed.has(w));
  return (
    <div className={`rounded-lg border p-4 ${open.length ? 'border-[#E7D3A0] bg-[#F8EFD9]/50' : 'border-sage-mid bg-sage-tint'}`}>
      <div className="mb-2 flex items-center justify-between gap-2"><div><div className="eyebrow">PRE-FLIGHT CHECK</div><div className="text-[12px] text-ink-secondary">Protects Kling credits · warnings never block you</div></div>
        <div className="font-mono text-[12px]">{open.length === 0 ? '✓ all clear' : `${open.length} to review`}</div></div>
      {open.length === 0 && <p className="text-[13px] font-medium text-sage-deep">✓ Nothing left to fix. Ready to copy the Kling prompt.</p>}
      <ul className="space-y-2">
        {open.map(w => (
          <li key={w} className="flex items-start gap-2.5 rounded-md border border-[#E7D3A0] bg-surface p-2.5 text-[13px]">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#C99A3A] text-[11px] font-bold text-white">!</span>
            <span className="flex-1">{w}</span>
            <button type="button" className="btn btn-sm" onClick={() => setFixed(new Set([...fixed, w]))}>Mark fixed</button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        {status !== 'READY' && (
          <form action={setKlingStatus}><input type="hidden" name="id" value={klingId} /><input type="hidden" name="status" value="READY" />
            <SubmitBtn className={open.length ? 'btn-primary' : 'btn-approve'} pendingText="…">{open.length ? 'Mark ready anyway' : 'Mark ready'}</SubmitBtn></form>
        )}
        {status === 'READY' && <span className="chip st-ready">READY</span>}
      </div>
    </div>
  );
}
