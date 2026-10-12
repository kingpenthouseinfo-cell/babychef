'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Lightbox } from './client';
import { HoldApprove } from './image-workspace';
import { approveAttempt, redoAttempt, rejectAttempt, saveChecklistState, undoApprove } from '@/lib/actions/image';

type St = 'pass' | 'unsure' | 'fail';
const NEXT: Record<St, St> = { pass: 'unsure', unsure: 'fail', fail: 'pass' };
const MARK: Record<St, string> = { pass: '✓', unsure: '?', fail: '✗' };
const CLS: Record<St, string> = { pass: 'border-sage-deep bg-sage-tint text-sage-deep', unsure: 'border-[#E7D3A0] bg-[#F8EFD9] text-[#8A6216]', fail: 'border-[#C8705C] bg-[#F6E3DE] text-[#A8513F]' };
const CATS = ['Character mismatch', 'Wrong age', 'Wrong skin tone', 'Wrong outfit', 'Wrong kitchen', 'Wrong camera angle', 'Wrong crop', 'Wrong ingredient', 'Wrong quantity', 'Wrong food texture', 'Wrong food state', 'Wrong utensil', 'Wrong cookware', 'Bad hands', 'Bad anatomy', 'Wrong label/brand', 'Wrong physics', 'Continuity failure', 'Other'];

export type ReviewProps = {
  attemptId: string; imageId: string; code: string; number: number; status: string; isApproved: boolean;
  generatedAsset: string; prevAsset: string | null; prevCode: string | null; masterAsset: string | null;
  items: string[]; initial: Record<string, St>; unblocks: string[]; builderRedoHref: string; replaceConfirm?: string;
  mustBeVisible: string[]; mustNotChange: string[]; mustNotAppear: string[];
};

