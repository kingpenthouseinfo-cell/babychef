import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { aiReferencesFor } from '@/lib/ai-refs';
import { isLocalRequest } from '@/lib/local-only';
import { verify, directImageUrl, downloadImageUrl, zipUrl, origin } from '@/lib/signed-links';
import { imageCode } from '@/lib/util';
import { effectiveCode } from '@/lib/project-code';

export const dynamic = 'force-dynamic';

const ROLE: Record<string, string> = { BABY: 'baby-chef-master', KITCHEN: 'kitchen-master', OUTFIT: 'outfit-master', BEFORE: 'before', AFTER: 'after', EXTRA: 'extra' };

/**
 * Machine-readable reference list for ONE picture, so an automation can find the exact files without reading the page.
 * `slug` may be the project slug or id; `imageId` may be the picture id or its code (IMG-014).
 * Allowed from this computer, or with a short-lived signed link. Image links in the answer are signed and expire.
 */
export async function GET(req: Request, { params }: { params: { slug: string; imageId: string } }) {
  const project = await db.project.findFirst({ where: { OR: [{ slug: params.slug }, { id: params.slug }] } });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  const m = /^IMG-?(\d+)$/i.exec(params.imageId);
  const img = await db.plannedImage.findFirst({ where: { projectId: project.id, ...(m ? { seq: parseInt(m[1], 10) } : { id: params.imageId }) }, include: { scene: true } });
  if (!img) return NextResponse.json({ error: 'Picture not found' }, { status: 404 });
  const u = new URL(req.url);
  if (!isLocalRequest(req) && !verify(`manifest:${img.id}`, u.searchParams.get('exp'), u.searchParams.get('sig'))) return NextResponse.json({ error: 'This link has expired or is not allowed. Open the reference pack in Baby Chef Studio again.' }, { status: 403 });
  const set = await aiReferencesFor(project.id, img.id);
  if (!set) return NextResponse.json({ error: 'Picture not found' }, { status: 404 });
  const base = origin();
  const refs = set.refs.map(r => ({
    role: ROLE[r.role], label: r.label,
    imageId: null as string | null,
    name: r.title ?? (r.role === 'BABY' ? 'Master Baby Chef' : r.role === 'KITCHEN' ? 'Master Kitchen' : r.role === 'OUTFIT' ? 'Master Outfit' : null),
    position: r.tag ?? null, approved: !!r.approved, overridden: !!r.overridden,
    directImageUrl: r.assetId ? directImageUrl(r.assetId) : null,
    downloadUrl: r.assetId ? downloadImageUrl(r.assetId, r.dlName) : null,
    downloadName: r.dlName, _src: r.sourceImageId ?? null,
  }));
  const srcIds = refs.map(r => r._src).filter(Boolean) as string[];
  const srcs = srcIds.length ? await db.plannedImage.findMany({ where: { id: { in: srcIds } }, select: { id: true, seq: true } }) : [];
  const seqOf = new Map(srcs.map(s => [s.id, s.seq]));
  const references = refs.map(({ _src, ...r }) => ({ ...r, imageId: _src ? imageCode(seqOf.get(_src) ?? 0) : null }));
  const cur = set.current;
  return NextResponse.json({
    project: { slug: project.slug, code: effectiveCode(project), title: project.title },
    currentImage: { id: imageCode(img.seq), pictureId: img.id, position: set.tag, name: img.title, scene: img.scene.title, hasImage: !!cur.assetId, directImageUrl: cur.assetId ? directImageUrl(cur.assetId) : null },
    references,
    missing: references.filter(r => !r.directImageUrl).map(r => r.role),
    referencePackPage: `${base}/projects/${project.slug}/images/${img.id}/references`,
    zipUrl: zipUrl(img.id),
    linksExpireInSeconds: 12 * 60 * 60,
    notes: 'These pictures are visual continuity references only (same Baby Chef, kitchen, outfit, lighting, cookware, scale, photographic style). The prompt for the current picture decides the exact action and food state. Do not copy a later picture\'s ingredients or cooking state.',
  });
}
