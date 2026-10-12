import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { buildChecklist, getProjectBySlug, imageInclude, refPool, relevantCorrections, suggestPrevious } from '@/lib/queries';
import { projectFolder } from '@/lib/files';
import { listRecentDownloads } from '@/lib/downloads';
import { Area, BigImage, Check, Chip, Field, GoldBadge, Section, Sel, Text, Warn, fileUrl } from '@/components/ui';
import { ConfirmForm, CopyButton, DirtyForm, SubmitBtn } from '@/components/client';
import { AddResultButton, AddResultDialog, HoldApprove, PromptEditor, RevealButton } from '@/components/image-workspace';
import { ReviewPanel } from '@/components/review-panel';
import { pickReferencesForMe, makeFixPrompt, approveAttempt, attachRef, deleteImage, detachRef, moveRef, redoAttempt, rejectAttempt, restorePrompt, saveChecklist, saveImage, setImageStatus, updateRef, usePreviousApproved } from '@/lib/actions/image';
import { CORRECTION_CATEGORIES, CROP_GUIDANCE, CROP_LEVELS, IMAGE_REF_ROLES, IMAGE_STATUSES, PRIORITIES, PROMPT_STATUSES, REVIEW_CHECKS, SEVERITIES, SHOT_TYPES, WAITING_REASONS } from '@/lib/constants';
import { fmtDate, imageCode, lines, parseJson, sceneCode } from '@/lib/util';
import { imagePromptWarnings } from '@/lib/prompt-quality';
import { expectedFilename, nextVersion, withFilename } from '@/lib/naming';

