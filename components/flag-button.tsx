'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleFlag } from '@/lib/actions/flags';

/** Little red flag. Outline = not flagged; solid red = flagged (shows in NEED TO FIX). Plain button so it works inside the batch form. */
export function FlagButton({ kind, id, flagged, className = '' }: { kind: 'image' | 'scene'; id: string; flagged: boolean; className?: string }) {
  const router = useRouter();
  const [on, setOn] = useState(flagged);
  const [, start] = useTransition();
  const label = on ? `Remove the red flag from this ${kind === 'scene' ? 'scene' : 'picture'}` : `Flag this ${kind === 'scene' ? 'scene' : 'picture'} as needing a fix`;
  return (
    <button type="button" aria-label={label} aria-pressed={on} title={on ? 'Flagged: NEED TO FIX (click to remove)' : 'Flag: NEED TO FIX'} data-testid="flag-btn"
      onClick={e => { e.preventDefault(); e.stopPropagation(); const next = !on; setOn(next); start(async () => { const fd = new FormData(); fd.set('kind', kind); fd.set('id', id); fd.set('on', next ? '1' : '0'); await toggleFlag(fd); router.refresh(); }); }}
      className={`flex h-8 w-8 items-center justify-center rounded-full border shadow-sm transition ${on ? 'border-[#D4574A] bg-[#E5493A] text-white' : 'border-line-strong bg-white/90 text-ink-muted hover:border-[#E5493A] hover:text-[#E5493A]'} ${className}`}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></svg>
    </button>
  );
}
