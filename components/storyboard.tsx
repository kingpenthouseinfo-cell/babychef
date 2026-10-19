'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { saveStoryboard, addStoryboardPicture, renameScene } from '@/lib/actions/storyboard';
import { RevealButton } from './image-workspace';

export type SbPic = { id: string; seq: number; code: string; title: string; assetId: string | null; status: string };
export type SbScene = { id: string; label: string; title: string; pics: SbPic[] };

/** The scene's name: click it to edit (Enter or click away saves, Esc cancels). */
function SceneTitle({ sceneId, label, title, onSaved }: { sceneId: string; label: string; title: string; onSaved: (t: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(title);
  const [err, setErr] = useState('');
  const [, start] = useTransition();
  const done = (save: boolean) => {
    setEditing(false);
    if (!save || v.trim() === title.trim()) { setV(title); return; }
    start(async () => { try { const r = await renameScene(sceneId, v); onSaved(r.title); setErr(''); } catch (e: any) { setErr(e?.message || 'Could not rename'); setV(title); } });
  };
  return (
    <span className="storyboard__scene-tag" data-testid="sb-scene-tag">
      <span className="storyboard__scene-no">Scene {label}</span>
      {editing
        ? <input className="storyboard__scene-input" data-testid="sb-scene-input" autoFocus aria-label={`Name of scene ${label}`} value={v} onChange={e => setV(e.target.value)} onBlur={() => done(true)} onKeyDown={e => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); }} />
        : <button type="button" className="storyboard__scene-name" data-testid="sb-scene-name" title="Click to rename this scene" onClick={() => { setV(title); setEditing(true); }}>{title}</button>}
      {err && <span className="storyboard__scene-err" role="alert">{err}</span>}
    </span>
  );
}

