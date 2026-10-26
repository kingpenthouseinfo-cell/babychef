'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { assignSceneClip, reorderSceneClips, unassignSceneClip } from '@/lib/actions/clips';

type Clip = { id: string; name: string };
type SceneOpt = { id: string; label: string };

function Player({ id, name }: { id: string; name: string }) {
  return <video src={`/api/files/${id}#t=0.1`} controls preload="metadata" playsInline className="aspect-video w-full rounded-lg bg-black" aria-label={`Preview ${name}`} data-testid="clip-player" />;
}

/** The scene's finished video clips on the Video Clips tab: play each one, put them in order, move one to another scene or take it off the scene (the file stays). */
export function SceneClipsPanel({ projectId, sceneId, clips, scenes }: { projectId: string; sceneId: string; clips: Clip[]; scenes: SceneOpt[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [err, setErr] = useState('');
  const run = (fn: () => Promise<void>) => start(async () => { try { setErr(''); await fn(); router.refresh(); } catch (e: any) { setErr(e?.message || 'That did not work.'); } });
  const swap = (k: number, d: number) => { const ids = clips.map(c => c.id); [ids[k], ids[k + d]] = [ids[k + d], ids[k]]; run(() => reorderSceneClips(projectId, sceneId, ids)); };
  if (!clips.length) return null;
  return (
    <div className="border-t border-line bg-[#F4F9FE] px-5 py-4" data-testid="scene-clips-panel" onClick={e => e.stopPropagation()}>
      <div className="eyebrow !text-[#3E6290]">VIDEO CLIPS ON THIS SCENE — PLAY ORDER</div>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {clips.map((c, k) => (
          <div key={c.id} className="rounded-xl border border-[#B9CFEA] bg-white p-2" data-testid="panel-clip" data-clip-id={c.id}>
            <div className="mb-1 flex items-center gap-2 text-[12.5px]"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#3E6290] text-[11px] font-extrabold text-white">{k + 1}</span><span className="min-w-0 flex-1 truncate" title={c.name}>{c.name}</span></div>
            <Player id={c.id} name={c.name} />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <button type="button" className="btn btn-sm" disabled={busy || k === 0} data-testid="panel-earlier" onClick={() => swap(k, -1)}>← Earlier</button>
              <button type="button" className="btn btn-sm" disabled={busy || k === clips.length - 1} data-testid="panel-later" onClick={() => swap(k, 1)}>Later →</button>
              <select className="input h-8 max-w-[150px] text-[12px]" aria-label="Move to another scene" value="" disabled={busy} onChange={e => { const to = e.target.value; if (to) run(() => assignSceneClip(projectId, to, c.id)); }}>
                <option value="">Move to scene…</option>{scenes.filter(s => s.id !== sceneId).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <button type="button" className="btn btn-sm btn-ghost" disabled={busy} data-testid="panel-remove" onClick={() => run(() => unassignSceneClip(projectId, sceneId, c.id))}>Take off</button>
            </div>
          </div>
        ))}
      </div>
      {err && <div className="mt-2 text-[12.5px] text-red-700">{err}</div>}
    </div>
  );
}

/** Clips that are in the project's Video Clips folder but not on a scene yet: preview them and put each on a scene. */
export function WaitingClips({ projectId, clips, scenes }: { projectId: string; clips: Clip[]; scenes: SceneOpt[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [err, setErr] = useState('');
  if (!clips.length) return null;
  return (
    <div className="rounded-[16px] border border-[#B9CFEA] bg-[#F4F9FE] p-4" data-testid="waiting-clips">
      <div className="eyebrow !text-[#3E6290]">CLIPS WAITING FOR A SCENE ({clips.length})</div>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {clips.map(c => (
          <div key={c.id} className="rounded-xl border border-[#B9CFEA] bg-white p-2" data-testid="waiting-clip">
            <div className="mb-1 truncate text-[12.5px]" title={c.name}>{c.name}</div>
            <Player id={c.id} name={c.name} />
            <select className="input mt-2 h-8 w-full text-[12px]" aria-label="Put on scene" value="" disabled={busy} data-testid="waiting-put" onChange={e => { const to = e.target.value; if (to) start(async () => { try { setErr(''); await assignSceneClip(projectId, to, c.id); router.refresh(); } catch (x: any) { setErr(x?.message || 'That did not work.'); } }); }}>
              <option value="">Put on scene…</option>{scenes.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        ))}
      </div>
      {err && <div className="mt-2 text-[12.5px] text-red-700">{err}</div>}
    </div>
  );
}
