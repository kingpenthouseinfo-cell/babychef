'use client';
// Storyboard tab: picture row + Scene Storyboard. Styles live in app/storyboard.css (import it once in layout or here).
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SbBoard, addPicture, addScene, dotClass, flatten, movePicture, movePictureToScene,
  moveScene, renamePicture, renameScene, toSavePayload,
} from '@/lib/storyboard-order';

export type ClipInfo = { id: string; name: string };

type Props = {
  sceneClips?: Record<string, ClipInfo[]>;                                   // finished video clip on each scene (by scene id)
  tray?: ClipInfo[];                                                       // clips not on any scene yet
  onUploadClip?: (sceneId: string | null, file: File) => Promise<void>;   // save a video file into the project's Video Clips folder (and onto a scene)
  onAssignClip?: (sceneId: string, assetId: string) => Promise<void>;
  onApprove?: (pictureId: string) => Promise<void>;                     // one-click approve of the newest version
  onSetUsed?: (pictureId: string, used: boolean) => Promise<void>;       // "Don't use this picture" / "Use it again"
  onRemoveOld?: (pictureId: string) => Promise<void>;                     // move all but the picture in use to the Unassigned tab
  onCleanAll?: () => Promise<{ versions: number; pictures: number }>;     // count of old versions in the whole project
  onCleanAllDo?: () => Promise<void>;
  onReplacePicture?: (pictureId: string, file: File) => Promise<void>;   // drop an image file on a picture tile: it becomes that picture's photo (older versions are kept)
  onUnassignClip?: (sceneId: string, assetId?: string) => Promise<void>;
  onReorderClips?: (sceneId: string, orderedIds: string[]) => Promise<void>;   // put a scene's clips in a new play order
  initial: SbBoard;
  onSave: (payload: ReturnType<typeof toSavePayload>) => Promise<{ renamed?: number } | void>;
  onCheckFolder?: () => Promise<{ count: number; examples: string[] }>;   // how many files do not match this order yet
  onMatchFolder?: () => Promise<{ renamed: number }>;                     // rename the files in the folder to match this order   // persists the order for the whole app
  onOpenPicture: (pictureId: string) => void;                              // go to Picture detail
  revealInFinder?: (assetId: string) => Promise<void>;                     // defaults to POST /api/reveal
};

const FolderIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round">
    <path d="M1.75 4.25a1 1 0 0 1 1-1h3.4l1.5 1.5h5.6a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H2.75a1 1 0 0 1-1-1z" />
  </svg>
);

