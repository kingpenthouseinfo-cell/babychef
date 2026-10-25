'use server';
import { revalidatePath } from 'next/cache';
import { db } from '../db';
import { storage } from '../storage';
import { projectFolder } from '../files';
import { str, imageCode } from '../util';
import { logActivity } from '../activity';
import { syncFolderNamesSafe } from '../folder-sync';

const touch = () => revalidatePath('/', 'layout');
const UNASSIGNED_DIR = 'Unassigned Pictures';

/** "Don't use this picture": it stays in the plan and all files are kept, but it no longer counts (not in video clips, not counted as still to do). Reversible. */
export async function skipPicture(fd: FormData) {
  const img = await db.plannedImage.findUniqueOrThrow({ where: { id: str(fd, 'id')! } });
  await db.plannedImage.update({ where: { id: img.id }, data: { status: 'SKIPPED', approvedAttemptId: null } });
  await logActivity(`${imageCode(img.seq)} marked "don't use"`, null, img.projectId);
  touch();
}

/** Use it again: the picture that was approved before becomes the approved one again (or Check this / Ready if there was none). */
export async function unskipPicture(fd: FormData) {
  const img = await db.plannedImage.findUniqueOrThrow({ where: { id: str(fd, 'id')! }, include: { attempts: { orderBy: { number: 'desc' } } } });
  const was = img.attempts.find(a => a.status === 'APPROVED');
  const data = was ? { status: 'APPROVED', approvedAttemptId: was.id } : img.attempts.length ? { status: 'REVIEW' } : { status: img.fullPrompt?.trim() ? 'READY' : 'PLANNED' };
  await db.plannedImage.update({ where: { id: img.id }, data });
  await logActivity(`${imageCode(img.seq)} is used again`, null, img.projectId);
  touch();
}

/** Move a version's file out of the picture's slot into the project's "Unassigned Pictures" folder and list it on the Unassigned tab. Nothing is deleted. */
async function unassignAttempt(attemptId: string, why: string) {
  const a = await db.attempt.findUniqueOrThrow({ where: { id: attemptId }, include: { asset: true, image: { include: { project: true } } } });
  const folder = await projectFolder(a.image.projectId);
  const name = a.asset.displayName.replace(/^\d{2,4}_/, '');
  let target = `${folder}/${UNASSIGNED_DIR}/${name}`, n = 1;
  while (await storage.exists(target) || await db.asset.findFirst({ where: { relPath: target } })) target = `${folder}/${UNASSIGNED_DIR}/${name.replace(/(\.[a-z0-9]+)$/i, `_${++n}$1`)}`;
  if (await storage.exists(a.asset.relPath)) await storage.move(a.asset.relPath, target); else target = a.asset.relPath;
  const nm = target.split('/').pop()!;
  await db.$transaction([
    ...(a.image.approvedAttemptId === a.id ? [db.plannedImage.update({ where: { id: a.imageId }, data: { approvedAttemptId: null } })] : []),
    db.attempt.delete({ where: { id: a.id } }),
    db.asset.update({ where: { id: a.assetId }, data: { relPath: target, displayName: nm, internalName: nm, kind: 'UNASSIGNED_PICTURE' } }),
    db.unmatchedFile.create({ data: { relPath: target, name: nm, folder: UNASSIGNED_DIR, reason: why, assetId: a.assetId, size: a.asset.size } }),
  ]);
  return a;
}

/** Remove every version of a picture except the one in use (the approved one, otherwise the newest). The others go to the Unassigned tab, not the bin. */
export async function removeOldVersionsOf(imageId: string): Promise<number> {
  const img = await db.plannedImage.findUniqueOrThrow({ where: { id: imageId }, include: { attempts: { orderBy: { number: 'desc' } } } });
  const keep = img.attempts.find(a => a.id === img.approvedAttemptId) ?? img.attempts[0];
  let n = 0;
  for (const a of img.attempts) { if (a.id === keep?.id) continue; await unassignAttempt(a.id, `Removed from ${imageCode(img.seq)} “${img.title}” (version ${a.number})`); n++; }
  const left = await db.attempt.count({ where: { imageId } });
  await db.plannedImage.update({ where: { id: imageId }, data: { attemptCount: left } });
  return n;
}
export async function removeOldVersions(fd: FormData) {
  const img = await db.plannedImage.findUniqueOrThrow({ where: { id: str(fd, 'id')! } });
  const n = await removeOldVersionsOf(img.id);
  if (n) await logActivity(`${n} old version${n === 1 ? '' : 's'} of ${imageCode(img.seq)} moved to Unassigned`, null, img.projectId);
  touch();
}

/** One version only (the "x" next to a version). The file goes to the Unassigned tab. */
export async function removeVersion(fd: FormData) {
  const a = await db.attempt.findUniqueOrThrow({ where: { id: str(fd, 'attemptId')! }, include: { image: true } });
  await unassignAttempt(a.id, `Removed from ${imageCode(a.image.seq)} “${a.image.title}” (version ${a.number})`);
  const left = await db.attempt.findMany({ where: { imageId: a.imageId }, orderBy: { number: 'desc' } });
  const img = await db.plannedImage.findUniqueOrThrow({ where: { id: a.imageId } });
  const status = img.status === 'SKIPPED' ? 'SKIPPED' : left.some(x => x.status === 'APPROVED') ? 'APPROVED' : left.some(x => x.status === 'REVIEW') ? 'REVIEW' : left.length ? 'REDO' : 'READY';
  await db.plannedImage.update({ where: { id: a.imageId }, data: { status, attemptCount: left.length } });
  await syncFolderNamesSafe(a.image.projectId);
  touch();
}

/** The whole project: how many old versions would be moved out of the way? (nothing changes) */
export async function countOldVersions(projectId: string): Promise<{ versions: number; pictures: number }> {
  const imgs = await db.plannedImage.findMany({ where: { projectId }, include: { attempts: { select: { id: true } } } });
  const pics = imgs.filter(i => i.attempts.length > 1);
  return { versions: pics.reduce((s, i) => s + i.attempts.length - 1, 0), pictures: pics.length };
}
export async function removeOldVersionsProject(projectId: string): Promise<{ removed: number }> {
  const imgs = await db.plannedImage.findMany({ where: { projectId }, include: { attempts: { select: { id: true } } } });
  let removed = 0;
  for (const i of imgs) if (i.attempts.length > 1) removed += await removeOldVersionsOf(i.id);
  if (removed) await logActivity(`${removed} old picture version${removed === 1 ? '' : 's'} moved to Unassigned`, null, projectId);
  touch();
  return { removed };
}

/** Which step of the scene and which line of dialogue a picture is for (empty = automatic). */
export async function saveStepDialogue(fd: FormData) {
  const id = str(fd, 'id')!;
  const v = (k: string) => { const t = (str(fd, k) ?? '').trim(); return t ? t.slice(0, 400) : null; };
  await db.plannedImage.update({ where: { id }, data: { stepNote: v('stepNote'), dialogueLine: v('dialogueLine') } as any });
  touch();
}
