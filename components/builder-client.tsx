'use client';
import { useEffect, useState } from 'react';
import { useFormState } from 'react-dom';
import { CopyButton, SubmitBtn } from './client';
import { savePromptVersion, previewScenes, importScenes } from '@/lib/actions/builder';
import type { ParsedScene } from '@/lib/import';

declare global { interface Window { __bcsDirty?: boolean } }

export function ContextForm({ children }: { children: React.ReactNode }) {
  return (
    <form id="ctx-form" method="get" onSubmit={e => {
      if (window.__bcsDirty) { e.preventDefault(); window.dispatchEvent(new CustomEvent('bcs:rebuild-request')); }
    }}>{children}</form>
  );
}

export function BuilderEditor({ projectId, initial, meta, label, chatgpt, claude }: { projectId: string; initial: string; meta: string; label: string; chatgpt: string; claude: string }) {
  const [t, setT] = useState(initial);
  const [ask, setAsk] = useState(false);
  useEffect(() => { window.__bcsDirty = false; setT(initial); setAsk(false); }, [initial]);
  useEffect(() => { const h = () => setAsk(true); window.addEventListener('bcs:rebuild-request', h); return () => window.removeEventListener('bcs:rebuild-request', h); }, []);
  const edited = t.trim() !== initial.trim();
  const rebuild = () => { window.__bcsDirty = false; setAsk(false); (document.getElementById('ctx-form') as HTMLFormElement | null)?.requestSubmit(); };
  return (
    <form action={savePromptVersion} className="space-y-2">
      <input type="hidden" name="projectId" value={projectId} /><input type="hidden" name="meta" value={meta} /><input type="hidden" name="original" value={initial} /><input type="hidden" name="label" value={label} />
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">FINAL PROMPT {edited && <span className="ml-2 rounded-xs bg-[#F8EFD9] px-1.5 py-1 text-[10px] tracking-[0.08em] text-[#8A6216]">EDITED</span>}</span>
        <span className="font-mono text-[11px] text-ink-secondary">{t.length.toLocaleString()} chars · {t.trim().split(/\s+/).length.toLocaleString()} words · editable</span>
      </div>
      {ask && (
        <div className="rounded-lg border border-[#E7D3A0] bg-[#F8EFD9] p-3 text-[13px] text-[#8A6216]" role="alertdialog">
          <b>You&apos;ve edited this prompt.</b> Rebuilding replaces your edits with a fresh build from the template.
          <div className="mt-2 flex gap-2"><button type="button" className="btn btn-sm" onClick={() => setAsk(false)}>Keep my edits</button><button type="button" className="btn btn-sm btn-danger" onClick={rebuild}>Rebuild anyway</button></div>
        </div>
      )}
      <textarea name="text" value={t} onChange={e => { setT(e.target.value); window.__bcsDirty = e.target.value.trim() !== initial.trim(); }} rows={28} className="w-full rounded-lg border border-blue-mid bg-grad-blue px-[18px] py-4 text-[14px] leading-[1.65] text-ink-2 outline-none focus:ring-2 focus:ring-blue-mid" aria-label="Final copy-ready prompt" />
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton text={t} label="COPY PROMPT" />
        <SubmitBtn className="" pendingText="Saving…">SAVE VERSION</SubmitBtn>
        <button type="button" className="btn" onClick={() => (document.getElementById('ctx-form') as HTMLFormElement | null)?.requestSubmit()}>Rebuild</button>
        <a className="btn" href={chatgpt} target="_blank" rel="noopener noreferrer">OPEN CHATGPT ↗</a>
        <a className="btn" href={claude} target="_blank" rel="noopener noreferrer">OPEN CLAUDE ↗</a>
      </div>
    </form>
  );
}

export function ImportScenes({ projectId, initialText }: { projectId: string; initialText: string }) {
  const [state, action] = useFormState(previewScenes, { scenes: [] as ParsedScene[], error: undefined as string | undefined });
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-2">
        <textarea name="text" defaultValue={initialText} rows={16} className="input mono" placeholder="Paste the AI's structured scene list here…" aria-label="Pasted scene text" />
        <SubmitBtn className="btn-primary" pendingText="Parsing…">PREVIEW IMPORT</SubmitBtn>
      </form>
      {state.error && <div className="rounded-lg border border-[#E7D3A0] bg-[#F8EFD9] p-3 text-sm">{state.error}</div>}
      {state.scenes.length > 0 && (
        <form action={importScenes} className="card space-y-3">
          <input type="hidden" name="projectId" value={projectId} /><input type="hidden" name="scenes" value={JSON.stringify(state.scenes)} />
          <h2>Found {state.scenes.length} scene(s) — nothing is saved until you import</h2>
          {state.scenes.map((s, i) => (
            <label key={i} className="block rounded-lg border border-line p-2 text-sm">
              <span className="flex items-center gap-2"><input type="checkbox" name="pick" value={i} defaultChecked className="h-4 w-4" /><b>{s.title || `Scene ${i + 1}`}</b></span>
              <span className="mt-1 block text-xs text-ink-secondary">{Object.keys(s.fields).length} field(s): {Object.keys(s.fields).join(', ')}</span>
            </label>
          ))}
          <p className="text-xs text-ink-secondary">Imported scenes are added after your existing scenes. Existing scenes are never changed or deleted.</p>
          <SubmitBtn className="btn-accent" pendingText="Importing…">IMPORT SELECTED SCENES</SubmitBtn>
        </form>
      )}
    </div>
  );
}
