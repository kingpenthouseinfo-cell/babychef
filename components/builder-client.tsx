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
      if (window.__bcsDirty && !window.confirm('You edited the prompt text. Rebuilding from the template will replace your edits. Continue?')) e.preventDefault();
      else window.__bcsDirty = false;
    }}>{children}</form>
  );
}

export function BuilderEditor({ projectId, initial, meta, label, chatgpt, claude }: { projectId: string; initial: string; meta: string; label: string; chatgpt: string; claude: string }) {
  const [t, setT] = useState(initial);
  useEffect(() => { window.__bcsDirty = false; setT(initial); }, [initial]);
  const edited = t.trim() !== initial.trim();
  return (
    <form action={savePromptVersion} className="space-y-2">
      <input type="hidden" name="projectId" value={projectId} /><input type="hidden" name="meta" value={meta} /><input type="hidden" name="original" value={initial} /><input type="hidden" name="label" value={label} />
      <textarea name="text" value={t} onChange={e => { setT(e.target.value); window.__bcsDirty = e.target.value.trim() !== initial.trim(); }} rows={28} className="input mono" aria-label="Final copy-ready prompt" />
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton text={t} label="COPY PROMPT" />
        <SubmitBtn className="" pendingText="Saving…">SAVE VERSION</SubmitBtn>
        <button type="button" className="btn" onClick={() => (document.getElementById('ctx-form') as HTMLFormElement | null)?.requestSubmit()}>REBUILD</button>
        <a className="btn" href={chatgpt} target="_blank" rel="noopener noreferrer">OPEN CHATGPT ↗</a>
        <a className="btn" href={claude} target="_blank" rel="noopener noreferrer">OPEN CLAUDE ↗</a>
      </div>
      <div className="text-xs text-neutral-500">{t.length.toLocaleString()} characters · {t.trim().split(/\s+/).length.toLocaleString()} words{edited && <b className="ml-2 text-amber-800">edited — Rebuild will replace your edits (you will be asked)</b>}</div>
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
      {state.error && <div className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm">{state.error}</div>}
      {state.scenes.length > 0 && (
        <form action={importScenes} className="card space-y-3">
          <input type="hidden" name="projectId" value={projectId} /><input type="hidden" name="scenes" value={JSON.stringify(state.scenes)} />
          <h2>Found {state.scenes.length} scene(s) — nothing is saved until you import</h2>
          {state.scenes.map((s, i) => (
            <label key={i} className="block rounded-lg border border-line p-2 text-sm">
              <span className="flex items-center gap-2"><input type="checkbox" name="pick" value={i} defaultChecked className="h-4 w-4" /><b>{s.title || `Scene ${i + 1}`}</b></span>
              <span className="mt-1 block text-xs text-neutral-500">{Object.keys(s.fields).length} field(s): {Object.keys(s.fields).join(', ')}</span>
            </label>
          ))}
          <p className="text-xs text-neutral-500">Imported scenes are added after your existing scenes. Existing scenes are never changed or deleted.</p>
          <SubmitBtn className="btn-accent" pendingText="Importing…">IMPORT SELECTED SCENES</SubmitBtn>
        </form>
      )}
    </div>
  );
}
