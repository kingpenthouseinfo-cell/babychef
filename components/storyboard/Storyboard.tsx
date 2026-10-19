'use client';
// Storyboard tab: picture row + Scene Storyboard. Styles live in app/storyboard.css (import it once in layout or here).
import { useEffect, useMemo, useState } from 'react';
import {
  SbBoard, addPicture, addScene, dotClass, flatten, movePicture, movePictureToScene,
  moveScene, renamePicture, renameScene, toSavePayload,
} from '@/lib/storyboard-order';

type Props = {
  initial: SbBoard;
  onSave: (payload: ReturnType<typeof toSavePayload>) => Promise<void>;   // persists the order for the whole app
  onOpenPicture: (pictureId: string) => void;                              // go to Picture detail
  revealInFinder?: (assetId: string) => Promise<void>;                     // defaults to POST /api/reveal
};

const FolderIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round">
    <path d="M1.75 4.25a1 1 0 0 1 1-1h3.4l1.5 1.5h5.6a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H2.75a1 1 0 0 1-1-1z" />
  </svg>
);

export default function Storyboard({ initial, onSave, onOpenPicture, revealInFinder }: Props) {
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
    try { await onSave(toSavePayload(board)); } catch (e: any) { setMsg(e?.message || 'Could not save. Try again.'); return; }
    setSaved(board); setDirty(false); setMsg('✓ Order saved');
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
          {dirty && <button className="storyboard__undo" data-testid="sb-undo" onClick={undo}>Undo changes</button>}
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
                className={'storyboard__tile' + (drag === p.id ? ' is-dragging' : '')}
                draggable={!isEditing}
                onDragStart={e => { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; setDrag(p.id); }}
                onDragEnd={() => { setDrag(null); setOver(null); }}
                onDragOver={over_(key)} onDrop={dropPic(c.scene.id, c.indexInScene)}
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
                  className={'storyboard-scenes__card' + (dragScene === s.id ? ' is-dragging' : '')}
                  draggable={!isEditing}
                  onDragStart={e => { e.dataTransfer.setData('text/plain', s.id); e.dataTransfer.effectAllowed = 'move'; setDragScene(s.id); }}
                  onDragEnd={() => { setDragScene(null); setOverScene(null); }}
                  onDragOver={overS(gk)} onDrop={dropScene(i)}
                >
                  <div className="storyboard-scenes__thumbs">
                    {s.pictures.length === 0
                      ? <span className="storyboard-scenes__none">No pictures yet</span>
                      : s.pictures.slice(0, 3).map(p => p.imageUrl
                          ? <span key={p.id} className="storyboard-scenes__mini" style={{ backgroundImage: `url(${p.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                          : <span key={p.id} className="storyboard-scenes__mini storyboard-scenes__mini--empty" />)}
                  </div>
                  <div className="storyboard-scenes__label"><span>Scene {i + 1}</span><span className="storyboard__grip">⠿</span></div>
                  {isEditing
                    ? <input data-testid="sb-scene-input" className="storyboard-scenes__name-input" autoFocus value={draftText} onChange={e => setDraftText(e.target.value)} onBlur={commitEdit} onKeyDown={editKeys} />
                    : <button className="storyboard-scenes__name" data-testid="sb-scene-name" title="Click to rename" onClick={() => startEdit('s:' + s.id, s.title)}>{s.title}</button>}
                  <span className="storyboard-scenes__count">{s.pictures.length === 1 ? '1 picture' : `${s.pictures.length} pictures`}</span>
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
    </div>
  );
}
