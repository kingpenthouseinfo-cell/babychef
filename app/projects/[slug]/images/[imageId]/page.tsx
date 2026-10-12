import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { buildChecklist, getProjectBySlug, imageInclude, refPool, relevantCorrections, suggestPrevious } from '@/lib/queries';
import { Area, BigImage, Check, Chip, Field, Section, Sel, Text, Thumb, Warn, fileUrl, GoldBadge } from '@/components/ui';
import { ChecklistText } from '@/components/image-bits';
import { ConfirmForm, CopyButton, DirtyForm, PromptBox, SubmitBtn } from '@/components/client';
import { approveAttempt, attachRef, deleteImage, detachRef, moveRef, redoAttempt, rejectAttempt, restorePrompt, saveChecklist, saveImage, setImageStatus, updateRef, uploadResult, usePreviousApproved } from '@/lib/actions/image';
import { CORRECTION_CATEGORIES, CROP_GUIDANCE, CROP_LEVELS, IMAGE_REF_ROLES, PRIORITIES, PROMPT_STATUSES, REVIEW_CHECKS, SEVERITIES, SHOT_TYPES, SOURCE_TOOLS, WAITING_REASONS } from '@/lib/constants';
import { fmtDate, imageCode, lines, parseJson, sceneCode } from '@/lib/util';

