'use server';
import { revalidatePath } from 'next/cache';
import { db } from '../db';
import { importFile, projectFolder } from '../files';
import { str } from '../util';
import { logActivity } from '../activity';
import { syncFolderNamesSafe } from '../folder-sync';

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
  if (sceneId) await db.scene.update({ where: { id: sceneId, projectId }, data: { videoAssetId: asset.id } as any });
  await logActivity(sceneId ? `Video clip added to a scene: ${file.name}` : `Video clip added: ${file.name}`, null, projectId);
  await syncFolderNamesSafe(projectId);
  touch();
  const fresh = await db.asset.findUniqueOrThrow({ where: { id: asset.id } });
  return { assetId: fresh.id, name: fresh.displayName };
}

/** Storyboard: put a clip from the tray (or another scene) on a scene. A clip sits on one scene at a time; the scene's old clip goes back to the tray (its file is kept). */
export async function assignSceneClip(projectId: string, sceneId: string, assetId: string): Promise<void> {
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  const asset = await db.asset.findFirst({ where: { id: assetId, kind: 'VIDEO_CLIP', projectSlug: project.slug } });
  if (!asset) throw new Error('That clip was not found');
  await db.scene.updateMany({ where: { projectId, videoAssetId: assetId }, data: { videoAssetId: null } as any });
  await db.scene.update({ where: { id: sceneId, projectId }, data: { videoAssetId: assetId } as any });
  await syncFolderNamesSafe(projectId);
  touch();
}

/** Storyboard: take the clip off a scene (it goes back to the tray; the file stays in the folder). */
export async function unassignSceneClip(projectId: string, sceneId: string): Promise<void> {
  await db.scene.update({ where: { id: sceneId, projectId }, data: { videoAssetId: null } as any });
  await syncFolderNamesSafe(projectId);
  touch();
}
