'use client';
import { useState } from 'react';
import { autoTitle } from '@/lib/auto-title';
import { expectedFilename } from '@/lib/naming';

export type PicCtx = { slug: string; sceneOrder: number; nextSeq: number };

/** "What picture do you need?" + live "WILL BE ADDED AS" preview. Title, number, filename and version are automatic. */
export function AddPictureFields({ ctx, scenes, sceneId, big = false, extra }: { ctx: PicCtx; scenes?: { id: string; order: number }[]; sceneId?: string; big?: boolean; extra?: React.ReactNode }) {
  const [what, setWhat] = useState('');
  const [title, setTitle] = useState('');
  const [sc, setSc] = useState(sceneId ?? '');
  const order = scenes?.find(s => s.id === sc)?.order ?? ctx.sceneOrder;
  const shown = (title.trim() || autoTitle(what, ctx.nextSeq));
  const file = expectedFilename({ slug: ctx.slug, sceneOrder: order, seq: ctx.nextSeq, title: shown, version: 1 });
  return (
    <>
      <label className="block"><span className="label">What picture do you need?</span>
        <textarea name="what" rows={big ? 3 : 2} className="input" value={what} onChange={e => setWhat(e.target.value)} placeholder="e.g. Close-up of Baby Chef rubbing the butter into the flour" autoFocus={false} /></label>
      <div className="rounded-lg border border-line bg-white p-3 text-[13px]" aria-live="polite" data-testid="will-be-added">
        <div className="eyebrow">WILL BE ADDED AS</div>
        <div className="mt-1 font-semibold">Picture {ctx.nextSeq} · {shown}</div>
        <div className="mt-0.5 break-all font-mono text-[11.5px] text-ink-secondary">File: {file}</div>
      </div>
      <details className="text-[13px]"><summary className="cursor-pointer text-ink-secondary">More details (optional)</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {scenes && <label className="block sm:col-span-2"><span className="label">Scene</span>
            <select className="input" value={sc} onChange={e => setSc(e.target.value)} name="sceneId" aria-label="Scene">{scenes.map(s => <option key={s.id} value={s.id}>{(s as any).label}</option>)}</select></label>}
          <label className="block sm:col-span-2"><span className="label">Picture name (we make one for you — change it if you like)</span>
            <input name="title" className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder={shown} /></label>
          {extra}
        </div>
      </details>
    </>
  );
}
