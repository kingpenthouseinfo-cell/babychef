'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { startGenerating } from '@/lib/actions/image';
import { CopyButton } from './client';

/** MAKE PICTURE: copies the full prompt (file name included), opens ChatGPT in a new tab and marks the picture as being made. One click, no modal. */
export function MakePictureButton({ imageId, text, chatgpt, label = 'Make picture', className = 'btn btn-accent min-h-[52px] w-full px-6 text-[16px]', mark = true, onDone }: { imageId: string; text: string; chatgpt: string; label?: string; className?: string; mark?: boolean; onDone?: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [, start] = useTransition();
  async function go() {
    // open first: browsers only allow a new tab straight from the click
    try { window.open(chatgpt || 'https://chatgpt.com/', '_blank', 'noopener,noreferrer'); } catch { /* popup blocked: the copy still works */ }
    let copied = false;
    try { await navigator.clipboard.writeText(text); copied = true; } catch {
      try { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); copied = document.execCommand('copy'); document.body.removeChild(ta); } catch { copied = false; }
    }
    setState(copied ? 'ok' : 'fail');
    if (copied) setTimeout(() => setState('idle'), 4500);
    if (mark) start(async () => { await startGenerating(imageId); router.refresh(); });
    onDone?.();
  }
  return (
    <div>
      <button type="button" onClick={go} disabled={!text.trim()} className={className}>{label}</button>
      <div className="mt-2 min-h-[22px] text-[13px]" role="status" aria-live="polite">
        {state === 'ok' && <span className="font-medium text-[#46704F]">✓ Prompt copied. ChatGPT opened.</span>}
        {state === 'fail' && <span className="flex flex-wrap items-center gap-3 text-[#A5473A]">Couldn’t copy automatically. <CopyButton text={text} label="Copy prompt" variant="secondary" className="btn-sm" /></span>}
      </div>
    </div>
  );
}
