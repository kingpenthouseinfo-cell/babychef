import '@/app/unassigned.css';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { SCENE_ORDER, IMAGE_ORDER, backfillPositions } from '@/lib/order';
import { sceneLabels } from '@/lib/scene-label';
import { imageLabel } from '@/lib/image-gen';
import { projectFolder } from '@/lib/files';
import { UnassignedBoard } from '@/components/unassigned-board';

export const dynamic = 'force-dynamic';

/** UNASSIGNED: pictures and video clips that are in this project's folder but not on a picture slot / scene. Drag them onto a slot or scene, delete them for good, or move them to another project. */
export default async function Unassigned({ params }: { params: { slug: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  await backfillPositions();
  const folder = await projectFolder(p.id);
  const [scenes, imgs, photos, clips, others] = await Promise.all([
    db.scene.findMany({ where: { projectId: p.id }, orderBy: [...SCENE_ORDER] }),
    db.plannedImage.findMany({ where: { projectId: p.id }, orderBy: [...IMAGE_ORDER], include: { approvedAttempt: true, attempts: { orderBy: { number: 'desc' }, take: 1 } } }),
    db.unmatchedFile.findMany({ where: { status: 'OPEN', relPath: { startsWith: `${folder}/` } }, orderBy: { foundAt: 'desc' } }),
    db.asset.findMany({ where: { kind: 'VIDEO_CLIP', projectSlug: p.slug }, orderBy: { createdAt: 'asc' } }),
    db.project.findMany({ where: { deletedAt: null, id: { not: p.id } }, orderBy: { title: 'asc' }, select: { id: true, title: true } }),
  ]);
  const lab = sceneLabels(scenes);
  const slots = scenes.flatMap(sc => imgs.filter(i => i.sceneId === sc.id).map((i, n) => ({ id: i.id, code: imageLabel(lab.get(sc.id) ?? '', n), title: i.title, sceneLabel: lab.get(sc.id) ?? '', sceneTitle: sc.title, assetId: (i.approvedAttempt ?? i.attempts[0])?.assetId ?? null, status: i.status })));
  const onScene = new Map(scenes.filter(s => (s as any).videoAssetId).map(s => [(s as any).videoAssetId as string, s.id]));
  const assetOf = new Map(clips.map(c => [c.id, c]));
  const sceneBoxes = scenes.map(s => { const a = (s as any).videoAssetId ? assetOf.get((s as any).videoAssetId) : null; return { id: s.id, label: lab.get(s.id) ?? '', title: s.title, clip: a ? { id: a.id, name: a.displayName } : null }; });
  const looseClips = clips.filter(c => !onScene.has(c.id)).map(c => ({ id: c.id, name: c.displayName, size: c.size }));
  const photoAssets = await db.asset.findMany({ where: { id: { in: photos.map(x => x.assetId).filter(Boolean) as string[] } }, select: { id: true, width: true, height: true } });
  const photoItems = photos.map(u => { const a = photoAssets.find(x => x.id === u.assetId); return { id: u.id, name: u.name, assetId: u.assetId, reason: u.reason, size: u.size, folder: u.folder, dims: a?.width ? `${a.width}×${a.height}` : '' }; });
  return (
    <div className="unassigned-page" data-testid="unassigned-page">
      <header className="unassigned-page__head"><h1 className="unassigned-page__title">Unassigned</h1><p className="unassigned-page__sub">Pictures and video clips that are in this project’s folder but not on a picture or scene yet. Drag them where they belong, delete them for good, or move them to another project.</p></header>
      <UnassignedBoard projectId={p.id} slug={p.slug} photos={photoItems} slots={slots} clips={looseClips} scenes={sceneBoxes} projects={others} />
    </div>
  );
}
