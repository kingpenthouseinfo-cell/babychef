'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveStepDialogue, skipPicture, unskipPicture, removeOldVersions, quickApprove } from '@/lib/actions/pictures';
import type { StepInfo } from '@/lib/step-dialogue';

/** "Step 2 of 4 · what it shows" and "Says: the dialogue it goes with" under a picture. Click Edit to change either (empty = automatic). */
export function PictureNotes({ id, info, stepNote, dialogueLine, compact = false }: { id: string; info: StepInfo; stepNote: string | null; dialogueLine: string | null; compact?: boolean }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [step, setStep] = useState(stepNote ?? '');
  const [line, setLine] = useState(dialogueLine ?? '');
  const [busy, start] = useTransition();
  const save = () => start(async () => { const fd = new FormData(); fd.set('id', id); fd.set('stepNote', step); fd.set('dialogueLine', line); await saveStepDialogue(fd); setEdit(false); router.refresh(); });
  const label = info.saysKind === 'suggested' ? 'Says (suggested)' : info.saysKind === 'scene' ? 'Scene says' : 'Says';
  if (edit) return (
    <div className={`${compact ? 'basis-full pl-[4.5rem]' : 'mt-1'} space-y-1 text-[12.5px]`} data-testid="pic-notes-edit" onClick={e => e.stopPropagation()}>
      <label className="block"><span className="eyebrow">STEP — what is happening in this picture</span><input className="input mt-0.5 text-[13px]" value={step} onChange={e => setStep(e.target.value)} placeholder={info.step} aria-label="Step" data-testid="pic-step-input" /></label>
      <label className="block"><span className="eyebrow">DIALOGUE — the line this picture goes with</span><input className="input mt-0.5 text-[13px]" value={line} onChange={e => setLine(e.target.value)} placeholder={info.says || 'e.g. Now add the jaggery'} aria-label="Dialogue" data-testid="pic-dialogue-input" /></label>
      <div className="flex gap-2"><button type="button" className="btn btn-sm btn-primary" onClick={save} disabled={busy} data-testid="pic-notes-save">Save</button><button type="button" className="btn btn-sm" onClick={() => setEdit(false)}>Cancel</button></div>
    </div>
  );
  return (
    <div className={`${compact ? 'basis-full pl-[4.5rem]' : 'mt-1'} text-[12.5px] leading-snug`} data-testid="pic-notes">
      <div><b className="text-[#46638A]">{info.stepEnd && info.stepEnd > info.stepNo ? `Steps ${info.stepNo}–${info.stepEnd}` : `Step ${info.stepNo}`} of {info.stepOf}:</b> <span className="text-ink-secondary">{info.step}</span></div>
      {info.says ? <div><b className="text-[#6A4E98]">{label}:</b> <span className={info.saysKind === 'set' ? 'text-ink' : 'italic text-ink-secondary'}>“{info.says}”</span></div> : <div className="text-ink-muted">No dialogue for this picture.</div>}
      <button type="button" className="mt-0.5 text-[12px] font-semibold text-blue-deep hover:underline" onClick={() => setEdit(true)} data-testid="pic-notes-edit-btn">Edit step / dialogue</button>
    </div>
  );
}

/** Small buttons for a picture card that sits inside a form: Don't use / Use again, and remove old versions. (Plain buttons, not nested forms.) */
export function PictureUse({ id, status, versions }: { id: string; status: string; versions: number }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const call = (fn: (fd: FormData) => Promise<void>) => start(async () => { const fd = new FormData(); fd.set('id', id); await fn(fd); router.refresh(); });
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="pic-use">
      {status === 'SKIPPED'
        ? <button type="button" className="btn btn-sm" disabled={busy} data-testid="pic-unskip" onClick={() => call(unskipPicture)}>Use this picture again</button>
        : <button type="button" className="btn btn-sm btn-ghost" disabled={busy} data-testid="pic-skip" onClick={() => { if (window.confirm('Stop using this picture?\n\nIt stays in the plan and its files are kept; it just no longer counts or goes into the video clip. You can use it again any time.')) call(skipPicture); }}>Don’t use this picture</button>}
      {versions > 1 && <button type="button" className="btn btn-sm btn-ghost" disabled={busy} data-testid="pic-remove-old" onClick={() => { if (window.confirm(`Remove the ${versions - 1} older version${versions - 1 === 1 ? '' : 's'} of this picture?\n\nOnly the one in use stays. The others are moved to the Unassigned tab — nothing is deleted.`)) call(removeOldVersions); }}>Remove old versions ({versions - 1})</button>}
    </div>
  );
}

/** Big green one-click approve for a picture that has an uploaded version but is not approved yet. Renders nothing otherwise. */
export function QuickApprove({ id, status, versions, className = '' }: { id: string; status: string; versions: number; className?: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [err, setErr] = useState('');
  if (status === 'APPROVED' || status === 'SKIPPED' || versions < 1) return null;
  return (
    <span className={'inline-flex flex-col ' + className}>
      <button type="button" disabled={busy} data-testid="quick-approve" onClick={e => { e.preventDefault(); e.stopPropagation(); start(async () => { try { setErr(''); const fd = new FormData(); fd.set('id', id); await quickApprove(fd); router.refresh(); } catch (x: any) { setErr(x?.message || 'Could not approve.'); } }); }}
        className="inline-flex items-center gap-1 rounded-lg bg-[#16A34A] px-3 py-1.5 text-[13px] font-extrabold uppercase tracking-wide text-white shadow-sm ring-2 ring-[#BBF7D0] hover:bg-[#15803D] disabled:opacity-60">{busy ? 'Approving…' : '✓ Approve'}</button>
      {err && <span className="text-[11px] text-red-700">{err}</span>}
    </span>
  );
}
