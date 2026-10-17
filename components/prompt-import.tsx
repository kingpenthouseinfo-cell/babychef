'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { previewVideoImport, applyVideoImport, type VideoImportItem } from '@/lib/actions/kling';
import { previewImageImport, applyImageImport } from '@/lib/actions/image';

/** Paste a whole answer / production plan and fill every prompt in the right box. Nothing is saved until you press FILL IN. One component for Image Prompts and Video Prompts. */
export function PromptImport({ kind, projectId }: { kind: 'image' | 'video'; projectId: string }) {
  const video = kind === 'video', noun = video ? 'video prompt' : 'picture prompt';
  const [shared, setShared] = useState('');
  const [useShared, setUseShared] = useState(false);
  const router = useRouter();
  const [text, setText] = useState('');
  const [items, setItems] = useState<(VideoImportItem & { on: boolean })[] | null>(null);
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, start] = useTransition();
  const check = () => start(async () => {
    setMsg('');
    try {
      const r = video ? await previewVideoImport(projectId, text) : await previewImageImport(projectId, text);
      if (!r.items.length) { setItems(null); setMsg(video ? 'I could not find any video prompts in that text. Each one needs a heading that names its picture, like “## IMG-003: Palm jaggery”, then the prompt under it.' : 'I could not find any pictures in that text. Each one needs a line like “IMG-003 - Palm jaggery presentation”, then its description under it.'); return; }
      setShared((r as any).shared ?? ''); setUseShared(false);
      const seen = new Set<string>();
      setOptions(r.options);
      setItems(r.items.map(i => { const dup = !!i.target && seen.has(i.target); if (i.target) seen.add(i.target); return { ...i, on: !!i.target && !dup }; }));
    } catch (e: any) { setMsg(e?.message || 'Something went wrong. Try again.'); }
  });
  const fill = () => start(async () => {
    const pick = (items ?? []).filter(i => i.on && i.target);
    try { const rows = pick.map(i => ({ target: i.target, prompt: !video && useShared && shared ? `${shared}\n\n${i.prompt}` : i.prompt }));
      const r = video ? await applyVideoImport(rows) : await applyImageImport(rows); setMsg(`Done ✓ — ${r.saved} ${noun}${r.saved === 1 ? '' : 's'} filled in.`); setItems(null); setText(''); router.refresh(); } catch (e: any) { setMsg(e?.message || 'Could not save. Try again.'); }
  });
  const set = (n: number, patch: Partial<VideoImportItem & { on: boolean }>) => setItems(a => a!.map((x, i) => (i === n ? { ...x, ...patch } : x)));
  const dupTargets = new Set((items ?? []).filter(i => i.on).map(i => i.target).filter((t, n, a) => t && a.indexOf(t) !== n));
  const count = (items ?? []).filter(i => i.on && i.target).length;
  return (
    <details className="prompt-import" data-testid={`${kind}-import`}>
      <summary className="prompt-import__summary">Paste text to fill the prompts in automatically</summary>
      <div className="prompt-import__body">
        <p className="prompt-import__help">{video ? <>Paste the whole answer from ChatGPT or Claude. Each prompt needs a heading with its picture code (like <code>## IMG-003: Palm jaggery presentation</code>) and the prompt text under it. I put each one in the matching video clip.</> : <>Paste your production plan or picture descriptions. Each picture needs a line like <code>IMG-003 - Palm jaggery presentation</code> with its description under it (the “Filename:” lines are skipped). I put each one in the matching picture’s prompt box.</>}</p>
        <textarea className="prompt-import__text" data-testid="import-text" aria-label="Paste video prompts" rows={8} value={text} onChange={e => { setText(e.target.value); setItems(null); }} placeholder="Paste here…" />
        <div className="prompt-import__actions"><button type="button" className="prompt-row__btn prompt-row__btn--copy" data-testid="import-check" onClick={check} disabled={busy || !text.trim()}>{busy && !items ? 'READING…' : 'CHECK IT'}</button>{msg && <span className="prompt-row__msg" role="status" data-testid="import-msg">{msg}</span>}</div>
        {items && (
          <div className="prompt-import__preview" data-testid="import-preview">
            <p className="prompt-import__found">Found {items.length} {noun}{items.length === 1 ? '' : 's'}. Check where each one goes, then press FILL IN.</p>
            {!video && shared && <label className="prompt-import__shared" data-testid="import-shared"><input type="checkbox" checked={useShared} onChange={e => setUseShared(e.target.checked)} /> Also put the shared look rules (Baby Chef, kitchen, camera) at the top of every prompt</label>}
            <ul className="prompt-import__list">
              {items.map((it, n) => (
                <li key={n} className="prompt-import__item" data-testid="import-item">
                  <label className="prompt-import__check"><input type="checkbox" checked={it.on} disabled={!it.target} onChange={e => set(n, { on: e.target.checked })} aria-label={`Use ${it.title}`} /><span className="prompt-import__what"><b>{it.seqs.map(s => `IMG-${String(s).padStart(3, '0')}`).join(' + ')}</b> {it.title.replace(/^IMG[\s_-]*\d+\s*[:–—-]?\s*/i, '')}</span></label>
                  <select className="prompt-import__select" aria-label="Goes in" value={it.target} onChange={e => { const o = options.find(x => x.value === e.target.value); set(n, { target: e.target.value, targetLabel: o?.label ?? '', on: !!e.target.value }); }}>
                    <option value="">— choose where it goes —</option>
                    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <span className="prompt-import__note">{!it.target ? (video ? 'No matching clip found' : 'No picture with that number yet') : dupTargets.has(it.target) && it.on ? (video ? 'Same clip as another one — only the last is kept' : 'Same picture as another one — only the last is kept') : it.hasPrompt ? 'Replaces the existing prompt (old one is kept as a version)' : 'Empty now'}{it.target.startsWith('scene:') ? ' · a new clip will be made' : ''}</span>
                  <pre className="prompt-import__sample">{it.prompt.slice(0, 160)}{it.prompt.length > 160 ? '…' : ''}</pre>
                </li>))}
            </ul>
            <button type="button" className="prompt-row__btn prompt-row__btn--save" data-testid="import-fill" onClick={fill} disabled={busy || count === 0}>{busy ? 'FILLING IN…' : `FILL IN ${count} ${noun.toUpperCase()}${count === 1 ? '' : 'S'}`}</button>
          </div>)}
      </div>
    </details>
  );
}
