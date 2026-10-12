import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { collectTextFiles } from '@/lib/exports';
import { projectFolder } from '@/lib/files';
import { storage } from '@/lib/storage';
import { writeTextFiles } from '@/lib/actions/settings';
import { Chip, Empty, Section, Thumb } from '@/components/ui';
import { SubmitBtn } from '@/components/client';
import { fmtDay, imageCode, klingCode, sceneCode } from '@/lib/util';

type Row = { key: string; cat: string; name: string; ref: string; version: string; status: string; date: Date | null; assetId?: string; href?: string; path?: string };
const CATS = ['References', 'Generated images', 'Approved images', 'Redo images', 'Kling videos', 'Prompt & text exports', 'Publishing text'];

export default async function Files({ params, searchParams }: { params: { slug: string }; searchParams: { cat?: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const folder = await projectFolder(p.id);
  const [refs, images, clips, texts, root] = await Promise.all([
    db.reference.findMany({ where: { projectId: p.id, deletedAt: null }, include: { asset: true, ingredient: true } }),
    db.plannedImage.findMany({ where: { projectId: p.id }, include: { attempts: { include: { asset: true } }, scene: true } }),
    db.klingClip.findMany({ where: { projectId: p.id }, include: { attempts: { include: { asset: true } } } }),
    collectTextFiles(p.id), storage.root(),
  ]);
  const rows: Row[] = [];
  for (const r of refs) rows.push({ key: r.id, cat: 'References', name: r.asset.displayName, ref: `${r.code}${r.ingredient ? ' · ' + r.ingredient.name : ''}`, version: `v${r.version}`, status: r.active ? 'ACTIVE' : 'INACTIVE', date: r.asset.createdAt, assetId: r.assetId, path: r.asset.relPath });
  for (const i of images) for (const a of i.attempts) rows.push({ key: a.id, cat: a.status === 'APPROVED' ? 'Approved images' : ['REDO', 'REJECTED', 'SUPERSEDED'].includes(a.status) ? 'Redo images' : 'Generated images', name: a.asset.displayName, ref: `${imageCode(i.seq)} · ${sceneCode(i.scene.order)}`, version: `attempt ${a.number}`, status: a.status, date: a.createdAt, assetId: a.assetId, path: a.asset.relPath });
  for (const k of clips) for (const a of k.attempts) if (a.asset) rows.push({ key: a.id, cat: 'Kling videos', name: a.asset.displayName, ref: klingCode(k.order), version: `generation ${a.number}`, status: a.status, date: a.createdAt, assetId: a.assetId ?? undefined, path: a.asset.relPath });
  for (const t of texts) rows.push({ key: t.path, cat: t.path.startsWith('06 ') ? 'Publishing text' : 'Prompt & text exports', name: t.path.split('/').pop()!, ref: t.path.split('/').slice(0, -1).join('/') || 'project', version: '', status: 'GENERATED FROM DATABASE', date: null, path: t.path });
  const cat = searchParams.cat;
  const list = rows.filter(r => !cat || r.cat === cat);
  return (
    <div className="space-y-5">
      <Section title="Project folder on your computer">
        <p className="mono break-all text-sm">{root}/{folder}/</p>
        <p className="mt-1 text-sm text-ink-secondary">Everything below is a normal file inside this folder. “Write text files” also saves your scripts, prompts, scenes and publishing copy there as .txt so the folder is understandable without the app.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <form action={writeTextFiles}><input type="hidden" name="projectId" value={p.id} /><SubmitBtn className="" pendingText="Writing…">WRITE TEXT FILES TO PROJECT FOLDER</SubmitBtn></form>
          <a className="btn" href={`/api/projects/${p.slug}/export?format=zip`}>EXPORT PROJECT (ZIP)</a><a className="btn" href={`/api/projects/${p.slug}/export?format=json`}>Export JSON</a>
        </div>
      </Section>
      <div className="flex flex-wrap gap-1.5"><Link href={`/projects/${p.slug}/files`} className={`btn btn-sm ${!cat ? 'btn-primary' : ''}`}>All ({rows.length})</Link>{CATS.map(c => <Link key={c} href={`/projects/${p.slug}/files?cat=${encodeURIComponent(c)}`} className={`btn btn-sm ${cat === c ? 'btn-primary' : ''}`}>{c} ({rows.filter(r => r.cat === c).length})</Link>)}</div>
      {list.length === 0 ? <Empty title="No files yet." hint="References, imported results and exported prompts appear here." /> : (
        <div className="grid gap-3 md:grid-cols-2">{list.map(r => (
          <div key={r.cat + r.key} className="card flex gap-3">
            <div className="w-20 shrink-0">{r.assetId ? <Thumb id={r.assetId} alt={r.name} w={200} ratio="aspect-square" /> : <div className="flex aspect-square items-center justify-center rounded-lg bg-sunken text-xs text-ink-secondary">TXT</div>}</div>
            <div className="min-w-0 flex-1 text-sm"><div className="break-all font-semibold leading-tight">{r.name}</div><div className="text-xs text-ink-secondary">{r.cat} · {r.ref} {r.version && `· ${r.version}`}</div><div className="mt-1 flex items-center gap-2"><Chip>{r.status}</Chip>{r.date && <span className="text-xs text-ink-secondary">{fmtDay(r.date)}</span>}</div>
              {r.assetId && <a className="btn btn-sm mt-2" href={`/api/files/${r.assetId}?download=1`}>Download</a>}</div>
          </div>))}</div>
      )}
    </div>
  );
}
