'use client';
import { useState, useTransition } from 'react';
import { leanKlingRequest } from '@/lib/actions/kling';

/** Copies a SHORT request for ChatGPT: the rules + this clip's facts, or just the facts. Nothing is sent anywhere. */
export function CopyRequest({ projectId, klingId }: { projectId: string; klingId: string }) {
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState('');
  const copy = (factsOnly: boolean) => start(async () => {
    try {
      const t = await leanKlingRequest(projectId, klingId, factsOnly);
      await navigator.clipboard.writeText(t);
      setMsg(`✓ Copied (${t.split(/\s+/).length} words) — paste it into ChatGPT`);
    } catch { setMsg('Could not copy. Try again.'); }
    setTimeout(() => setMsg(''), 6000);
  });
  return (
    <div className="prompt-row__request" data-testid="copy-request">
      <button type="button" className="prompt-row__btn prompt-row__btn--copy" disabled={busy} data-testid="copy-request-full" title="The writing rules plus this clip's pictures, actions and exact dialogue" onClick={() => copy(false)}>COPY REQUEST</button>
      <button type="button" className="prompt-row__btn" disabled={busy} data-testid="copy-request-facts" title="Only this clip's facts. Use when the rules are already saved in your ChatGPT Project" onClick={() => copy(true)}>COPY FACTS ONLY</button>
      {msg && <span className="prompt-row__msg" role="status" data-testid="copy-request-msg">{msg}</span>}
    </div>
  );
}
