'use client';
import { useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { autosavePrompt } from '@/lib/actions/image';
import { CopyButton } from './client';
import { MakePictureButton } from './make-picture';
import type { FixRef } from '@/lib/fix-refs';

const START = '--- REFERENCE IMAGES (attach these to ChatGPT, in this order) ---', END = '--- END REFERENCE IMAGES ---';
const strip = (t: string) => { const a = t.indexOf(START); if (a < 0) return t.trimEnd(); const b = t.indexOf(END, a); return (t.slice(0, a) + (b >= 0 ? t.slice(b + END.length) : '')).trimEnd(); };
const LEAD = 'Attached reference pictures —';
const stripSentence = (t: string) => t.split(/\n\n/).filter(x => !x.startsWith(LEAD)).join('\n\n').trimEnd();
const thumb = (id: string, w = 240) => `/api/files/${id}?w=${w}`;

/** Fix one flagged picture: 1) tick reference pictures and say what each one is, 2) the prompt, 3) a few optional ideas. */
export function FixWorkspace({ imageId, prompt, chatgpt, refs, final }: { imageId: string; prompt: string; chatgpt: string; refs: FixRef[]; final: ReactNode }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [text, setText] = useState(prompt);
  const [saved, setSaved] = useState('');
  const [step, setStep] = useState(1);
  const [, start] = useTransition();
  const latest = useRef(prompt);
  const save = (t: string) => { latest.current = t; start(async () => { await autosavePrompt(imageId, 'fullPrompt', t); setSaved('Saved ✓'); router.refresh(); }); };
  const toggle = (k: string) => setPicked(p => (p.includes(k) ? p.filter(x => x !== k) : [...p, k]));
  const chosen = picked.map(k => refs.find(r => r.key === k)!).filter(Boolean);
  const block = () => chosen.length ? `${START}\n${chosen.map((r, n) => `Reference ${n + 1} (${r.label}${r.title && r.title !== r.label ? ': ' + r.title : ''}): ${(notes[r.key] ?? '').trim() || r.hint || 'use for continuity'}`).join('\n')}\n${END}` : '';
  const sentence = () => chosen.length ? `${LEAD} ${chosen.map((r, n) => `Reference ${n + 1} is ${(notes[r.key] ?? '').trim() || r.hint || r.title} (${r.label.toLowerCase()})`).join('; ')}. Keep the same look as these references.` : '';
  const addToPrompt = (mode: 'list' | 'sentence') => { const t = [stripSentence(strip(text)), mode === 'list' ? block() : sentence()].filter(Boolean).join('\n\n'); setText(t); save(t); };
  const groups: ['SUGGESTED' | 'REFERENCE' | 'PICTURE', string][] = [['SUGGESTED', 'SUGGESTED FOR THIS PICTURE'], ['REFERENCE', 'REFERENCE PHOTOS & INGREDIENTS'], ['PICTURE', 'APPROVED PICTURES']];
  const Tile = ({ r }: { r: FixRef }) => {
    const on = picked.includes(r.key);
    return (
      <div className={`w-[112px] ${on ? 'rounded-xl ring-2 ring-[#6A8FC7]' : ''}`} data-testid="fix-ref" data-on={on ? '1' : '0'}>
        <label className="block cursor-pointer"><div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-sunken"><img src={thumb(r.assetId)} alt={r.title} className="h-full w-full object-cover" loading="lazy" /><input type="checkbox" checked={on} onChange={() => toggle(r.key)} className="absolute left-1.5 top-1.5 h-5 w-5" aria-label={`Use ${r.title}`} /></div>
          <div className="mt-1 truncate text-[11px] font-semibold" title={r.title}>{r.title}</div><div className="truncate text-[10px] text-ink-secondary">{r.label}</div></label>
      </div>
    );
  };
  return (
    <div className="mt-4 space-y-4">
      <ol className="flex gap-2" aria-label="Steps" data-testid="fix-steps">{['References', 'Prompt', 'Final image'].map((t, n) => <li key={t} className="flex-1"><button type="button" onClick={() => setStep(n + 1)} aria-current={step === n + 1 ? 'step' : undefined} className={`w-full rounded-xl border px-3 py-3 text-[15px] font-semibold ${step === n + 1 ? 'border-blue-deep bg-blue-tint text-blue-deep' : 'border-line bg-white text-ink-secondary'}`}>{n + 1} · {t}</button></li>)}</ol>
      {step === 1 && <section aria-label="References" data-testid="fix-references" className="rounded-2xl border border-line bg-white p-4">
        <h3 className="text-[20px] font-semibold">1 · References</h3>
        <p className="mt-1 text-[12.5px] text-ink-secondary">Tick the pictures that should go to ChatGPT with this prompt.</p>
        {groups.map(([g, title]) => { const list = refs.filter(r => r.group === g); if (!list.length) return null; const body = <div className="mt-2 flex flex-wrap gap-2.5">{list.map(r => <Tile key={r.key} r={r} />)}</div>;
          return g === 'PICTURE' ? <details key={g} className="mt-3"><summary className="cursor-pointer text-[12.5px] font-semibold text-blue-deep">{title} ({list.length})</summary>{body}</details> : <div key={g} className="mt-3"><div className="text-[11px] font-semibold tracking-wide text-ink-secondary">{title}</div>{body}</div>; })}
        {refs.length === 0 && <p className="mt-2 text-[13px] text-ink-secondary">No reference pictures yet. Add some on the References page.</p>}
        {chosen.length > 0 && (
          <div className="mt-4 space-y-2 rounded-xl border border-line bg-surface p-3" data-testid="fix-chosen">
            <div className="text-[12.5px] font-semibold">What is in each picture?</div>
            {chosen.map((r, n) => (
              <div key={r.key} className="flex items-start gap-2.5">
                <img src={thumb(r.assetId, 120)} alt="" className="h-12 w-16 shrink-0 rounded-md object-cover" />
                <div className="min-w-0 flex-1"><div className="text-[11.5px] font-semibold">Reference {n + 1} · {r.label}</div>
                  <input className="input mt-0.5 text-[13px]" placeholder="What is in this image / what kind of reference is it?" aria-label={`Note for ${r.title}`} value={notes[r.key] ?? ''} onChange={e => setNotes(s => ({ ...s, [r.key]: e.target.value }))} /></div>
                <a className="btn btn-sm" href={`/api/files/${r.assetId}?download=1`} title="Download to attach in ChatGPT">↓</a>
              </div>))}
            <div className="grid gap-2 sm:grid-cols-2"><button type="button" className="btn btn-accent min-h-[52px] text-[15px]" onClick={() => { addToPrompt('list'); setStep(2); }} data-testid="fix-add-to-prompt">ADD AS A LIST AT THE END</button>
              <button type="button" className="btn min-h-[52px] text-[15px]" onClick={() => { addToPrompt('sentence'); setStep(2); }} data-testid="fix-add-sentence">ADD INTO THE PROMPT TEXT</button></div>
          </div>)}
        <button type="button" className="btn btn-accent mt-4 min-h-[52px] w-full text-[16px]" onClick={() => setStep(2)} data-testid="fix-next-1">NEXT: PROMPT →</button>
      </section>}
      {step === 2 && <section aria-label="Prompt" className="rounded-2xl border border-line bg-white p-4">
        <h3 className="text-[20px] font-semibold">2 · Prompt</h3>
        <textarea className="input mt-1 min-h-[260px] font-mono text-[12.5px] leading-relaxed" value={text} aria-label="Prompt" data-testid="fix-prompt" onChange={e => { setText(e.target.value); setSaved(''); }} onBlur={() => { if (text !== latest.current) save(text); }} />
        <div className="mt-2 flex flex-wrap items-start gap-2"><CopyButton text={text} label="COPY PROMPT" variant="secondary" className="min-h-[52px] flex-1 text-[15px]" /><MakePictureButton imageId={imageId} text={text} chatgpt={chatgpt} mark={false} label="OPEN CHATGPT + COPY PROMPT" className="btn btn-accent min-h-[52px] w-full text-[15px]" /><span className="pt-2 text-[12px] text-ink-secondary" role="status">{saved}</span></div>
        <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" className="btn min-h-[52px] text-[15px]" onClick={() => setStep(1)}>← BACK</button><button type="button" className="btn btn-accent min-h-[52px] text-[15px]" onClick={() => setStep(3)} data-testid="fix-next-2">NEXT: FINAL IMAGE →</button></div>
      </section>}
      {step === 3 && <div data-testid="fix-step-final">{final}<button type="button" className="btn mt-3 min-h-[52px] w-full text-[15px]" onClick={() => setStep(2)}>← BACK TO PROMPT</button></div>}
    </div>
  );
}
