'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { assignUnassignedPicture, deleteUnassignedPicture, moveUnassignedPicture, scanForUnassigned, assignUnassignedClip, deleteUnassignedClip, moveUnassignedClip } from '@/lib/actions/unassigned';
import { uploadSceneClip } from '@/lib/actions/clips';

type Photo = { id: string; name: string; assetId: string | null; reason: string; size: number; folder: string; dims: string };
type Slot = { id: string; code: string; title: string; sceneLabel: string; sceneTitle: string; assetId: string | null; status: string };
type Clip = { id: string; name: string; size: number };
type SceneBox = { id: string; label: string; title: string; clip: { id: string; name: string } | null };
type Proj = { id: string; title: string };
const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Pictures and clips that are in the project folder but not on a slot / scene. Drag onto a target, delete for good, or move to another project. */
export function UnassignedBoard({ projectId, slug, photos, slots, clips, scenes, projects }: { projectId: string; slug: string; photos: Photo[]; slots: Slot[]; clips: Clip[]; scenes: SceneBox[]; projects: Proj[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [drag, setDrag] = useState<{ kind: 'photo' | 'clip'; id: string } | null>(null);
  const dragRef = useRef<{ kind: 'photo' | 'clip'; id: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState<Record<string, string>>({});
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 6000); };
  const run = (label: string, fn: () => Promise<string | void>) => start(async () => { try { flash(`${label}…`); const r = await fn(); flash(r || '✓ Done'); router.refresh(); } catch (e: any) { flash(e?.message || 'That did not work. Try again.'); } });
  const begin = (kind: 'photo' | 'clip', id: string) => (e: React.DragEvent) => { dragRef.current = { kind, id }; setDrag({ kind, id }); e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; };
  const end = () => { dragRef.current = null; setDrag(null); setOver(null); };

  const dropOnSlot = (s: Slot) => (e: React.DragEvent) => {
    e.preventDefault(); const d = dragRef.current; end();
    if (!d || d.kind !== 'photo') return;
    run(`Adding the photo to ${s.code}`, async () => { const r = await assignUnassignedPicture(d.id, s.id); return `✓ Added to ${s.code} “${s.title}” as version ${r.number}${r.approved ? ' and set as its picture' : ' — check it on the picture page'}`; });
  };
  const dropOnScene = (sc: SceneBox) => (e: React.DragEvent) => {
    e.preventDefault(); const d = dragRef.current; end();
    if (!d || d.kind !== 'clip') return;
    run(`Putting the clip on Scene ${sc.label}`, async () => { await assignUnassignedClip(projectId, sc.id, d.id); return `✓ Clip is now on Scene ${sc.label} — the file was renamed to match the storyboard`; });
  };
  const uploadClip = (files: File[]) => run('Saving the clip', async () => {
    const vids = files.filter(f => f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(f.name));
    if (!vids.length) throw new Error('Drop a video file (MP4, MOV, M4V or WebM).');
    for (const f of vids) { const fd = new FormData(); fd.set('projectId', projectId); fd.set('file', f); await uploadSceneClip(fd); }
    return `✓ ${vids.length} clip${vids.length === 1 ? '' : 's'} saved in the Video Clips folder`;
  });
  const pickProject = (key: string) => moveTo[key] || '';
  const projTitle = (id: string) => projects.find(p => p.id === id)?.title ?? 'that project';

  const MoveBox = ({ k, onMove }: { k: string; onMove: (target: string) => void }) => projects.length ? (
    <span className="unassigned-photo__actions">
      <select className="unassigned-select" aria-label="Move to another project" value={pickProject(k)} onChange={e => setMoveTo(m => ({ ...m, [k]: e.target.value }))} data-testid="un-move-select">
        <option value="">Move to project…</option>{projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
      </select>
      <button type="button" className="unassigned-btn" disabled={!pickProject(k) || busy} data-testid="un-move" onClick={() => { const t = pickProject(k); if (t && window.confirm(`Move this file to “${projTitle(t)}”?`)) onMove(t); }}>Move</button>
    </span>
  ) : null;

  return (
    <div data-testid="unassigned-board">
      <div className="unassigned-msg" role="status" data-testid="un-msg">{msg}</div>

      {/* ---------------- pictures ---------------- */}
      <section className="unassigned-section" data-testid="un-pictures">
        <div className="unassigned-section__head"><h2 className="unassigned-section__title">Unassigned pictures</h2><span className="unassigned-section__count" data-testid="un-photo-count">{photos.length}</span>
          <button type="button" className="unassigned-btn" onClick={() => run('Looking in the folder', async () => { await scanForUnassigned(); return '✓ Folder checked'; })} disabled={busy} data-testid="un-scan">Look in the folder now</button></div>
        <p className="unassigned-section__help">Photos in your project folder that are not on a picture slot — including old versions you removed. Drag one onto a picture slot below.</p>
        {photos.length === 0 ? <div className="unassigned-empty" data-testid="un-photo-empty">Nothing here. Every picture in the folder is on a slot.</div> : (
          <div className="unassigned-grid">
            {photos.map(p => (
              <div key={p.id} className={'unassigned-photo' + (drag?.id === p.id ? ' is-dragging' : '')} data-testid="un-photo" data-id={p.id} draggable onDragStart={begin('photo', p.id)} onDragEnd={end}>
                <span className="unassigned-photo__thumb">{p.assetId ? <img src={`/api/files/${p.assetId}?w=360`} alt={p.name} loading="lazy" draggable={false} /> : null}</span>
                <div className="unassigned-photo__name">{p.name}</div>
                <div className="unassigned-photo__why" title={p.reason}>{p.reason}</div>
                <div className="unassigned-photo__why">{[p.dims, kb(p.size)].filter(Boolean).join(' · ')}</div>
                <div className="unassigned-photo__actions">
                  {p.assetId && <button type="button" className="unassigned-btn" onClick={async () => { const r = await fetch('/api/reveal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetId: p.assetId }) }).then(x => x.json()).catch(() => null); if (r && !r.ok && r.path) { await navigator.clipboard.writeText(r.path).catch(() => undefined); flash('Finder only opens on a Mac — the path was copied instead.'); } }}>Show in folder</button>}
                  <button type="button" className="unassigned-btn unassigned-btn--danger" disabled={busy} data-testid="un-delete" onClick={() => { if (window.confirm(`Delete “${p.name}” from your folder for good?\n\nThis cannot be undone.`)) run('Deleting', async () => { await deleteUnassignedPicture(p.id); return '✓ Deleted from the folder'; }); }}>Delete for good</button>
                </div>
                <MoveBox k={`p:${p.id}`} onMove={t => run('Moving', async () => { await moveUnassignedPicture(p.id, t); return `✓ Moved to “${projTitle(t)}”`; })} />
              </div>))}
          </div>)}
        <div className="unassigned-targets">
          <div className="unassigned-targets__title">Picture slots — drop a photo on one</div>
          {slots.length === 0 ? <div className="unassigned-empty">No pictures are planned yet.</div> : (
            <div className="unassigned-grid">
              {slots.map(s => (
                <div key={s.id} className={'unassigned-slot' + (over === `s:${s.id}` ? ' is-over' : '')} data-testid="un-slot" data-id={s.id}
                  onDragOver={e => { if (dragRef.current?.kind === 'photo') { e.preventDefault(); if (over !== `s:${s.id}`) setOver(`s:${s.id}`); } }} onDragLeave={() => setOver(o => (o === `s:${s.id}` ? null : o))} onDrop={dropOnSlot(s)}>
                  <span className="unassigned-slot__thumb">{s.assetId ? <img src={`/api/files/${s.assetId}?w=240`} alt="" loading="lazy" draggable={false} /> : <span className="unassigned-slot__empty">No picture yet</span>}</span>
                  <div className="unassigned-slot__code">{s.code}</div><div className="unassigned-slot__title">{s.title}</div><div className="unassigned-slot__scene">Scene {s.sceneLabel}</div>
                </div>))}
            </div>)}
        </div>
      </section>

      {/* ---------------- video clips ---------------- */}
      <section className="unassigned-section" data-testid="un-clips">
        <div className="unassigned-section__head"><h2 className="unassigned-section__title">Unassigned video clips</h2><span className="unassigned-section__count" data-testid="un-clip-count">{clips.length}</span></div>
        <p className="unassigned-section__help">Video clips in the Video Clips folder that are not on a scene. Drag one onto a scene below, or drop new video files here.</p>
        <div className={'unassigned-empty'} style={{ marginBottom: 12, borderColor: over === 'drop' ? '#6A8FC7' : undefined }} data-testid="un-clip-drop"
          onDragOver={e => { if (Array.from(e.dataTransfer?.types ?? []).includes('Files')) { e.preventDefault(); setOver('drop'); } }} onDragLeave={() => setOver(o => (o === 'drop' ? null : o))}
          onDrop={e => { e.preventDefault(); setOver(null); if (e.dataTransfer.files.length) uploadClip(Array.from(e.dataTransfer.files)); }}>
          Drop video files here, or <label style={{ textDecoration: 'underline', cursor: 'pointer' }}>choose files<input type="file" accept="video/*" multiple className="sr-only" data-testid="un-clip-input" onChange={e => { uploadClip(Array.from(e.target.files ?? [])); e.target.value = ''; }} /></label>
        </div>
        {clips.length === 0 ? <div className="unassigned-empty" data-testid="un-clip-empty">No loose clips. Every clip is on a scene.</div> : (
          <div className="unassigned-grid">
            {clips.map(c => (
              <div key={c.id} className={'unassigned-photo' + (drag?.id === c.id ? ' is-dragging' : '')} data-testid="un-clip" data-id={c.id} draggable onDragStart={begin('clip', c.id)} onDragEnd={end}>
                <a className="unassigned-photo__thumb" href={`/api/files/${c.id}`} target="_blank" rel="noreferrer" draggable={false}><video src={`/api/files/${c.id}#t=0.1`} preload="metadata" muted playsInline /></a>
                <div className="unassigned-photo__name">{c.name}</div>
                <div className="unassigned-photo__why">{kb(c.size)}</div>
                <div className="unassigned-photo__actions">
                  <button type="button" className="unassigned-btn" onClick={async () => { const r = await fetch('/api/reveal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetId: c.id }) }).then(x => x.json()).catch(() => null); if (r && !r.ok && r.path) { await navigator.clipboard.writeText(r.path).catch(() => undefined); flash('Finder only opens on a Mac — the path was copied instead.'); } }}>Show in folder</button>
                  <button type="button" className="unassigned-btn unassigned-btn--danger" disabled={busy} data-testid="un-clip-delete" onClick={() => { if (window.confirm(`Delete “${c.name}” from your folder for good?\n\nThis cannot be undone.`)) run('Deleting', async () => { await deleteUnassignedClip(projectId, c.id); return '✓ Deleted from the folder'; }); }}>Delete for good</button>
                </div>
                <MoveBox k={`c:${c.id}`} onMove={t => run('Moving', async () => { await moveUnassignedClip(projectId, c.id, t); return `✓ Moved to “${projTitle(t)}”`; })} />
              </div>))}
          </div>)}
        <div className="unassigned-targets">
          <div className="unassigned-targets__title">Scenes — drop a clip on one</div>
          {scenes.length === 0 ? <div className="unassigned-empty">No scenes yet.</div> : (
            <div className="unassigned-grid">
              {scenes.map(sc => (
                <div key={sc.id} className={'unassigned-slot' + (over === `sc:${sc.id}` ? ' is-over' : '')} data-testid="un-scene" data-id={sc.id}
                  onDragOver={e => { if (dragRef.current?.kind === 'clip') { e.preventDefault(); if (over !== `sc:${sc.id}`) setOver(`sc:${sc.id}`); } }} onDragLeave={() => setOver(o => (o === `sc:${sc.id}` ? null : o))} onDrop={dropOnScene(sc)}>
                  <span className="unassigned-slot__thumb">{sc.clip ? <video src={`/api/files/${sc.clip.id}#t=0.1`} preload="metadata" muted playsInline /> : <span className="unassigned-slot__empty">No clip yet</span>}</span>
                  <div className="unassigned-slot__code">Scene {sc.label}</div><div className="unassigned-slot__title">{sc.title}</div>{sc.clip && <div className="unassigned-slot__scene">{sc.clip.name}</div>}
                </div>))}
            </div>)}
        </div>
      </section>
      <span hidden data-slug={slug} />
    </div>
  );
}
