import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { collectTextFiles } from '@/lib/exports';
import { projectFolder } from '@/lib/files';
import { storage } from '@/lib/storage';
import { addProjectFile, writeTextFiles } from '@/lib/actions/settings';
import { Chip, Empty, fileUrl } from '@/components/ui';
import { RevealButton } from '@/components/image-workspace';
import { SubmitBtn, CopyButton } from '@/components/client';
import { fmtDay, imageCode, klingCode, sceneCode } from '@/lib/util';

type Row = { key: string; dir: string; name: string; ref: string; version: string; status: string; date: Date | null; assetId?: string; idTag?: string };
const DIRS = ['01 References', '02 Images', '03 Redos', '04 Kling', '05 Prompts', '06 Publishing', 'Other'];

export default async function Files({ params, searchParams }: { params: { slug: string }; searchParams: { dir?: string; view?: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const folder = await projectFolder(p.id);
  const [refs, images, clips, texts, others, root] = await Promise.all([
    db.reference.findMany({ where: { projectId: p.id, deletedAt: null }, include: { asset: true, ingredient: true } }),
    db.plannedImage.findMany({ where: { projectId: p.id }, include: { attempts: { include: { asset: true } }, scene: true } }),
    db.klingClip.findMany({ where: { projectId: p.id }, include: { attempts: { include: { asset: true } } } }),
    collectTextFiles(p.id), db.asset.findMany({ where: { relPath: { startsWith: `${folder}/07 Other/` } } }), storage.root(),
  ]);
  const rows: Row[] = [];
  const dirOf = (rel: string) => { const seg = rel.startsWith(folder + '/') ? rel.slice(folder.length + 1).split('/')[0] : '01 References'; return DIRS.includes(seg) ? seg : 'Other'; };
  for (const r of refs) rows.push({ key: r.id, dir: '01 References', name: r.title, ref: `${r.code}${r.ingredient ? ' · ' + r.ingredient.name : ''}`, version: `v${r.version}`, status: r.active ? 'ACTIVE' : 'INACTIVE', date: r.asset.createdAt, assetId: r.assetId, idTag: r.code });
  for (const i of images) for (const a of i.attempts) rows.push({ key: a.id, dir: dirOf(a.asset.relPath), name: `${i.title}`, ref: `${imageCode(i.seq)} · ${sceneCode(i.scene.order)} · ${a.asset.displayName}`, version: `attempt ${a.number}`, status: a.status, date: a.createdAt, assetId: a.assetId, idTag: imageCode(i.seq) });
  for (const k of clips) for (const a of k.attempts) if (a.asset) rows.push({ key: a.id, dir: '04 Kling', name: k.title, ref: `${klingCode(k.order)} · ${a.asset.displayName}`, version: `generation ${a.number}`, status: a.status, date: a.createdAt, assetId: a.assetId ?? undefined, idTag: klingCode(k.order) });
  for (const t of texts) rows.push({ key: t.path, dir: t.path.startsWith('05 ') ? '05 Prompts' : t.path.startsWith('06 ') ? '06 Publishing' : 'Other', name: t.path.split('/').pop()!, ref: t.path.split('/').slice(0, -1).join('/') || 'project', version: '', status: 'GENERATED FROM DATABASE', date: null, idTag: 'TXT' });
  for (const a of others) rows.push({ key: a.id, dir: 'Other', name: a.displayName, ref: a.originalName, version: `v${a.version}`, status: 'ACTIVE', date: a.createdAt, assetId: a.mime.startsWith('image/') ? a.id : undefined, idTag: 'FILE' });
  const dir = searchParams.dir && DIRS.includes(searchParams.dir) ? searchParams.dir : null;
  const list = rows.filter(r => !dir || r.dir === dir);
  const view = searchParams.view === 'list' ? 'list' : 'grid';
  const q = (o: Record<string, string>) => `/projects/${p.slug}/files?${new URLSearchParams({ ...(dir ? { dir } : {}), view, ...o }).toString()}`;
  return (
    <div className="grid gap-0 overflow-hidden rounded-lg border border-line bg-surface lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="border-b border-line bg-grad-purple p-4 lg:border-b-0 lg:border-r">
        <div className="eyebrow text-purple-deep">ON THIS MAC</div>
        <div className="mt-3 text-[12px] text-ink-secondary">Baby Chef Studio /</div>
        <div className="text-[13px] font-semibold">{folder} /</div>
        <ul className="mt-2 space-y-0.5">
          {DIRS.map(d => (
            <li key={d}><Link href={`/projects/${p.slug}/files?dir=${encodeURIComponent(d)}&view=${view}`} className={`flex items-center justify-between rounded-md px-3 py-2 text-[13px] transition ${dir === d ? 'bg-surface font-semibold shadow-sm ring-1 ring-purple-mid' : 'hover:bg-white/60'}`}><span className="font-mono text-[12px]">{d}</span><span className="font-mono text-[12px] text-ink-secondary">{rows.filter(r => r.dir === d).length}</span></Link></li>
          ))}
        </ul>
        <Link href={`/projects/${p.slug}/files`} className="mt-3 block text-[12px] text-purple-deep underline">All files ({rows.length})</Link>
        <p className="mt-6 text-[11px] text-ink-secondary">Files stay in normal folders and are readable in Finder without the app.</p>
      </aside>
      <div className="min-w-0 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 truncate font-mono text-[12px] text-ink-secondary" title={`${root}/${folder}${dir ? '/' + dir : ''}`}>{root.replace(/^\/Users\/[^/]+/, '~')}/{folder}{dir ? `/${dir}` : ''}</div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="View" className="flex gap-1 rounded-md bg-sunken p-1 text-[12px]">{(['grid', 'list'] as const).map(v => <Link key={v} href={q({ view: v })} className={`rounded-sm px-3 py-1 font-medium capitalize ${view === v ? 'bg-surface shadow-sm' : 'text-ink-secondary'}`}>{v}</Link>)}</div>
            <RevealButton projectFolder={`${folder}${dir && dir !== 'Other' ? '/' + dir : ''}`} />
            <form action={writeTextFiles}><input type="hidden" name="projectId" value={p.id} /><SubmitBtn className="btn-sm" pendingText="Writing…">Write text files</SubmitBtn></form>
            <details className="relative"><summary className="btn btn-sm btn-primary cursor-pointer list-none">+ Add file</summary>
              <form action={addProjectFile} className="absolute right-0 top-full z-20 mt-2 w-[280px] space-y-2 rounded-lg border border-line bg-surface p-3 shadow-md"><input type="hidden" name="projectId" value={p.id} /><input type="file" name="file" required className="input" /><SubmitBtn className="btn-sm btn-primary" pendingText="Adding…">Copy into 07 Other</SubmitBtn></form></details>
            <a className="btn btn-sm" href={`/api/projects/${p.slug}/export?format=zip`}>Export ZIP</a>
          </div>
        </div>
        <p className="mb-3 font-mono text-[11px] text-ink-muted">filename pattern: {'{project-slug}_{SC##}_{IMG-###}_{description}_v{n}.png'} · never overwritten</p>
        {list.length === 0 ? <Empty title="No files here yet." hint="References, added results and exported prompts appear in this folder view." /> : view === 'list' ? (
          <div className="overflow-hidden rounded-lg border border-line">
            {list.map(r => (
              <div key={r.dir + r.key} className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-0">
                {r.assetId ? <img src={fileUrl(r.assetId, 120)} alt="" loading="lazy" className="h-9 w-14 shrink-0 rounded-sm border border-line object-cover" /> : <span className="flex h-9 w-14 shrink-0 items-center justify-center rounded-sm bg-sunken font-mono text-[10px] text-ink-muted">{r.idTag}</span>}
                <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium">{r.name}</div><div className="truncate font-mono text-[11px] text-ink-secondary">{r.ref}</div></div>
                <span className="hidden font-mono text-[11px] text-ink-secondary sm:block">{r.version}</span><Chip>{r.status}</Chip>
                {r.assetId && <a className="text-[12px] text-blue-deep underline" href={`/api/files/${r.assetId}?download=1`}>Download</a>}
                <CopyButton text={r.ref.split(' · ').pop() || r.name} label="Copy name" variant="secondary" className="btn-sm" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {list.map(r => (
              <div key={r.dir + r.key} className="overflow-hidden rounded-lg border border-line">
                <div className="relative aspect-video bg-[repeating-linear-gradient(135deg,#ECE9EC_0_8px,#E5E1E5_8px_16px)]">
                  {r.assetId && <img src={fileUrl(r.assetId, 480)} alt="" loading="lazy" className="h-full w-full object-cover" />}
                  <span className="absolute left-2 top-2 rounded-xs bg-surface/90 px-1.5 py-0.5 font-mono text-[10px]">{r.idTag}</span>
                  <span className="absolute right-2 top-2"><Chip>{r.status}</Chip></span>
                </div>
                <div className="p-3"><div className="truncate text-[14px] font-semibold">{r.name}</div><div className="mt-0.5 break-all font-mono text-[10px] leading-tight text-ink-secondary">{r.ref}</div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-ink-muted"><span>{r.version}</span><span>{r.date ? fmtDay(r.date) : ''}</span></div>
                  <div className="mt-2 flex items-center gap-3">{r.assetId && <a className="text-[12px] font-medium text-blue-deep underline" href={`/api/files/${r.assetId}?download=1`}>Download</a>}<CopyButton text={r.ref.split(' · ').pop() || r.name} label="Copy name" variant="secondary" className="btn-sm" /></div></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
