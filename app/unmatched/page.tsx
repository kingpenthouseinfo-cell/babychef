import Link from 'next/link';
import { db } from '@/lib/db';
import { getStorageRoot } from '@/lib/storage';
import { getSettings } from '@/lib/settings';
import { watcherStatus } from '@/lib/watcher';
import { rescanNow, ignoreUnmatched } from '@/lib/actions/watch';
import { AssignForm, ProjOpt } from '@/components/unmatched-client';
import { RevealButton } from '@/components/image-workspace';
import { PageHeader, Empty, Thumb } from '@/components/ui';
import { SubmitBtn } from '@/components/client';
import { fmtDate, imageCode, sceneCode } from '@/lib/util';
import { nextVersion } from '@/lib/naming';

export default async function Unmatched() {
  const [open, ignored, projects, s, root] = await Promise.all([
    db.unmatchedFile.findMany({ where: { status: 'OPEN' }, orderBy: { foundAt: 'desc' } }),
    db.unmatchedFile.count({ where: { status: 'IGNORED' } }),
    db.project.findMany({ where: { deletedAt: null }, orderBy: { title: 'asc' }, include: { scenes: { orderBy: [{ pos: 'asc' }, { order: 'asc' }], include: { images: { orderBy: [{ pos: 'asc' }, { seq: 'asc' }], include: { attempts: { select: { number: true } } } } } } } }),
    getSettings(), getStorageRoot(),
  ]);
  const assets = await db.asset.findMany({ where: { id: { in: open.map(o => o.assetId).filter(Boolean) as string[] } } });
  const opts: ProjOpt[] = projects.map(p => ({ id: p.id, title: p.title, scenes: p.scenes.map(sc => ({ id: sc.id, label: `${sceneCode(sc.order)} ${sc.title}`, images: sc.images.map(i => ({ id: i.id, label: `${imageCode(i.seq)} ${i.title}`, next: nextVersion(i.attempts.map(a => a.number)) })) })) }));
  const w = watcherStatus();
  const on = s.watchProjectFolders !== 'false';
  return (
    <>
      <PageHeader title="Unmatched Files" sub="Images found in your project folders that could not be matched confidently. Nothing is guessed.">
        <form action={rescanNow}><SubmitBtn className="" pendingText="Scanning…">Scan folders now</SubmitBtn></form>
      </PageHeader>
      <div className="mb-5 rounded-lg border border-line bg-surface p-4 text-[13px]">
        <b>Folder watcher:</b> {on ? <span className="text-sage-deep">ON</span> : <span className="text-[#8A6216]">OFF</span>} · watching <span className="font-mono">{root.replace(/^\/Users\/[^/]+/, '~')}/&lt;Project&gt;/02 Images</span> · last scan {w.lastScan ? fmtDate(new Date(w.lastScan)) : 'not yet'} · <Link href="/settings#general" className="underline">change in Settings</Link>
        <p className="mt-1 text-ink-secondary">A file is matched automatically only when its name contains the project code, scene, image and version — e.g. <span className="font-mono">JBP-S12-IMG024_v1.png</span> — and those IDs agree with the folder and your planned image. Files are indexed in place and never copied, deleted or overwritten.</p>
      </div>
      {open.length === 0 ? <Empty title="No unmatched files." hint={`Every image in your project folders is matched${ignored ? ` (${ignored} ignored)` : ''}.`} /> : (
        <div className="space-y-4">
          {open.map(u => (
            <section key={u.id} className="card">
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="w-full shrink-0 md:w-56"><Thumb id={u.assetId} alt={u.name} w={480} ratio="aspect-video" />{assets.find(a => a.id === u.assetId)?.width && <div className="mt-1 font-mono text-[11px] text-ink-muted">{assets.find(a => a.id === u.assetId)!.width}×{assets.find(a => a.id === u.assetId)!.height}</div>}</div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="break-all font-mono text-[14px] font-medium">{u.name}</div>
                  <div className="text-[12px] text-ink-secondary">Detected folder: <span className="font-mono">{u.folder}</span> · found {fmtDate(u.foundAt)} · {(u.size / 1024).toFixed(0)} KB</div>
                  <div className="rounded-md border border-[#E7D3A0] bg-[#F8EFD9]/60 px-3 py-2 text-[12px] text-[#8A6216]"><b>Why it is unmatched:</b> {u.reason}</div>
                  <AssignForm id={u.id} projects={opts} />
                  <div className="flex flex-wrap gap-2 pt-1">
                    {u.assetId && <RevealButton assetId={u.assetId} />}
                    <form action={ignoreUnmatched}><input type="hidden" name="id" value={u.id} /><button className="btn btn-sm btn-ghost">Ignore (leave the file alone)</button></form>
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