/** Storyboard: every picture as a thumbnail in one flat run, in video order (no scene grouping). Drag a picture to move it — it joins the scene of the picture it lands next to. "+" adds a picture in between; a scene with no pictures shows a placeholder in its place. The order you leave it in is the saved order. */
export function Storyboard({ projectId, slug, initial }: { projectId: string; slug: string; initial: SbScene[] }) {
  const router = useRouter();
  const [scenes, setScenes] = useState<SbScene[]>(initial);
  const [msg, setMsg] = useState('');
  const [busy, start] = useTransition();
  const drag = useRef<{ kind: 'pic' | 'scene'; id: string } | null>(null);
  const [hint, setHint] = useState<string>(''); // id + side being hovered, for the drop marker
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };

  const persist = (next: SbScene[]) => {
    const prev = scenes; setScenes(next); setMsg('Saving…');
    start(async () => { try { await saveStoryboard(projectId, next.map(s => ({ sceneId: s.id, pictureIds: s.pics.map(p => p.id) }))); flash('Saved ✓'); router.refresh(); } catch (e: any) { setScenes(prev); flash(e?.message || 'Could not save. Try again.'); } });
  };
  const add = (sceneId: string, afterImageId: string | null) => start(async () => {
    try { setMsg('Adding…'); await addStoryboardPicture(projectId, sceneId, afterImageId); flash('Picture added ✓'); router.refresh(); } catch (e: any) { flash(e?.message || 'Could not add. Try again.'); }
  });
  // picture dropped: before/after a picture, or at the end of a scene
  const dropPic = (sceneId: string, targetPicId: string | null, after: boolean) => {
    const d = drag.current; drag.current = null; setHint('');
    if (!d || d.kind !== 'pic' || d.id === targetPicId) return;
    const pic = scenes.flatMap(s => s.pics).find(p => p.id === d.id); if (!pic) return;
    const next = scenes.map(s => ({ ...s, pics: s.pics.filter(p => p.id !== d.id) }));
    const lane = next.find(s => s.id === sceneId)!;
    let at = targetPicId ? lane.pics.findIndex(p => p.id === targetPicId) : lane.pics.length;
    if (targetPicId && after) at += 1;
    lane.pics.splice(Math.max(0, at), 0, pic);
    persist(next);
  };
  const side = (e: React.DragEvent, horizontal: boolean) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); return horizontal ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2; };
  const total = scenes.reduce((n, s) => n + s.pics.length, 0);

  const firstScene = scenes.find(sc => sc.pics.length > 0);
  return (
    <div className="storyboard" data-testid="storyboard">
      <div className="storyboard__bar"><span className="storyboard__count">{total} picture{total === 1 ? '' : 's'}</span><span className="storyboard__msg" role="status" data-testid="sb-msg">{busy && !msg ? 'Saving…' : msg}</span></div>
      <div className="storyboard__tiles" data-testid="sb-tiles">
        {firstScene && <button type="button" className="storyboard__add storyboard__add--start" data-testid="sb-add" aria-label="Add a picture at the very start" title="Add a picture at the start" onClick={() => add(firstScene.id, 'START')} disabled={busy}>+</button>}
        {scenes.flatMap(sc => sc.pics.length === 0 ? [(
          <div key={`empty-${sc.id}`} className="storyboard__empty" data-testid="sb-empty" data-scene-id={sc.id} onDragOver={e => { if (drag.current?.kind === 'pic') e.preventDefault(); }} onDrop={e => { e.preventDefault(); dropPic(sc.id, null, true); }}>
            <SceneTitle sceneId={sc.id} label={sc.label} title={sc.title} onSaved={t => setScenes(a => a.map(x => x.id === sc.id ? { ...x, title: t } : x))} /><span className="storyboard__empty-text">No picture yet</span>
            <button type="button" className="storyboard__add" data-testid="sb-add" onClick={() => add(sc.id, null)} disabled={busy}>+ Add one</button>
          </div>)] : sc.pics.map((p, pi) => (
          <div key={p.id} className="storyboard__slot">
            <div className="storyboard__col">
            {pi === 0 ? <SceneTitle sceneId={sc.id} label={sc.label} title={sc.title} onSaved={t => setScenes(a => a.map(x => x.id === sc.id ? { ...x, title: t } : x))} /> : <span className="storyboard__scene-tag storyboard__scene-tag--spacer" aria-hidden />}
            <div className={`storyboard__tile ${hint === `p:${p.id}:b` ? 'is-before' : hint === `p:${p.id}:a` ? 'is-after' : ''}`} data-testid="sb-tile" data-pic-id={p.id} data-scene-id={sc.id} draggable
              onDragStart={e => { drag.current = { kind: 'pic', id: p.id }; e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { drag.current = null; setHint(''); }}
              onDragOver={e => { if (drag.current?.kind === 'pic' && drag.current.id !== p.id) { e.preventDefault(); setHint(`p:${p.id}:${side(e, true) ? 'a' : 'b'}`); } }}
              onDrop={e => { if (drag.current?.kind === 'pic') { e.preventDefault(); dropPic(sc.id, p.id, side(e, true)); } }}>
              <Link href={`/projects/${slug}/images/${p.id}`} className="storyboard__thumb" draggable={false} title={`${p.code} · ${p.title}`}>{p.assetId ? <img src={`/api/files/${p.assetId}?w=240`} alt={p.title} loading="lazy" draggable={false} /> : <span className="storyboard__thumb-empty">No picture yet</span>}</Link>
              <div className="storyboard__code">{p.code}<span className={`storyboard__dot storyboard__dot--${p.status.toLowerCase().replace(/[^a-z]+/g, '-')}`} title={p.status} /></div>
              <div className="storyboard__title">{p.title}</div>
              {p.assetId && <RevealButton assetId={p.assetId} label="Open in folder" className="storyboard__folder" />}
            </div>
            </div>
            <button type="button" className="storyboard__add" data-testid="sb-add" aria-label="Add a picture after this one" title="Add a picture here" onClick={() => add(sc.id, p.id)} disabled={busy}>+</button>
          </div>)))}
      </div>
    </div>
  );
}