export default async function ImagePage({ params, searchParams }: { params: { slug: string; imageId: string }; searchParams: { attempt?: string; fix?: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const img = await db.plannedImage.findFirst({ where: { id: params.imageId, projectId: p.id }, include: imageInclude });
  if (!img) notFound();
  const [pool, prev, corrs, versions, siblings, ingredients, others, masters, dependents, downloads, folder] = await Promise.all([
    refPool(p, img.id), suggestPrevious(p.id, img.seq), relevantCorrections(img, p.babyChefId),
    db.promptVersion.findMany({ where: { ownerId: img.id }, orderBy: [{ type: 'asc' }, { version: 'desc' }] }),
    db.plannedImage.findMany({ where: { projectId: p.id }, orderBy: [{ scene: { pos: 'asc' } }, { pos: 'asc' }, { seq: 'asc' }], select: { id: true, seq: true, title: true, status: true, attemptCount: true, scene: { select: { order: true } } } }),
    db.ingredient.findMany({ where: { projectId: p.id } }),
    db.plannedImage.findMany({ where: { projectId: p.id, id: { not: params.imageId } }, orderBy: [{ scene: { pos: 'asc' } }, { pos: 'asc' }, { seq: 'asc' }], select: { id: true, seq: true, title: true } }),
    p.babyChefId ? db.reference.findMany({ where: { babyChefId: p.babyChefId, kind: 'MASTER', deletedAt: null, active: true }, include: { asset: true }, orderBy: [{ isGold: 'desc' }] }) : [],
    db.plannedImage.findMany({ where: { dependsOnId: params.imageId }, select: { seq: true }, orderBy: [{ scene: { pos: 'asc' } }, { pos: 'asc' }, { seq: 'asc' }] }),
    listRecentDownloads(),
    projectFolder(p.id),
  ]);
  // "linked in N images" for every attached reference (one stored file, many links)
  const refIds = img.refs.map(r => r.referenceId).filter(Boolean) as string[];
  const srcIds = img.refs.map(r => r.sourceImageId).filter(Boolean) as string[];
  const [refLinks, srcLinks] = await Promise.all([
    db.imageRef.groupBy({ by: ['referenceId'], where: { referenceId: { in: refIds } }, _count: true }),
    db.imageRef.groupBy({ by: ['sourceImageId'], where: { sourceImageId: { in: srcIds } }, _count: true }),
  ]);
  const linkedIn = (r: (typeof img.refs)[number]) => r.referenceId ? refLinks.find(x => x.referenceId === r.referenceId)?._count ?? 1 : srcLinks.find(x => x.sourceImageId === r.sourceImageId)?._count ?? 1;

  const code = imageCode(img.seq);
  const sc = sceneCode(img.scene.order);
  const checklist = buildChecklist(img);
  const idx = siblings.findIndex(s => s.id === img.id);
  const pictureNo = idx + 1;
  const sceneNo = 1 + (await db.scene.findMany({ where: { projectId: p.id }, orderBy: [{ pos: 'asc' }, { order: 'asc' }], select: { id: true } })).findIndex(x => x.id === img.sceneId);
  const attached = new Set(img.refs.map(r => r.sourceImageId).filter(Boolean));
  const prevSuggest = prev && !attached.has(prev.id) ? prev : null;
  const blocked = img.dependsOn && img.dependsOn.status !== 'APPROVED';
  const pkgAttached = checklist.filter(c => c.packageCritical);
  const pkgMissing = ingredients.filter(i => i.importance === 'PACKAGE_CRITICAL' && (img.ingredients || '').toLowerCase().includes(i.name.toLowerCase()) && !pkgAttached.some(c => c.label.startsWith(i.name)));
  const slugBase = `${p.slug}_${sc}_${code}`;
  const selected = img.attempts.find(a => a.id === searchParams.attempt) ?? img.attempts.find(a => a.id === img.approvedAttemptId) ?? img.attempts[img.attempts.length - 1] ?? null;
  const compareFrame = img.refs.find(r => r.role === 'PREVIOUS APPROVED FRAME')?.sourceImage;
  const compareFrameAsset = compareFrame?.approvedAttempt?.assetId ?? prev?.approvedAttempt?.assetId;
  const compareCode = compareFrame ? imageCode(compareFrame.seq) : prev ? imageCode(prev.seq) : null;
  const compareMaster = img.refs.find(r => r.role === 'MASTER BABY')?.reference?.assetId ?? masters.find(m => m.category.includes('Face'))?.assetId ?? masters[0]?.assetId;
  const warnings = imagePromptWarnings(img);
  const fullV = versions.find(v => v.type === 'FULL' && v.active)?.version ?? versions.find(v => v.type === 'FULL')?.version ?? 0;
  const contV = versions.find(v => v.type === 'CONTINUATION' && v.active)?.version ?? versions.find(v => v.type === 'CONTINUATION')?.version ?? 0;
  const attemptLabel = (s: string) => s === 'REDO' ? 'Needs fixing' : s === 'REVIEW' ? 'Check this' : s === 'APPROVED' ? 'Looks good' : s === 'REJECTED' ? "Don't use" : 'Replaced';
  const attemptColor = (s: string) => s === 'REDO' ? 'text-[#A8513F]' : s === 'REVIEW' ? 'text-[#33507A]' : s === 'APPROVED' ? 'text-[#3B6448]' : 'text-ink-muted';
  const imgOpts = siblings.map(s => ({ id: s.id, code: imageCode(s.seq), title: s.title, scene: sceneCode(s.scene.order), slug: p.slug, next: s.attemptCount + 1, seq: s.seq, sceneOrder: s.scene.order }));
  const fixMode = searchParams.fix === '1';
  const foundState = !fixMode && !!selected && selected.status === 'REVIEW' && img.status !== 'APPROVED';
  const goodState = !fixMode && img.status === 'APPROVED' && !!img.approvedAttemptId;
  const nextPic = siblings[idx + 1] ?? null;
  const ago = (d: Date) => { const m = Math.round((Date.now() - d.getTime()) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} hr ago` : fmtDate(d); };
  const approveConfirm = img.approvedAttemptId && selected && selected.id !== img.approvedAttemptId ? `${code} already has an approved result (attempt ${img.attempts.find(x => x.id === img.approvedAttemptId)?.number}). Replace it with attempt ${selected.number}? The old one stays in history.` : undefined;
  const base = `/projects/${p.slug}/images`;
  const nextV = nextVersion(img.attempts.map(a => a.number));
  const expected = expectedFilename({ slug: p.slug, sceneOrder: img.scene.order, seq: img.seq, title: img.title, version: nextV });
  const fullCopy = withFilename(img.fullPrompt, expected), contCopy = withFilename(img.contPrompt, expected);
  const rawChecklist = parseJson<unknown>(selected?.checklist, {});
  const reviewState: Record<string, 'pass' | 'unsure' | 'fail'> = Array.isArray(rawChecklist) ? Object.fromEntries((rawChecklist as string[]).map(k => [k, 'pass' as const])) : (rawChecklist as Record<string, 'pass' | 'unsure' | 'fail'>);

  return (
    <div className="space-y-5 pb-16 md:pb-0">
      <AddResultDialog currentId={img.id} images={imgOpts} downloads={downloads} folderLabel={folder} />

      {/* breadcrumb + previous / next picture */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
        <Link href={`/projects/${p.slug}/story`} className="text-ink-secondary hover:text-ink">← Scenes & Pictures · Scene {sceneNo} · {img.scene.title}</Link>
        <div className="flex items-center gap-2">
          {idx > 0 && <Link className="btn btn-sm" href={`${base}/${siblings[idx - 1].id}`}>‹ Picture {pictureNo - 1}</Link>}
          {idx < siblings.length - 1 && <Link className="btn btn-sm" href={`${base}/${siblings[idx + 1].id}`}>Picture {pictureNo + 1} ›</Link>}
        </div>
      </div>

      {warnings.length > 0 && img.status !== 'READY' && img.status !== 'APPROVED' && (
        <details className="rounded-md border border-[#E7D3A0] bg-[#F8EFD9] px-3 py-2 text-[13px] text-[#8A6216]"><summary className="cursor-pointer font-semibold">Prompt-quality check: {warnings.length} thing(s) missing (warning only)</summary><ul className="mt-1 list-disc pl-5">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></details>
      )}
      {blocked && <Warn>Waiting for {imageCode(img.dependsOn!.seq)} — it is not approved yet. (You can still proceed.)</Warn>}
      {img.status === 'WAITING' && <div className="rounded-md border border-[#E7D3A0] bg-[#F8EFD9] px-3 py-2 text-[13px] text-[#8A6216]"><b>WAITING</b> since {fmtDate(img.waitingAt)} — {img.waitingReason || 'no reason'}{img.waitingNote ? `: ${img.waitingNote}` : ''}</div>}
      {pkgAttached.length > 0 && <div className="rounded-md border border-gold-border bg-gold-bg px-3 py-2 text-[13px] text-gold-text"><b>PACKAGE CRITICAL</b> — {pkgAttached.map(c => c.label).join('; ')}. Add this label reference to ChatGPT.</div>}
      {pkgMissing.map(i => <div key={i.id} className="rounded-md border border-gold-border bg-gold-bg px-3 py-2 text-[13px] text-gold-text"><b>PACKAGE CRITICAL:</b> {i.name}{i.brand ? ` (${i.brand})` : ''} appears in this image but no brand reference is attached.</div>)}

      {/* title */}
      <div>
        <div className="text-[14px] text-ink-secondary" title={`{code} · {sc}`}>Picture {pictureNo}</div>
        <div className="mt-1 flex flex-wrap items-center gap-3"><h1 className="break-words text-[32px] md:text-[40px]">{img.title}</h1><Chip tone={img.status}>{img.status}</Chip></div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* LEFT — the picture */}
        <div className="min-w-0 space-y-3.5">
          <div className="order-3 flex flex-wrap items-center justify-between gap-2 lg:order-none">
            <div className="min-w-0 truncate font-mono text-[12px] text-ink-secondary" title={selected?.asset.relPath}>{selected ? selected.asset.relPath.split('/').slice(-2).join(' / ') : `${folder} / 02 Images`}</div>
            <div className="flex items-center gap-3 text-[12px]">
              {compareCode && selected && <a href="#compare" className="font-medium text-blue-deep underline">Compare with {compareCode}</a>}
              {selected && <RevealButton assetId={selected.assetId} className="text-[12px] font-medium text-blue-deep underline" />}
            </div>
          </div>

          <div className="order-3 lg:order-none">{selected ? (
            <BigImage id={selected.assetId} alt={`${code} attempt ${selected.number}`} imgClass="mx-auto max-h-[min(46vh,420px)] w-full object-contain" wrapClass="bg-[#F1EFF1]" w={1200} />
          ) : (
            <div className="flex aspect-video max-h-[270px] w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-pink-mid bg-pink-tint/50 text-center">
              <div className="text-[15px] font-semibold">No result yet</div>
              <p className="text-[13px] text-ink-secondary">Drop a generated image anywhere on this page, or</p>
              <AddResultButton label="Add finished picture" className="btn btn-primary" />
            </div>
          )}</div>

          {img.attempts.length > 0 && (
            <div className="order-4 flex flex-wrap items-center gap-2 lg:order-none" aria-label="Attempts">
              {img.attempts.map(a => (
                <Link key={a.id} href={`${base}/${img.id}?attempt=${a.id}`} scroll={false} aria-current={selected?.id === a.id}
                  className={`flex items-center gap-2 rounded-md border bg-purple-tint p-1.5 pr-3 transition hover:border-purple-deep ${selected?.id === a.id ? 'border-purple-deep' : 'border-purple-mid'}`}>
                  <img src={fileUrl(a.assetId, 120)} alt="" className="h-[26px] w-[44px] rounded-sm object-cover" />
                  <span className="font-mono text-[12px]">v{a.number}</span>
                  <span className={`text-[12px] ${attemptColor(a.status)}`}>{attemptLabel(a.status)}{a.status === 'REDO' && a.wrong ? ` · ${a.wrong.slice(0, 28)}${a.wrong.length > 28 ? '…' : ''}` : ''}</span>
                </Link>
              ))}
              <AddResultButton label="+ Add finished picture" className="btn btn-sm" />
            </div>
          )}

          <div className="rounded-[18px] border border-line bg-white p-4 text-[13px]">
          <div className="rounded-md border border-pink-mid bg-surface p-3 text-[13px]">
            <div className="eyebrow mb-1.5 text-pink-deep">Food state</div>
            <div><span className="text-ink-secondary">Before</span> — {img.scene.foodBefore || '—'}</div>
            <div className="mt-1"><span className="text-ink-secondary">After</span> — {img.ingredientState || img.scene.foodAfter || '—'}</div>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
            <dt className="text-ink-secondary">Shot</dt><dd>{img.shotType}</dd>
            <dt className="text-ink-secondary">Aspect</dt><dd>{img.aspectRatio || p.aspectRatio}</dd>
            <dt className="text-ink-secondary">Vertical crop</dt><dd>{img.cropImportance}</dd>
            <dt className="text-ink-secondary">Attempts</dt><dd className="font-mono">{img.attemptCount}</dd>
            <dt className="text-ink-secondary">Depends on</dt><dd>{img.dependsOn ? <span><span className="font-mono">{imageCode(img.dependsOn.seq)}</span> · <span className={img.dependsOn.status === 'APPROVED' ? 'text-[#3B6448]' : 'text-[#8A6216]'}>{img.dependsOn.status === 'APPROVED' ? 'approved' : 'not approved'}</span></span> : '—'}</dd>
            <dt className="text-ink-secondary">Unblocks</dt><dd className="font-mono">{dependents.length ? dependents.map(d => imageCode(d.seq)).join(', ') : '—'}</dd>
          </dl>


          </div>
        </div>

        {/* RIGHT — one state at a time: Make → Found → Fix it → Looks good */}
        <div className="min-w-0 space-y-4">
          {fixMode && selected ? (
            <form action={makeFixPrompt} className="rounded-[16px] border border-line bg-white p-6" style={{ boxShadow: '0 14px 34px -28px rgba(40,36,60,.4)' }}>
              <input type="hidden" name="attemptId" value={selected.id} />
              <h2 className="text-[28px]">What needs fixing?</h2>
              <label className="mt-5 block"><span className="mb-1.5 block text-[14px] font-semibold">What’s wrong?</span><textarea name="wrong" rows={2} required className="input" placeholder="The pepper looks like a big red bell pepper." /></label>
              <label className="mt-4 block"><span className="mb-1.5 block text-[14px] font-semibold">What should it look like instead?</span><textarea name="change" rows={2} className="input" placeholder="Small, wrinkled, lantern-shaped, orange-red." /></label>
              <label className="mt-4 block"><span className="mb-1.5 block text-[14px] font-semibold">What should stay exactly the same? <span className="font-normal text-ink-secondary">optional</span></span><textarea name="keep" rows={2} className="input" placeholder="Baby’s hand, the board, the light." /></label>
              <div className="mt-5 flex flex-wrap items-center gap-4"><SubmitBtn className="btn-copy min-h-[48px] px-7" pendingText="Saving…">Make fix prompt</SubmitBtn><Link href={`${base}/${img.id}`} className="text-[14px] text-ink-secondary hover:text-ink">Cancel</Link></div>
              <p className="mt-3 text-[12.5px] text-ink-secondary">Saves as a new version. The old picture stays in the folder.</p>
            </form>
          ) : foundState && selected ? (
            <section className="rounded-[16px] border p-6" style={{ background: 'linear-gradient(135deg,#FDECF1,#F9EEF7)', borderColor: '#F0CDDA' }} aria-label="Picture found">
              <div className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#46704F]">✓ Picture found · {ago(selected.createdAt)}</div>
              <div className="mt-1.5 break-all font-mono text-[12.5px] text-ink-secondary">{selected.asset.relPath.split('/').pop()}</div>
              <h2 className="mt-4 text-[30px]">Does this look right?</h2>
              <form id="approve-form" action={approveAttempt} className="mt-4 flex"><input type="hidden" name="attemptId" value={selected.id} /><HoldApprove formId="approve-form" confirm={approveConfirm} /></form>
              <Link href={`${base}/${img.id}?attempt=${selected.id}&fix=1`} className="btn mt-3 min-h-[48px] w-full">Fix it</Link>
              <form action={rejectAttempt} className="mt-3 text-center"><input type="hidden" name="attemptId" value={selected.id} /><button className="text-[14px] font-medium text-[#A5473A]">Don’t use this</button></form>
            </section>
          ) : goodState && selected ? (
            <>
              <section className="rounded-[16px] border p-6" style={{ background: 'linear-gradient(135deg,#EAF4EC,#F1F7E8)', borderColor: '#CFE3D3' }} aria-label="Looks good">
                <div className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#46704F]">✓ Looks good</div>
                <div className="mt-2 break-all font-mono text-[12.5px]">{selected.asset.relPath.split('/').pop()}</div>
                <div className="mt-3"><RevealButton assetId={selected.assetId} label="Show in folder" className="btn btn-sm" /></div>
              </section>
              {nextPic && <section className="rounded-[16px] border p-6" style={{ background: 'linear-gradient(135deg,#FDECF1,#F9EEF7)', borderColor: '#F0CDDA' }}><div className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#9A4A64]">WHAT TO DO NEXT</div><div className="mt-1 text-[13px] text-ink-secondary">Picture {pictureNo + 1}</div><h2 className="text-[28px]">{nextPic.title}</h2><Link href={`${base}/${nextPic.id}`} className="btn btn-accent mt-3 min-h-[48px] px-6">Continue</Link></section>}
              <div className="text-center text-[13.5px]"><Link href={`${base}/${img.id}?attempt=${selected.id}&fix=1`} className="font-semibold text-blue-deep">Replace or fix this picture</Link></div>
            </>
          ) : (
            <>
          <section className="rounded-[18px] border p-4" style={{ background: 'linear-gradient(135deg,#E9F1FC,#EEEDFC)', borderColor: '#C9D9EF' }}>
            <div className="mb-3 flex items-center justify-between"><span className="eyebrow text-blue-deep">CHATGPT WILL USE</span><form action={pickReferencesForMe}><input type="hidden" name="imageId" value={img.id} /><button className="text-[12.5px] font-semibold text-blue-deep hover:underline">Pick the obvious ones for me</button></form></div>
          {prevSuggest && (
            <form action={usePreviousApproved} className="rounded-md border border-sage-mid bg-surface p-2.5"><input type="hidden" name="imageId" value={img.id} /><input type="hidden" name="sourceId" value={prevSuggest.id} />
              <div className="mb-2 flex items-center gap-2.5 text-[12px]"><img src={fileUrl(prevSuggest.approvedAttempt!.assetId, 160)} alt="" className="h-[44px] w-[60px] rounded-sm border border-line object-cover" /><span>Suggested previous: <b className="font-mono">{imageCode(prevSuggest.seq)}</b> {prevSuggest.title}</span></div>
              <SubmitBtn className="btn-approve btn-sm w-full" pendingText="…">USE PREVIOUS PICTURE</SubmitBtn></form>
          )}
          {!prevSuggest && !prev && <p className="text-[12px] text-ink-secondary">No earlier approved image yet — approve one to use it as the Previous Picture.</p>}

            <div className="flex flex-wrap gap-2">
              {img.refs.map((r, i) => { const c = checklist[i]; return (
                <div key={r.id} className={`flex items-center gap-2 rounded-xl border bg-white p-1.5 pr-3 ${c.required ? 'border-line' : 'border-dashed border-line-strong'}`}>
                  <div className="h-[34px] w-[34px] shrink-0 overflow-hidden rounded-lg bg-sunken">{c.assetId ? <BigImage id={c.assetId} alt={c.label} imgClass="h-[34px] w-[34px] object-cover" w={120} /> : null}</div>
                  <div className="min-w-0 text-[13px] leading-tight"><span className="text-[#46704F]">{c.required ? '✓ ' : ''}</span>{c.label}{c.packageCritical && <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gold-text">PACKAGE CRITICAL</div>}</div>
                </div>); })}
              {checklist.length === 0 && <p className="text-[13px] text-ink-secondary">Nothing attached yet — choose the Baby Chef, the kitchen and any product photo.</p>}
            </div>
            {checklist.length > 0 && <p className="mt-2 text-[12.5px] text-blue-deep">Picked automatically from the Baby Chef, kitchen and the picture before. Attach them to ChatGPT in this order.</p>}
          <details className="mt-3 rounded-xl border border-line bg-white/80 p-3">
            <summary className="cursor-pointer text-[13px] font-semibold text-blue-deep">Change</summary>
            <div className="mt-3 space-y-3">
              {img.refs.map((r, i) => (
                <div key={r.id} className="rounded-md border border-line bg-surface p-2 text-[12px]">
                  <div className="font-medium">{checklist[i].label}</div><div className="text-[11px] text-ink-secondary">linked in {linkedIn(r)} image{linkedIn(r) === 1 ? '' : 's'} · one stored file, never copied</div>
                  <form action={updateRef} className="mt-1 space-y-1"><input type="hidden" name="id" value={r.id} /><Sel name="role" label="Role" v={r.role} options={IMAGE_REF_ROLES} /><Text name="notes" label="Notes" v={r.notes} /><Check name="required" label="Required" v={r.required} /><SubmitBtn className="btn-sm">Save</SubmitBtn></form>
                  <div className="mt-1 flex gap-1">
                    <form action={moveRef}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="dir" value="up" /><button className="btn btn-sm" aria-label="Move up">↑</button></form>
                    <form action={moveRef}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="dir" value="down" /><button className="btn btn-sm" aria-label="Move down">↓</button></form>
                    <form action={detachRef}><input type="hidden" name="id" value={r.id} /><button className="btn btn-sm btn-danger">Unlink</button></form>
                  </div>
                </div>
              ))}
              <form action={attachRef} className="space-y-2 border-t border-sage-mid pt-3"><input type="hidden" name="imageId" value={img.id} />
                <Field label="Attach reference"><select name="target" className="input" required defaultValue=""><option value="" disabled>— choose —</option>{pool.groups.map(g => <optgroup key={g.label} label={g.label}>{g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>)}</select></Field>
                <Sel name="role" label="Role" options={IMAGE_REF_ROLES} /><Text name="notes" label="Notes" /><Check name="required" label="Required" v />
                <SubmitBtn className="btn-sm btn-primary" pendingText="…">Attach</SubmitBtn></form>
              <p className="text-[11px] text-ink-secondary">Masters establish identity/kitchen. The Previous Picture establishes current food, cookware and composition. A reference is one stored file linked to many images — never copied.</p>
            </div>
          </details>

          <RevealButton projectFolder={`${folder}/01 References`} className="btn btn-sm mt-3" />

          </section>

          <div className="space-y-3.5">
            <PromptEditor filename={expected} imageId={img.id} full={img.fullPrompt} cont={img.contPrompt} fullVersion={fullV} contVersion={contV} updatedAt={img.updatedAt.getTime()} />
          </div>

            <div className="rounded-[18px] border border-line bg-white p-4" aria-label="Save this picture as">
              <div className="eyebrow text-purple-deep">SAVE THIS PICTURE AS</div>
              <div className="mt-2 flex flex-wrap items-center gap-3"><code className="min-w-0 flex-1 break-all font-mono text-[14px] font-medium leading-snug" data-testid="expected-filename">{expected}</code><CopyButton text={expected} label="COPY FILENAME" variant="secondary" className="min-w-[160px]" /></div>
              <p className="mt-2 text-[12px] text-ink-secondary">Save the generated image into <span className="font-mono">{folder}/02 Images</span> with exactly this name — Baby Chef Studio detects it automatically and adds it to {code} for review. COPY PROMPT adds a FILE ORGANIZATION section with this filename.</p>
              <div className="mt-2"><RevealButton projectFolder={`${folder}/02 Images`} label="Show folder in Finder" /></div>
            </div>


          <section className="rounded-[18px] border border-line bg-white p-4"><div className="eyebrow mb-3">ACTIONS</div><a href="https://chatgpt.com/" target="_blank" rel="noreferrer" className="btn mb-2.5 w-full">Open ChatGPT ↗</a>
          <div className="flex flex-col gap-2.5">
            <CopyButton text={fullCopy} label="COPY IMAGE PROMPT" className="min-h-[40px] w-full" />
            <CopyButton text={contCopy} label="COPY NEXT IMAGE PROMPT" variant="secondary" className="w-full" />
            <div className="flex gap-2">
              <AddResultButton label="Add finished picture" className="btn flex-1" />
              <details className="relative flex-1">
                <summary className="btn btn-ghost w-full cursor-pointer list-none">Waiting on something</summary>
                <form action={setImageStatus} className="absolute bottom-full left-0 z-20 mb-2 w-[260px] space-y-2 rounded-lg border border-line bg-surface p-3 shadow-md"><input type="hidden" name="id" value={img.id} /><input type="hidden" name="status" value="WAITING" />
                  <Sel name="reason" label="Reason" options={WAITING_REASONS} /><Text name="note" label="Optional note" /><SubmitBtn className="btn-sm btn-primary" pendingText="…">MARK WAITING</SubmitBtn></form>
              </details>
            </div>
            <div className="flex flex-wrap gap-2 text-[12px]">
              {img.status !== 'READY' && <form action={setImageStatus}><input type="hidden" name="id" value={img.id} /><input type="hidden" name="status" value="READY" /><SubmitBtn className="btn-sm btn-accent" pendingText="…">MARK READY</SubmitBtn></form>}
              {img.status === 'READY' && <form action={setImageStatus}><input type="hidden" name="id" value={img.id} /><input type="hidden" name="status" value="GENERATING" /><SubmitBtn className="btn-sm" pendingText="…">MARK GENERATING</SubmitBtn></form>}
              <form action={setImageStatus} className="flex gap-1"><input type="hidden" name="id" value={img.id} /><select name="status" defaultValue={img.status} className="input !min-h-[32px] !w-auto !py-1 text-[12px]" aria-label="Set status">{IMAGE_STATUSES.map(s => <option key={s}>{s}</option>)}</select><SubmitBtn className="btn-sm" pendingText="…">Set</SubmitBtn></form>
            </div>
          </div>
          </section>

            </>
          )}
          <details className="rounded-[18px] border border-line bg-white p-4"><summary className="cursor-pointer text-[14px] font-semibold text-ink-secondary">More details</summary><div className="mt-3 space-y-3.5">
          <div className="order-5 rounded-lg border border-blue-mid bg-blue-tint/60 p-3 lg:order-none">
            <div className="eyebrow mb-2 text-blue-deep">Production Brain — have ChatGPT / Claude WRITE the prompt</div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/projects/${p.slug}/builder?type=image-full&image=${img.id}`} className="btn btn-sm btn-copy-secondary">PREPARE FULL IMAGE PROMPT</Link>
              <Link href={`/projects/${p.slug}/builder?type=image-cont&image=${img.id}`} className="btn btn-sm btn-copy-secondary">MAKE NEXT IMAGE PROMPT</Link>
              {img.attempts.length > 0 && <Link href={`/projects/${p.slug}/builder?type=image-redo&image=${img.id}${selected ? `&attempt=${selected.id}` : ''}`} className="btn btn-sm btn-copy-secondary">PREPARE REDO PROMPT</Link>}
              <Link href={`/projects/${p.slug}/prompts?cat=IMAGE GENERATION&image=${img.id}`} className="btn btn-sm btn-ghost">Assemble from fields</Link>
            </div>
          </div>

          </div></details>
        </div>
      </div>

      {/* sticky copy bar for phones */}
      <div className="fixed inset-x-0 bottom-14 z-40 flex gap-2 border-t border-line bg-surface p-2 md:hidden" style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom) * 0)' }}>
        <CopyButton text={fullCopy} label="Copy image prompt" className="flex-1" /><AddResultButton label="Add finished picture" className="btn flex-1" />
      </div>

      {/* REVIEW / REDO */}
      {selected && (selected.status === 'REVIEW' || selected.status === 'APPROVED') && (
        <ReviewPanel
          attemptId={selected.id} imageId={img.id} code={code} number={selected.number} status={selected.status} isApproved={selected.id === img.approvedAttemptId}
          generatedAsset={selected.assetId} prevAsset={compareFrameAsset ?? null} prevCode={compareCode} masterAsset={compareMaster ?? null}
          items={REVIEW_CHECKS} initial={reviewState} unblocks={dependents.map(d => imageCode(d.seq))}
          builderRedoHref={`/projects/${p.slug}/builder?type=image-redo&image=${img.id}&attempt=${selected.id}`} replaceConfirm={approveConfirm}
          mustBeVisible={lines(img.mustBeVisible)} mustNotChange={lines(img.mustNotChange)} mustNotAppear={lines(img.mustNotAppear)}
        />
      )}

      {/* ATTEMPT HISTORY */}
      <section id="results" className="space-y-3">
        <h2>Attempt history</h2>
        {img.attempts.length === 0 && <p className="text-[13px] text-ink-secondary">No results yet.</p>}
        {[...img.attempts].reverse().map(a => {
          const approved = a.id === img.approvedAttemptId;
          return (
            <div key={a.id} className={`card flex flex-col gap-3 sm:flex-row ${approved ? 'border-sage-deep' : ''}`}>
              <div className="w-full shrink-0 sm:w-56"><BigImage id={a.assetId} alt={`${code} attempt ${a.number}`} /></div>
              <div className="min-w-0 flex-1 space-y-1 text-[13px]">
                <div className="flex flex-wrap items-center gap-2"><b>Version {a.number}</b><Chip>{a.status}</Chip>{approved && <Chip tone="APPROVED">THE ONE TO USE</Chip>}<span className="text-xs text-ink-secondary">{a.sourceTool} · {a.promptType}{a.promptVersion ? ` v${a.promptVersion}` : ''} · {fmtDate(a.createdAt)}</span></div>
                <div className="break-all font-mono text-[11px] text-ink-secondary">{a.asset.relPath.split('/').slice(-2).join(' / ')}{approved && <> → approved as <b>{slugBase}_approved-v{a.number}{a.asset.displayName.slice(a.asset.displayName.lastIndexOf('.'))}</b></>}</div>
                <div className="text-[11px] text-ink-muted">{a.asset.orientation}{a.asset.width ? ` · ${a.asset.width}×${a.asset.height}` : ''}</div>
                {a.wrong && <p><b className="text-[#A8513F]">Wrong:</b> {a.wrong}</p>}
                {a.change && <p><b className="text-[#3B6448]">Correction:</b> {a.change}</p>}
                {a.keep && <p><b>Keep:</b> {a.keep}</p>}
                {a.notes && <p className="text-ink-secondary">{a.notes}</p>}
                <div className="flex flex-wrap gap-2 pt-1"><Link className="btn btn-sm btn-copy-secondary" href={`/projects/${p.slug}/builder?type=image-redo&image=${img.id}&attempt=${a.id}`}>PREPARE REDO PROMPT</Link>
                  <a className="btn btn-sm" href={`/api/files/${a.assetId}?download=1${approved ? `&name=${slugBase}_approved-v${a.number}` : ''}`}>Download</a>
                  <RevealButton assetId={a.assetId} />
                  {a.status !== 'APPROVED' && a.status !== 'REVIEW' && <form action={approveAttempt}><input type="hidden" name="attemptId" value={a.id} /><SubmitBtn className="btn-sm" pendingText="…" confirm={img.approvedAttemptId ? 'Replace the current approved result with this attempt?' : undefined}>Approve this one</SubmitBtn></form>}</div>
              </div>
            </div>
          );
        })}
      </section>

      {/* PLANNING DETAILS */}
      <DirtyForm action={saveImage} className="space-y-4"><input type="hidden" name="id" value={img.id} />
        <Section title="Planning">
          <div className="grid gap-3 sm:grid-cols-2">
            <Text name="title" label="Image title" v={img.title} /><Sel name="shotType" label="Shot type" v={img.shotType} options={SHOT_TYPES} />
            <Sel name="priority" label="Priority" v={img.priority} options={PRIORITIES} /><Sel name="promptStatus" label="Prompt status" v={img.promptStatus} options={PROMPT_STATUSES} />
            <Sel name="dependsOnId" label="Depends on (must be approved first)" v={img.dependsOnId} options={[['', '— none —'], ...others.map(o => [o.id, `${imageCode(o.seq)} ${o.title}`] as [string, string])]} />
            <Text name="aspectRatio" label="Preferred aspect ratio" v={img.aspectRatio} /><Sel name="cropImportance" label="Vertical crop importance" v={img.cropImportance} options={CROP_LEVELS} hint={img.cropImportance === 'CRITICAL' ? CROP_GUIDANCE : undefined} />
            <Text name="purpose" label="Purpose" v={img.purpose} />
            <Area name="startingComposition" label="STARTING COMPOSITION (spatial layout: bottom / middle / top / hands)" v={img.startingComposition} rows={5} className="sm:col-span-2" />
            <Area name="mustBeVisible" label="WHAT MUST BE VISIBLE (one per line)" v={img.mustBeVisible} rows={5} />
            <Area name="mustNotChange" label="WHAT MUST NOT CHANGE (one per line)" v={img.mustNotChange} rows={5} />
            <Area name="mustNotAppear" label="WHAT MUST NOT APPEAR (one per line)" v={img.mustNotAppear} rows={5} className="sm:col-span-2" />
          </div>
        </Section>
        <details className="card" open><summary className="cursor-pointer text-[15px] font-semibold">Food state & action</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Text name="ingredients" label="Ingredient(s)" v={img.ingredients} /><Text name="ingredientQty" label="Ingredient quantity" v={img.ingredientQty} />
            <Area name="ingredientState" label="Ingredient current state" v={img.ingredientState} rows={2} /><Area name="foodTexture" label="Food texture" v={img.foodTexture} rows={2} />
            <Text name="foodColor" label="Food color" v={img.foodColor} /><Text name="cookware" label="Cookware" v={img.cookware} /><Text name="utensils" label="Utensils" v={img.utensils} />
            <Area name="objectPlacement" label="Object placement" v={img.objectPlacement} rows={2} /><Area name="actionMoment" label="Action moment" v={img.actionMoment} rows={2} /><Area name="physics" label="Physics notes" v={img.physics} rows={2} />
          </div></details>
        <details className="card"><summary className="cursor-pointer text-[15px] font-semibold">Character, camera & lighting</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Text name="characterVisibility" label="Character visibility" v={img.characterVisibility} /><Text name="expression" label="Character expression" v={img.expression} />
            <Text name="bodyPosition" label="Body positioning" v={img.bodyPosition} /><Text name="handPosition" label="Hand positioning" v={img.handPosition} />
            <Text name="lighting" label="Lighting" v={img.lighting} /><Text name="cameraAngle" label="Camera angle" v={img.cameraAngle} /><Text name="cameraDistance" label="Camera distance" v={img.cameraDistance} />
            <Text name="lens" label="Lens / look" v={img.lens} /><Text name="depthOfField" label="Depth of field" v={img.depthOfField} /><Text name="focusPoint" label="Focus point" v={img.focusPoint} /><Text name="background" label="Background" v={img.background} />
            <Area name="safety" label="Safety / adult assistance" v={img.safety} rows={2} /><Area name="continuity" label="Continuity requirements" v={img.continuity} rows={2} />
            <Area name="restrictions" label="Special restrictions" v={img.restrictions} rows={2} /><Area name="notes" label="Notes" v={img.notes} rows={2} />
          </div></details>
        <SubmitBtn>SAVE IMAGE DETAILS</SubmitBtn>
      </DirtyForm>

      <Section title="Prompt history">
        {versions.length === 0 ? <p className="text-[13px] text-ink-secondary">Versions appear when you save a version, add a result, or mark the image READY.</p> : versions.map(v => (
          <details key={v.id} className="border-b border-line py-2 last:border-0"><summary className="cursor-pointer text-[13px]"><b>{v.type === 'FULL' ? 'Full' : 'Continuation'} v{v.version}</b> {v.active && <Chip tone="APPROVED">ACTIVE</Chip>} · {fmtDate(v.createdAt)} · {v.reason}</summary>
            <pre className="mono mt-2 whitespace-pre-wrap rounded-md bg-sunken p-2">{v.text}</pre>
            <div className="mt-1 flex gap-2"><CopyButton text={v.text} label="COPY" className="btn-sm" />{!v.active && <form action={restorePrompt}><input type="hidden" name="id" value={v.id} /><SubmitBtn className="btn-sm" pendingText="…">Restore as active</SubmitBtn></form>}</div></details>
        ))}
      </Section>
      <Section title="Relevant corrections">
        {corrs.length === 0 ? <p className="text-[13px] text-ink-secondary">None.</p> : <ul className="space-y-2 text-[13px]">{corrs.slice(0, 8).map(c => <li key={c.id}><b>{c.title}</b>{c.correct && <div className="text-ink-secondary">→ {c.correct}</div>}</li>)}</ul>}
      </Section>
      <ConfirmForm action={deleteImage} message={`Delete ${code} and all its attempts/history? This cannot be undone.`}><input type="hidden" name="id" value={img.id} /><button className="btn btn-sm btn-danger">Delete planned image…</button></ConfirmForm>
    </div>
  );
}
