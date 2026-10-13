import Link from 'next/link';
import { db } from '@/lib/db';
import { buildChecklist, imageInclude, nextReadyImages } from '@/lib/queries';
import { PageHeader, Empty, Chip } from '@/components/ui';
import { ChecklistText, RefThumbs } from '@/components/image-bits';
import { CopyButton, SubmitBtn } from '@/components/client';
import { QueueNext } from '@/components/queue-client';
import { fmtDate } from '@/lib/util';
import { expectedFilename, nextVersion, withFilename } from '@/lib/naming';
import { setImageStatus } from '@/lib/actions/image';
import { getSettings } from '@/lib/settings';
import { imageCode, sceneCode } from '@/lib/util';
import { WAITING_REASONS } from '@/lib/constants';

export default async function Queue({ searchParams }: { searchParams: { project?: string; show?: string; sort?: string } }) {
  const [projects, s] = await Promise.all([db.project.findMany({ where: { deletedAt: null, status: { not: 'ARCHIVED' } }, orderBy: { title: 'asc' } }), getSettings()]);
  const pid = searchParams.project || null;
  const { eligible, blocked } = await nextReadyImages(pid);
  const rest = await db.plannedImage.findMany({ where: { status: { in: ['GENERATING', 'WAITING', 'REVIEW', 'REDO'] }, ...(pid ? { projectId: pid } : {}), project: { deletedAt: null } }, include: { ...imageInclude, project: true }, orderBy: [{ projectId: 'asc' }, { seq: 'asc' }] });
  const show = searchParams.show || 'ready';
  const rank: Record<string, number> = { HIGH: 0, NORMAL: 1, LOW: 2 };
  let rows: any[] = show === 'ready' ? [...eligible, ...blocked] : rest.filter(i => show === 'all' || i.status === show.toUpperCase());
  if (searchParams.sort === 'priority') rows = [...rows].sort((a, b) => rank[a.priority] - rank[b.priority] || a.seq - b.seq);
  const { orderedPictures } = await import('@/lib/order');
  const projIds = [...new Set(eligible.map((i: any) => i.projectId))] as string[];
  const noMap = new Map<string, number>();
  for (const pj of projIds) for (const x of await orderedPictures(pj)) noMap.set(x.id, x.n);
  const fname = (i: any) => expectedFilename({ slug: i.project.slug, code: i.project.code, sceneOrder: i.scene.order, seq: i.seq, title: i.title, version: nextVersion((i.attempts ?? []).map((a: any) => a.number)) });
  const nextItems = eligible.map((i: any) => ({ filename: fname(i), id: i.id, slug: i.project.slug, code: imageCode(i.seq), no: noMap.get(i.id) ?? 0, title: i.title, project: i.project.title, scene: sceneCode(i.scene.order), shot: i.shotType, aspect: i.aspectRatio || i.project.aspectRatio, priority: i.priority, full: i.fullPrompt, cont: i.contPrompt, refs: buildChecklist(i).map(c => ({ label: c.label, assetId: c.assetId, required: c.required })) }));
  const q = (o: Record<string, string>) => '/queue?' + new URLSearchParams({ ...(pid ? { project: pid } : {}), ...(searchParams.sort ? { sort: searchParams.sort } : {}), show, ...o }).toString();
  return (
    <>
      <PageHeader title="Pictures to Make" sub="Work through your pictures one at a time">
        <a href={s.url_ChatGPT} target="_blank" rel="noopener noreferrer" className="btn">OPEN CHATGPT ↗</a>
        <a href={s.url_Claude} target="_blank" rel="noopener noreferrer" className="btn">OPEN CLAUDE ↗</a>
        <a href={s.url_Kling} target="_blank" rel="noopener noreferrer" className="btn">OPEN KLING ↗</a>
      </PageHeader>
      <form className="mb-4 flex flex-wrap gap-2"><select name="project" defaultValue={pid || ''} className="input max-w-xs" aria-label="Project filter"><option value="">All projects</option>{projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select><input type="hidden" name="show" value={show} /><button className="btn">Filter</button></form>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {[['ready', `Ready ${eligible.length + blocked.length}`], ['generating', `Generating ${rest.filter((x: any) => x.status === 'GENERATING').length}`], ['waiting', `Waiting ${rest.filter((x: any) => x.status === 'WAITING').length}`], ['redo', `Redo ${rest.filter((x: any) => x.status === 'REDO').length}`], ['review', `Review ${rest.filter((x: any) => x.status === 'REVIEW').length}`], ['all', 'All active']].map(([k, l]) => <Link key={k} href={q({ show: k })} className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${show === k ? 'bg-btn-blue text-white shadow-sm' : 'bg-surface text-ink-secondary ring-1 ring-line hover:text-ink'}`}>{l}</Link>)}
        <Link href={q({ sort: searchParams.sort === 'priority' ? '' : 'priority' })} className="btn btn-sm btn-ghost">Sort by priority</Link>
      </div>
      {show === 'ready' && <div className="mb-6"><QueueNext items={nextItems} chatgpt={s.url_ChatGPT} /></div>}
      {show === 'ready' && rest.filter((x: any) => x.status === 'WAITING').map((w: any) => (
        <div key={w.id} className="mb-3 max-w-[820px] rounded-lg border border-[#E7D3A0] bg-[#F8EFD9]/60 p-4 text-[13px]">
          <div className="flex flex-wrap items-center gap-2"><span className="chip st-waiting">WAITING</span><span className="font-mono text-[12px] font-medium">{imageCode(w.seq)}</span><span>{w.title}</span></div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-[12px]"><dt className="text-ink-secondary">Reason</dt><dd>{w.waitingReason || '—'}</dd><dt className="text-ink-secondary">Marked</dt><dd className="font-mono">{fmtDate(w.waitingAt)}</dd>{w.waitingNote && <><dt className="text-ink-secondary">Notes</dt><dd>{w.waitingNote}</dd></>}</dl>
          <form action={setImageStatus} className="mt-3"><input type="hidden" name="id" value={w.id} /><input type="hidden" name="status" value="READY" /><SubmitBtn className="btn-sm" pendingText="…">Return to Ready</SubmitBtn></form>
        </div>))}
      {show === 'ready' && blocked.length > 0 && <p className="mb-3 text-[13px] text-[#8A6216]">{blocked.length} ready image(s) are waiting for a dependency to be approved.</p>}
      {show === 'ready' ? null : rows.length === 0 ? <Empty title="No images here." hint={show === 'ready' ? 'No images ready. Finish a prompt or resolve dependencies.' : 'Nothing in this state.'} /> : (
        <div className="space-y-3">{rows.map((i: any) => {
          const cl = buildChecklist(i);
          const isBlocked = i.dependsOn && i.dependsOn.status !== 'APPROVED';
          const slug = i.project?.slug;
          return (
            <div key={i.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><div className="flex flex-wrap items-center gap-2"><Link href={`/projects/${slug}/images/${i.id}`} className="font-mono text-base font-bold hover:underline">{imageCode(i.seq)}</Link><Chip>{i.status}</Chip>{i.priority === 'HIGH' && <Chip tone="HIGH">HIGH</Chip>}<Chip>{`PROMPT ${i.promptStatus}`}</Chip></div>
                  <div className="mt-1 font-semibold">{i.title}</div><div className="text-xs text-ink-secondary">{i.project?.title} · {sceneCode(i.scene.order)} {i.scene.title} · {i.shotType}</div></div>
                <div className="text-right text-xs text-ink-secondary">{cl.filter(c => c.required).length} required refs</div>
              </div>
              <div className="mt-2 rounded-md border border-purple-mid bg-purple-tint/60 px-3 py-2"><span className="eyebrow text-purple-deep">NEXT RESULT FILE</span><div className="font-mono text-[12px] break-all">{fname(i)}</div></div>
              {isBlocked && <div className="mt-2 text-sm font-semibold text-[#8A6216]">Waiting for {imageCode(i.dependsOn.seq)}.</div>}
              {i.status === 'WAITING' && <div className="mt-2 rounded-md border border-[#E7D3A0] bg-[#F8EFD9]/60 px-3 py-2 text-[12px]"><b>Reason:</b> {i.waitingReason || '—'} · <b>Marked:</b> <span className="font-mono">{fmtDate(i.waitingAt)}</span>{i.waitingNote ? <> · <b>Notes:</b> {i.waitingNote}</> : null}</div>}
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]"><div><RefThumbs list={cl} max={8} /><details className="mt-2"><summary className="cursor-pointer text-xs font-semibold">VIEW REFERENCES (checklist)</summary><div className="mt-2"><ChecklistText list={cl} /></div></details></div></div>
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton text={withFilename(i.fullPrompt, fname(i))} label="COPY IMAGE PROMPT" /><CopyButton text={withFilename(i.contPrompt, fname(i))} label="COPY NEXT IMAGE PROMPT" variant="secondary" /><CopyButton text={fname(i)} label="COPY FILENAME" variant="secondary" />
                {i.status === 'READY' && <form action={setImageStatus}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="status" value="GENERATING" /><SubmitBtn className="" pendingText="…">MARK GENERATING</SubmitBtn></form>}
                {['READY', 'GENERATING'].includes(i.status) && <form action={setImageStatus} className="flex gap-1"><input type="hidden" name="id" value={i.id} /><input type="hidden" name="status" value="WAITING" /><select name="reason" className="input w-44" aria-label="Waiting reason">{WAITING_REASONS.map(r => <option key={r}>{r}</option>)}</select><SubmitBtn className="" pendingText="…">MARK WAITING</SubmitBtn></form>}
                {i.status === 'WAITING' && <form action={setImageStatus}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="status" value="READY" /><SubmitBtn className="" pendingText="…">Return to READY</SubmitBtn></form>}
                {i.status === 'REDO' && <form action={setImageStatus}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="status" value="READY" /><SubmitBtn className="" pendingText="…">Mark READY again</SubmitBtn></form>}
                <Link href={`/projects/${slug}/images/${i.id}#${i.status === 'REVIEW' ? 'review' : 'results'}`} className="btn btn-primary">{i.status === 'REVIEW' ? 'REVIEW' : 'ADD FINISHED PICTURE'}</Link>
              </div>
            </div>
          );
        })}</div>
      )}
    </>
  );
}
