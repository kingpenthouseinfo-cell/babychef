'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Ev = { id: number; kind: 'matched' | 'unmatched'; text: string; href: string };

/** Polls the folder watcher; shows a small toast when a file was detected and refreshes the current page. */
export function WatcherNotice() {
  const router = useRouter();
  const last = useRef<number | null>(null);
  const [toasts, setToasts] = useState<Ev[]>([]);
  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        const r = await fetch('/api/watch/status', { cache: 'no-store' }).then(r => r.json());
        const top = r.events.length ? r.events[r.events.length - 1].id : 0;
        if (last.current === null) last.current = top;
        else if (top > last.current) {
          const fresh = (r.events as Ev[]).filter(e => e.id > last.current!);
          last.current = top;
          if (!stop) { setToasts(t => [...t, ...fresh].slice(-3)); router.refresh(); fresh.forEach(f => setTimeout(() => setToasts(t => t.filter(x => x.id !== f.id)), 9000)); }
        }
      } catch { /* server restarting */ }
    }
    void tick();
    const i = setInterval(tick, 5000);
    return () => { stop = true; clearInterval(i); };
  }, [router]);
  if (!toasts.length) return null;
  return (
    <div className="fixed right-4 top-20 z-[70] space-y-2" role="status" aria-live="polite">
      {toasts.map(t => (
        <Link key={t.id} href={t.href} className={`block max-w-sm rounded-lg border px-4 py-3 text-[13px] shadow-md ${t.kind === 'matched' ? 'border-sage-mid bg-sage-tint text-sage-deep' : 'border-[#E7D3A0] bg-[#F8EFD9] text-[#8A6216]'}`}><b>{t.kind === 'matched' ? '✓ ' : '⚠ '}</b>{t.text}</Link>
      ))}
    </div>
  );
}
