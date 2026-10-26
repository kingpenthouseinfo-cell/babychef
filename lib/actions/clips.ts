'use server';
import { revalidatePath } from 'next/cache';
import { db } from '../db';
import { importFile, projectFolder } from '../files';
import { str } from '../util';
import { logActivity } from '../activity';
import { syncFolderNamesSafe } from '../folder-sync';
import { sceneClipIds, setSceneClips, removeClipEverywhere } from '../scene-clips';

const touch = () => revalidatePath('/', 'layout');
const VIDEO = /\.(mp4|mov|m4v|webm)$/i;

/** Storyboard: save a finished video clip into the project's "06 Video Clips" folder. With a scene it is also put on that scene's box; without one it waits in the tray. */
export async function uploadSceneClip(fd: FormData): Promise<{ assetId: string; name: string }> {
  const projectId = str(fd, 'projectId')!, sceneId = str(fd, 'sceneId');
  const file = fd.get('file') as File | null;
  if (!file || !file.size) throw new Error('Choose a video file');
  if (!file.type.startsWith('video/') && !VIDEO.test(file.name)) throw new Error('Choose a video file (MP4, MOV, M4V or WebM)');
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  const asset = await importFile(file, { rootFolder: await projectFolder(projectId), folder: '06 Video Clips', fileBase: file.name.replace(/\.[^.]+$/, '') || 'clip', kind: 'VIDEO_CLIP', projectSlug: project.slug });
  if (sceneId) { const sc: any = await db.scene.findFirstOrThrow({ where: { id: sceneId, projectId } }); await setSceneClips(sceneId, [...sceneClipIds(sc), asset.id]); }
  await logActivity(sceneId ? `Video clip added to a scene: ${file.name}` : `Video clip added: ${file.name}`, null, projectId);
  await syncFolderNamesSafe(projectId);
  touch();
  const fresh = await db.asset.findUniqueOrThrow({ where: { id: asset.id } });
  return { assetId: fresh.id, name: fresh.displayName };
}

/** Storyboard: put a clip from the tray (or another scene) on a scene. A clip sits on one scene at a time; a scene can hold several clips, played in the order shown (newest goes last unless `index` says where). Nothing is removed from the folder. */
export async function assignSceneClip(projectId: string, sceneId: string, assetId: string, index?: number): Promise<void> {
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  const asset = await db.asset.findFirst({ where: { id: assetId, kind: 'VIDEO_CLIP', projectSlug: project.slug } });
  if (!asset) throw new Error('That clip was not found');
  await removeClipEverywhere(projectId, assetId);
  const sc: any = await db.scene.findFirstOrThrow({ where: { id: sceneId, projectId } });
  const ids = sceneClipIds(sc);
  ids.splice(index === undefined || index < 0 || index > ids.length ? ids.length : index, 0, assetId);
  await setSceneClips(sceneId, ids);
  await syncFolderNamesSafe(projectId);
  touch();
}

/** Storyboard: put a scene's clips in a new order (the files are renamed to match: 01_…-CLIP1, 01_…-CLIP2). */
export async function reorderSceneClips(projectId: string, sceneId: string, orderedIds: string[]): Promise<void> {
  const sc: any = await db.scene.findFirstOrThrow({ where: { id: sceneId, projectId } });
  const have = sceneClipIds(sc);
  const next = [...orderedIds.filter(x => have.includes(x)), ...have.filter(x => !orderedIds.includes(x))];
  await setSceneClips(sceneId, next);
  await syncFolderNamesSafe(projectId);
  touch();
}

/** Storyboard: take one clip off a scene (it goes back to the tray; the file stays in the folder). Without a clip id, all of the scene's clips are taken off. */
export async function unassignSceneClip(projectId: string, sceneId: string, assetId?: string): Promise<void> {
  const sc: any = await db.scene.findFirstOrThrow({ where: { id: sceneId, projectId } });
  await setSceneClips(sceneId, assetId ? sceneClipIds(sc).filter(x => x !== assetId) : []);
  await syncFolderNamesSafe(projectId);
  touch();
}
