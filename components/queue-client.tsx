'use client';
import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CopyButton } from './client';
import { startGenerating, markWaitingById } from '@/lib/actions/image';
import { WAITING_REASONS } from '@/lib/constants';
import { withFilename } from '@/lib/naming';

export type QItem = { id: string; slug: string; code: string; title: string; project: string; scene: string; shot: string; aspect: string; priority: string; full: string; cont: string; filename: string; refs: { label: string; assetId: string | null; required: boolean }[] };
const TARGET = 20;
const today = () => new Date().toISOString().slice(0, 10);

/** NEXT card: ordered required references, prompt preview, Copy Next Prompt (marks Generating + advances), Skip, session progress. */
export function QueueNext({ items, chatgpt }: { items: QItem[]; chatgpt: string }) {
  const router = useRouter();
  const [skipped, setSkipped] = useState<string[]>([]);
  const [pref, setPref] = useState<'FULL' | 'CONT'>('CONT');
  const [done, setDone] = useState(0);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const [waitOpen, setWaitOpen] = useState(false);
  const [reason, setReason] = useState(WAITING_REASONS[0]);
  useEffect(() => {
    try {
      const p = localStorage.getItem('bcs-pref'); if (p === 'FULL' || p === 'CONT') setPref(p);
      const s = JSON.parse(localStorage.getItem('bcs-session') || '{}'); if (s.day === today()) setDone(s.done || 0);
    } catch { /* ignore */ }
  }, []);
  const queue = items.filter(i => !skipped.includes(i.id));
  const cur = queue[0];
  const up = queue.slice(1, 6);
  const choose = (p: 'FULL' | 'CONT') => { setPref(p); try { localStorage.setItem('bcs-pref', p); } catch { /* ignore */ } };
  const text = cur ? withFilename(pref === 'FULL' ? cur.full : cur.cont, cur.filename) : '';
  const shown = cur ? (pref === 'FULL' ? cur.full : cur.cont) : '';

  async function copyNext() {
    if (!cur) return;
    try { await navigator.clipboard.writeText(text); } catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }
    setCopied(true); setTimeout(() => setCopied(false), 1600);
    const n = done + 1; setDone(n);
    try { localStorage.setItem('bcs-session', JSON.stringify({ day: today(), done: n })); } catch { /* ignore */ }
    start(async () => { await startGenerating(cur.id); router.refresh(); });
  }

  if (!cur) return <div className="rounded-lg border border-dashed border-line-strong bg-surface/70 p-8 text-center"><div className="text-[15px] font-semibold">No images ready.</div><p className="mt-1 text-[13px] text-ink-secondary">Finish a prompt or resolve dependencies — your prompt queue is clear.</p></div>;
  const req = cur.refs.filter(r => r.required);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="zone-blue rounded-lg border p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2"><span className="eyebrow text-blue-deep">NEXT</span><span className="chip st-ready">READY</span></div>
          <Link href={`/projects/${cur.slug}/images/${cur.id}`} className="text-[13px] font-medium text-blue-deep">Open image detail →</Link>
        </div>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3"><span className="font-mono text-[34px] font-medium leading-none md:text-[44px]">{cur.code}</span><span className="text-[22px] font-semibold md:text-[26px]">{cur.title}</span><span className="font-mono text-[12px] text-ink-secondary">{cur.scene} · {cur.shot.toLowerCase()} · {cur.aspect}</span></div>
        <div className="eyebrow mt-5 text-sage-deep">Required references · attach to ChatGPT in this order</div>
        <ol className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
          {req.length === 0 && <li className="col-span-full text-[13px] text-ink-secondary">No references attached.</li>}
          {req.map((r, i) => (
            <li key={i} className="relative">
              <span className="absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-sage-deep font-mono text-[11px] text-white">{i + 1}</span>
              {r.assetId ? <img src={`/api/files/${r.assetId}?w=400`} alt={r.label} className="aspect-video w-full rounded-md border border-sage-mid object-cover" /> : <div className="flex aspect-video items-center justify-center rounded-md border border-[#E7D3A0] bg-[#F8EFD9] text-[11px] font-semibold text-[#8A6216]">NOT APPROVED</div>}
              <div className="mt-1 line-clamp-2 text-[12px] leading-tight">{r.label}</div>
            </li>
          ))}
        </ol>
        {cur.refs.some(r => !r.required) && <p className="mt-2 text-[12px] text-ink-secondary">+ {cur.refs.filter(r => !r.required).length} optional reference(s)</p>}
        <div className="mt-4 flex gap-1" role="group" aria-label="Prompt type">
          <button type="button" aria-pressed={pref === 'CONT'} className={`btn btn-sm ${pref === 'CONT' ? 'btn-copy-secondary' : 'btn-ghost'}`} onClick={() => choose('CONT')}>Continuation</button>
          <button type="button" aria-pressed={pref === 'FULL'} className={`btn btn-sm ${pref === 'FULL' ? 'btn-copy-secondary' : 'btn-ghost'}`} onClick={() => choose('FULL')}>Full prompt</button>
        </div>
        <div className="mt-2 max-h-36 overflow-auto rounded-lg border border-line bg-surface px-4 py-3 text-[14px] leading-[1.6] text-ink-2">{shown.trim() || <span className="text-[#A8513F]">This image has no {pref === 'FULL' ? 'full' : 'continuation'} prompt yet.</span>}</div>
        <div className="mt-3 rounded-lg border border-purple-mid bg-grad-purple p-3"><div className="eyebrow text-purple-deep">NEXT RESULT FILE</div><div className="mt-1 flex flex-wrap items-center gap-2"><code className="min-w-0 flex-1 break-all font-mono text-[13px] font-medium">{cur.filename}</code><CopyButton text={cur.filename} label="COPY FILENAME" variant="secondary" className="btn-sm" /></div></div>
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={copyNext} disabled={!text.trim() || pending} className="btn btn-copy hidden min-h-[48px] min-w-[240px] px-6 text-[15px] md:inline-flex" style={copied ? { background: 'linear-gradient(180deg,#7FAE93 0%,#4E7A5C 100%)', boxShadow: 'var(--btn-shadow-sage)' } : undefined}>{copied ? '✓ Copied, paste into ChatGPT' : 'Copy Next Prompt'}</button>
          <CopyButton text={withFilename(pref === 'CONT' ? cur.full : cur.cont, cur.filename)} label={pref === 'CONT' ? 'Copy full prompt' : 'Copy continuation'} variant="secondary" />
          <a href={chatgpt} target="_blank" rel="noopener noreferrer" className="btn">Open ChatGPT ↗</a>
          <button type="button" className="btn" onClick={() => setWaitOpen(!waitOpen)} aria-expanded={waitOpen}>Waiting on something</button>
          <Link href={`/projects/${cur.slug}/images/${cur.id}#results`} className="btn">Add finished picture</Link>
          <button type="button" className="btn btn-ghost ml-auto" onClick={() => setSkipped([...skipped, cur.id])}>Skip → next</button>
        </div>
        {waitOpen && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#E7D3A0] bg-[#F8EFD9]/60 p-3">
            <select value={reason} onChange={e => setReason(e.target.value)} className="input !w-auto text-[13px]" aria-label="Waiting reason">{WAITING_REASONS.map(r => <option key={r}>{r}</option>)}</select>
            <button type="button" className="btn btn-sm btn-primary" disabled={pending} onClick={() => start(async () => { await markWaitingById(cur.id, reason, ''); setWaitOpen(false); router.refresh(); })}>MARK WAITING</button>
          </div>
        )}
        <p className="mt-2 text-[11px] text-ink-secondary">Copy Next Prompt marks this image GENERATING and moves to the next one.</p>
      </section>

      <div className="fixed inset-x-0 bottom-14 z-40 border-t border-line bg-surface p-2 md:hidden">
        <button type="button" onClick={copyNext} disabled={!text.trim() || pending} className="btn btn-copy min-h-[48px] w-full text-[15px]" style={copied ? { background: 'linear-gradient(180deg,#7FAE93 0%,#4E7A5C 100%)', boxShadow: 'var(--btn-shadow-sage)' } : undefined}>{copied ? '✓ Copied, paste into ChatGPT' : `Copy Next Prompt · ${cur.code}`}</button>
      </div>
      <aside className="space-y-3 pb-16 md:pb-0">
        <div className="flex items-center justify-between"><div className="eyebrow">UPCOMING</div><div className="flex items-center gap-2 text-[12px] text-ink-secondary">This session <span className="h-1.5 w-20 overflow-hidden rounded-full bg-sunken"><span className="block h-full bg-btn-blue" style={{ width: `${Math.min(100, (done / TARGET) * 100)}%` }} /></span><span className="font-mono">{done} / {TARGET}</span></div></div>
        {up.length === 0 && <p className="text-[13px] text-ink-secondary">Nothing else ready after this one.</p>}
        <ul className="space-y-2">
          {up.map((u, i) => (
            <li key={u.id}><Link href={`/projects/${u.slug}/images/${u.id}`} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-2.5 hover:border-ink/30">
              <span className="font-mono text-[11px] text-ink-muted">{i + 2}</span>
              {u.refs[0]?.assetId ? <img src={`/api/files/${u.refs[0].assetId}?w=160`} alt="" className="h-[34px] w-[56px] rounded-sm border border-line object-cover" /> : <span className="h-[34px] w-[56px] rounded-sm bg-[repeating-linear-gradient(135deg,#ECE9EC_0_6px,#E5E1E5_6px_12px)]" />}
              <span className="min-w-0 flex-1"><span className="block font-mono text-[12px] font-medium">{u.code}</span><span className="block truncate text-[12px] text-ink-secondary">{u.title}</span><span className="block truncate font-mono text-[10px] text-purple-deep" title={u.filename}>{u.filename}</span></span>
              <span className="chip st-ready">READY</span></Link></li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
