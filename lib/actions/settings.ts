'use server';
import { revalidatePath } from 'next/cache';
import { setSetting } from '../settings';
import { bool, str, strRaw } from '../util';
import { DEFAULT_SETTINGS, TOOL_NAMES } from '../constants';
import { testRoot } from '../storage';
import { writeProjectTextFiles } from '../exports';

export async function saveSettings(fd: FormData) {
  const keys = ['appName', 'defaultAspect', 'defaultShortDuration', 'defaultLongDuration', 'defaultProjectStatus', 'principles', ...TOOL_NAMES.map(t => `url_${t}`)];
  for (const k of keys) if (fd.has(k)) await setSetting(k, strRaw(fd, k).trim() || DEFAULT_SETTINGS[k] || '');
  if (fd.has('_general')) { await setSetting('defaultVerticalCrop', String(bool(fd, 'defaultVerticalCrop'))); await setSetting('watchProjectFolders', String(bool(fd, 'watchProjectFolders'))); }
  revalidatePath('/', 'layout');
}

export async function saveStorageRoot(_prev: unknown, fd: FormData): Promise<{ ok: boolean; message: string }> {
  const wanted = str(fd, 'root') || '~/Documents/Baby Chef Studio';
  const t = await testRoot(wanted);
  if (!t.ok) return { ok: false, message: `Cannot use that folder: ${t.error}` };
  await setSetting('storageRoot', wanted);
  revalidatePath('/', 'layout');
  return { ok: true, message: `Storage root set to ${t.abs}. New files go there. Existing files are NOT moved automatically — copy your old Baby Chef Studio folder into the new location if you want them together.` };
}

export async function writeTextFiles(fd: FormData) {
  await writeProjectTextFiles(str(fd, 'projectId')!);
  revalidatePath('/', 'layout');
}

/** "+ Add file": copy any file into the project's "07 Other" folder (tracked in the database). */
export async function addProjectFile(fd: FormData) {
  const { importFile, projectFolder } = await import('../files');
  const { db } = await import('../db');
  const file = fd.get('file') as File | null;
  const projectId = str(fd, 'projectId')!;
  if (!file || !file.size) throw new Error('Choose a file');
  const p = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  const base = (file.name.replace(/\.[^.]+$/, '') || 'file').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'file';
  await importFile(file, { rootFolder: await projectFolder(projectId), folder: '07 Other', fileBase: `${p.slug}_${base}`, kind: 'OTHER', projectSlug: p.slug });
  revalidatePath('/', 'layout');
}

/** The "watch folders" switch on its own (so it never touches the other defaults). */
export async function setWatchFolders(fd: FormData) {
  await setSetting('watchProjectFolders', String(fd.get('watch') === 'on'));
  revalidatePath('/', 'layout');
}
