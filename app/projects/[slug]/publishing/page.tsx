import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { ensureChecklist } from '@/lib/settings';
import { buildVars, render } from '@/lib/template-engine';
import { contextBlock } from '@/lib/publishing';
import { Area, Check, Chip, Empty, Fold, Sel, Text } from '@/components/ui';
import { ConfirmForm, CopyButton, DirtyForm, SubmitBtn } from '@/components/client';
import { addChecklist, createPublishingAssets, deleteChecklist, deletePublishingAsset, preparePublishingPrompt, quickResult, savePubContext, savePublishingAsset, saveThumbnail, setPublishingStatus, toggleChecklist } from '@/lib/actions/prompts';
import { PUB_CONTEXT_FIELDS, PUB_STATUSES } from '@/lib/constants';
import { fmtDate, imageCode, parseJson } from '@/lib/util';

export default async function Publishing({ params, searchParams }: { params: { slug: string }; searchParams: { pl?: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  await ensureChecklist(p.id);
  const [assets, docs, checklist, images, thumbTpl, settings] = await Promise.all([
    db.publishingAsset.findMany({ where: { projectId: p.id }, orderBy: { code: 'asc' } }),
    db.projectDoc.findMany({ where: { projectId: p.id, key: { in: ['pubctx', 'thumbnail'] } } }),
    db.checklistItem.findMany({ where: { projectId: p.id }, orderBy: { order: 'asc' } }),
    db.plannedImage.findMany({ where: { projectId: p.id, approvedAttemptId: { not: null } }, orderBy: [{ scene: { pos: 'asc' } }, { pos: 'asc' }, { seq: 'asc' }] }),
    db.promptTemplate.findUnique({ where: { code: 'TPL-YT-THUMB' } }),
    import('@/lib/settings').then(m => m.getSettings()),
  ]);
  const ctx = parseJson<any>(docs.find(d => d.key === 'pubctx')?.data, { include: PUB_CONTEXT_FIELDS });
  const th = parseJson<Record<string, string>>(docs.find(d => d.key === 'thumbnail')?.data, {});
  const inc: string[] = ctx.include ?? PUB_CONTEXT_FIELDS;
  const preview = await contextBlock(p.id);
  const vars = await buildVars(p.id);
  const thumbPrompt = thumbTpl ? render(thumbTpl.text, vars).out : '';
  const pubVersions = await db.promptVersion.findMany({ where: { ownerId: { in: assets.map(a => a.id) }, type: 'PUBLISHING' }, orderBy: { version: 'desc' } });
  const platforms = [...new Set(assets.map(a => a.platform))];
  const pl = platforms.includes(searchParams.pl ?? '') ? searchParams.pl! : platforms[0];
  const plAssets = assets.filter(a => a.platform === pl);
  const done = checklist.filter(c => c.done).length;
  const groups = [...new Set(checklist.map(c => c.group))];
  const imgOpts: [string, string][] = [['', '— none —'], ...images.map(i => [i.id, `${imageCode(i.seq)} ${i.title}`] as [string, string])];
  return (
    <div className="space-y-5">
      <div><h1 className="text-[34px] md:text-[40px]">Post Video</h1><p className="mt-1 text-[14px] text-ink-secondary">Text is made from the recipe and scenes. Prepare it any time — the final video isn’t needed yet.</p></div>
      <div className="rounded-[14px] bg-[#F4F1FA] p-3.5 text-[13.5px] text-[#47434F]">Nothing is posted automatically. For each item: <b>PREPARE PROMPT</b> → <b>COPY</b> → paste into ChatGPT/Claude → paste the answer back → write the <b>selected final text</b>.</div>
      <Fold title="Publishing context (what gets added to every publishing prompt)">
        <DirtyForm action={savePubContext} className="space-y-3"><input type="hidden" name="projectId" value={p.id} />
          <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">{PUB_CONTEXT_FIELDS.map(f => <label key={f} className="flex items-center gap-2 text-sm"><input type="checkbox" name="include" value={f} defaultChecked={inc.includes(f)} className="h-4 w-4" />{f}</label>)}</div>
          <div className="grid gap-3 sm:grid-cols-2">{['Funny moments', 'Recipe highlights', 'Cooking techniques', 'Notes'].map(f => <Area key={f} name={`x:${f}`} label={f} v={ctx[f]} rows={2} />)}</div>
          <SubmitBtn>SAVE CONTEXT</SubmitBtn>
        </DirtyForm>
        <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">Preview context</summary><pre className="mono mt-2 whitespace-pre-wrap rounded-lg bg-sunken p-3">{preview || '(nothing selected / nothing filled in yet)'}</pre></details>
      </Fold>

      {assets.length === 0 ? (
        <Empty title="No publishing items yet." hint="Create the standard set for YouTube, Shorts, Facebook, Instagram and TikTok."><form action={createPublishingAssets}><input type="hidden" name="projectId" value={p.id} /><SubmitBtn pendingText="Creating…">CREATE STANDARD PUBLISHING ITEMS</SubmitBtn></form></Empty>
      ) : (
        <form action={createPublishingAssets}><input type="hidden" name="projectId" value={p.id} /><button className="btn btn-sm">Add any missing standard items</button></form>
      )}

      {assets.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]"><span className="mr-1 text-ink-secondary">Status flow</span>
            {['NEEDS PROMPT', 'PROMPT READY', 'GENERATED', 'REVIEW', 'SELECTED', 'PUBLISHED'].map((st, i) => <span key={st} className="flex items-center gap-1.5">{i > 0 && <span className="text-ink-muted">›</span>}<Chip>{st}</Chip></span>)}</div>
          <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
            <nav className="space-y-2" aria-label="Platforms">
              {platforms.map(name => {
                const list = assets.filter(a => a.platform === name), sel = list.filter(a => ['SELECTED', 'PUBLISHED'].includes(a.status)).length;
                return (
                  <Link key={name} href={`/projects/${p.slug}/publishing?pl=${encodeURIComponent(name)}`} className={`block rounded-lg border p-3 transition ${name === pl ? 'border-purple-mid bg-grad-purple' : 'border-line bg-surface hover:border-ink/30'}`}>
                    <div className="flex items-center justify-between"><span className="text-[12px] font-semibold uppercase tracking-[0.08em]">{name.replace(' Long Form', '')}</span><span className="font-mono text-[12px] text-ink-secondary">{sel} / {list.length}</span></div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/70"><div className="h-full rounded-full bg-btn-blue" style={{ width: `${list.length ? (sel / list.length) * 100 : 0}%` }} /></div>
                  </Link>
                );
              })}
            </nav>
            <section>
              <div className="mb-3 flex items-baseline gap-2"><h2>{pl}</h2><span className="text-[13px] text-ink-secondary">{plAssets.length} items</span></div>
              <div className="space-y-3">
                {plAssets.map(a => (
                  <div key={a.id} className="grid gap-3 rounded-lg border border-line bg-surface p-4 md:grid-cols-[170px_minmax(0,1fr)_150px]">
                    <div><div className="text-[14px] font-semibold">{a.assetType}</div><div className="mt-1.5"><Chip>{a.status}</Chip></div><div className="mt-1.5 font-mono text-[11px] text-ink-muted">{a.promptVersion ? `prompt v${a.promptVersion}` : 'no prompt yet'}{a.returned ? ' · result pasted' : ''}</div></div>
                    <div className="min-w-0 space-y-2">
                      <div className="flex items-center gap-2 rounded-md border border-blue-mid bg-blue-tint px-2.5 py-1.5 text-[12px]"><span className="rounded-xs bg-blue-light px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-blue-deep">PROMPT</span><span className="min-w-0 flex-1 truncate">{a.prompt ? a.prompt.replace(/\s+/g, ' ').slice(0, 110) : 'Not prepared yet'}</span>
                        {a.prompt ? <CopyButton text={a.prompt} label="Copy prompt" variant="secondary" className="btn-sm" /> : <form action={preparePublishingPrompt}><input type="hidden" name="id" value={a.id} /><SubmitBtn className="btn-sm btn-copy-secondary" pendingText="…">Prepare prompt</SubmitBtn></form>}</div>
                      {a.selected || a.returned ? (
                        <div className="whitespace-pre-wrap rounded-md border border-line px-3 py-2 text-[13px]">{a.selected || a.returned}</div>
                      ) : (
                        <form action={quickResult} className="space-y-1.5"><input type="hidden" name="id" value={a.id} /><textarea name="returned" rows={2} className="input text-[13px]" placeholder="Paste the AI result here…" aria-label={`Paste result for ${a.assetType}`} /><SubmitBtn className="btn-sm" pendingText="…">Save result</SubmitBtn></form>
                      )}
                    </div>
                    <div className="flex flex-row flex-wrap gap-2 md:flex-col">
                      <form action={setPublishingStatus}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="SELECTED" /><SubmitBtn className="btn-sm w-full" pendingText="…">Mark selected</SubmitBtn></form>
                      <form action={setPublishingStatus}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="PUBLISHED" /><SubmitBtn className="btn-sm btn-approve w-full" pendingText="…">Mark published</SubmitBtn></form>
                    </div>
                    <details className="md:col-span-3">
                      <summary className="cursor-pointer text-[12px] font-semibold text-ink-secondary">Full details — prompt, result history, notes, published URL</summary>
                      <div className="mt-3 space-y-3">
                        <div className="flex flex-wrap gap-2"><form action={preparePublishingPrompt}><input type="hidden" name="id" value={a.id} /><SubmitBtn className="btn-primary" pendingText="…">{a.prompt ? 'REBUILD PROMPT' : 'PREPARE PROMPT'}</SubmitBtn></form>
                          {a.prompt && <a className="btn" href={`/api/export/text?type=publishing&id=${a.id}`}>DOWNLOAD PROMPT</a>}
                          <a className="btn" href={settings.url_ChatGPT} target="_blank" rel="noopener noreferrer">OPEN CHATGPT ↗</a><a className="btn" href={settings.url_Claude} target="_blank" rel="noopener noreferrer">OPEN CLAUDE ↗</a></div>
                        <DirtyForm action={savePublishingAsset} className="space-y-3"><input type="hidden" name="id" value={a.id} />
                          <Area name="prompt" label="Prompt" v={a.prompt} rows={6} mono />
                          <Area name="returned" label="Returned text (paste from ChatGPT / Claude)" v={a.returned} rows={6} />
                          <Area name="selected" label="SELECTED FINAL TEXT" v={a.selected} rows={4} />
                          <div className="grid gap-3 sm:grid-cols-3"><Sel name="status" label="Status" v={a.status} options={PUB_STATUSES} /><Text name="publishedUrl" label="Published URL" v={a.publishedUrl} /><Text name="publishedAt" label="Published date" type="date" v={a.publishedAt ? a.publishedAt.toISOString().slice(0, 10) : ''} /></div>
                          <Text name="notes" label="Notes" v={a.notes} />
                          <div className="flex flex-wrap gap-2"><SubmitBtn>SAVE</SubmitBtn>{a.selected && <CopyButton text={a.selected} label="COPY SELECTED" />}</div>
                        </DirtyForm>
                        {pubVersions.filter(v => v.ownerId === a.id).length > 0 && (
                          <details className="rounded-md border border-line p-2"><summary className="cursor-pointer text-[12px] font-semibold">Prompt history ({pubVersions.filter(v => v.ownerId === a.id).length})</summary>
                            {pubVersions.filter(v => v.ownerId === a.id).map(v => <div key={v.id} className="mt-2 border-t border-line pt-2"><div className="text-[12px]"><b>v{v.version}</b> {v.active && <Chip tone="CURRENT">ACTIVE</Chip>} · {fmtDate(v.createdAt)} · {v.reason}</div><pre className="mono mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-sunken p-2">{v.text}</pre><CopyButton text={v.text} label="COPY" className="btn-sm mt-1" /></div>)}
                          </details>
                        )}
                        <div className="text-[11px] text-ink-muted">Updated {fmtDate(a.updatedAt)}</div>
                        <ConfirmForm action={deletePublishingAsset} message="Delete this publishing item?"><input type="hidden" name="id" value={a.id} /><button className="btn btn-sm btn-danger">Delete item</button></ConfirmForm>
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      <Fold title="YouTube thumbnail planning">
        <DirtyForm action={saveThumbnail} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="projectId" value={p.id} />
          <Area name="concept" label="Thumbnail concept" v={th.concept} rows={3} /><Text name="text" label="Thumbnail text" v={th.text} />
          <Sel name="refImageId" label="Thumbnail reference image" v={th.refImageId} options={imgOpts} /><Sel name="foodImageId" label="Food beauty image" v={th.foodImageId} options={imgOpts} />
          <Sel name="babyImageId" label="Baby reaction image" v={th.babyImageId} options={imgOpts} /><Area name="notes" label="Notes" v={th.notes} rows={2} />
          <div className="flex flex-wrap gap-2 sm:col-span-2"><SubmitBtn>SAVE THUMBNAIL PLAN</SubmitBtn><CopyButton text={thumbPrompt} label="COPY THUMBNAIL IDEAS PROMPT" /></div></DirtyForm>
      </Fold>

      <Fold title={`Publishing checklist (${done}/${checklist.length})`}>
        {groups.map(g => (
          <div key={g} className="mb-3"><h3 className="mb-1">{g}</h3>
            {checklist.filter(c => c.group === g).map(c => (
              <div key={c.id} className="flex items-center gap-2 py-0.5">
                <form action={toggleChecklist}><input type="hidden" name="id" value={c.id} /><button className={`flex items-center gap-2 text-sm ${c.done ? 'text-ink-secondary line-through' : ''}`} aria-pressed={c.done}><span className={`inline-flex h-5 w-5 items-center justify-center rounded border ${c.done ? 'border-green-600 bg-green-600 text-white' : 'border-neutral-400'}`}>{c.done ? '✓' : ''}</span>{c.label}</button></form>
                {c.custom && <form action={deleteChecklist}><input type="hidden" name="id" value={c.id} /><button className="text-xs text-[#A8513F] underline">remove</button></form>}
              </div>))}
          </div>))}
        <form action={addChecklist} className="mt-3 flex flex-wrap gap-2"><input type="hidden" name="projectId" value={p.id} /><input name="label" className="input max-w-sm" placeholder="Add custom checklist item…" aria-label="Custom checklist item" /><button className="btn">Add</button></form>
      </Fold>
    </div>
  );
}
void Check;
