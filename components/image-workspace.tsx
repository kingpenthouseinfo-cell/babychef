'use client';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { CopyButton } from './client';
import { autosavePrompt, savePromptVersionAction, uploadResult } from '@/lib/actions/image';
import { expectedFilename, withFilename } from '@/lib/naming';

const rel = (ms: number | null) => {
  if (!ms) return 'not saved yet';
  const s = Math.round((Date.now() - ms) / 1000);
  return s < 5 ? 'just now' : s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : `${Math.round(s / 3600)}h ago`;
};
const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

/** Blue prompt zone: Full / Continuation tabs, autosave, pinned Copy button. */
export function PromptEditor({ imageId, full, cont, fullVersion, contVersion, updatedAt, filename }: { imageId: string; full: string; cont: string; fullVersion: number; contVersion: number; updatedAt: number; filename: string }) {
  const [tab, setTab] = useState<'full' | 'cont'>('full');
  const [text, setText] = useState({ full, cont });
  const [saved, setSaved] = useState<number | null>(updatedAt);
  const [pending, setPending] = useState(false);
  const [label, setLabel] = useState('');
  const [reason, setReason] = useState('');
  const [isPending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(text); latest.current = text;
  const dirty = useRef<Set<'full' | 'cont'>>(new Set());

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const fields = [...dirty.current]; dirty.current.clear();
    for (const f of fields) await autosavePrompt(imageId, f === 'full' ? 'fullPrompt' : 'contPrompt', latest.current[f]);
    if (fields.length) { setSaved(Date.now()); setPending(false); }
  }, [imageId]);

  function change(v: string) {
    setText(t => ({ ...t, [tab]: v }));
    dirty.current.add(tab); setPending(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 1200);
  }
  // relative time depends on the clock, so compute it only in the browser (avoids a server/client text mismatch)
  useEffect(() => { setLabel(rel(saved)); const i = setInterval(() => setLabel(rel(saved)), 15000); return () => clearInterval(i); }, [saved]);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty.current.size) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    // ⌘C when nothing is focused/selected copies the current prompt
    const k = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && !window.getSelection()?.toString() && !(el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) navigator.clipboard.writeText(withFilename(latest.current[tab], filename)).catch(() => undefined);
    };
    window.addEventListener('keydown', k);
    return () => { window.removeEventListener('beforeunload', h); window.removeEventListener('keydown', k); };
  }, [tab, filename]);

  const cur = text[tab];
  const ver = tab === 'full' ? fullVersion : contVersion;
  return (
    <div className="zone-blue flex min-h-[250px] flex-1 flex-col rounded-lg border">
      <div className="flex flex-wrap items-center gap-2 border-b border-blue-mid/60 px-3 py-2.5">
        <div role="tablist" aria-label="Prompt type" className="flex gap-1">
          {([['full', 'Full prompt'], ['cont', 'Continuation']] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-sm px-3 py-1.5 text-[13px] font-medium transition ${tab === k ? 'bg-blue-light text-blue-deep' : 'text-ink-secondary hover:bg-white/60'}`}>{l}</button>
          ))}
        </div>
        <span className="font-mono text-[11px] text-ink-secondary">{ver ? `v${ver}` : 'no version yet'} · {words(cur)} words · {pending ? 'saving…' : label ? `saved ${label}` : 'saved'}</span>
        <div className="ml-auto"><CopyButton text={withFilename(cur, filename)} label={tab === 'full' ? 'COPY FULL PROMPT' : 'COPY CONTINUATION'} className="min-w-[190px]" /></div>
      </div>
      <textarea value={cur} onChange={e => change(e.target.value)} onBlur={flush} aria-label={tab === 'full' ? 'Full prompt' : 'Continuation prompt'}
        placeholder={tab === 'full' ? 'Full prompt — complete visual context for ChatGPT…' : 'Continuation prompt — only what changes from the previous frame…'}
        className="min-h-[220px] w-full flex-1 resize-y bg-transparent px-[18px] py-4 text-[15px] leading-[1.65] text-ink-2 outline-none" />
      <div className="flex flex-wrap items-center gap-2 border-t border-blue-mid/60 px-3 py-2">
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for this version (optional)" aria-label="Reason for new prompt version" className="input max-w-xs !py-1.5 text-[13px]" />
        <button type="button" disabled={isPending} className="btn btn-sm btn-copy-secondary" onClick={() => start(async () => { await flush(); const fd = new FormData(); fd.set('imageId', imageId); fd.set('reason', reason); await savePromptVersionAction(fd); setReason(''); })}>{isPending ? 'Saving…' : 'Save as new version'}</button>
        <span className="text-[11px] text-ink-secondary">Typing autosaves. Versions are only created when you save one (or add a result / mark READY).</span>
      </div>
    </div>
  );
}

/** Approve: click approves; keyboard needs press-and-hold (700ms) with visible fill progress. */
export function HoldApprove({ formId, confirm, ms = 700 }: { formId: string; confirm?: string; ms?: number }) {
  const [p, setP] = useState(0);
  const raf = useRef<number | null>(null); const t0 = useRef(0);
  const submit = () => { if (confirm && !window.confirm(confirm)) return; (document.getElementById(formId) as HTMLFormElement | null)?.requestSubmit(); };
  const stop = () => { if (raf.current) cancelAnimationFrame(raf.current); raf.current = null; setP(0); };
  const step = () => { const v = Math.min(1, (performance.now() - t0.current) / ms); setP(v); if (v >= 1) { raf.current = null; setP(0); submit(); } else raf.current = requestAnimationFrame(step); };
  return (
    <button type="button" className="btn btn-approve relative flex-[1.4] overflow-hidden" aria-label={`Approve (click, or hold Enter/Space for ${ms / 1000} seconds)`}
      onClick={e => { if (e.detail > 0) submit(); }}
      onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); t0.current = performance.now(); raf.current = requestAnimationFrame(step); } }}
      onKeyUp={e => { if (e.key === 'Enter' || e.key === ' ') stop(); }} onBlur={stop}>
      <span className="absolute inset-y-0 left-0 bg-white/30" style={{ width: `${p * 100}%` }} aria-hidden />
      <span className="relative">APPROVE</span>
    </button>
  );
}

export function RevealButton({ assetId, projectFolder, label = 'Show in Finder', className = 'btn btn-sm' }: { assetId?: string; projectFolder?: string; label?: string; className?: string }) {
  const [msg, setMsg] = useState('');
  return (
    <button type="button" className={className} onClick={async () => {
      const r = await fetch('/api/reveal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetId, projectFolder }) }).then(r => r.json()).catch(() => null);
      if (r && !r.ok && r.path) { await navigator.clipboard.writeText(r.path).catch(() => undefined); setMsg('Path copied'); setTimeout(() => setMsg(''), 2200); }
    }}>{msg || label}</button>
  );
}

export type DlItem = { name: string; size: number; mtime: number };
export type ImgOpt = { id: string; code: string; title: string; scene: string; slug: string; next: number; seq: number; sceneOrder: number };

export function AddResultButton({ label = 'Add result', className = 'btn' }: { label?: string; className?: string }) {
  return <button type="button" className={className} onClick={() => window.dispatchEvent(new CustomEvent('bcs:add-result'))}>{label}</button>;
}

/** “Add generated image” dialog + drag-and-drop anywhere on the page. */
export function AddResultDialog({ currentId, images, downloads, folderLabel }: { currentId: string; images: ImgOpt[]; downloads: DlItem[]; folderLabel: string }) {
  const [open, setOpen] = useState(false);
  const [assigned, setAssigned] = useState(currentId);
  const [source, setSource] = useState<'file' | 'download'>(downloads.length ? 'download' : 'file');
  const [dl, setDl] = useState(downloads[0]?.name ?? '');
  const [fileName, setFileName] = useState('');
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cur = images.find(i => i.id === assigned) ?? images[0];
  const ext = (source === 'download' ? dl : fileName).split('.').pop()?.toLowerCase() || 'png';
  const saveAs = expectedFilename({ slug: cur.slug, sceneOrder: cur.sceneOrder, seq: cur.seq, title: cur.title, version: cur.next, ext: ext === 'jpeg' ? 'jpg' : ext });

  const openWith = useCallback((f?: File) => {
    if (f && /\.(heic|heif)$/i.test(f.name)) { window.alert('HEIC/HEIF images are not supported yet. Export it as JPG or PNG first (Preview → File → Export…).'); return; }
    setOpen(true);
    if (f && fileRef.current) { const dt = new DataTransfer(); dt.items.add(f); fileRef.current.files = dt.files; setFileName(f.name); setSource('file'); }
  }, []);
  useEffect(() => {
    const o = () => openWith();
    const over = (e: DragEvent) => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); setOver(true); } };
    const leave = (e: DragEvent) => { if (!e.relatedTarget) setOver(false); };
    const drop = (e: DragEvent) => { if (e.dataTransfer?.files.length) { e.preventDefault(); setOver(false); openWith(e.dataTransfer.files[0]); } };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('bcs:add-result', o); window.addEventListener('dragover', over); window.addEventListener('dragleave', leave); window.addEventListener('drop', drop); window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('bcs:add-result', o); window.removeEventListener('dragover', over); window.removeEventListener('dragleave', leave); window.removeEventListener('drop', drop); window.removeEventListener('keydown', esc); };
  }, [openWith]);

  return (
    <>
      {over && <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center border-4 border-dashed border-pink-deep/50 bg-pink-tint/80 text-[18px] font-semibold text-pink-deep">Drop the generated image to add it</div>}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Add generated image" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <form action={async fd => { await uploadResult(fd); setOpen(false); }} className="max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-t-xl bg-surface p-6 shadow-md sm:rounded-lg">
            <div className="eyebrow text-pink-deep">IMAGES · IMPORT FLOW</div>
            <h2 className="mt-2 text-[22px]">Add generated image</h2>
            <input type="hidden" name="imageId" value={assigned} />
            <div className="mt-4 space-y-3">
              {downloads.length > 0 && (
                <fieldset>
                  <legend className="label">Source</legend>
                  <label className="mb-2 flex cursor-pointer items-center gap-3 rounded-md border border-line p-2 has-[:checked]:border-pink-mid has-[:checked]:bg-pink-tint">
                    <input type="radio" checked={source === 'download'} onChange={() => setSource('download')} />
                    <span className="text-[13px]"><b>Import from Downloads</b></span>
                  </label>
                  {source === 'download' && (
                    <div className="mb-2 grid gap-2">
                      {downloads.map(d => (
                        <label key={d.name} className="flex cursor-pointer items-center gap-3 rounded-md border border-line p-1.5 has-[:checked]:border-pink-deep">
                          <input type="radio" name="downloadName" value={d.name} checked={dl === d.name} onChange={() => setDl(d.name)} />
                          <img src={`/api/downloads?name=${encodeURIComponent(d.name)}`} alt="" className="h-[40px] w-[72px] rounded-sm border border-line object-cover" />
                          <span className="min-w-0 flex-1"><span className="block truncate font-mono text-[12px]">{d.name}</span><span className="text-[11px] text-ink-secondary">{(d.size / 1024).toFixed(0)} KB · {rel(d.mtime)}</span></span>
                        </label>
                      ))}
                      <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" name="moveOriginal" className="accent-[#4C6B52]" /> Move instead of copy (removes it from Downloads)</label>
                    </div>
                  )}
                  <label className="flex cursor-pointer items-center gap-3 rounded-md border border-line p-2 has-[:checked]:border-pink-mid has-[:checked]:bg-pink-tint">
                    <input type="radio" checked={source === 'file'} onChange={() => setSource('file')} /><span className="text-[13px]"><b>Choose a file…</b></span>
                  </label>
                </fieldset>
              )}
              <div className={source === 'file' || !downloads.length ? '' : 'hidden'}>
                <label className="label" htmlFor="ar-file">Image file</label>
                <input id="ar-file" ref={fileRef} type="file" name="file" accept="image/png,image/jpeg,image/webp,image/gif" className="input" onChange={e => setFileName(e.target.files?.[0]?.name ?? '')} />
                <p className="mt-1 text-[11px] text-ink-secondary">Tip: you can also drag a file anywhere on this page.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2"><span className="label">Assigned to</span>
                  <select className="input" value={assigned} onChange={e => setAssigned(e.target.value)}>{images.map(i => <option key={i.id} value={i.id}>{i.code} · {i.title}</option>)}</select></label>
                <label className="block"><span className="label">Source tool</span><select name="sourceTool" className="input"><option>ChatGPT</option><option>Claude</option><option>Other</option></select></label>
                <label className="block"><span className="label">Prompt used</span><select name="promptType" className="input"><option value="FULL">Full prompt</option><option value="CONTINUATION">Continuation</option></select></label>
              </div>
              <div><span className="label">Save as</span><div className="break-all rounded-md border border-line bg-sunken px-3 py-2 font-mono text-[12px]">{saveAs}</div></div>
              <div><span className="label">Destination</span><div className="font-mono text-[12px] text-ink-secondary">{folderLabel} / 02 Images</div></div>
              <label className="block"><span className="label">Notes</span><input name="notes" className="input" /></label>
            </div>
            <p className="mt-4 text-[12px] text-ink-secondary">Copied into your project folder · status → Review</p>
            <div className="mt-4 flex justify-end gap-2"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button><ImportSubmit disabled={source === 'file' ? !fileName : !dl} /></div>
          </form>
        </div>
      )}
    </>
  );
}
import { useFormStatus } from 'react-dom';
function ImportSubmit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn btn-primary" disabled={pending || disabled}>{pending ? 'Importing…' : 'Import'}</button>;
}
