'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveFlagNote, toggleFlag } from '@/lib/actions/flags';

/** What needs fixing (saved when you click away) + remove the flag. */
export function FlagNote({ kind, id, note }: { kind: 'image' | 'scene'; id: string; note: string }) {
  const router = useRouter();
  const [v, setV] = useState(note);
  const [pending, start] = useTransition();
  const save = () => { if (v.trim() === note.trim()) return; start(async () => { const fd = new FormData(); fd.set('kind', kind); fd.set('id', id); fd.set('note', v); await saveFlagNote(fd); router.refresh(); }); };
  const unflag = () => start(async () => { const fd = new FormData(); fd.set('kind', kind); fd.set('id', id); fd.set('on', '0'); await toggleFlag(fd); router.refresh(); });
  return (
    <div className="mt-2 flex flex-wrap items-start gap-2">
      <textarea className="input min-h-[40px] min-w-[220px] flex-1 text-[13px]" rows={2} placeholder="What needs fixing? (optional)" aria-label="What needs fixing" value={v} onChange={e => setV(e.target.value)} onBlur={save} />
      <button type="button" className="btn btn-sm" disabled={pending} onClick={unflag} data-testid="unflag">REMOVE FLAG</button>
    </div>
  );
}
