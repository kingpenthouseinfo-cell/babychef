'use client';
import { useEffect, useState } from 'react';
import { FillFromText, type FillProps } from './fill-client';

/** "Fill from text" as a modal: step 1 paste, step 2 what we found, then fill in. */
export function FillModalButton(props: FillProps & { label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [open]);
  const { label = 'Fill from text', className = 'btn min-h-[48px] px-5', ...rest } = props;
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{label}</button>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 md:p-10" style={{ background: 'rgba(30,29,34,.38)' }} onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }} role="dialog" aria-modal="true" aria-label="Fill from text">
          <div className="w-full max-w-[720px] rounded-[20px] bg-white p-6 md:p-8" style={{ boxShadow: '0 24px 50px -20px rgba(30,29,34,.35)' }}>
            <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-[30px]">Paste your info</h2><p className="mt-1 text-[14px] text-ink-secondary">Paste the recipe or Baby Chef Studio text here and I’ll fill in the form for you.</p></div><button type="button" onClick={() => setOpen(false)} className="btn btn-sm btn-ghost" aria-label="Close">✕</button></div>
            <FillFromText {...rest} onCancel={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
