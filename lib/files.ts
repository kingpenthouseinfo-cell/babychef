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

export type UploadOpts = {
  projectSlug?: string | null;      // null => shared library folder
  folder: string;                   // e.g. references/baby
  friendlyBase: string;             // e.g. REF_baby_jamaican-master-face
  kind: string;
  version?: number;
  altText?: string | null;
  versionLabel?: string;            // suffix before ext, e.g. "attempt-v2"; default `_${NN}`
  separator?: string;
};

/**
 * Save an uploaded File. Friendly name is stored as displayName and in the
 * stored filename; a short random suffix guarantees nothing is overwritten.
 */
export async function saveUpload(file: File, o: UploadOpts) {
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = safeExt(file.name, file.type);
  const base = slugify(o.friendlyBase).replace(/-/g, '-');
  const friendlyRaw = o.friendlyBase.replace(/[^A-Za-z0-9._\-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const version = o.version ?? 1;
  const label = o.versionLabel ?? String(version).padStart(2, '0');
  const displayName = `${friendlyRaw || base}_${label}${ext}`;
  const rand = Math.random().toString(36).slice(2, 7);
  const internalName = `${friendlyRaw || base}_${label}_${rand}${ext}`;
  const relPath = [o.projectSlug || '_library', ...o.folder.split('/').map(s => slugify(s))].join('/') + '/' + internalName;
  await storage.put(relPath, buf);
  const dim = file.type.startsWith('image/') ? imageSize(buf) : null;
  return db.asset.create({
    data: {
      displayName, originalName: (file.name || 'upload').slice(0, 200), internalName, relPath,
      mime: file.type || 'application/octet-stream', size: buf.length,
      width: dim?.width ?? null, height: dim?.height ?? null,
      orientation: orientationOf(dim?.width, dim?.height),
      kind: o.kind, projectSlug: o.projectSlug ?? null, version, altText: o.altText ?? null,
    },
  });
}

export async function deleteAssetIfOrphan(assetId: string) {
  const a = await db.asset.findUnique({ where: { id: assetId }, include: { _count: { select: { references: true, attempts: true, corrections: true, klingTries: true } } } });
  if (!a) return;
  const c = a._count;
  if (c.references + c.attempts + c.corrections + c.klingTries > 0) return;
  await storage.remove(a.relPath);
  await db.asset.delete({ where: { id: a.id } });
}

export async function nextCode(model: 'reference' | 'correction', prefix: string, width: number): Promise<string> {
  const rows = await (model === 'reference' ? db.reference.findMany({ select: { code: true } }) : db.correction.findMany({ select: { code: true } }));
  let max = 0;
  for (const r of rows) { const n = parseInt(r.code.replace(/\D/g, ''), 10); if (n > max) max = n; }
  return `${prefix}-${String(max + 1).padStart(width, '0')}`;
}
