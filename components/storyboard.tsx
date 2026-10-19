'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { saveStoryboard, addStoryboardPicture } from '@/lib/actions/storyboard';

export type SbPic = { id: string; seq: number; code: string; title: string; assetId: string | null; status: string };
export type SbScene = { id: string; label: string; title: string; pics: SbPic[] };

/** Storyboard: every picture as a thumbnail in video order, grouped by scene. Drag a picture to move it (even into another scene), drag a scene bar to move the whole scene, "+" to add a picture in between. The order you leave it in is the saved order. */
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
  const dropScene = (targetSceneId: string, after: boolean) => {
    const d = drag.current; drag.current = null; setHint('');
    if (!d || d.kind !== 'scene' || d.id === targetSceneId) return;
    const moving = scenes.find(s => s.id === d.id)!; const rest = scenes.filter(s => s.id !== d.id);
    let at = rest.findIndex(s => s.id === targetSceneId); if (after) at += 1;
    rest.splice(at, 0, moving); persist(rest);
  };
  const side = (e: React.DragEvent, horizontal: boolean) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); return horizontal ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2; };
  const total = scenes.reduce((n, s) => n + s.pics.length, 0);

  return (
    <div className="storyboard" data-testid="storyboard">
      <div className="storyboard__bar"><span className="storyboard__count">{total} picture{total === 1 ? '' : 's'} · {scenes.length} scene{scenes.length === 1 ? '' : 's'}</span><span className="storyboard__msg" role="status" data-testid="sb-msg">{busy && !msg ? 'Saving…' : msg}</span></div>
      {scenes.map(sc => (
        <section key={sc.id} className="storyboard__scene" data-testid="sb-scene" data-scene-id={sc.id}
          onDragOver={e => { const d = drag.current; if (d?.kind === 'scene') { e.preventDefault(); setHint(`s:${sc.id}:${side(e, false) ? 'a' : 'b'}`); } }}
          onDrop={e => { if (drag.current?.kind === 'scene') { e.preventDefault(); dropScene(sc.id, side(e, false)); } }}>
          <header className={`storyboard__head ${hint === `s:${sc.id}:b` ? 'is-before' : hint === `s:${sc.id}:a` ? 'is-after' : ''}`}>
            <span className="storyboard__grip" draggable data-testid="sb-scene-grip" title="Drag to move the whole scene" aria-label={`Move scene ${sc.label}`} onDragStart={e => { drag.current = { kind: 'scene', id: sc.id }; e.dataTransfer.setData('text/plain', sc.id); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { drag.current = null; setHint(''); }}>⠿</span>
            <span className="storyboard__scene-label">Scene {sc.label}</span><span className="storyboard__scene-title">{sc.title}</span>
            <span className="storyboard__scene-count">{sc.pics.length} picture{sc.pics.length === 1 ? '' : 's'}</span>
            <button type="button" className="storyboard__add-end" data-testid="sb-add-end" onClick={() => add(sc.id, null)} disabled={busy}>+ Add picture</button>
          </header>
          <div className="storyboard__tiles"
            onDragOver={e => { if (drag.current?.kind === 'pic') { e.preventDefault(); } }}
            onDrop={e => { if (drag.current?.kind === 'pic' && e.target === e.currentTarget) { e.preventDefault(); dropPic(sc.id, null, true); } }}>
            {sc.pics.length === 0 && (
              <div className="storyboard__empty" data-testid="sb-empty" onDragOver={e => { if (drag.current?.kind === 'pic') e.preventDefault(); }} onDrop={e => { e.preventDefault(); e.stopPropagation(); dropPic(sc.id, null, true); }}>
                <span className="storyboard__empty-text">No picture yet</span><span className="storyboard__empty-hint">Drop a picture here</span>
                <button type="button" className="storyboard__add" data-testid="sb-add" onClick={() => add(sc.id, null)} disabled={busy}>+ Add one</button>
              </div>)}
            {sc.pics.map((p, i) => (
              <div key={p.id} className="storyboard__slot">
                {i === 0 && <button type="button" className="storyboard__add storyboard__add--start" data-testid="sb-add" aria-label="Add a picture before this one" title="Add a picture here" onClick={() => add(sc.id, 'START')} disabled={busy}>+</button>}
                <div className={`storyboard__tile ${hint === `p:${p.id}:b` ? 'is-before' : hint === `p:${p.id}:a` ? 'is-after' : ''}`} data-testid="sb-tile" data-pic-id={p.id} draggable
                  onDragStart={e => { drag.current = { kind: 'pic', id: p.id }; e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { drag.current = null; setHint(''); }}
                  onDragOver={e => { if (drag.current?.kind === 'pic' && drag.current.id !== p.id) { e.preventDefault(); e.stopPropagation(); setHint(`p:${p.id}:${side(e, true) ? 'a' : 'b'}`); } }}
                  onDrop={e => { if (drag.current?.kind === 'pic') { e.preventDefault(); e.stopPropagation(); dropPic(sc.id, p.id, side(e, true)); } }}>
                  <Link href={`/projects/${slug}/images/${p.id}`} className="storyboard__thumb" draggable={false} title={`${p.code} · ${p.title}`}>{p.assetId ? <img src={`/api/files/${p.assetId}?w=240`} alt={p.title} loading="lazy" draggable={false} /> : <span className="storyboard__thumb-empty">No picture yet</span>}</Link>
                  <div className="storyboard__code">{p.code}<span className={`storyboard__dot storyboard__dot--${p.status.toLowerCase().replace(/[^a-z]+/g, '-')}`} title={p.status} /></div>
                  <div className="storyboard__title">{p.title}</div>
                </div>
                <button type="button" className="storyboard__add" data-testid="sb-add" aria-label="Add a picture after this one" title="Add a picture here" onClick={() => add(sc.id, p.id)} disabled={busy}>+</button>
              </div>))}
          </div>
        </section>))}
    </div>
  );
}