export default async function ImagePage({ params }: { params: { slug: string; imageId: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const img = await db.plannedImage.findFirst({ where: { id: params.imageId, projectId: p.id }, include: imageInclude });
  if (!img) notFound();
  const [pool, prev, corrs, versions, siblings, ingredients, others, masters] = await Promise.all([
    refPool(p, img.id), suggestPrevious(p.id, img.seq), relevantCorrections(img, p.babyChefId),
    db.promptVersion.findMany({ where: { ownerId: img.id }, orderBy: [{ type: 'asc' }, { version: 'desc' }] }),
    db.plannedImage.findMany({ where: { projectId: p.id }, orderBy: { seq: 'asc' }, select: { id: true, seq: true, title: true, status: true } }),
    db.ingredient.findMany({ where: { projectId: p.id }, include: { references: { where: { deletedAt: null }, include: { asset: true } } } }),
    db.plannedImage.findMany({ where: { projectId: p.id, id: { not: params.imageId } }, orderBy: { seq: 'asc' }, select: { id: true, seq: true, title: true } }),
    p.babyChefId ? db.reference.findMany({ where: { babyChefId: p.babyChefId, kind: 'MASTER', deletedAt: null, active: true }, include: { asset: true }, orderBy: [{ isGold: 'desc' }] }) : [],
  ]);
  const code = imageCode(img.seq);
  const checklist = buildChecklist(img);
  const idx = siblings.findIndex(s => s.id === img.id);
  const attached = new Set(img.refs.map(r => r.sourceImageId).filter(Boolean));
  const prevSuggest = prev && !attached.has(prev.id) ? prev : null;
  const blocked = img.dependsOn && img.dependsOn.status !== 'APPROVED';
  const pkgAttached = checklist.filter(c => c.packageCritical);
  const pkgMissing = ingredients.filter(i => i.importance === 'PACKAGE_CRITICAL' && (img.ingredients || '').toLowerCase().includes(i.name.toLowerCase()) && !pkgAttached.some(c => c.label.startsWith(i.name)));
  const review = img.attempts.filter(a => a.status === 'REVIEW');
  const slugBase = `${p.slug}_${sceneCode(img.scene.order)}_${code}`;
  const compareFrame = img.refs.find(r => r.role === 'PREVIOUS APPROVED FRAME')?.sourceImage?.approvedAttempt?.assetId ?? prev?.approvedAttempt?.assetId;
  const compareMaster = img.refs.find(r => r.role === 'MASTER BABY')?.reference?.assetId ?? masters.find(m => m.category.includes('Face'))?.assetId ?? masters[0]?.assetId;
  const statusBtn = (s: string, cls = '') => (
    <form action={setImageStatus} key={s}><input type="hidden" name="id" value={img.id} /><input type="hidden" name="status" value={s} /><SubmitBtn className={`btn-sm ${cls}`} pendingText="…">{s === 'READY' ? 'MARK READY' : s === 'GENERATING' ? 'MARK GENERATING' : s === 'PLANNED' ? 'Reset to PLANNED' : s}</SubmitBtn></form>
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href={`/projects/${p.slug}/images`} className="underline">← All images</Link>
        <div className="flex gap-1">
          {idx > 0 && <Link className="btn btn-sm" href={`/projects/${p.slug}/images/${siblings[idx - 1].id}`}>← {imageCode(siblings[idx - 1].seq)}</Link>}
          {idx < siblings.length - 1 && <Link className="btn btn-sm" href={`/projects/${p.slug}/images/${siblings[idx + 1].id}`}>{imageCode(siblings[idx + 1].seq)} →</Link>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-2xl font-bold">{code}</span><h1 className="min-w-0 break-words text-xl">{img.title}</h1>
        <Chip>{img.status}</Chip><Chip>{`PROMPT: ${img.promptStatus}`}</Chip>{img.priority === 'HIGH' && <Chip tone="HIGH">HIGH PRIORITY</Chip>}
        <span className="text-sm text-neutral-500">{sceneCode(img.scene.order)} · {img.scene.title} · {img.attemptCount} attempt(s)</span>
      </div>

      {/* COPY BAR — easy to reach on mobile */}
      <div className="sticky top-14 z-10 -mx-4 flex flex-wrap gap-2 border-y border-line bg-paper/95 px-4 py-2 backdrop-blur sm:static sm:mx-0 sm:rounded-xl sm:border sm:bg-white sm:px-3 lg:top-0">
        <CopyButton text={img.fullPrompt} label="COPY FULL PROMPT" /><CopyButton text={img.contPrompt} label="COPY CONTINUATION PROMPT" />
        {img.status !== 'READY' && statusBtn('READY', 'btn-accent')}{img.status === 'READY' && statusBtn('GENERATING')}
      </div>

      {blocked && <Warn>Waiting for {imageCode(img.dependsOn!.seq)} — it is not approved yet. (You can still proceed.)</Warn>}
      {img.status === 'WAITING' && <div className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm"><b>WAITING</b> since {fmtDate(img.waitingAt)} — {img.waitingReason || 'no reason'}{img.waitingNote ? `: ${img.waitingNote}` : ''}</div>}
      {pkgAttached.length > 0 && (
        <div className="rounded-xl border-2 border-red-600 bg-red-50 p-3"><div className="font-bold text-red-700">PACKAGE CRITICAL</div><ul className="text-sm">{pkgAttached.map(c => <li key={c.id}>{c.label} — upload this label reference into ChatGPT.</li>)}</ul></div>
      )}
      {pkgMissing.map(i => (
        <div key={i.id} className="rounded-xl border-2 border-red-600 bg-red-50 p-3 text-sm"><b className="text-red-700">PACKAGE CRITICAL:</b> {i.name}{i.brand ? ` (${i.brand})` : ''} appears in this image but no brand reference is attached. Attach one below.</div>
      ))}

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        {/* LEFT: references */}
        <aside className="space-y-4">
          <Section title="Reference checklist">
            <p className="mb-2 text-xs text-neutral-500">Before generating {code}, upload:</p>
            <ChecklistText list={checklist} />
            <div className="mt-3 space-y-3">
              {img.refs.map((r, i) => {
                const c = checklist[i];
                return (
                  <div key={r.id} className="rounded-lg border border-line p-2">
                    <div className="flex gap-2">
                      <div className="w-20 shrink-0">{c.assetId ? <BigImage id={c.assetId} alt={c.label} /> : <div className="flex aspect-[4/3] items-center justify-center rounded bg-amber-100 text-[10px] font-bold">NOT APPROVED</div>}</div>
                      <div className="min-w-0 flex-1 text-xs"><div className="font-semibold leading-tight">{c.label}</div><div className="text-neutral-500">{r.role}</div>{r.reference?.isGold && <GoldBadge />}</div>
                    </div>
                    <details className="mt-1"><summary className="cursor-pointer text-[11px] font-semibold text-neutral-600">Edit</summary>
                      <form action={updateRef} className="mt-1 space-y-1"><input type="hidden" name="id" value={r.id} /><Sel name="role" label="Role" v={r.role} options={IMAGE_REF_ROLES} /><Text name="notes" label="Notes" v={r.notes} /><Check name="required" label="Required" v={r.required} /><SubmitBtn className="btn-sm">Save</SubmitBtn></form>
                    </details>
                    <div className="mt-1 flex gap-1">
                      <form action={moveRef}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="dir" value="up" /><button className="btn btn-sm" aria-label="Move up">↑</button></form>
                      <form action={moveRef}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="dir" value="down" /><button className="btn btn-sm" aria-label="Move down">↓</button></form>
                      <form action={detachRef}><input type="hidden" name="id" value={r.id} /><button className="btn btn-sm btn-danger">Remove</button></form>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
          <Section title="Attach reference">
            {prevSuggest && (
              <form action={usePreviousApproved} className="mb-3 rounded-lg bg-emerald-50 p-2"><input type="hidden" name="imageId" value={img.id} /><input type="hidden" name="sourceId" value={prevSuggest.id} />
                <div className="mb-1 flex items-center gap-2 text-xs"><div className="w-14"><Thumb id={prevSuggest.approvedAttempt!.assetId} alt={prevSuggest.title} w={160} /></div><span>Suggested previous: <b>{imageCode(prevSuggest.seq)}</b> {prevSuggest.title}</span></div>
                <SubmitBtn className="btn-sm btn-primary" pendingText="…">USE PREVIOUS APPROVED IMAGE</SubmitBtn></form>
            )}
            {!prevSuggest && !prev && <p className="mb-2 text-xs text-neutral-500">No earlier approved image yet — approve one to use it as Previous Approved Frame.</p>}
            <form action={attachRef} className="space-y-2"><input type="hidden" name="imageId" value={img.id} />
              <Field label="Reference"><select name="target" className="input" required defaultValue=""><option value="" disabled>— choose —</option>{pool.groups.map(g => <optgroup key={g.label} label={g.label}>{g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>)}</select></Field>
              <Sel name="role" label="Role" options={IMAGE_REF_ROLES} /><Text name="notes" label="Notes" /><Check name="required" label="Required" v />
              <SubmitBtn className="btn-sm btn-primary" pendingText="…">Attach</SubmitBtn></form>
            <p className="mt-2 text-[11px] text-neutral-500">Masters establish identity/kitchen. The Previous Approved Frame establishes current food, cookware and composition. Often you need both.</p>
          </Section>
          <Section title="Relevant corrections">
            {corrs.length === 0 ? <p className="text-sm text-neutral-500">None.</p> : <ul className="space-y-2 text-sm">{corrs.slice(0, 8).map(c => <li key={c.id}><b>{c.title}</b>{c.correct && <div className="text-neutral-600">→ {c.correct}</div>}</li>)}</ul>}
          </Section>
        </aside>

        {/* RIGHT: main form */}
        <div className="space-y-4">
          <DirtyForm action={saveImage} className="space-y-4">
            <input type="hidden" name="id" value={img.id} />
            <Section title="Prompts">
              <div className="grid gap-4 2xl:grid-cols-2">
                <PromptBox name="fullPrompt" label="FULL PROMPT" initial={img.fullPrompt} copyLabel="COPY FULL PROMPT" downloadHref={`/api/export/text?type=image-full&id=${img.id}`} />
                <PromptBox name="contPrompt" label="CONTINUATION PROMPT" initial={img.contPrompt} copyLabel="COPY CONTINUATION PROMPT" downloadHref={`/api/export/text?type=image-cont&id=${img.id}`} />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3"><Text name="promptReason" label="Reason for revision (saved with the new prompt version)" className="sm:col-span-2" /><Sel name="promptStatus" label="Prompt status" v={img.promptStatus} options={PROMPT_STATUSES} /></div>
              <div className="mt-2"><Link href={`/projects/${p.slug}/prompts?cat=IMAGE GENERATION&image=${img.id}`} className="btn btn-sm">PREPARE IMAGE PROMPT from template</Link></div>
            </Section>
            <Section title="Planning">
              <div className="grid gap-3 sm:grid-cols-2">
                <Text name="title" label="Image title" v={img.title} /><Sel name="shotType" label="Shot type" v={img.shotType} options={SHOT_TYPES} />
                <Sel name="priority" label="Priority" v={img.priority} options={PRIORITIES} /><Sel name="dependsOnId" label="Depends on (must be approved first)" v={img.dependsOnId} options={[['', '— none —'], ...others.map(o => [o.id, `${imageCode(o.seq)} ${o.title}`] as [string, string])]} />
                <Text name="aspectRatio" label="Preferred aspect ratio" v={img.aspectRatio} /><Sel name="cropImportance" label="Vertical crop importance" v={img.cropImportance} options={CROP_LEVELS} hint={img.cropImportance === 'CRITICAL' ? CROP_GUIDANCE : undefined} />
                <Text name="purpose" label="Purpose" v={img.purpose} className="sm:col-span-2" />
                <Area name="startingComposition" label="STARTING COMPOSITION (spatial layout: bottom / middle / top / hands)" v={img.startingComposition} rows={5} className="sm:col-span-2" />
                <Area name="mustBeVisible" label="WHAT MUST BE VISIBLE (one per line)" v={img.mustBeVisible} rows={5} />
                <Area name="mustNotChange" label="WHAT MUST NOT CHANGE (one per line)" v={img.mustNotChange} rows={5} />
                <Area name="mustNotAppear" label="WHAT MUST NOT APPEAR (one per line)" v={img.mustNotAppear} rows={5} className="sm:col-span-2" />
              </div>
            </Section>
            <details className="card" open><summary className="cursor-pointer font-semibold">Food state & action</summary>
              <div className="mt-3 rounded-lg bg-amber-50 p-2 text-sm"><b>{sceneCode(img.scene.order)} food state:</b> before — {img.scene.foodBefore || '?'}; during — {img.scene.foodDuring || '?'}; after — {img.scene.foodAfter || '?'}</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Text name="ingredients" label="Ingredient(s)" v={img.ingredients} /><Text name="ingredientQty" label="Ingredient quantity" v={img.ingredientQty} />
                <Area name="ingredientState" label="Ingredient current state" v={img.ingredientState} rows={2} /><Area name="foodTexture" label="Food texture" v={img.foodTexture} rows={2} />
                <Text name="foodColor" label="Food color" v={img.foodColor} /><Text name="cookware" label="Cookware" v={img.cookware} /><Text name="utensils" label="Utensils" v={img.utensils} />
                <Area name="objectPlacement" label="Object placement" v={img.objectPlacement} rows={2} /><Area name="actionMoment" label="Action moment" v={img.actionMoment} rows={2} /><Area name="physics" label="Physics notes" v={img.physics} rows={2} />
              </div></details>
            <details className="card"><summary className="cursor-pointer font-semibold">Character, camera & lighting</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Text name="characterVisibility" label="Character visibility" v={img.characterVisibility} /><Text name="expression" label="Character expression" v={img.expression} />
                <Text name="bodyPosition" label="Body positioning" v={img.bodyPosition} /><Text name="handPosition" label="Hand positioning" v={img.handPosition} />
                <Text name="lighting" label="Lighting" v={img.lighting} /><Text name="cameraAngle" label="Camera angle" v={img.cameraAngle} /><Text name="cameraDistance" label="Camera distance" v={img.cameraDistance} />
                <Text name="lens" label="Lens / look" v={img.lens} /><Text name="depthOfField" label="Depth of field" v={img.depthOfField} /><Text name="focusPoint" label="Focus point" v={img.focusPoint} /><Text name="background" label="Background" v={img.background} />
                <Area name="safety" label="Safety / adult assistance" v={img.safety} rows={2} /><Area name="continuity" label="Continuity requirements" v={img.continuity} rows={2} />
                <Area name="restrictions" label="Special restrictions" v={img.restrictions} rows={2} /><Area name="notes" label="Notes" v={img.notes} rows={2} />
              </div></details>
            <div className="flex flex-wrap gap-2"><SubmitBtn>SAVE IMAGE</SubmitBtn></div>
          </DirtyForm>

          <Section title="Status">
            <div className="flex flex-wrap gap-2">
              {statusBtn('READY', 'btn-accent')}{statusBtn('GENERATING')}{statusBtn('REVIEW')}{statusBtn('SKIPPED')}{statusBtn('PLANNED')}
            </div>
            <details className="mt-3 rounded-lg border border-line p-3"><summary className="cursor-pointer text-sm font-semibold">MARK WAITING…</summary>
              <form action={setImageStatus} className="mt-2 grid gap-2 sm:grid-cols-2"><input type="hidden" name="id" value={img.id} /><input type="hidden" name="status" value="WAITING" />
                <Sel name="reason" label="Reason" options={WAITING_REASONS} /><Text name="note" label="Optional note" /><div><SubmitBtn className="btn-sm" pendingText="…">MARK WAITING</SubmitBtn></div></form></details>
          </Section>

          <Section title="Prompt history">
            {versions.length === 0 ? <p className="text-sm text-neutral-500">Versions appear once a prompt is saved and later revised.</p> : versions.map(v => (
              <details key={v.id} className="border-b border-line py-2 last:border-0"><summary className="cursor-pointer text-sm"><b>{v.type === 'FULL' ? 'Full' : 'Continuation'} v{v.version}</b> {v.active && <Chip tone="APPROVED">ACTIVE</Chip>} · {fmtDate(v.createdAt)} · {v.reason}</summary>
                <pre className="mono mt-2 whitespace-pre-wrap rounded bg-neutral-50 p-2">{v.text}</pre>
                <div className="mt-1 flex gap-2"><CopyButton text={v.text} label="COPY" className="btn-sm" />{!v.active && <form action={restorePrompt}><input type="hidden" name="id" value={v.id} /><SubmitBtn className="btn-sm" pendingText="…">Restore as active</SubmitBtn></form>}</div></details>
            ))}
          </Section>
        </div>
      </div>

      {/* RESULTS */}
      <section id="results" className="space-y-4">
        <h2>Generated results & history</h2>
        <div className="card">
          <form action={uploadResult} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><input type="hidden" name="imageId" value={img.id} />
            <Field label="UPLOAD RESULT"><input type="file" name="file" accept="image/*" required className="input" /></Field>
            <Sel name="sourceTool" label="Source tool" options={SOURCE_TOOLS} /><Sel name="promptType" label="Prompt used" options={[['FULL', 'Full prompt'], ['CONTINUATION', 'Continuation prompt']]} />
            <Text name="notes" label="Notes" />
            <div className="sm:col-span-2 lg:col-span-4"><SubmitBtn pendingText="Uploading…">UPLOAD RESULT (as {slugBase}_attempt-v{img.attemptCount + 1})</SubmitBtn></div></form>
        </div>

        {review.map(a => (
          <div key={a.id} id="review" className="card border-2 border-violet-400">
            <div className="mb-3 flex items-center gap-2"><h2>Review — attempt {a.number}</h2><Chip>REVIEW</Chip></div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <div><BigImage id={a.assetId} alt={`${code} attempt ${a.number}`} />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div><div className="label">Previous approved frame</div>{compareFrame ? <BigImage id={compareFrame} alt="Previous approved frame" /> : <div className="text-xs text-neutral-400">none</div>}</div>
                  <div><div className="label">Master baby</div>{compareMaster ? <BigImage id={compareMaster} alt="Master baby reference" /> : <div className="text-xs text-neutral-400">none</div>}</div>
                </div></div>
              <div className="space-y-3 text-sm">
                <div><div className="label">Must be visible</div><ul className="list-disc pl-5">{lines(img.mustBeVisible).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                <div><div className="label">Must not change</div><ul className="list-disc pl-5">{lines(img.mustNotChange).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                <div><div className="label">Must not appear</div><ul className="list-disc pl-5">{lines(img.mustNotAppear).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                <div><div className="label">Food state</div>{img.ingredientState || img.scene.foodDuring || '—'}</div>
                <details><summary className="cursor-pointer text-xs font-semibold">Prompt used ({a.promptType}{a.promptVersion ? ` v${a.promptVersion}` : ''})</summary><pre className="mono mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-neutral-50 p-2">{a.promptType === 'FULL' ? img.fullPrompt : img.contPrompt}</pre></details>
              </div>
            </div>
            <form action={approveAttempt} className="mt-4 space-y-3">
              <input type="hidden" name="attemptId" value={a.id} />
              <fieldset><legend className="label">Review checklist (optional)</legend>
                <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4">{REVIEW_CHECKS.map(c => <label key={c} className="flex items-center gap-2 text-sm"><input type="checkbox" name="check" value={c} defaultChecked={parseJson<string[]>(a.checklist, []).includes(c)} className="h-4 w-4" />{c}</label>)}</div></fieldset>
              <Text name="notes" label="Notes" v={a.notes} />
              <div className="flex flex-wrap gap-2">
                <SubmitBtn className="btn-accent" pendingText="…" confirm={img.approvedAttemptId ? `${code} already has an approved result (attempt ${img.attempts.find(x => x.id === img.approvedAttemptId)?.number}). Replace it with this attempt? The old one is kept in history.` : undefined}><span>APPROVE</span></SubmitBtn>
                <button type="submit" formAction={saveChecklist} className="btn">Save checklist</button>
                <button type="submit" formAction={rejectAttempt} className="btn btn-danger">REJECT</button>
              </div>
            </form>
            <details className="mt-3 rounded-lg border-2 border-orange-300 bg-orange-50 p-3"><summary className="cursor-pointer font-semibold text-orange-900">REDO — record what went wrong</summary>
              <form action={redoAttempt} className="mt-3 grid gap-3 sm:grid-cols-2"><input type="hidden" name="attemptId" value={a.id} />
                <Area name="wrong" label="What is wrong?" rows={3} /><Area name="change" label="What should change?" rows={3} /><Area name="keep" label="What must remain unchanged?" rows={3} className="sm:col-span-2" />
                <Sel name="corrCategory" label="Correction category" options={CORRECTION_CATEGORIES} /><Sel name="severity" label="Severity" v="MEDIUM" options={SEVERITIES} />
                <Text name="notes" label="Notes" className="sm:col-span-2" /><div className="sm:col-span-2"><Check name="addToLibrary" label="Also add to the Corrections / Don't Do This library" /></div>
                <div className="sm:col-span-2"><SubmitBtn className="btn-accent" pendingText="…">REDO — save correction</SubmitBtn></div></form></details>
          </div>
        ))}

        <div className="space-y-3">
          <h3>Attempt history</h3>
          {img.attempts.length === 0 && <p className="text-sm text-neutral-500">No results uploaded yet.</p>}
          {[...img.attempts].reverse().map(a => {
            const approved = a.id === img.approvedAttemptId;
            return (
              <div key={a.id} className={`card flex flex-col gap-3 sm:flex-row ${approved ? 'border-2 border-green-600' : ''}`}>
                <div className="w-full shrink-0 sm:w-56"><BigImage id={a.assetId} alt={`${code} attempt ${a.number}`} /></div>
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2"><b>Attempt {a.number}</b><Chip>{a.status}</Chip>{approved && <Chip tone="APPROVED">APPROVED RESULT</Chip>}<span className="text-xs text-neutral-500">{a.sourceTool} · {a.promptType}{a.promptVersion ? ` v${a.promptVersion}` : ''} · {fmtDate(a.createdAt)}</span></div>
                  <div className="break-all text-xs text-neutral-500">{a.asset.displayName}{approved && <> → approved as <b>{slugBase}_approved-v{a.number}{a.asset.displayName.slice(a.asset.displayName.lastIndexOf('.'))}</b></>}</div>
                  <div className="text-xs text-neutral-400">{a.asset.orientation}{a.asset.width ? ` · ${a.asset.width}×${a.asset.height}` : ''}</div>
                  {a.wrong && <p><b className="text-red-700">Wrong:</b> {a.wrong}</p>}
                  {a.change && <p><b className="text-green-800">Correction:</b> {a.change}</p>}
                  {a.keep && <p><b>Keep:</b> {a.keep}</p>}
                  {a.notes && <p className="text-neutral-600">{a.notes}</p>}
                  <div className="flex flex-wrap gap-2 pt-1"><a className="btn btn-sm" href={`/api/files/${a.assetId}?download=1${approved ? `&name=${slugBase}_approved-v${a.number}` : ''}`}>Download</a>
                    {a.status !== 'APPROVED' && a.status !== 'REVIEW' && <form action={approveAttempt}><input type="hidden" name="attemptId" value={a.id} /><SubmitBtn className="btn-sm" pendingText="…" confirm={img.approvedAttemptId ? 'Replace the current approved result with this attempt?' : undefined}>Approve this one</SubmitBtn></form>}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <ConfirmForm action={deleteImage} message={`Delete ${code} and all its attempts/history? This cannot be undone.`}><input type="hidden" name="id" value={img.id} /><button className="btn btn-sm btn-danger">Delete planned image…</button></ConfirmForm>
    </div>
  );
}

