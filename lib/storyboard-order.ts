// Pure helpers for the Storyboard page. No React, no DB. Easy to unit test.
// Data shape: the whole video is an ordered list of scenes, and each scene has an ordered list of pictures.
// "Folder order" = scenes in order, pictures in order inside each scene.

export type PictureStatus = 'approved' | 'review' | 'generating' | 'redo' | 'needs-revision' | 'not-made' | 'new';

export interface SbPicture {
  id: string;
  title: string;
  status: PictureStatus;
  imageUrl?: string | null;   // thumbnail URL (null = not made yet)
  filePath?: string | null;   // (unused here) absolute path on disk
  assetId?: string | null;    // file record id: "Show in Finder" asks the server to reveal this asset
  isNew?: boolean;            // added on this page, not saved yet
  skipped?: boolean;          // marked "don't use"
  versions?: number;          // how many versions of this picture exist
  info?: string;              // "Step 2 of 4: … · Says: …" (shown on hover)
}
export interface SbScene { id: string; title: string; pictures: SbPicture[]; }
export type SbBoard = SbScene[];

const clone = (b: SbBoard): SbBoard => b.map(s => ({ ...s, pictures: [...s.pictures] }));
const tmpId = (p: string) => `${p}_new_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Move a picture so it sits at index `toIndex` inside scene `toSceneId` (before the picture currently there). */
export function movePicture(b: SbBoard, pictureId: string, toSceneId: string, toIndex: number): SbBoard {
  const d = clone(b);
  let item: SbPicture | undefined, fromScene = '', fromIndex = -1;
  for (const s of d) {
    const i = s.pictures.findIndex(p => p.id === pictureId);
    if (i > -1) { item = s.pictures.splice(i, 1)[0]; fromScene = s.id; fromIndex = i; break; }
  }
  if (!item) return b;
  if (fromScene === toSceneId && fromIndex < toIndex) toIndex--;
  const target = d.find(s => s.id === toSceneId);
  if (!target) return b;
  target.pictures.splice(Math.max(0, Math.min(toIndex, target.pictures.length)), 0, item);
  return d;
}

/** Move a picture to the END of another scene (used by the scene dropdown under each tile). */
export function movePictureToScene(b: SbBoard, pictureId: string, toSceneId: string): SbBoard {
  const target = b.find(s => s.id === toSceneId);
  if (!target) return b;
  const already = target.pictures.some(p => p.id === pictureId);
  return movePicture(b, pictureId, toSceneId, target.pictures.length + (already ? 1 : 0));
}

/** Insert a blank "New picture" at index inside a scene (the + buttons). */
export function addPicture(b: SbBoard, sceneId: string, index: number, title = 'New picture'): SbBoard {
  const d = clone(b);
  const s = d.find(x => x.id === sceneId);
  if (!s) return b;
  s.pictures.splice(index, 0, { id: tmpId('pic'), title, status: 'new', isNew: true, imageUrl: null, filePath: null });
  return d;
}

export function renamePicture(b: SbBoard, pictureId: string, title: string): SbBoard {
  const t = title.trim(); if (!t) return b;
  return b.map(s => ({ ...s, pictures: s.pictures.map(p => (p.id === pictureId ? { ...p, title: t } : p)) }));
}

/** Move a whole scene (with its pictures) so it sits before the scene currently at `toIndex`. */
export function moveScene(b: SbBoard, sceneId: string, toIndex: number): SbBoard {
  const d = clone(b);
  const from = d.findIndex(s => s.id === sceneId);
  if (from < 0) return b;
  const [s] = d.splice(from, 1);
  if (from < toIndex) toIndex--;
  d.splice(Math.max(0, Math.min(toIndex, d.length)), 0, s);
  return d;
}

/** Insert a new empty scene at index (the + between scene cards). */
export function addScene(b: SbBoard, index: number, title = 'New scene'): SbBoard {
  const d = clone(b);
  d.splice(index, 0, { id: tmpId('scene'), title, pictures: [] });
  return d;
}

export function renameScene(b: SbBoard, sceneId: string, title: string): SbBoard {
  const t = title.trim(); if (!t) return b;
  return b.map(s => (s.id === sceneId ? { ...s, title: t } : s));
}

/** Flat list for the picture row: every picture in folder order, plus a placeholder for each empty scene. */
export type SbCell =
  | { kind: 'picture'; picture: SbPicture; scene: SbScene; sceneNumber: number; indexInScene: number; code: string }
  | { kind: 'empty'; scene: SbScene; sceneNumber: number };

export function flatten(b: SbBoard): SbCell[] {
  const out: SbCell[] = []; let n = 0;
  b.forEach((scene, si) => {
    if (!scene.pictures.length) { out.push({ kind: 'empty', scene, sceneNumber: si + 1 }); return; }
    scene.pictures.forEach((picture, i) => {
      n++;
      out.push({ kind: 'picture', picture, scene, sceneNumber: si + 1, indexInScene: i, code: String(n).padStart(3, '0') });
    });
  });
  return out;
}

/** What to write to the DB on "Save order". The order field is 1-based. Pictures carry their new scene. */
export function toSavePayload(b: SbBoard) {
  return {
    scenes: b.map((s, i) => ({ id: s.id, title: s.title, order: i + 1, isNew: s.id.includes('_new_') })),
    pictures: b.flatMap((s, si) => s.pictures.map((p, i) => ({
      id: p.id, title: p.title, sceneId: s.id, sceneOrder: si + 1, orderInScene: i + 1, isNew: !!p.isNew,
    }))),
  };
}

export const dotClass = (s: PictureStatus) =>
  'storyboard__dot' + (['approved', 'review', 'generating', 'redo', 'needs-revision'].includes(s) ? ` storyboard__dot--${s}` : '');
