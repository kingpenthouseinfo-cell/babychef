import path from 'path';
import { db } from './db';
import { storage } from './storage';
import { orientationOf, slugify } from './util';

export function safeExt(name: string, mime?: string): string {
  let ext = path.extname(name || '').toLowerCase().replace(/[^a-z0-9.]/g, '');
  if (!ext || ext.length > 6) {
    const m: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'video/mp4': '.mp4', 'video/quicktime': '.mov' };
    ext = (mime && m[mime]) || '';
  }
  return ext === '.jpeg' ? '.jpg' : ext;
}

/** Folder/file segment that is safe on macOS/Windows/Linux but keeps spaces & capitals readable. */
export function safeSegment(s: string): string {
  return (s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/\s+/g, ' ').replace(/^[.\s-]+|[\s.]+$/g, '').slice(0, 80) || 'Untitled';
}

/** Human-readable project folder name (e.g. "Jamaican Beef Patties"), fixed once assigned. */
export async function projectFolder(projectId: string): Promise<string> {
  const p = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  if (p.folderName) return p.folderName;
  let name = safeSegment(p.title), n = 1;
  while (await db.project.findFirst({ where: { folderName: name, id: { not: p.id } } })) name = `${safeSegment(p.title)} (${++n})`;
  await db.project.update({ where: { id: p.id }, data: { folderName: name } });
  return name;
}

export const PROJECT_SUBFOLDERS = ['01 References/Baby', '01 References/Kitchen', '01 References/Products', '01 References/Food', '01 References/Actions', '01 References/Corrections', '02 Images', '03 Redos', '04 Kling', '05 Prompts', '06 Publishing'];

/** Read pixel dimensions from PNG / JPEG / GIF / WEBP headers without native deps. */
export function imageSize(buf: Buffer): { width: number; height: number } | null {
  try {
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    if (buf.length > 10 && buf.toString('ascii', 0, 3) === 'GIF') return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
      const t = buf.toString('ascii', 12, 16);
      if (t === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
      if (t === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      if (t === 'VP8L') { const b = buf.readUInt32LE(21); return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }; }
    }
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const m = buf[i + 1];
        if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
  } catch { /* fall through */ }
  return null;
}

/** Pixel size as DISPLAYED (honours EXIF rotation, e.g. iPhone portrait photos), falling back to a header parse. */
async function exifAwareSize(buf: Buffer): Promise<{ width: number; height: number } | null> {
  try {
    const sharp = (await import('sharp')).default;
    const m = await sharp(buf).metadata();
    if (m.width && m.height) return m.orientation && m.orientation >= 5 ? { width: m.height, height: m.width } : { width: m.width, height: m.height };
  } catch { /* fall back */ }
  return imageSize(buf);
}

export type ImportOpts = {
  rootFolder: string;          // e.g. "Jamaican Beef Patties" or "00 Baby Chefs/Jamaican Baby Chef"
  folder: string;              // e.g. "01 References/Products" ('' for none)
  dir?: string;                // explicit full directory (overrides rootFolder/folder)
  fileBase: string;            // friendly name without extension, e.g. "REF-PRODUCT-001_grace-coconut-milk_front"
  kind: string;
  version?: number;
  projectSlug?: string | null;
  altText?: string | null;
};

/**
 * Import a local file (chosen with the browser file picker) into the organized
 * project folder. The on-disk name IS the friendly name; if a file with that
 * name already exists, a numeric suffix is added so nothing is ever overwritten.
 */
export async function importFile(file: File, o: ImportOpts) {
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = safeExt(file.name, file.type);
  const base = o.fileBase.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'file';
  const dir = o.dir ?? [...o.rootFolder.split('/'), ...o.folder.split('/')].filter(Boolean).map(safeSegment).join('/');
  let name = `${base}${ext}`, n = 1;
  while (await storage.exists(`${dir}/${name}`) || await db.asset.findFirst({ where: { relPath: `${dir}/${name}` } })) name = `${base}_dup${++n}${ext}`;
  const relPath = `${dir}/${name}`;
  await storage.put(relPath, buf);
  const dim = file.type.startsWith('image/') ? await exifAwareSize(buf) : null;
  return db.asset.create({
    data: {
      displayName: name, originalName: (file.name || 'file').slice(0, 200), internalName: name, relPath,
      mime: file.type || 'application/octet-stream', size: buf.length, width: dim?.width ?? null, height: dim?.height ?? null,
      orientation: orientationOf(dim?.width, dim?.height), kind: o.kind, projectSlug: o.projectSlug ?? null, version: o.version ?? 1, altText: o.altText ?? null,
    },
  });
}

/** Move an already-imported file to another subfolder of its project (e.g. 02 Images -> 03 Redos). */
export async function moveAssetToFolder(assetId: string, subfolder: string) {
  const a = await db.asset.findUnique({ where: { id: assetId } });
  if (!a) return;
  const parts = a.relPath.split('/');
  const rootFolder = parts[0];
  const target = [rootFolder, ...subfolder.split('/').map(safeSegment), parts[parts.length - 1]].join('/');
  if (target === a.relPath) return;
  let final = target, n = 1;
  while (await storage.exists(final)) final = target.replace(/(\.[a-z0-9]+)$/i, `_${++n}$1`);
  await storage.move(a.relPath, final);
  await db.asset.update({ where: { id: a.id }, data: { relPath: final } });
}

export async function deleteAssetIfOrphan(assetId: string) {
  const a = await db.asset.findUnique({ where: { id: assetId }, include: { _count: { select: { references: true, attempts: true, corrections: true, klingTries: true } } } });
  if (!a) return;
  const c = a._count;
  if (c.references + c.attempts + c.corrections + c.klingTries > 0) return;
  await storage.remove(a.relPath);
  await db.asset.delete({ where: { id: a.id } });
}

/** Next code like REF-PRODUCT-003 (counter is per prefix). */
export async function nextCode(model: 'reference' | 'correction', prefix: string, width: number): Promise<string> {
  const rows = await (model === 'reference' ? db.reference.findMany({ select: { code: true } }) : db.correction.findMany({ select: { code: true } }));
  let max = 0;
  for (const r of rows) {
    if (!r.code.startsWith(prefix + '-')) continue;
    const n = parseInt(r.code.slice(prefix.length + 1).replace(/\D/g, ''), 10);
    if (n > max) max = n;
  }
  return `${prefix}-${String(max + 1).padStart(width, '0')}`;
}
void slugify;
