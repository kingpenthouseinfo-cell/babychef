import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { db } from '@/lib/db';
import { storage } from '@/lib/storage';
import { collectTextFiles, toCsv } from '@/lib/exports';
import { projectFolder } from '@/lib/files';
import { imageCode, sceneCode } from '@/lib/util';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const p = await db.project.findFirst({ where: { slug: params.slug, deletedAt: null } });
  if (!p) return new NextResponse('Not found', { status: 404 });
  const u = new URL(req.url);
  const format = u.searchParams.get('format') || 'json';

  if (format === 'csv') {
    const table = u.searchParams.get('table');
    let rows: Record<string, unknown>[] = [];
    if (table === 'ingredients') rows = (await db.ingredient.findMany({ where: { projectId: p.id }, orderBy: { order: 'asc' } })).map(({ id, projectId, ...r }) => r);
    else if (table === 'scenes') rows = (await db.scene.findMany({ where: { projectId: p.id }, orderBy: [{ pos: 'asc' }, { order: 'asc' }] })).map(({ id, projectId, order, ...r }) => ({ code: sceneCode(order), ...r }));
    else if (table === 'images') rows = (await db.plannedImage.findMany({ where: { projectId: p.id }, orderBy: [{ scene: { pos: 'asc' } }, { pos: 'asc' }, { seq: 'asc' }], include: { scene: true } })).map(({ id, projectId, seq, sceneId, scene, approvedAttemptId, dependsOnId, ...r }) => ({ code: imageCode(seq), scene: sceneCode(scene.order), ...r }));
    else return new NextResponse('Unknown table', { status: 400 });
    return new NextResponse(toCsv(rows), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${p.slug}_${table}.csv"` } });
  }

  if (format === 'zip') {
    const folder = await projectFolder(p.id);
    const zip = new JSZip();
    const root = zip.folder(folder)!;
    for (const t of await collectTextFiles(p.id)) root.file(t.path.startsWith('05 ') || t.path.startsWith('06 ') ? t.path : `00 Project Info/${t.path}`, t.content);
    const assets = await db.asset.findMany({ where: { OR: [{ relPath: { startsWith: folder + '/' } }, { references: { some: { projectId: p.id } } }] } });
    for (const a of assets) { try { root.file(a.relPath.startsWith(folder + '/') ? a.relPath.slice(folder.length + 1) : `01 References/${a.relPath.split('/').slice(1).join('/')}`, await storage.read(a.relPath)); } catch { /* missing file: skip */ } }
    const full = await db.project.findUniqueOrThrow({ where: { id: p.id }, include: { ingredients: true, scenes: { include: { images: { include: { attempts: true, refs: true } } } }, clips: { include: { refs: true, scenes: true, attempts: true } }, scripts: true, short: { include: { items: true } }, publishing: true, babyChef: true } });
    root.file('00 Project Info/project-data.json', JSON.stringify(full, null, 2));
    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    return new NextResponse(buf, { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${p.slug}.zip"` } });
  }

  const full = await db.project.findUniqueOrThrow({
    where: { id: p.id },
    include: {
      babyChef: true, ingredients: { include: { references: true } }, references: true, recipes: true, scripts: true, docs: true, notes: true,
      scenes: { include: { images: { include: { refs: true, attempts: true } } } }, clips: { include: { refs: true, scenes: true, attempts: true } },
      short: { include: { items: true } }, prompts: true, publishing: true, checklist: true, corrections: true,
    },
  });
  const images = await db.promptVersion.findMany({ where: { ownerId: { in: full.scenes.flatMap(s => s.images.map(i => i.id)).concat(full.clips.map(c => c.id)) } } });
  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), project: full, promptVersions: images }, null, 2), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${p.slug}.json"` } });
}
