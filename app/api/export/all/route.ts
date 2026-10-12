import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import { db } from '@/lib/db';
import { collectTextFiles } from '@/lib/exports';
import { projectFolder } from '@/lib/files';

export const dynamic = 'force-dynamic';

/** Export everything: every recipe video's text files and data, every Baby Chef, and your settings. Pictures and videos already live in your folder on this Mac. */
export async function GET() {
  const zip = new JSZip();
  const projects = await db.project.findMany({ where: { deletedAt: null } });
  for (const p of projects) {
    const root = zip.folder(await projectFolder(p.id))!;
    for (const t of await collectTextFiles(p.id)) root.file(t.path.startsWith('05 ') || t.path.startsWith('06 ') ? t.path : `00 Project Info/${t.path}`, t.content);
    const full = await db.project.findUniqueOrThrow({ where: { id: p.id }, include: { ingredients: true, scenes: { include: { images: { include: { attempts: true, refs: true } } } }, clips: { include: { refs: true, scenes: true } } } });
    root.file('00 Project Info/project-data.json', JSON.stringify(full, null, 2));
  }
  zip.file('baby-chefs.json', JSON.stringify(await db.babyChef.findMany({ where: { deletedAt: null } }), null, 2));
  zip.file('settings.json', JSON.stringify(await db.setting.findMany(), null, 2));
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return new NextResponse(buf, { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="baby-chef-studio-export.zip"' } });
}
