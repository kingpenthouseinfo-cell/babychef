'use client';
import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

export function CopyButton({ text, label = 'COPY', className = '', disabled, variant = 'primary' }: { text: string; label?: string; className?: string; disabled?: boolean; variant?: 'primary' | 'secondary' }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } finally { document.body.removeChild(ta); }
    }
    setDone(true); setTimeout(() => setDone(false), 1600);
  }
  const base = variant === 'secondary' ? 'btn-copy-secondary' : 'btn-copy';
  return (
    <button type="button" onClick={copy} disabled={disabled || !text}
      style={done ? { background: 'linear-gradient(180deg,#7FAE93 0%,#4E7A5C 100%)', boxShadow: 'var(--btn-shadow-sage)', color: '#fff' } : undefined}
      className={`btn ${base} ${className}`} aria-live="polite">
      {/* both labels are rendered so the button width never shifts */}
      <span className="relative inline-grid">
        <span className={`col-start-1 row-start-1 text-center ${done ? 'invisible' : ''}`}>{label}</span>
        <span className={`col-start-1 row-start-1 text-center ${done ? '' : 'invisible'}`} aria-hidden={!done}>✓ COPIED</span>
      </span>
    </button>
  );
}

export function SubmitBtn({ children, className = 'btn-primary', pendingText = 'Saving…', confirm }: { children: React.ReactNode; className?: string; pendingText?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`btn ${className}`}
      onClick={e => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}>
      {pending ? pendingText : children}
    </button>
  );
}

/** Form that warns about unsaved changes (no silent data loss). */
export function DirtyForm({ action, children, className = '' }: { action: (fd: FormData) => void | Promise<void>; children: React.ReactNode; className?: string }) {
  const [dirty, setDirty] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
  return (
    <form ref={ref} action={async fd => { setDirty(false); await action(fd); }} onChange={() => setDirty(true)} className={className}>
      {dirty && <div className="mb-2 rounded-md bg-[#F8EFD9] px-3 py-1.5 text-xs font-semibold text-[#8A6216]">Unsaved changes — press SAVE</div>}
      {children}
    </form>
  );
}

export function ConfirmForm({ action, message, children, className = '' }: { action: (fd: FormData) => void | Promise<void>; message: string; children: React.ReactNode; className?: string }) {
  return <form action={action} className={className} onSubmit={e => { if (!window.confirm(message)) e.preventDefault(); }}>{children}</form>;
}

export function MarkerToolbar({ target, markers }: { target: string; markers: string[] }) {
  function ins(m: string) {
    const ta = document.getElementById(target) as HTMLTextAreaElement | null;
    if (!ta) return;
    const s = ta.selectionStart ?? ta.value.length;
    ta.value = ta.value.slice(0, s) + m + ' ' + ta.value.slice(ta.selectionEnd ?? s);
    ta.focus(); ta.selectionStart = ta.selectionEnd = s + m.length + 1;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.form?.dispatchEvent(new Event('change', { bubbles: true }));
  }
  return <div className="mb-2 flex flex-wrap gap-1">{markers.map(m => <button key={m} type="button" onClick={() => ins(m)} className="btn btn-sm">{m}</button>)}</div>;
}

export function LivePrompt({ initial, name = 'text', rows = 18, copyLabel = 'COPY PROMPT' }: { initial: string; name?: string; rows?: number; copyLabel?: string }) {
  const [t, setT] = useState(initial);
  return (
    <div>
      <textarea name={name} value={t} onChange={e => setT(e.target.value)} rows={rows} className="input mono" aria-label="Assembled prompt" />
      <div className="mt-2 flex flex-wrap gap-2"><CopyButton text={t} label={copyLabel} /></div>
    </div>
  );
}

