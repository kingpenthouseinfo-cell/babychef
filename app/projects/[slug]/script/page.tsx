import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { DirtyForm, SubmitBtn, CopyButton, MarkerToolbar } from '@/components/client';
import { Area, Chip, Empty, Section, Sel, Text } from '@/components/ui';
import { createScript, saveScript, setCurrentScript, reopenScript } from '@/lib/actions/script';
import { SCRIPT_MARKERS, SCRIPT_STATUSES } from '@/lib/constants';
import { fmtDate, wordCount } from '@/lib/util';
import Link from 'next/link';

function Highlight({ text }: { text: string }) {
  const parts = text.split(/(\[[A-Z \-]+\])/g);
  return <pre className="mono max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-neutral-50 p-3">{parts.map((p, i) => SCRIPT_MARKERS.includes(p) ? <mark key={i} className="rounded bg-amber-200 px-0.5">{p}</mark> : p)}</pre>;
}

export default async function Script({ params, searchParams }: { params: { slug: string }; searchParams: { v?: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const versions = await db.scriptVersion.findMany({ where: { projectId: p.id }, orderBy: { version: 'desc' } });
  const sel = versions.find(v => v.id === searchParams.v) ?? versions.find(v => v.isCurrent) ?? versions[0];
  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-neutral-100 p-3 text-sm">Scripts are written elsewhere (ChatGPT / Claude) and pasted here. Use <Link className="underline" href={`/projects/${p.slug}/prompts?cat=SCRIPT`}>PREPARE SCRIPT PROMPT</Link> to build the request.</div>
      {!sel ? <Empty title="No script yet." hint="Create Script v1, then paste your script into it."><form action={createScript}><input type="hidden" name="projectId" value={p.id} /><SubmitBtn pendingText="Creating…">+ CREATE SCRIPT v1</SubmitBtn></form></Empty> : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {versions.map(v => <Link key={v.id} href={`/projects/${p.slug}/script?v=${v.id}`} className={`btn btn-sm ${v.id === sel.id ? 'btn-primary' : ''}`}>v{v.version}{v.isCurrent ? ' ★ CURRENT' : ''}</Link>)}
          </div>
          <Section title={`Script v${sel.version}`} right={<div className="flex items-center gap-2"><Chip>{sel.status}</Chip>{sel.isCurrent && <Chip tone="APPROVED">CURRENT</Chip>}</div>}>
            <DirtyForm action={saveScript} className="space-y-3" key={sel.id + sel.updatedAt.toISOString()}>
              <input type="hidden" name="id" value={sel.id} />
              <div className="grid gap-3 sm:grid-cols-3"><Text name="title" label="Script title" v={sel.title} className="sm:col-span-2" /><Sel name="status" label="Status" v={sel.status} options={SCRIPT_STATUSES} /></div>
              <MarkerToolbar target="script-content" markers={SCRIPT_MARKERS} />
              <Area id="script-content" name="content" label={`Script (${wordCount(sel.content)} words)`} v={sel.content} rows={22} mono />
              <Area name="notes" label="Version notes" v={sel.notes} rows={2} />
              <div className="text-xs text-neutral-500">Created {fmtDate(sel.createdAt)} · Last modified {fmtDate(sel.updatedAt)}</div>
              <div className="flex flex-wrap gap-2"><SubmitBtn>SAVE</SubmitBtn><CopyButton text={sel.content} label="COPY ENTIRE SCRIPT" />
                <a className="btn" href={`/api/export/text?type=script&id=${sel.id}`}>DOWNLOAD</a></div>
            </DirtyForm>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
              {!sel.isCurrent && <form action={setCurrentScript}><input type="hidden" name="id" value={sel.id} /><SubmitBtn className="" pendingText="…">Make this version CURRENT</SubmitBtn></form>}
              <form action={createScript}><input type="hidden" name="projectId" value={p.id} /><input type="hidden" name="from" value={sel.id} /><input type="hidden" name="notes" value={`Duplicated from v${sel.version}`} /><SubmitBtn className="" pendingText="…">Duplicate as new version</SubmitBtn></form>
              {sel.status === 'LOCKED' && <form action={reopenScript}><input type="hidden" name="id" value={sel.id} /><SubmitBtn className="" pendingText="…">Reopen (unlock)</SubmitBtn></form>}
            </div>
          </Section>
          <Section title="Preview with markers highlighted"><Highlight text={sel.content || '(empty)'} /></Section>
        </>
      )}
    </div>
  );
}
