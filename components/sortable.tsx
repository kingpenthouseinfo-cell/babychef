'use client';
import { useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/** Drag to reorder. Direct children carrying data-sort-id can be dragged by their [data-handle]. Nothing moves until you drop; then the new order is saved. */
export function Sortable({ className, children, onSave }: { className?: string; children: React.ReactNode; onSave: (ids: string[]) => Promise<void> }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [, start] = useTransition();
  useEffect(() => {
    const root = ref.current; if (!root) return;
    let drag: HTMLElement | null = null, over: HTMLElement | null = null, after = false;
    const items = () => [...root.children].filter(c => (c as HTMLElement).dataset.sortId) as HTMLElement[];
    const clear = () => items().forEach(i => i.style.boxShadow = '');
    const down = (e: Event) => { const h = (e.target as HTMLElement).closest('[data-handle]'); const it = h?.closest('[data-sort-id]') as HTMLElement | null; if (h && it && it.parentElement === root) it.draggable = true; };
    const start_ = (e: DragEvent) => { const it = (e.target as HTMLElement).closest('[data-sort-id]') as HTMLElement | null; if (!it || it.parentElement !== root) return; drag = it; e.dataTransfer?.setData('text/plain', it.dataset.sortId || ''); if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; };
    const dover = (e: DragEvent) => {
      if (!drag) return; e.preventDefault(); clear();
      const el = (e.target as HTMLElement).closest('[data-sort-id]') as HTMLElement | null;
      if (!el || el.parentElement !== root || el === drag) { over = null; return; }
      const r = el.getBoundingClientRect(); const horizontal = getComputedStyle(root).display === 'grid';
      after = horizontal ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2; over = el;
      el.style.boxShadow = horizontal ? (after ? 'inset -3px 0 0 #3E6290' : 'inset 3px 0 0 #3E6290') : (after ? 'inset 0 -3px 0 #3E6290' : 'inset 0 3px 0 #3E6290');
    };
    const drop = (e: DragEvent) => {
      if (!drag) return; e.preventDefault(); clear();
      const ids = items().map(i => i.dataset.sortId!);
      if (over) { const from = ids.indexOf(drag.dataset.sortId!); ids.splice(from, 1); let to = ids.indexOf(over.dataset.sortId!); if (after) to += 1; ids.splice(to, 0, drag.dataset.sortId!); start(async () => { await onSave(ids); router.refresh(); }); }
      drag.draggable = false; drag = null; over = null;
    };
    const end = () => { clear(); if (drag) drag.draggable = false; drag = null; over = null; };
    root.addEventListener('pointerdown', down); root.addEventListener('dragstart', start_); root.addEventListener('dragover', dover); root.addEventListener('drop', drop); root.addEventListener('dragend', end);
    return () => { root.removeEventListener('pointerdown', down); root.removeEventListener('dragstart', start_); root.removeEventListener('dragover', dover); root.removeEventListener('drop', drop); root.removeEventListener('dragend', end); };
  }, [onSave, router]);
  return <div ref={ref} className={className}>{children}</div>;
}

export const Handle = ({ label }: { label: string }) => <span data-handle="" className="inline-flex h-7 w-5 cursor-grab select-none items-center justify-center text-[15px] leading-none text-[#B9B4C2] hover:text-ink-secondary" title="Drag to reorder" aria-label={`Drag to reorder ${label}`}>⋮⋮</span>;
