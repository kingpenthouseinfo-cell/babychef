import JSZip from 'jszip';
import path from 'node:path';
import { db } from './db';
import { storage } from './storage';
import { aiReferencesFor } from './ai-refs';
import { effectiveCode } from './project-code';
import { imageCode, pad } from './util';

export const REFERENCE_NOTES = (o: { code: string; scene: string; title: string; list: string[] }) => `CURRENT IMAGE:
${o.code}

SCENE:
${o.scene}

IMAGE:
${o.title}

FILES IN THIS PACK:
${o.list.join('\n')}

REFERENCE INSTRUCTIONS:

These images are visual continuity references only.

Use them to preserve Baby Chef identity, kitchen/location, outfit, lighting, cookware, scale, proportions and overall photographic style.

Do not copy the exact pose, action, camera framing or food state from the neighboring images unless the current image prompt requires it.

The CURRENT IMAGE PROMPT determines the exact action and food state.

Do not introduce ingredients or cooking states from a later reference image.
`;

/** One small ZIP with this picture's reference files (named so each file explains itself) + REFERENCE-NOTES.txt. Files are only copied into the ZIP when this is called. */
export async function buildReferencePack(projectId: string, imageId: string): Promise<{ name: string; data: Buffer } | null> {
  const set = await aiReferencesFor(projectId, imageId);
  if (!set) return null;
  const img = await db.plannedImage.findUniqueOrThrow({ where: { id: imageId }, include: { scene: true, project: true } });
  const zip = new JSZip();
  const seen = new Set<string>();
  const list: string[] = [];
  let n = 0;
  for (const r of set.refs) {
    if (!r.assetId || seen.has(r.assetId)) continue;
    seen.add(r.assetId);
    const a = await db.asset.findUnique({ where: { id: r.assetId } });
    if (!a) continue;
    let buf: Buffer;
    try { buf = await storage.read(a.relPath); } catch { continue; }
    const ext = path.extname(a.displayName) || '.png';
    const fname = `${pad(++n, 2)}_${r.dlName}${ext}`;
    zip.file(fname, buf);
    list.push(`${fname}  —  ${r.label}${r.tag ? ` ${r.tag}` : ''}${r.title ? ` (${r.title})` : ''}`);
  }
  zip.file('REFERENCE-NOTES.txt', REFERENCE_NOTES({ code: `${set.tag} (${imageCode(img.seq)})`, scene: `Scene ${img.scene.title}`, title: img.title, list }));
  const base = `${effectiveCode(img.project)}-S${pad(img.scene.order)}-IMG${pad(img.seq, 3)}_AI-REFERENCES`;
  return { name: `${base}.zip`, data: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }) };
}
