import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { ensureChecklist } from '@/lib/settings';
import { buildVars, render } from '@/lib/template-engine';
import { contextBlock } from '@/lib/publishing';
import { Area, Check, Chip, Empty, Section, Sel, Text } from '@/components/ui';
import { ConfirmForm, CopyButton, DirtyForm, SubmitBtn } from '@/components/client';
import { addChecklist, createPublishingAssets, deleteChecklist, deletePublishingAsset, preparePublishingPrompt, savePubContext, savePublishingAsset, saveThumbnail, toggleChecklist } from '@/lib/actions/prompts';
import { PUB_CONTEXT_FIELDS, PUB_STATUSES } from '@/lib/constants';
import { fmtDate, imageCode, parseJson } from '@/lib/util';

export default async function Publishing({ params }: { params: { slug: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  await ensureChecklist(p.id);
  const [assets, docs, checklist, images, thumbTpl, settings] = await Promise.all([
    db.publishingAsset.findMany({ where: { projectId: p.id }, orderBy: { code: 'asc' } }),
    db.projectDoc.findMany({ where: { projectId: p.id, key: { in: ['pubctx', 'thumbnail'] } } }),
    db.checklistItem.findMany({ where: { projectId: p.id }, orderBy: { order: 'asc' } }),
    db.plannedImage.findMany({ where: { projectId: p.id, approvedAttemptId: { not: null } }, orderBy: { seq: 'asc' } }),
    db.promptTemplate.findUnique({ where: { code: 'TPL-YT-THUMB' } }),
    import('@/lib/settings').then(m => m.getSettings()),
  ]);
  const ctx = parseJson<any>(docs.find(d => d.key === 'pubctx')?.data, { include: PUB_CONTEXT_FIELDS });
  const th = parseJson<Record<string, string>>(docs.find(d => d.key === 'thumbnail')?.data, {});
  const inc: string[] = ctx.include ?? PUB_CONTEXT_FIELDS;
  const preview = await contextBlock(p.id);
  const vars = await buildVars(p.id);
  const thumbPrompt = thumbTpl ? render(thumbTpl.text, vars).out : '';
  const platforms = [...new Set(assets.map(a => a.platform))];
  const done = checklist.filter(c => c.done).length;
  const groups = [...new Set(checklist.map(c => c.group))];
  const imgOpts: [string, string][] = [['', '— none —'], ...images.map(i => [i.id, `${imageCode(i.seq)} ${i.title}`] as [string, string])];
  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-neutral-100 p-3 text-sm">Nothing is posted automatically. For each item: <b>PREPARE PROMPT</b> → <b>COPY</b> → paste into ChatGPT/Claude → paste the answer back → write the <b>selected final text</b>.</div>
      <Section title="Publishing context (what gets added to every publishing prompt)">
        <DirtyForm action={savePubContext} className="space-y-3"><input type="hidden" name="projectId" value={p.id} />
          <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">{PUB_CONTEXT_FIELDS.map(f => <label key={f} className="flex items-center gap-2 text-sm"><input type="checkbox" name="include" value={f} defaultChecked={inc.includes(f)} className="h-4 w-4" />{f}</label>)}</div>
          <div className="grid gap-3 sm:grid-cols-2">{['Funny moments', 'Recipe highlights', 'Cooking techniques', 'Notes'].map(f => <Area key={f} name={`x:${f}`} label={f} v={ctx[f]} rows={2} />)}</div>
          <SubmitBtn>SAVE CONTEXT</SubmitBtn>
        </DirtyForm>
        <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">Preview context</summary><pre className="mono mt-2 whitespace-pre-wrap rounded-lg bg-neutral-50 p-3">{preview || '(nothing selected / nothing filled in yet)'}</pre></details>
      </Section>

      {assets.length === 0 ? (
        <Empty title="No publishing items yet." hint="Create the standard set for YouTube, Shorts, Facebook, Instagram and TikTok."><form action={createPublishingAssets}><input type="hidden" name="projectId" value={p.id} /><SubmitBtn pendingText="Creating…">CREATE STANDARD PUBLISHING ITEMS</SubmitBtn></form></Empty>
      ) : (
        <form action={createPublishingAssets}><input type="hidden" name="projectId" value={p.id} /><button className="btn btn-sm">Add any missing standard items</button></form>
      )}

      {platforms.map(pl => (
        <Section key={pl} title={pl} right={<span className="text-xs text-neutral-500">{assets.filter(a => a.platform === pl && ['SELECTED', 'PUBLISHED'].includes(a.status)).length}/{assets.filter(a => a.platform === pl).length} selected</span>}>
          <div className="space-y-2">
            {assets.filter(a => a.platform === pl).map(a => (
              <details key={a.id} className="rounded-lg border border-line p-3">
                <summary className="cursor-pointer text-sm"><b>{a.assetType}</b> <Chip>{a.status}</Chip> <span className="text-xs text-neutral-400">{a.code}{a.promptVersion ? ` · prompt v${a.promptVersion}` : ''}</span>{a.selected && <span className="ml-2 text-xs text-neutral-500">✓ {a.selected.slice(0, 50).replace(/\n/g, ' ')}</span>}</summary>
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap gap-2"><form action={preparePublishingPrompt}><input type="hidden" name="id" value={a.id} /><SubmitBtn className="btn-primary" pendingText="…">{a.prompt ? 'REBUILD PROMPT' : 'PREPARE PROMPT'}</SubmitBtn></form>
                    {a.prompt && <CopyButton text={a.prompt} label="COPY PROMPT" />}{a.prompt && <a className="btn" href={`/api/export/text?type=publishing&id=${a.id}`}>DOWNLOAD PROMPT</a>}
                    <a className="btn" href={settings.url_ChatGPT} target="_blank" rel="noopener noreferrer">OPEN CHATGPT ↗</a><a className="btn" href={settings.url_Claude} target="_blank" rel="noopener noreferrer">OPEN CLAUDE ↗</a></div>
                  <DirtyForm action={savePublishingAsset} className="space-y-3"><input type="hidden" name="id" value={a.id} />
                    <Area name="prompt" label="Prompt" v={a.prompt} rows={6} mono />
                    <Area name="returned" label="Returned text (paste from ChatGPT / Claude)" v={a.returned} rows={6} />
                    <Area name="selected" label="SELECTED FINAL TEXT" v={a.selected} rows={4} />
                    <div className="grid gap-3 sm:grid-cols-3"><Sel name="status" label="Status" v={a.status} options={PUB_STATUSES} /><Text name="publishedUrl" label="Published URL" v={a.publishedUrl} /><Text name="publishedAt" label="Published date" type="date" v={a.publishedAt ? a.publishedAt.toISOString().slice(0, 10) : ''} /></div>
                    <Text name="notes" label="Notes" v={a.notes} />
                    <div className="flex flex-wrap gap-2"><SubmitBtn>SAVE</SubmitBtn>{a.selected && <CopyButton text={a.selected} label="COPY SELECTED" />}</div>
                  </DirtyForm>
                  <div className="text-[11px] text-neutral-400">Updated {fmtDate(a.updatedAt)}</div>
                  <ConfirmForm action={deletePublishingAsset} message="Delete this publishing item?"><input type="hidden" name="id" value={a.id} /><button className="btn btn-sm btn-danger">Delete item</button></ConfirmForm>
                </div>
              </details>))}
          </div>
        </Section>
      ))}

      <Section title="YouTube thumbnail planning">
        <DirtyForm action={saveThumbnail} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="projectId" value={p.id} />
          <Area name="concept" label="Thumbnail concept" v={th.concept} rows={3} /><Text name="text" label="Thumbnail text" v={th.text} />
          <Sel name="refImageId" label="Thumbnail reference image" v={th.refImageId} options={imgOpts} /><Sel name="foodImageId" label="Food beauty image" v={th.foodImageId} options={imgOpts} />
          <Sel name="babyImageId" label="Baby reaction image" v={th.babyImageId} options={imgOpts} /><Area name="notes" label="Notes" v={th.notes} rows={2} />
          <div className="flex flex-wrap gap-2 sm:col-span-2"><SubmitBtn>SAVE THUMBNAIL PLAN</SubmitBtn><CopyButton text={thumbPrompt} label="COPY THUMBNAIL IDEAS PROMPT" /></div></DirtyForm>
      </Section>

      <Section title={`Publishing checklist (${done}/${checklist.length})`}>
        {groups.map(g => (
          <div key={g} className="mb-3"><h3 className="mb-1">{g}</h3>
            {checklist.filter(c => c.group === g).map(c => (
              <div key={c.id} className="flex items-center gap-2 py-0.5">
                <form action={toggleChecklist}><input type="hidden" name="id" value={c.id} /><button className={`flex items-center gap-2 text-sm ${c.done ? 'text-neutral-400 line-through' : ''}`} aria-pressed={c.done}><span className={`inline-flex h-5 w-5 items-center justify-center rounded border ${c.done ? 'border-green-600 bg-green-600 text-white' : 'border-neutral-400'}`}>{c.done ? '✓' : ''}</span>{c.label}</button></form>
                {c.custom && <form action={deleteChecklist}><input type="hidden" name="id" value={c.id} /><button className="text-xs text-red-700 underline">remove</button></form>}
              </div>))}
          </div>))}
        <form action={addChecklist} className="mt-3 flex flex-wrap gap-2"><input type="hidden" name="projectId" value={p.id} /><input name="label" className="input max-w-sm" placeholder="Add custom checklist item…" aria-label="Custom checklist item" /><button className="btn">Add</button></form>
      </Section>
    </div>
  );
}
void Check;