/** Review / Redo: compare modes, 3-state checklist, hold-to-approve (700ms), Redo panel with category chips. */
export function ReviewPanel(p: ReviewProps) {
  const [mode, setMode] = useState<'prev' | 'master' | 'single'>(p.prevAsset ? 'prev' : p.masterAsset ? 'master' : 'single');
  const [state, setState] = useState<Record<string, St>>(p.initial);
  const [redo, setRedo] = useState(false);
  const [cat, setCat] = useState('');
  const pass = p.items.filter(i => state[i] === 'pass').length;
  function cycle(item: string) {
    const cur = state[item];
    const next: Record<string, St> = { ...state, [item]: cur ? NEXT[cur] : 'pass' };
    setState(next); saveChecklistState(p.attemptId, next);
  }
  const left = mode === 'prev' ? p.prevAsset : mode === 'master' ? p.masterAsset : null;
  const leftTag = mode === 'prev' ? `Previous approved ${p.prevCode ?? ''}` : 'Master baby';
  return (
    <section id="review" className="card border-purple-mid space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="eyebrow text-purple-deep">REVIEW</div><h2 className="mt-1">Image review — <span className="font-mono">{p.code}</span> · attempt v{p.number}</h2><p className="text-[13px] text-ink-secondary">Compare, check, then approve (hold) or send back · click Redo to open the correction panel</p></div>
        <div role="group" aria-label="Compare mode" className="flex gap-1 rounded-md bg-sunken p-1">
          {([['prev', 'vs previous approved', !!p.prevAsset], ['master', 'vs master', !!p.masterAsset], ['single', 'Single', true]] as const).map(([k, l, ok]) => (
            <button key={k} type="button" disabled={!ok} onClick={() => setMode(k)} className={`rounded-sm px-3 py-1.5 text-[12px] font-medium transition disabled:opacity-40 ${mode === k ? 'bg-surface shadow-sm' : 'text-ink-secondary'}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className={`grid gap-3 ${left ? 'md:grid-cols-2' : ''}`}>
        {left && <div><div className="mb-1 flex justify-between text-[12px]"><span className="font-mono">{leftTag}</span></div><Lightbox src={`/api/files/${left}`} thumb={`/api/files/${left}?w=1000`} alt={leftTag} imgClass="aspect-video w-full object-contain" wrapClass="bg-[#F1EFF1]" /></div>}
        <div><div className="mb-1 flex justify-between text-[12px]"><span className="font-mono">{p.code} · v{p.number}</span><span className="text-[#33507A]">Generated · in review</span></div><Lightbox src={`/api/files/${p.generatedAsset}`} thumb={`/api/files/${p.generatedAsset}?w=1000`} alt="Generated image" imgClass={`w-full object-contain ${left ? 'aspect-video' : 'max-h-[520px]'}`} wrapClass="bg-[#F1EFF1]" /></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="mb-2 flex items-center justify-between"><span className="eyebrow">REVIEW CHECKLIST</span><span className="font-mono text-[12px] text-ink-secondary">{pass}/{p.items.length}</span></div>
          <div className="flex flex-wrap gap-2">
            {p.items.map(i => {
              const st = state[i];
              return <button key={i} type="button" onClick={() => cycle(i)} aria-label={`${i}: ${st ?? 'not checked'}`} className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12px] transition ${st ? CLS[st] : 'border-line bg-surface text-ink-secondary'}`}><b className="w-3 text-center">{st ? MARK[st] : '·'}</b>{i}</button>;
            })}
          </div>
          <p className="mt-2 text-[11px] text-ink-secondary">Click an item to cycle ✓ → ? → ✗ (saved automatically). Not required for approval.</p>
          <div className="mt-4 grid gap-3 text-[13px] sm:grid-cols-3">
            <div><div className="label">Must be visible</div><ul className="list-disc pl-4">{p.mustBeVisible.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
            <div><div className="label">Must not change</div><ul className="list-disc pl-4">{p.mustNotChange.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
            <div><div className="label">Must not appear</div><ul className="list-disc pl-4">{p.mustNotAppear.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          </div>
        </div>

        <div className="space-y-3">
          {p.isApproved ? (
            <div className="rounded-lg border border-sage-mid bg-sage-tint p-3 text-[13px]"><b className="text-sage-deep">✓ Approved</b>{p.unblocks.length > 0 && <> · {p.unblocks.join(', ')} unblocked</>}
              <form action={undoApprove} className="mt-2"><input type="hidden" name="attemptId" value={p.attemptId} /><button className="btn btn-sm">Undo</button></form></div>
          ) : (
            <div className="space-y-2">
              <form id={`rv-approve-${p.attemptId}`} action={approveAttempt} className="flex"><input type="hidden" name="attemptId" value={p.attemptId} /><HoldApprove formId={`rv-approve-${p.attemptId}`} confirm={p.replaceConfirm} ms={700} /></form>
              <hr className="border-line" />
              <div className="flex gap-2">
                <button type="button" className="btn btn-danger flex-1" onClick={() => setRedo(!redo)} aria-expanded={redo}>Redo</button>
                <form action={rejectAttempt} className="flex-1"><input type="hidden" name="attemptId" value={p.attemptId} /><button className="btn btn-danger w-full">Reject</button></form>
              </div>
              <p className="text-[11px] text-ink-secondary">Hold Approve for 0.7s (keyboard: hold Enter/Space). Approve is kept away from Copy and Redo on purpose.</p>
            </div>
          )}
        </div>
      </div>

      {redo && !p.isApproved && (
        <form action={redoAttempt} className="space-y-3 rounded-lg border border-[#C8705C]/50 bg-[#F6E3DE]/40 p-4"><input type="hidden" name="attemptId" value={p.attemptId} /><input type="hidden" name="corrCategory" value={cat} />
          <div className="flex items-center justify-between"><div className="eyebrow text-[#A8513F]">REDO · v{p.number} → v{p.number + 1}</div><button type="button" className="text-[12px] underline" onClick={() => setRedo(false)}>← Back to review</button></div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block"><span className="label">What went wrong?</span><textarea name="wrong" rows={4} className="input" /></label>
            <label className="block"><span className="label">What needs to change?</span><textarea name="change" rows={4} className="input" /></label>
            <label className="block"><span className="label">What must remain unchanged?</span><textarea name="keep" rows={4} className="input" /></label>
          </div>
          <div><span className="label">Category</span><div className="flex flex-wrap gap-1.5">{CATS.map(c => <button key={c} type="button" onClick={() => setCat(cat === c ? '' : c)} aria-pressed={cat === c} className={`rounded-md border px-2.5 py-1 text-[12px] ${cat === c ? 'border-[#C8705C] bg-[#F6E3DE] text-[#A8513F]' : 'border-line bg-surface text-ink-secondary'}`}>{c}</button>)}</div></div>
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="addToLibrary" className="accent-[#4C6B52]" /> Also add to the Corrections / Don&apos;t Do This library</label>
          <div className="flex flex-wrap items-center gap-3"><button className="btn btn-danger">Save redo · v{p.number} moves to 03 Redos</button><Link href={p.builderRedoHref} className="btn btn-copy-secondary">Build redo prompt →</Link></div>
        </form>
      )}
    </section>
  );
}