export default function Storyboard({ initial, onSave, onOpenPicture, revealInFinder, onCheckFolder, onMatchFolder, sceneClips = {}, tray = [], onUploadClip, onAssignClip, onUnassignClip, onReorderClips, onReplacePicture, onApprove, onSetUsed, onRemoveOld, onCleanAll, onCleanAllDo }: Props) {
  const [saved, setSaved] = useState<SbBoard>(initial);
  const [board, setBoard] = useState<SbBoard>(initial);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState('');
  const [drag, setDrag] = useState<string | null>(null);         // picture id being dragged
  const [over, setOver] = useState<string | null>(null);         // drop key "sceneId:index" | "end"
  const [dragScene, setDragScene] = useState<string | null>(null);
  const [overScene, setOverScene] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);   // "p:<id>" | "s:<id>"
  const [draftText, setDraftText] = useState('');
  const [picking, setPicking] = useState<string | null>(null);   // picture id with scene dropdown open
  const [opened, setOpened] = useState<string | null>(null);

  // ---- video clips: drop a video file (or drag one from the tray) on a scene box ----
  const dragClipRef = useRef<string | null>(null);                  // clip id being dragged (a ref: drag events can fire faster than React re-renders)
  const [dragClip, setDragClipState] = useState<string | null>(null);
  const setDragClip = (v: string | null) => { dragClipRef.current = v; setDragClipState(v); };
  const [clipOver, setClipOver] = useState<string | null>(null);   // scene id a clip is hovering over
  const [clipMsg, setClipMsg] = useState('');
  // ---- drop an image file from Finder on a picture tile: replace (or add) that picture's photo ----
  const [fileOver, setFileOver] = useState<string | null>(null);
  const [picMsg, setPicMsg] = useState('');
  const flashPic = (m: string) => { setPicMsg(m); setTimeout(() => setPicMsg(''), 5000); };
  const guard = async (what: string, fn: () => Promise<void>) => {
    if (dirty) { flashPic('Save order (or Undo changes) first, then do that.'); return; }
    try { flashPic(`${what}…`); await fn(); flashPic(`✓ ${what} — done`); } catch (e: any) { flashPic(e?.message || 'That did not work.'); }
  };
  const cleanAll = async () => {
    if (!onCleanAll || !onCleanAllDo) return;
    if (dirty) { flashPic('Save order (or Undo changes) first, then do that.'); return; }
    const c = await onCleanAll();
    if (!c.versions) { flashPic('✓ There are no old versions to remove'); return; }
    if (window.confirm(`Remove ${c.versions} old picture version${c.versions === 1 ? '' : 's'} from ${c.pictures} picture${c.pictures === 1 ? '' : 's'}?\n\nFor each picture only the one in use stays. The others are moved to the Unassigned tab — nothing is deleted.`)) await guard('Removing old versions', onCleanAllDo);
  };
  const replacePhoto = async (p: { id: string; title: string; isNew?: boolean }, files: File[]) => {
    setFileOver(null);
    if (!onReplacePicture) return;
    if (dirty) { flashPic('Save order (or Undo changes) first, then drop the photo.'); return; }
    if (p.isNew || p.id.includes('_new_')) { flashPic('Press Save order first, then drop the photo on the new picture.'); return; }
    if (files.some(f => /\.(heic|heif)$/i.test(f.name))) { flashPic('HEIC photos are not supported yet. Export as JPG or PNG first.'); return; }
    const pic = files.find(f => f.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(f.name));
    if (!pic) { flashPic('Drop a PNG, JPG or WebP picture.'); return; }
    try { flashPic(`Replacing the photo of “${p.title}”…`); await onReplacePicture(p.id, pic); flashPic(`✓ New photo saved for “${p.title}” (the old one is kept as an earlier version)`); } catch (e: any) { flashPic(e?.message || 'Could not replace the photo.'); }
  };
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
  const flashClip = (m: string) => { setClipMsg(m); setTimeout(() => setClipMsg(''), 5000); };
  const isVideo = (f: File) => f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(f.name);
  const uploadClips = async (sceneId: string | null, files: File[]) => {
    if (!onUploadClip) return;
    const vids = files.filter(isVideo);
    if (!vids.length) { flashClip('Drop a video file (MP4, MOV, M4V or WebM).'); return; }
    if (sceneId && sceneId.includes('_new_')) { flashClip('Press Save order first, then drop the clip on the new scene.'); return; }
    try {
      for (const [n, f] of vids.entries()) { flashClip(`Saving ${f.name}…`); await onUploadClip(n === 0 ? sceneId : null, f); }
      flashClip(sceneId ? '✓ Clip saved in the Video Clips folder and put on the scene' : '✓ Clip saved in the Video Clips folder');
    } catch (e: any) { flashClip(e?.message || 'Could not save that clip. Try again.'); }
  };
  const dropOnScene = (sceneId: string) => async (e: React.DragEvent) => {
    e.preventDefault(); setClipOver(null);
    const cid = dragClipRef.current; setDragClip(null);
    if (hasFiles(e)) { await uploadClips(sceneId, Array.from(e.dataTransfer.files)); return; }
    if (cid && onAssignClip) {
      if (sceneId.includes('_new_')) { flashClip('Press Save order first, then drop the clip on the new scene.'); return; }
      try { await onAssignClip(sceneId, cid); flashClip('✓ Clip put on the scene — the file was renamed to match the storyboard'); } catch (er: any) { flashClip(er?.message || 'Could not move that clip.'); }
    }
  };
  const change = (next: SbBoard) => { setBoard(next); setDirty(true); setMsg(''); };
  const cells = useMemo(() => flatten(board), [board]);
  const total = board.reduce((a, s) => a + s.pictures.length, 0);
  const last = board[board.length - 1];

  // warn before leaving with unsaved order
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const startEdit = (key: string, text: string) => { setEditing(key); setDraftText(text); };
  const commitEdit = () => {
    if (!editing) return;
    const [kind, id] = [editing.slice(0, 1), editing.slice(2)];
    const v = draftText.trim();
    setEditing(null);
    if (!v) return;
    change(kind === 'p' ? renamePicture(board, id, v) : renameScene(board, id, v));
  };
  const editKeys = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') setEditing(null);
  };

  const over_ = (key: string) => (e: React.DragEvent) => { e.preventDefault(); if (over !== key) setOver(key); };
  const dropPic = (sceneId: string, index: number) => (e: React.DragEvent) => {
    e.preventDefault(); if (drag) change(movePicture(board, drag, sceneId, index)); setDrag(null); setOver(null);
  };
  const overS = (key: string) => (e: React.DragEvent) => { e.preventDefault(); if (overScene !== key) setOverScene(key); };
  const dropScene = (index: number) => (e: React.DragEvent) => {
    e.preventDefault(); if (dragScene) change(moveScene(board, dragScene, index)); setDragScene(null); setOverScene(null);
  };

  const reveal = async (path: string, id: string) => {
    if (revealInFinder) await revealInFinder(path);
    else { const r = await fetch('/api/reveal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetId: path }) }).then(x => x.json()).catch(() => null); if (r && !r.ok && r.path) { await navigator.clipboard.writeText(r.path).catch(() => undefined); setOpened(id + ':copied'); setTimeout(() => setOpened(null), 1800); return; } }
    setOpened(id); setTimeout(() => setOpened(null), 1400);
  };

  const save = async () => {
    setMsg('Saving…');
    let renamed = 0;
    try { const r = await onSave(toSavePayload(board)); renamed = (r && r.renamed) || 0; } catch (e: any) { setMsg(e?.message || 'Could not save. Try again.'); return; }
    setSaved(board); setDirty(false); setMsg(renamed ? `✓ Order saved · ${renamed} file name${renamed === 1 ? '' : 's'} in the folder updated` : '✓ Order saved');
  };
  const matchFolder = async () => {
    if (!onCheckFolder || !onMatchFolder) return;
    setMsg('Checking the folder…');
    try {
      const c = await onCheckFolder();
      if (!c.count) { setMsg('✓ The folder already matches this order'); return; }
      if (!window.confirm(`Rename ${c.count} picture file${c.count === 1 ? '' : 's'} in your folder so they list in this order?\n\nFor example:\n${c.examples.join('\n')}\n\nNothing is deleted. The old names are saved in a log inside the project folder.`)) { setMsg(''); return; }
      setMsg('Renaming…');
      const r = await onMatchFolder();
      setMsg(`✓ ${r.renamed} file name${r.renamed === 1 ? '' : 's'} in the folder updated to match`);
    } catch (e: any) { setMsg(e?.message || 'Could not rename. Try again.'); }
  };
  const undo = () => { setBoard(saved); setDirty(false); setMsg(''); };

  return (
    <div className="storyboard-page">
      <header className="storyboard-page__head">
        <div className="storyboard-page__head-text">
          <h1 className="storyboard-page__title">Storyboard</h1>
          <p className="storyboard-page__sub">Every picture in folder order. Drag to rearrange, click + to add one in between, click a name to rename it or a scene to move it. Saving here sets the order for the whole video.</p>
        </div>
        <div className="storyboard__bar">
          <span className="storyboard__count">{total} pictures · {board.length} scenes</span>
          {dirty && <span className="storyboard__msg storyboard__msg--dirty" data-testid="sb-dirty">Unsaved changes</span>}
          {!dirty && msg && <span className="storyboard__msg" data-testid="sb-msg">{msg}</span>}
          {picMsg && <span className="storyboard__msg" role="status" data-testid="sb-photo-msg">{picMsg}</span>}
          {dirty && <button className="storyboard__undo" data-testid="sb-undo" onClick={undo}>Undo changes</button>}
          {!dirty && onCleanAll && <button className="storyboard__undo" data-testid="sb-clean-all" onClick={() => void cleanAll()} title="Move every picture's older versions out of the way (to the Unassigned tab)">Remove old versions</button>}
          {!dirty && onMatchFolder && <button className="storyboard__undo" data-testid="sb-match-folder" onClick={matchFolder} title="Rename the picture files in your folder so they list in this order">Match folder names</button>}
          <button className="storyboard__save" data-testid="sb-save" disabled={!dirty} onClick={save}>Save order</button>
        </div>
      </header>

      {/* ---------- Picture row ---------- */}
      <div className="storyboard__flow" data-testid="sb-flow">
        {cells.map(c => {
          if (c.kind === 'empty') {
            const key = `${c.scene.id}:0`;
            return (
              <div className="storyboard__slot" key={'e' + c.scene.id}>
                <div className="storyboard__gap"><button className="storyboard__add" data-testid="sb-add" title="Add a picture here" onClick={() => change(addPicture(board, c.scene.id, 0))}>+</button></div>
                <div data-testid="sb-empty" className={'storyboard__empty' + (over === key && drag ? ' is-over' : '')} onDragOver={over_(key)} onDrop={dropPic(c.scene.id, 0)}>
                  <div className="storyboard__empty-box">No picture for this scene</div>
                  <span className="storyboard__empty-label">Empty</span>
                  <span className="storyboard__scene-name">Scene {c.sceneNumber} · {c.scene.title}</span>
                </div>
              </div>
            );
          }
          const p = c.picture, key = `${c.scene.id}:${c.indexInScene}`, isEditing = editing === 'p:' + p.id;
          return (
            <div className="storyboard__slot" key={p.id}>
              <div className={'storyboard__gap' + (over === key && drag && drag !== p.id ? ' is-over' : '')} onDragOver={over_(key)} onDrop={dropPic(c.scene.id, c.indexInScene)}>
                <button className="storyboard__add" data-testid="sb-add" title="Add a picture here" onClick={() => change(addPicture(board, c.scene.id, c.indexInScene))}>+</button>
              </div>
              <div
                data-testid="sb-tile" data-pic-id={p.id}
                className={'storyboard__tile' + (drag === p.id ? ' is-dragging' : '') + (fileOver === p.id ? ' is-file-over' : '') + (p.skipped ? ' is-skipped' : '')} title={p.info}
                draggable={!isEditing}
                onDragStart={e => { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; setDrag(p.id); }}
                onDragEnd={() => { setDrag(null); setOver(null); }}
                onDragOver={e => { if (hasFiles(e)) { e.preventDefault(); if (fileOver !== p.id) setFileOver(p.id); } else over_(key)(e); }}
                onDragLeave={() => setFileOver(f => (f === p.id ? null : f))}
                onDrop={e => { if (hasFiles(e)) { e.preventDefault(); void replacePhoto(p, Array.from(e.dataTransfer.files)); } else dropPic(c.scene.id, c.indexInScene)(e); }}
              >
                {p.imageUrl ? (
                  <>
                    {p.assetId && (
                      <button className="storyboard__folder" data-testid="sb-folder" title="Show this file in Finder" onClick={e => { e.stopPropagation(); reveal(p.assetId!, p.id); }}>
                        <FolderIcon /><span>{opened === p.id ? 'Opened ✓' : opened === p.id + ':copied' ? 'Path copied' : 'Folder'}</span>
                      </button>
                    )}
                    <a className={'storyboard__thumb' + (p.status === 'needs-revision' || p.status === 'redo' ? ' storyboard__thumb--fix' : '')} onClick={() => onOpenPicture(p.id)}>
                      <img src={p.imageUrl} alt="" draggable={false} />
                    </a>
                  </>
                ) : p.isNew ? (
                  <span className="storyboard__thumb-empty storyboard__thumb-empty--new">New picture</span>
                ) : (
                  <span className="storyboard__thumb-empty">Not made yet</span>
                )}

                {isEditing ? (
                  <textarea className="storyboard__title-input" rows={2} autoFocus value={draftText}
                    onChange={e => setDraftText(e.target.value)} onBlur={commitEdit} onKeyDown={editKeys} />
                ) : (
                  <div className="storyboard__line">
                    <span className="storyboard__code">{c.code}</span>
                    <span className={dotClass(p.status)} />
                    <button className="storyboard__title" data-testid="sb-pic-title" title="Click to rename" onClick={() => startEdit('p:' + p.id, p.title)}>{p.title}</button>
                  </div>
                )}

                {picking === p.id ? (
                  <select data-testid="sb-scene-select" className="storyboard__scene-select" autoFocus value={c.scene.id}
                    onChange={e => { setPicking(null); if (e.target.value !== c.scene.id) change(movePictureToScene(board, p.id, e.target.value)); }}
                    onBlur={() => setPicking(null)}>
                    {board.map((s, i) => <option key={s.id} value={s.id}>Scene {i + 1} · {s.title}</option>)}
                  </select>
                ) : (
                  <button className="storyboard__scene-name" data-testid="sb-pic-scene" title="Click to move to another scene" onClick={() => setPicking(p.id)}>
                    Scene {c.sceneNumber} · {c.scene.title}
                  </button>
                )}
                {!p.isNew && onApprove && !p.skipped && p.status !== 'approved' && (p.versions ?? 0) > 0 && (
                  <button className="storyboard__approve" data-testid="sb-approve" onClick={() => void guard('Approving the picture', () => onApprove(p.id))}>✓ Approve</button>
                )}
                {!p.isNew && (onSetUsed || onRemoveOld) && (
                  <div className="storyboard__tools">
                    {onSetUsed && <button className="storyboard__tool" data-testid="sb-use-toggle" onClick={() => void guard(p.skipped ? 'Using the picture again' : 'Not using the picture', () => onSetUsed(p.id, !!p.skipped))}>{p.skipped ? 'Use again' : 'Don’t use'}</button>}
                    {onRemoveOld && (p.versions ?? 0) > 1 && <button className="storyboard__tool" data-testid="sb-remove-old" title="Keep only the picture in use; move the other versions to the Unassigned tab" onClick={() => { if (window.confirm(`Remove the ${(p.versions ?? 1) - 1} older version${(p.versions ?? 1) - 1 === 1 ? '' : 's'} of “${p.title}”?\n\nOnly the one in use stays. The others are moved to the Unassigned tab — nothing is deleted.`)) void guard('Removing old versions', () => onRemoveOld(p.id)); }}>Old versions ({(p.versions ?? 1) - 1}) ✕</button>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {last && (
          <div className="storyboard__slot">
            <div className={'storyboard__gap' + (over === 'end' && drag ? ' is-over' : '')} onDragOver={over_('end')} onDrop={dropPic(last.id, last.pictures.length)} />
            <button className="storyboard__add-end" onClick={() => change(addPicture(board, last.id, last.pictures.length))}>+ Add picture</button>
          </div>
        )}
      </div>

      {/* ---------- Scene Storyboard ---------- */}
      <div className="storyboard-scenes">
        <div className="storyboard-scenes__head">
          <h2 className="storyboard-scenes__title">Scene Storyboard</h2>
          <p className="storyboard-scenes__sub">Drag a scene to reorder it. Its pictures move with it. Click + to add a scene in between.</p>
        </div>
        <div className="storyboard-scenes__flow">
          {board.map((s, i) => {
            const gk = 'S' + i, isEditing = editing === 's:' + s.id;
            return (
              <div className="storyboard-scenes__slot" key={s.id}>
                <div className={'storyboard-scenes__gap' + (overScene === gk && dragScene && dragScene !== s.id ? ' is-over' : '')} onDragOver={overS(gk)} onDrop={dropScene(i)}>
                  <button className="storyboard__add" title="Add a scene here" onClick={() => change(addScene(board, i))}>+</button>
                </div>
                <div
                  data-testid="sb-scene-card" data-scene-id={s.id}
                  className={'storyboard-scenes__card' + (dragScene === s.id ? ' is-dragging' : '') + (sceneClips[s.id]?.length ? ' has-clip' : '') + (clipOver === s.id ? ' clip-over' : '')}
                  draggable={!isEditing}
                  onDragStart={e => { setDragClip(null); e.dataTransfer.setData('text/plain', s.id); e.dataTransfer.effectAllowed = 'move'; setDragScene(s.id); }}
                  onDragEnd={() => { setDragScene(null); setOverScene(null); }}
                  onDragOver={e => { if (hasFiles(e) || dragClipRef.current) { e.preventDefault(); if (clipOver !== s.id) setClipOver(s.id); } else overS(gk)(e); }}
                  onDragLeave={() => setClipOver(c => (c === s.id ? null : c))}
                  onDrop={e => { if (hasFiles(e) || dragClipRef.current) void dropOnScene(s.id)(e); else dropScene(i)(e); }}
                >
                  {!sceneClips[s.id]?.length && <div className="storyboard-scenes__thumbs">
                    {s.pictures.length === 0
                      ? <span className="storyboard-scenes__none">No pictures yet</span>
                      : s.pictures.slice(0, 3).map(p => p.imageUrl
                          ? <span key={p.id} className="storyboard-scenes__mini" style={{ backgroundImage: `url(${p.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                          : <span key={p.id} className="storyboard-scenes__mini storyboard-scenes__mini--empty" />)}
                  </div>}
                  <div className="storyboard-scenes__label"><span>Scene {i + 1}</span><span className="storyboard__grip">⠿</span></div>
                  {isEditing
                    ? <input data-testid="sb-scene-input" className="storyboard-scenes__name-input" autoFocus value={draftText} onChange={e => setDraftText(e.target.value)} onBlur={commitEdit} onKeyDown={editKeys} />
                    : <button className="storyboard-scenes__name" data-testid="sb-scene-name" title="Click to rename" onClick={() => startEdit('s:' + s.id, s.title)}>{s.title}</button>}
                  <span className="storyboard-scenes__count">{s.pictures.length === 1 ? '1 picture' : `${s.pictures.length} pictures`}</span>
                  {sceneClips[s.id]?.length ? (
                    <span className="storyboard-clips-list" data-testid="sb-scene-clips">
                      {sceneClips[s.id].map((c, k, arr) => (
                        <span key={c.id} className="storyboard-clip" data-testid="sb-scene-clip" data-clip-id={c.id}>
                          {arr.length > 1 && <span className="storyboard-clip__num" data-testid="sb-clip-num">{k + 1}</span>}
                          <a className="storyboard-clip__thumb" href={`/api/files/${c.id}`} target="_blank" rel="noreferrer" title={`Open ${c.name}`} draggable onDragStart={e => { e.stopPropagation(); e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move'; setDragClip(c.id); }} onDragEnd={() => { setDragClip(null); setClipOver(null); }}>
                            <video src={`/api/files/${c.id}#t=0.1`} preload="metadata" muted playsInline /><span className="storyboard-clip__play">▶</span>
                          </a>
                          <span className="storyboard-clip__name" title={c.name}>{c.name}</span>
                          {arr.length > 1 && onReorderClips && (
                            <span className="storyboard-clip__order">
                              <button type="button" className="storyboard-clip__move" data-testid="sb-clip-earlier" disabled={k === 0} title="Play this clip earlier" onClick={async () => { const ids = arr.map(x => x.id); [ids[k - 1], ids[k]] = [ids[k], ids[k - 1]]; try { await onReorderClips(s.id, ids); } catch (er: any) { flashClip(er?.message || 'Could not reorder.'); } }}>↑</button>
                              <button type="button" className="storyboard-clip__move" data-testid="sb-clip-later" disabled={k === arr.length - 1} title="Play this clip later" onClick={async () => { const ids = arr.map(x => x.id); [ids[k + 1], ids[k]] = [ids[k], ids[k + 1]]; try { await onReorderClips(s.id, ids); } catch (er: any) { flashClip(er?.message || 'Could not reorder.'); } }}>↓</button>
                            </span>
                          )}
                          {onUnassignClip && <button type="button" className="storyboard-clip__remove" data-testid="sb-clip-remove" title="Take this clip off the scene (the file stays in the folder)" onClick={async () => { try { await onUnassignClip(s.id, c.id); } catch (er: any) { flashClip(er?.message || 'Could not do that.'); } }}>×</button>}
                        </span>
                      ))}
                      {onUploadClip && <span className="storyboard-clip__hint">Drop another clip here to add it after these</span>}
                    </span>
                  ) : onUploadClip ? <span className="storyboard-clip__hint">Drop this scene’s video clip here</span> : null}
                </div>
              </div>
            );
          })}
          <div className="storyboard-scenes__slot">
            <div className={'storyboard-scenes__gap' + (overScene === 'Send' && dragScene ? ' is-over' : '')} onDragOver={overS('Send')} onDrop={dropScene(board.length)} />
            <button data-testid="sb-add-scene" className="storyboard-scenes__add-end" onClick={() => change(addScene(board, board.length))}>+ Add scene</button>
          </div>
        </div>
      </div>

      {/* ---------- Video clips tray ---------- */}
      {onUploadClip && (
        <div className="storyboard-clips" data-testid="sb-clips">
          <div className="storyboard-scenes__head">
            <h2 className="storyboard-scenes__title">Video Clips</h2>
            <p className="storyboard-scenes__sub">Drag a finished video from Finder onto its scene box above — the box turns blue and shows the clip. Or drop it here to keep it for later. Clips are saved in the project’s “06 Video Clips” folder and named in storyboard order.</p>
          </div>
          <div className={'storyboard-clips__drop' + (clipOver === 'tray' ? ' is-over' : '')} data-testid="sb-clip-drop"
            onDragOver={e => { if (hasFiles(e)) { e.preventDefault(); setClipOver('tray'); } }} onDragLeave={() => setClipOver(c => (c === 'tray' ? null : c))}
            onDrop={e => { e.preventDefault(); setClipOver(null); if (hasFiles(e)) void uploadClips(null, Array.from(e.dataTransfer.files)); }}>
            <span>Drop video clips here</span>
            <label className="storyboard-clips__choose">or choose a file<input type="file" accept="video/*" multiple className="sr-only" data-testid="sb-clip-input" onChange={e => { void uploadClips(null, Array.from(e.target.files ?? [])); e.target.value = ''; }} /></label>
          </div>
          {clipMsg && <div className="storyboard-clips__msg" role="status" data-testid="sb-clip-msg">{clipMsg}</div>}
          {tray.length > 0 && (
            <div className="storyboard-clips__tray" data-testid="sb-clip-tray">
              {tray.map(c => (
                <div key={c.id} className="storyboard-clips__item" data-testid="sb-tray-clip" data-clip-id={c.id} draggable title="Drag onto a scene box above"
                  onDragStart={e => { e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move'; setDragClip(c.id); }} onDragEnd={() => { setDragClip(null); setClipOver(null); }}>
                  <a className="storyboard-clip__thumb" href={`/api/files/${c.id}`} target="_blank" rel="noreferrer" draggable={false}><video src={`/api/files/${c.id}#t=0.1`} preload="metadata" muted playsInline /><span className="storyboard-clip__play">▶</span></a>
                  <span className="storyboard-clip__name" title={c.name}>{c.name}</span>
                </div>))}
            </div>)}
        </div>
      )}
    </div>
  );
}
