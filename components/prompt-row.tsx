'use client';
import { useRef, useState, useTransition } from 'react';
import { saveImagePrompt } from '@/lib/actions/image';
import { saveClipPrompt } from '@/lib/actions/kling';

/** One row of the Image Prompts / Video Prompts pages: thumbnail(s), the prompt, and COPY · EDIT · SAVE · CLEAR PROMPT. Plain class names (prompt-row__*) so a stylesheet can restyle it. */
export function PromptRow({ kind, id, prompt, children }: { kind: 'image' | 'video'; id: string; prompt: string; children?: React.ReactNode }) {
  const [saved, setSaved] = useState(prompt);
  const [draft, setDraft] = useState(prompt);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, start] = useTransition();
  const ta = useRef<HTMLTextAreaElement>(null);
  const dirty = draft !== saved;
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };
  const copy = async () => {
    const text = editing ? draft : saved;
    try { await navigator.clipboard.writeText(text); } catch { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); }
    flash('Copied ✓');
  };
  const edit = () => { if (editing) { setDraft(saved); setEditing(false); setMsg(''); } else { setEditing(true); setTimeout(() => ta.current?.focus(), 0); } };
  const clear = () => { setEditing(true); setDraft(''); setMsg('Cleared — press SAVE to keep it, or CANCEL to go back.'); setTimeout(() => ta.current?.focus(), 0); };
  const save = () => start(async () => {
    try { await (kind === 'image' ? saveImagePrompt(id, draft) : saveClipPrompt(id, draft)); setSaved(draft); setEditing(false); flash('Saved ✓'); } catch (e: any) { flash(e?.message || 'Could not save. Try again.'); }
  });
  return (
    <div className="prompt-row__body" data-testid="prompt-row" data-kind={kind} data-editing={editing ? '1' : '0'}>
      {children}
      <textarea ref={ta} className="prompt-row__prompt" data-testid="prompt-text" aria-label="Prompt" readOnly={!editing} value={editing ? draft : saved} placeholder={editing ? 'Type the prompt…' : 'No prompt yet.'} rows={editing ? 10 : 6} onChange={e => setDraft(e.target.value)} />
      <div className="prompt-row__actions">
        <button type="button" className="prompt-row__btn prompt-row__btn--copy" data-testid="prompt-copy" onClick={copy} disabled={!(editing ? draft : saved).trim()}>COPY</button>
        <button type="button" className="prompt-row__btn prompt-row__btn--edit" data-testid="prompt-edit" onClick={edit}>{editing ? 'CANCEL' : 'EDIT'}</button>
        <button type="button" className="prompt-row__btn prompt-row__btn--save" data-testid="prompt-save" onClick={save} disabled={!editing || !dirty || busy}>{busy ? 'SAVING…' : 'SAVE'}</button>
        <button type="button" className="prompt-row__btn prompt-row__btn--clear" data-testid="prompt-clear" onClick={clear} disabled={!saved.trim() && !draft.trim()}>CLEAR PROMPT</button>
        <span className="prompt-row__msg" role="status" data-testid="prompt-msg">{msg}</span>
      </div>
    </div>
  );
}
