'use client';
import { useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { autosavePrompt } from '@/lib/actions/image';
import { saveFlagNote, toggleFlag } from '@/lib/actions/flags';
import { MakePictureButton } from './make-picture';
import type { FixRef, FixCat } from '@/lib/fix-refs';
import { HEAD, BODY, PINK_BTN, MINT_BTN, SKY_BTN, SOFT_BTN } from '@/lib/fix-style';

const START = '--- REFERENCE IMAGES (attach these to ChatGPT, in this order) ---', END = '--- END REFERENCE IMAGES ---';
const thumb = (id: string, w = 300) => `/api/files/${id}?w=${w}`;

const CATS: { id: 'all' | FixCat; label: string; color: string }[] = [
  { id: 'all', label: 'All photos', color: '#3A3342' }, { id: 'chef', label: 'Baby Chef & kitchen', color: '#E07AA0' }, { id: 'ingredients', label: 'Ingredients', color: '#C9A13A' },
  { id: 'reference', label: 'Reference photos', color: '#6F93C9' }, { id: 'good', label: 'Pictures that look good', color: '#5DB37C' }, { id: 'other', label: 'Other pictures', color: '#9A80CC' },
];
const catColor = (c: FixCat) => CATS.find(x => x.id === c)!.color;

type Props = { imageId: string; title: string; sceneLine: string; current: { assetId: string; fileName: string } | null; flagNote: string; prompt: string; chatgpt: string; refs: FixRef[]; final: ReactNode };

/** Fix one flagged picture in 3 steps: 1 what's wrong + pick helpers, 2 the prompt (original + helpers added at the end), 3 the new picture. */
export function FixWorkspace({ imageId, title, sceneLine, current, flagNote, prompt, chatgpt, refs, final }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [done, setDone] = useState<number[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [cat, setCat] = useState<'all' | FixCat>('all');
  const [q, setQ] = useState('');
  const [wrong, setWrong] = useState(flagNote);
  const [orig, setOrig] = useState(prompt);
  const [saved, setSaved] = useState('');
  const [copied, setCopied] = useState(false);
  const [, start] = useTransition();
  const lastSaved = useRef(prompt), lastWrong = useRef(flagNote);
  const go = (n: number) => { if (n > step) setDone(d => Array.from(new Set([...d, step]))); setStep(n); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const saveOrig = () => { if (orig === lastSaved.current) return; lastSaved.current = orig; start(async () => { await autosavePrompt(imageId, 'fullPrompt', orig); setSaved('Saved ✓'); router.refresh(); }); };
  const saveWrong = () => { if (wrong.trim() === lastWrong.current.trim()) return; lastWrong.current = wrong; start(async () => { const fd = new FormData(); fd.set('kind', 'image'); fd.set('id', imageId); fd.set('note', wrong); await saveFlagNote(fd); router.refresh(); }); };
  const unflag = () => start(async () => { const fd = new FormData(); fd.set('kind', 'image'); fd.set('id', imageId); fd.set('on', '0'); await toggleFlag(fd); router.push(location.pathname); router.refresh(); });
  const toggle = (k: string) => setPicked(p => (p.includes(k) ? p.filter(x => x !== k) : [...p, k]));
  const chosen = picked.map(k => refs.find(r => r.key === k)!).filter(Boolean);
  const block = chosen.length ? `${START}\n${chosen.map((r, n) => `Reference ${n + 1} (${r.title}): ${(notes[r.key] ?? '').trim() || 'use for continuity'}`).join('\n')}\n${END}` : '';
  const full = [orig.trimEnd(), block].filter(Boolean).join('\n\n');
  const shownRefs = refs.filter(r => (cat === 'all' || r.cat === cat) && (!q.trim() || `${r.title} ${r.label}`.toLowerCase().includes(q.trim().toLowerCase())));
  const copy = async () => { try { await navigator.clipboard.writeText(full); } catch { const t = document.createElement('textarea'); t.value = full; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); } setCopied(true); setTimeout(() => setCopied(false), 3000); };
  const downloadAll = () => chosen.forEach((r, n) => setTimeout(() => { const a = document.createElement('a'); a.href = `/api/files/${r.assetId}?download=1&name=REF${n + 1}_${r.title}`; a.download = ''; document.body.appendChild(a); a.click(); document.body.removeChild(a); }, n * 500));
  const pillBase = 'flex-1 rounded-full px-3 py-3.5 text-center text-[15px] font-semibold border-b-4 transition';
  const pill = (n: number) => step === n ? `${pillBase} border-[#EBA9C2] bg-gradient-to-b from-[#FFE3EE] to-[#FCC8DA] text-[#9A3E62]` : done.includes(n) ? `${pillBase} border-[#9FD6B3] bg-gradient-to-b from-[#EEF9F1] to-[#D9F1E1] text-[#3F7D55]` : `${pillBase} border-[#E6DDF0] bg-gradient-to-b from-[#FBF9FD] to-[#F1EBF5] text-[#A79CB0]`;
  const names = ["What's wrong + helpers", 'Prompt', 'New picture'];
  return (
    <div className="rounded-[30px] bg-white p-4 shadow-[0_20px_50px_-30px_rgba(120,90,160,.5)] md:p-6" style={BODY}>
      <ol className="flex gap-2" aria-label="Steps" data-testid="fix-steps">{names.map((t, n) => <li key={t} className="flex-1 flex"><button type="button" onClick={() => go(n + 1)} aria-current={step === n + 1 ? 'step' : undefined} className={pill(n + 1)} style={HEAD}>{n + 1} · {t}{done.includes(n + 1) && step !== n + 1 ? ' ✓' : ''}</button></li>)}</ol>

      {step === 1 && (
        <div className="mt-5" data-testid="fix-references">
          <span className="inline-block rounded-full bg-gradient-to-b from-[#FFF9E3] to-[#FFF0C4] px-4 py-1.5 text-[13px] font-bold text-[#9A7A22]">{sceneLine}</span>
          <h2 className="mt-3 text-[32px] font-semibold leading-tight md:text-[38px]" style={HEAD}>This picture didn’t turn out right</h2>
          <p className="text-[#8A8093]">“{title}” — let’s make a better one together.</p>
          <div className="relative mt-4 overflow-hidden rounded-[26px] bg-gradient-to-br from-[#FFE3EE] to-[#EDE6FB]">
            {current ? <img src={thumb(current.assetId, 1200)} alt={title} className="mx-auto max-h-[560px] w-full object-contain" /> : <div className="flex aspect-[4/3] items-center justify-center text-[#A79CB0]">No picture yet</div>}
            <span className="absolute right-3 top-3 rounded-full bg-white px-3 py-1 text-[13px] font-bold text-[#C2577E] shadow">⚑ Flagged</span>
          </div>
          {current && <div className="mt-1 break-all font-mono text-[11px] text-[#A79CB0]">{current.fileName}</div>}
          <label className="mt-4 block text-[18px] font-semibold" style={HEAD} htmlFor="fix-wrong">What’s wrong with it?</label>
          <textarea id="fix-wrong" aria-label="What needs fixing" rows={2} className="mt-1 w-full rounded-[18px] border-2 border-[#F6D3E1] bg-[#FFFAFC] p-3 text-[16px] outline-none focus:border-[#F2A1BF]" placeholder="e.g. The beef still looks pink in the middle" value={wrong} onChange={e => setWrong(e.target.value)} onBlur={saveWrong} />
          <div className="my-6 border-t-2 border-dashed border-[#EADFF3]" />
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-[26px] font-semibold" style={HEAD}>Now pick helper pictures</h3><span className="text-[14px] font-semibold text-[#C2577E]">{picked.length} picked</span></div>
          <p className="text-[14px] text-[#8A8093]">Every photo in this project · tap the ones that show what you want</p>
          <div className="mt-3 rounded-[26px] bg-gradient-to-b from-[#F9F6FE] to-[#F1EBFB] p-3 md:p-4">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Photo categories">{CATS.map(c => <button key={c.id} type="button" data-testid={`fix-cat-${c.id}`} onClick={() => setCat(c.id)} className={`rounded-full border px-4 py-2 text-[14px] font-semibold ${cat === c.id ? 'text-white' : 'bg-white'}`} style={cat === c.id ? { background: c.color, borderColor: c.color } : { color: c.color, borderColor: '#EFE6F7' }}>{c.label}</button>)}</div>
            <input type="search" aria-label="Search photos" data-testid="fix-search" className="mt-3 w-full rounded-full border border-[#EADFF3] bg-white px-5 py-3 text-[15px] outline-none focus:border-[#C6B3E6]" placeholder="Search photos… e.g. onion, pan, baby" value={q} onChange={e => setQ(e.target.value)} />
            <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7">
              {shownRefs.map(r => { const n = picked.indexOf(r.key); const on = n >= 0; return (
                <button key={r.key} type="button" onClick={() => toggle(r.key)} aria-pressed={on} data-testid="fix-ref" data-on={on ? '1' : '0'} className="text-left">
                  <span className="relative block aspect-square overflow-hidden rounded-[18px] bg-white" style={on ? { boxShadow: `0 0 0 3px ${catColor(r.cat)}` } : undefined}>
                    <img src={thumb(r.assetId, 260)} alt={r.title} loading="lazy" className="h-full w-full object-cover" />
                    {on && <span className="absolute right-1.5 top-1.5 rounded-full px-2 py-0.5 text-[12px] font-bold text-white" style={{ background: catColor(r.cat) }}>✓ {n + 1}</span>}
                  </span>
                  <span className={`mt-1 block truncate text-center text-[12px] ${on ? 'font-bold' : 'text-[#8A8093]'}`} title={r.title}>{r.title}</span>
                </button>); })}
            </div>
            {shownRefs.length === 0 && <p className="py-6 text-center text-[14px] text-[#8A8093]">{q.trim() ? `No photos called “${q.trim()}”. Try another word.` : 'No photos here yet. Add some on the References page.'}</p>}
          </div>
          {chosen.length > 0 && (
            <div className="mt-4 rounded-[26px] bg-gradient-to-b from-[#FFF5F9] to-[#FFEAF2] p-4" data-testid="fix-chosen">
              <div className="text-[18px] font-semibold" style={HEAD}>Tell ChatGPT what each picture is for</div>
              <p className="text-[13px] text-[#8A8093]">Whatever you write here goes into the prompt.</p>
              <div className="mt-3 space-y-2">{chosen.map((r, n) => (
                <div key={r.key} className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-bold text-white" style={{ background: catColor(r.cat) }}>{n + 1}</span>
                  <img src={thumb(r.assetId, 120)} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                  <input className="min-w-0 flex-1 rounded-full border-2 border-[#F6D3E1] bg-white px-4 py-2.5 text-[15px] outline-none focus:border-[#F2A1BF]" placeholder={`What’s in “${r.title}”? e.g. use this baby’s face`} aria-label={`Note for ${r.title}`} value={notes[r.key] ?? ''} onChange={e => setNotes(s => ({ ...s, [r.key]: e.target.value }))} />
                  <button type="button" onClick={() => toggle(r.key)} aria-label={`Remove ${r.title}`} className="h-9 w-9 shrink-0 rounded-full bg-white text-[#A79CB0]">×</button>
                </div>))}</div>
            </div>)}
          <button type="button" className={`${PINK_BTN} mt-5 w-full`} style={HEAD} onClick={() => { saveWrong(); go(2); }} data-testid="fix-add-to-prompt">{chosen.length ? 'Add them to my prompt →' : 'Next: the prompt →'}</button>
          <button type="button" onClick={unflag} data-testid="unflag" className="mt-3 w-full text-center text-[13px] font-semibold text-[#A79CB0] underline">This one is fine after all — remove the flag</button>
        </div>
      )}

      {step === 2 && (
        <div className="mt-5">
          <div className="flex items-center gap-3 rounded-[22px] bg-gradient-to-r from-[#FFF1F6] to-[#F3EDFC] p-3">
            {current ? <img src={thumb(current.assetId, 160)} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" /> : <span className="h-16 w-16 shrink-0 rounded-xl bg-[#F1EBF5]" />}
            <div className="min-w-0"><div className="text-[11px] font-bold uppercase tracking-wide text-[#A79CB0]">Fixing · {sceneLine.replace(/ · [^·]*· /, ' · ')}</div><div className="truncate text-[18px] font-semibold" style={HEAD}>{title}</div>{wrong.trim() && <div className="truncate text-[13px] font-semibold text-[#C2577E]">{wrong}</div>}</div>
          </div>
          <h2 className="mt-5 text-[32px] font-semibold" style={HEAD}>Your prompt is ready</h2>
          <p className="text-[#8A8093]">This is the same prompt this picture was made with. Your helpers are added at the end.</p>
          <div className="mt-3 rounded-[24px] bg-gradient-to-b from-[#EEF4FE] to-[#D6E5FA] p-3">
            <div className="px-2 pb-2 text-[14px] font-bold text-[#4A6EA3]">Original prompt · from Images to Generate</div>
            <textarea aria-label="Prompt" data-testid="fix-prompt" className="min-h-[260px] w-full rounded-[18px] border-0 bg-white p-4 font-mono text-[13px] leading-relaxed outline-none" value={orig} onChange={e => { setOrig(e.target.value); setSaved(''); }} onBlur={saveOrig} />
            <div className="px-2 pt-1 text-[12px] text-[#4A6EA3]" role="status">{saved}</div>
          </div>
          {block && <div className="mt-3 rounded-[24px] bg-gradient-to-b from-[#FFF5F9] to-[#FFEAF2] p-3" data-testid="fix-added"><div className="px-2 pb-2 text-[14px] font-bold text-[#C2577E]">Added at the end for this fix</div><pre className="overflow-x-auto whitespace-pre-wrap rounded-[18px] bg-white p-4 font-mono text-[13px] leading-relaxed">{block}</pre></div>}
          {chosen.length > 0 && (
            <div className="mt-3 rounded-[24px] bg-gradient-to-b from-[#FFF9E3] to-[#FFF0C4] p-4" data-testid="fix-attach">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><div className="text-[17px] font-semibold text-[#7A5F14]" style={HEAD}>Attach these {chosen.length} picture{chosen.length === 1 ? '' : 's'} in ChatGPT, in this order</div><div className="text-[13px] text-[#9A7A22]">The numbers match the prompt.</div></div><button type="button" onClick={downloadAll} className={SOFT_BTN} data-testid="fix-download-all">↓ Download all</button></div>
              <div className="mt-3 flex flex-wrap gap-3">{chosen.map((r, n) => <div key={r.key} className="w-[88px]"><div className="relative"><img src={thumb(r.assetId, 200)} alt={r.title} className="aspect-square w-full rounded-xl object-cover" /><span className="absolute -left-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold text-white" style={{ background: catColor(r.cat) }}>{n + 1}</span></div><div className="mt-1 truncate text-center text-[11.5px] font-semibold">{r.title}</div></div>)}</div>
            </div>)}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button type="button" className={SKY_BTN} style={HEAD} onClick={copy} data-testid="fix-copy">{copied ? 'Copied ✓' : 'Copy prompt'}</button>
            <MakePictureButton imageId={imageId} text={full} chatgpt={chatgpt} mark={false} label="Open ChatGPT + copy" className={`${PINK_BTN} w-full`} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3"><button type="button" className={SOFT_BTN} onClick={() => go(1)}>← Back</button><button type="button" className={MINT_BTN} style={HEAD} onClick={() => go(3)} data-testid="fix-next-2">I made it → add the new picture</button></div>
        </div>
      )}

      {step === 3 && (
        <div className="mt-5" data-testid="fix-step-final">
          {final}
          <button type="button" className={`${SOFT_BTN} mt-3 w-full`} onClick={() => setStep(2)}>← Back to the prompt</button>
        </div>
      )}
    </div>
  );
}
