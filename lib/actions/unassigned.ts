'use server';
import { revalidatePath } from 'next/cache';
import { db } from '../db';
import { storage } from '../storage';
import { projectFolder } from '../files';
import { logActivity } from '../activity';
import { syncFolderNamesSafe } from '../folder-sync';
import { assignUnmatched } from './watch';
import { approveLatest } from './generate';
import { assignSceneClip } from './clips';
import { scanProjectFolders } from '../watcher';
import { sceneHasClip } from '../scene-clips';

const touch = () => revalidatePath('/', 'layout');

async function freeName(dir: string, name: string): Promise<string> {
  let target = `${dir}/${name}`, n = 1;
  while (await storage.exists(target) || await db.asset.findFirst({ where: { relPath: target } }) || await db.unmatchedFile.findFirst({ where: { relPath: target } })) target = `${dir}/${name.replace(/(\.[a-z0-9]+)$/i, `_${++n}$1`)}`;
  return target;
}

/** Drag an unassigned photo onto a picture slot: it becomes a new version of that picture (named and filed automatically). If the slot had no approved picture yet it becomes the picture. */
export async function assignUnassignedPicture(unmatchedId: string, imageId: string): Promise<{ number: number; approved: boolean }> {
  const img = await db.plannedImage.findUniqueOrThrow({ where: { id: imageId }, include: { attempts: { select: { number: true } } } });
  const hadApproved = !!img.approvedAttemptId;
  const fd = new FormData(); fd.set('id', unmatchedId); fd.set('imageId', imageId);
  await assignUnmatched(fd);
  const a = await db.attempt.findFirstOrThrow({ where: { imageId }, orderBy: { number: 'desc' } });
  let approved = false;
  if (!hadApproved && img.status !== 'SKIPPED') { const f = new FormData(); f.set('imageId', imageId); await approveLatest(f); approved = true; }
  touch();
  return { number: a.number, approved };
}

/** Delete a photo from the folder for good (file and record). Only for photos that are not on any picture. */
export async function deleteUnassignedPicture(unmatchedId: string): Promise<void> {
  const u = await db.unmatchedFile.findUniqueOrThrow({ where: { id: unmatchedId } });
  if (u.assetId) {
    const used = await db.asset.findUnique({ where: { id: u.assetId }, include: { _count: { select: { attempts: true, references: true, corrections: true, klingTries: true } } } });
    if (used && used._count.attempts + used._count.references + used._count.corrections + used._count.klingTries > 0) throw new Error('That photo is in use, so it was not deleted.');
  }
  await storage.remove(u.relPath);
  await db.$transaction([db.unmatchedFile.delete({ where: { id: u.id } }), ...(u.assetId ? [db.asset.deleteMany({ where: { id: u.assetId } })] : [])]);
  await logActivity(`Unassigned photo deleted: ${u.name}`, null, null as any);
  touch();
}

/** Move an unassigned photo into another project's Unassigned Pictures folder. */
export async function moveUnassignedPicture(unmatchedId: string, targetProjectId: string): Promise<void> {
  const u = await db.unmatchedFile.findUniqueOrThrow({ where: { id: unmatchedId } });
  const target = await db.project.findUniqueOrThrow({ where: { id: targetProjectId } });
  const dest = await freeName(`${await projectFolder(target.id)}/Unassigned Pictures`, u.name.replace(/^\d{2,4}_/, ''));
  await storage.move(u.relPath, dest);
  const nm = dest.split('/').pop()!;
  await db.$transaction([
    db.unmatchedFile.update({ where: { id: u.id }, data: { relPath: dest, name: nm, folder: 'Unassigned Pictures', reason: `Moved here from another project` } }),
    ...(u.assetId ? [db.asset.update({ where: { id: u.assetId }, data: { relPath: dest, displayName: nm, internalName: nm, projectSlug: target.slug } })] : []),
  ]);
  await logActivity(`Photo moved here from another project: ${nm}`, null, target.id);
  touch();
}

/** Look for new loose pictures in the project folders right now. */
export async function scanForUnassigned(): Promise<void> { await scanProjectFolders(); touch(); }

// ---- video clips not on a scene ----
export async function assignUnassignedClip(projectId: string, sceneId: string, assetId: string): Promise<void> { await assignSceneClip(projectId, sceneId, assetId); }

export async function deleteUnassignedClip(projectId: string, assetId: string): Promise<void> {
  const p = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  const a = await db.asset.findFirst({ where: { id: assetId, kind: 'VIDEO_CLIP', projectSlug: p.slug } });
  if (!a) throw new Error('That clip was not found');
  if (await sceneHasClip(projectId, assetId)) throw new Error('That clip is on a scene. Take it off the scene first.');
  await storage.remove(a.relPath);
  await db.asset.delete({ where: { id: a.id } }).catch(() => undefined);
  await logActivity(`Unassigned video clip deleted: ${a.displayName}`, null, projectId);
  touch();
}

export async function moveUnassignedClip(projectId: string, assetId: string, targetProjectId: string): Promise<void> {
  const p = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  const target = await db.project.findUniqueOrThrow({ where: { id: targetProjectId } });
  const a = await db.asset.findFirst({ where: { id: assetId, kind: 'VIDEO_CLIP', projectSlug: p.slug } });
  if (!a) throw new Error('That clip was not found');
  if (await sceneHasClip(projectId, assetId)) throw new Error('That clip is on a scene. Take it off the scene first.');
  const dest = await freeName(`${await projectFolder(target.id)}/06 Video Clips`, a.displayName.replace(/^(unassigned_|\d{2,3}(?:\.\d+)?_)/, 'unassigned_'));
  await storage.move(a.relPath, dest);
  const nm = dest.split('/').pop()!;
  await db.asset.update({ where: { id: a.id }, data: { relPath: dest, displayName: nm, internalName: nm, projectSlug: target.slug } });
  await syncFolderNamesSafe(target.id);
  await syncFolderNamesSafe(projectId);
  await logActivity(`Video clip moved here from another project: ${nm}`, null, target.id);
  touch();
}