export function NextPrompt({ items }: { items: { id: string; code: string; title: string; project: string; full: string; cont: string; checklist: { label: string; required: boolean }[] }[] }) {
  const [pref, setPref] = useState<'FULL' | 'CONT'>('CONT');
  const [open, setOpen] = useState(false);
  useEffect(() => { try { const p = localStorage.getItem('bcs-pref'); if (p === 'FULL' || p === 'CONT') setPref(p); } catch { /* ignore */ } }, []);
  function choose(p: 'FULL' | 'CONT') { setPref(p); try { localStorage.setItem('bcs-pref', p); } catch { /* ignore */ } }
  const it = items[0];
  if (!it) return (
    <div className="card border-dashed text-sm text-ink-secondary">No images ready. Finish a prompt, mark an image READY, or resolve dependencies.</div>
  );
  const text = pref === 'FULL' ? it.full : it.cont;
  return (
    <div className="zone-blue rounded-lg border p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><div className="eyebrow text-blue-deep">NEXT</div><div className="text-lg font-semibold">{it.code} — {it.title}</div><div className="text-xs text-ink-secondary">{it.project}</div></div>
        <div className="flex gap-1" role="group" aria-label="Prompt type">
          <button type="button" className={`btn btn-sm ${pref === 'FULL' ? 'btn-copy-secondary border-blue-deep' : ''}`} onClick={() => choose('FULL')}>IMAGE PROMPT</button>
          <button type="button" className={`btn btn-sm ${pref === 'CONT' ? 'btn-copy-secondary border-blue-deep' : ''}`} onClick={() => choose('CONT')}>CONTINUATION</button>
        </div>
      </div>
      <button type="button" className="mt-2 text-xs underline" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show'} reference checklist ({it.checklist.length})</button>
      {open && <ol className="mt-1 list-decimal pl-5 text-sm">{it.checklist.map((c, i) => <li key={i}>{c.label} <span className="text-xs font-semibold text-ink-secondary">{c.required ? 'REQUIRED' : 'OPTIONAL'}</span></li>)}</ol>}
      {!text.trim() && <p className="mt-2 text-sm text-[#A8513F]">This image has no {pref === 'FULL' ? 'full' : 'continuation'} prompt yet.</p>}
      <div className="mt-4"><CopyButton text={text} label={`COPY NEXT PROMPT (${pref === 'FULL' ? 'FULL' : 'CONTINUATION'})`} className="min-h-[48px] w-full sm:w-auto sm:min-w-[320px]" /></div>
    </div>
  );
}

export function MobileNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-sm lg:hidden" aria-expanded={open} aria-label="Toggle navigation" onClick={() => setOpen(!open)}>☰ Menu</button>
      {open && <div className="absolute left-0 right-0 top-14 z-30 border-b border-line bg-white p-3 lg:hidden" onClick={() => setOpen(false)}>{children}</div>}
    </>
  );
}

export function Lightbox({ src, alt, thumb, imgClass = 'aspect-[4/3] w-full object-cover', wrapClass = 'bg-sunken' }: { src: string; alt: string; thumb: string; imgClass?: string; wrapClass?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`block w-full overflow-hidden rounded-md border border-line ${wrapClass}`} aria-label={`View larger: ${alt}`}>
        <img src={thumb} alt={alt} loading="lazy" className={imgClass} />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setOpen(false)} role="dialog" aria-label={alt}>
          <img src={src} alt={alt} className="max-h-full max-w-full rounded-md" />
          <button className="btn absolute right-4 top-4" onClick={() => setOpen(false)}>Close</button>
        </div>
      )}
    </>
  );
}

export function PromptBox({ name, label, initial, rows = 12, downloadHref, copyLabel }: { name: string; label: string; initial: string; rows?: number; downloadHref?: string; copyLabel: string }) {
  const [t, setT] = useState(initial);
  return (
    <div>
      <label className="label" htmlFor={`pb-${name}`}>{label}</label>
      <textarea id={`pb-${name}`} name={name} value={t} onChange={e => setT(e.target.value)} rows={rows} className="input mono" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <CopyButton text={t} label={copyLabel} />
        {downloadHref && <a className="btn btn-sm" href={downloadHref}>DOWNLOAD</a>}
        <span className="text-xs text-ink-secondary">{t.trim() ? t.trim().split(/\s+/).length + ' words' : 'empty'}</span>
      </div>
    </div>
  );
}

export function AttachImageForm({ action, klingId, options }: { action: (fd: FormData) => void | Promise<void>; klingId: string; options: { id: string; label: string; approved: boolean }[] }) {
  const [sel, setSel] = useState('');
  return (
    <form action={action} onSubmit={e => {
      const o = options.find(x => x.id === sel);
      if (o && !o.approved && !window.confirm(`WARNING:\n${o.label} is not approved.\n\nContinue anyway?`)) e.preventDefault();
    }} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="klingId" value={klingId} />
      <label className="block"><span className="label">Add picture</span>
        <select name="imageId" className="input min-w-[260px]" required value={sel} onChange={e => setSel(e.target.value)}>
          <option value="" disabled>— choose planned image —</option>
          {options.map(o => <option key={o.id} value={o.id}>{o.label} {o.approved ? '✓ approved' : '⚠ NOT approved'}</option>)}
        </select></label>
      <SubmitBtn pendingText="…">Attach</SubmitBtn>
    </form>
  );
}
