import Link from 'next/link';
import { db } from '@/lib/db';
import { buildChecklist, imageInclude, nextReadyImages } from '@/lib/queries';
import { PageHeader, Empty, Chip } from '@/components/ui';
import { ChecklistText, RefThumbs } from '@/components/image-bits';
import { CopyButton, NextPrompt, SubmitBtn } from '@/components/client';
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
  const nextItems = eligible.map((i: any) => ({ id: i.id, code: imageCode(i.seq), title: i.title, project: i.project.title, full: i.fullPrompt, cont: i.contPrompt, checklist: buildChecklist(i).map(c => ({ label: c.label, required: c.required })) }));
  const q = (o: Record<string, string>) => '/queue?' + new URLSearchParams({ ...(pid ? { project: pid } : {}), ...(searchParams.sort ? { sort: searchParams.sort } : {}), show, ...o }).toString();
  return (
    <>
      <PageHeader title="Prompt Queue" sub="Work through ChatGPT generation: copy prompt → upload references → generate → upload result">
        <a href={s.url_ChatGPT} target="_blank" rel="noopener noreferrer" className="btn">OPEN CHATGPT ↗</a>
        <a href={s.url_Claude} target="_blank" rel="noopener noreferrer" className="btn">OPEN CLAUDE ↗</a>
        <a href={s.url_Kling} target="_blank" rel="noopener noreferrer" className="btn">OPEN KLING ↗</a>
      </PageHeader>
      <form className="mb-4 flex flex-wrap gap-2"><select name="project" defaultValue={pid || ''} className="input max-w-xs" aria-label="Project filter"><option value="">All projects</option>{projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select><input type="hidden" name="show" value={show} /><button className="btn">Filter</button></form>
      <div className="mb-5"><NextPrompt items={nextItems} /></div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {[['ready', `READY (${eligible.length + blocked.length})`], ['generating', 'GENERATING'], ['waiting', 'WAITING'], ['review', 'NEEDS REVIEW'], ['redo', 'REDO'], ['all', 'ALL ACTIVE']].map(([k, l]) => <Link key={k} href={q({ show: k })} className={`btn btn-sm ${show === k ? 'btn-primary' : ''}`}>{l}</Link>)}
        <Link href={q({ sort: searchParams.sort === 'priority' ? '' : 'priority' })} className="btn btn-sm">Sort by priority</Link>
      </div>
      {rows.length === 0 ? <Empty title="No images here." hint={show === 'ready' ? 'No images ready. Finish a prompt or resolve dependencies.' : 'Nothing in this state.'} /> : (
        <div className="space-y-3">{rows.map((i: any) => {
          const cl = buildChecklist(i);
          const isBlocked = i.dependsOn && i.dependsOn.status !== 'APPROVED';
          const slug = i.project?.slug;
          return (
            <div key={i.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><div className="flex flex-wrap items-center gap-2"><Link href={`/projects/${slug}/images/${i.id}`} className="font-mono text-base font-bold hover:underline">{imageCode(i.seq)}</Link><Chip>{i.status}</Chip>{i.priority === 'HIGH' && <Chip tone="HIGH">HIGH</Chip>}<Chip>{`PROMPT ${i.promptStatus}`}</Chip></div>
                  <div className="mt-1 font-semibold">{i.title}</div><div className="text-xs text-neutral-500">{i.project?.title} · {sceneCode(i.scene.order)} {i.scene.title} · {i.shotType}</div></div>
                <div className="text-right text-xs text-neutral-500">{cl.filter(c => c.required).length} required refs</div>
              </div>
              {isBlocked && <div className="mt-2 text-sm font-semibold text-amber-800">Waiting for {imageCode(i.dependsOn.seq)}.</div>}
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]"><div><RefThumbs list={cl} max={8} /><details className="mt-2"><summary className="cursor-pointer text-xs font-semibold">VIEW REFERENCES (checklist)</summary><div className="mt-2"><ChecklistText list={cl} /></div></details></div></div>
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton text={i.fullPrompt} label="COPY FULL PROMPT" /><CopyButton text={i.contPrompt} label="COPY CONTINUATION PROMPT" />
                {i.status === 'READY' && <form action={setImageStatus}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="status" value="GENERATING" /><SubmitBtn className="" pendingText="…">MARK GENERATING</SubmitBtn></form>}
                {['READY', 'GENERATING'].includes(i.status) && <form action={setImageStatus} className="flex gap-1"><input type="hidden" name="id" value={i.id} /><input type="hidden" name="status" value="WAITING" /><select name="reason" className="input w-44" aria-label="Waiting reason">{WAITING_REASONS.map(r => <option key={r}>{r}</option>)}</select><SubmitBtn className="" pendingText="…">MARK WAITING</SubmitBtn></form>}
                {i.status === 'WAITING' && <form action={setImageStatus}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="status" value="READY" /><SubmitBtn className="" pendingText="…">Return to READY</SubmitBtn></form>}
                {i.status === 'REDO' && <form action={setImageStatus}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="status" value="READY" /><SubmitBtn className="" pendingText="…">Mark READY again</SubmitBtn></form>}
                <Link href={`/projects/${slug}/images/${i.id}#${i.status === 'REVIEW' ? 'review' : 'results'}`} className="btn btn-accent">{i.status === 'REVIEW' ? 'REVIEW' : 'UPLOAD RESULT'}</Link>
              </div>
            </div>
          );
        })}</div>
      )}
    </>
  );
}
