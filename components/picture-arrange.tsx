'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { movePictureStep, movePictureToScene, swapPictures } from '@/lib/actions/arrange';

/** Move a picture up/down, into another scene, or swap it with another picture. Plain buttons (works inside the batch form). IMG numbers and files never change. */
export function PictureArrange({ imageId, sceneId, scenes, pictures }: { imageId: string; sceneId: string; scenes: { id: string; label: string }[]; pictures: { id: string; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [scene, setScene] = useState(''), [other, setOther] = useState('');
  const run = (fn: (fd: FormData) => Promise<void>, data: Record<string, string>) => start(async () => { const fd = new FormData(); fd.set('imageId', imageId); for (const [k, v] of Object.entries(data)) fd.set(k, v); await fn(fd); router.refresh(); });
  const sel = 'input h-9 min-w-[150px] max-w-[260px] text-[12.5px]';
  return (
    <details className="text-[12.5px]" data-testid="arrange">
      <summary className="cursor-pointer font-semibold text-ink-secondary">Move or reorder</summary>
      <div className="mt-2 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-sm" disabled={pending} onClick={() => run(movePictureStep, { dir: 'up' })} aria-label="Move this picture up">↑ MOVE UP</button>
          <button type="button" className="btn btn-sm" disabled={pending} onClick={() => run(movePictureStep, { dir: 'down' })} aria-label="Move this picture down">↓ MOVE DOWN</button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className={sel} aria-label="Move to scene" value={scene} onChange={e => setScene(e.target.value)}><option value="">Move to scene…</option>{scenes.filter(s => s.id !== sceneId).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
          <button type="button" className="btn btn-sm" disabled={pending || !scene} onClick={() => { run(movePictureToScene, { sceneId: scene }); setScene(''); }}>MOVE TO SCENE</button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className={sel} aria-label="Swap with picture" value={other} onChange={e => setOther(e.target.value)}><option value="">Swap places with…</option>{pictures.filter(p => p.id !== imageId).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
          <button type="button" className="btn btn-sm" disabled={pending || !other} onClick={() => { run(swapPictures, { otherId: other }); setOther(''); }}>SWAP</button>
        </div>
      </div>
    </details>
  );
}
