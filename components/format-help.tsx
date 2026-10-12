'use client';
import { useState } from 'react';
import { chatgptInstructions, everythingForChatgpt, helpFor, type HelpKind } from '@/lib/format-help';

async function copyText(t: string) {
  try { await navigator.clipboard.writeText(t); return true; } catch {
    try { const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); document.body.removeChild(ta); return ok; } catch { return false; }
  }
}

/** HOW SHOULD I FORMAT THIS? — collapsed help at the top of every importer. */
export function FormatHelp({ kind, open: openProp }: { kind: HelpKind; open?: boolean }) {
  const h = helpFor(kind);
  const [open, setOpen] = useState(!!openProp);
  const [done, setDone] = useState('');
  const [ex, setEx] = useState(false);
  async function copy(id: string, text: string) { if (await copyText(text)) { setDone(id); setTimeout(() => setDone(''), 1800); } }
  const Btn = ({ id, text, label, cls = 'btn btn-copy' }: { id: string; text: string; label: string; cls?: string }) => <button type="button" className={cls} onClick={() => copy(id, text)}>{done === id ? '✓ Copied' : label}</button>;
  return (
    <div className="rounded-[14px] border border-line bg-white" data-testid="format-help">
      <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span><span className="block text-[14px] font-semibold">How should I format this?</span><span className="block text-[12.5px] text-ink-secondary">{h.intro} Not sure how? Open this.</span></span>
        <span aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-line px-4 py-4">
          <p className="text-[13.5px] text-ink-secondary">Use ChatGPT to format it for you. Copy these instructions, paste them into ChatGPT, then paste your {h.source} underneath.</p>
          <div className="flex flex-wrap gap-2">
            <Btn id="all" text={everythingForChatgpt(kind)} label="COPY EVERYTHING FOR CHATGPT" cls="btn btn-approve" />
            <Btn id="instr" text={chatgptInstructions(kind)} label="COPY CHATGPT INSTRUCTIONS" />
            <Btn id="blank" text={h.blank} label="COPY BLANK TEMPLATE" cls="btn" />
            <button type="button" className="btn" aria-pressed={ex} onClick={() => setEx(!ex)}>{ex ? 'HIDE EXAMPLE' : 'SHOW EXAMPLE'}</button>
          </div>
          {ex && <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-surface p-3 font-mono text-[12.5px]" data-testid="format-example">{h.example}</pre>}
          <p className="text-[12.5px] text-ink-secondary">You don’t need ChatGPT. Baby Chef Studio reads this format on your computer.</p>
        </div>
      )}
    </div>
  );
}
