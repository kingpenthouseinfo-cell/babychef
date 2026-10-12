import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { Area, BigImage, Check, Chip, Field, Section, Sel, Text, Thumb, Warn } from '@/components/ui';
import { AttachImageForm, ConfirmForm, CopyButton, DirtyForm, PromptBox, SubmitBtn } from '@/components/client';
import { Collapsible, KlingRefStrip, PreflightCard } from '@/components/kling-client';
import { addKlingRef, deleteKling, moveKlingRef, recordKlingAttempt, removeKlingRef, restoreKlingPrompt, reviewKlingAttempt, saveKling, setKlingStatus } from '@/lib/actions/kling';
import { dialogueWarning, preflight } from '@/lib/kling';
import { KLING_STATUSES } from '@/lib/constants';
import { fmtDate, imageCode, klingCode, parseJson, ratioLabel, sceneCode, wordCount } from '@/lib/util';

export default async function KlingPage({ params }: { params: { slug: string; klingId: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const k = await db.klingClip.findFirst({ where: { id: params.klingId, projectId: p.id }, include: { refs: { orderBy: { order: 'asc' }, include: { image: { include: { approvedAttempt: { include: { asset: true } }, attempts: { include: { asset: true }, orderBy: { number: 'desc' }, take: 1 }, scene: true } } } }, scenes: true, attempts: { orderBy: { number: 'desc' }, include: { asset: true } } } });
  if (!k) notFound();
  const settings = await (await import('@/lib/settings')).getSettings();
  const [scenes, imgs, versions] = await Promise.all([
    db.scene.findMany({ where: { projectId: p.id }, orderBy: [{ pos: 'asc' }, { order: 'asc' }] }),
    db.plannedImage.findMany({ where: { projectId: p.id }, orderBy: [{ scene: { pos: 'asc' } }, { pos: 'asc' }, { seq: 'asc' }], include: { approvedAttempt: true } }),
    db.promptVersion.findMany({ where: { ownerId: k.id, type: 'KLING' }, orderBy: { version: 'desc' } }),
  ]);
  const code = klingCode(k.order);
  const refRows = k.refs.map((r, i) => {
    const asset = r.image.approvedAttempt?.asset ?? r.image.attempts[0]?.asset ?? null;
    return { r, n: i + 1, asset, approved: !!r.image.approvedAttemptId, label: `@image${i + 1} (${imageCode(r.image.seq)})`, orientation: asset?.orientation ?? 'UNKNOWN' };
  });
  const linkedScenes = scenes.filter(s => k.scenes.some(x => x.sceneId === s.id));
  const adultNeeded = linkedScenes.some(s => s.adultAssist === 'YES');
  const warnings = preflight(k, refRows.map(x => ({ approved: x.approved, label: x.label, orientation: x.orientation, hasAsset: !!x.asset })), p.babyChef?.voiceInstruction, adultNeeded);
  const acts = parseJson<string[]>(k.majorActions, []);
  const dw = dialogueWarning(k.dialogue, k.durationTarget);
  const attached = new Set(k.refs.map(r => r.imageId));
  const skeleton = refRows.map(x => `@image${x.n}\n(${x.r.image.title})`).join('\n\nTransition to ');
  const statusBtn = (s: string, cls = '') => <form action={setKlingStatus} key={s}><input type="hidden" name="id" value={k.id} /><input type="hidden" name="status" value={s} /><SubmitBtn className={`btn-sm ${cls}`} pendingText="…">{s === 'READY' ? 'MARK READY' : s}</SubmitBtn></form>;
  return (
    <div className="space-y-5">
      <Link href={`/projects/${p.slug}/kling`} className="text-sm underline">← All Video clips</Link>
      <div className="flex flex-wrap items-center gap-3"><span className="font-mono text-2xl font-bold">{code}</span><h1 className="text-xl">{k.title}</h1><Chip>{k.status}</Chip></div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-ink-secondary">
        <span className="font-mono">{k.durationTarget ? `${k.durationTarget} sec` : 'no duration'}</span><span className="font-mono">{k.aspectRatio || p.aspectRatio}</span>
        <span className="font-mono">{linkedScenes.length ? linkedScenes.map(s => sceneCode(s.order)).join(', ') : 'no scenes'}</span>
        <span>{refRows.filter(x => x.approved).length}/{refRows.length} references approved</span><span>{acts.length} major action(s)</span><span>{wordCount(k.dialogue)} dialogue words</span>
      </div>

      <section className="card border-purple-mid">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><div className="eyebrow text-purple-deep">REFERENCE STRIP · UPLOAD TO KLING IN THIS ORDER</div><p className="text-[12px] text-ink-secondary">Drag to reorder · @image numbers update the prompt</p></div></div>
        <KlingRefStrip klingId={k.id} items={refRows.map(x => ({ id: x.r.id, tag: `@image${x.n}`, code: imageCode(x.r.image.seq), title: x.r.image.title, assetId: x.asset?.id ?? null, approved: x.approved, meta: `${x.orientation}${x.asset?.width ? ` · ${ratioLabel(x.asset.width, x.asset.height)}` : ''}` }))} />
        <AttachImageForm action={addKlingRef} klingId={k.id} options={imgs.filter(i => !attached.has(i.id)).map(i => ({ id: i.id, label: `${imageCode(i.seq)} ${i.title}`, approved: !!i.approvedAttemptId }))} />
        <p className="mt-1 text-[11px] text-ink-secondary">Non-approved images can be attached after a warning (“Continue anyway?”).</p>
      </section>

      <PreflightCard klingId={k.id} status={k.status} warnings={warnings.filter(w => w.level === 'warn').map(w => w.text)} />
      <div className="flex flex-wrap gap-2">
        <CopyButton text={k.finalPrompt} label="COPY KLING PROMPT" />
        <a className="btn" href={settings.url_Kling} target="_blank" rel="noopener noreferrer">OPEN KLING ↗</a>
        {k.status !== 'GENERATING EXTERNALLY' && statusBtn('GENERATING EXTERNALLY')}{statusBtn('DRAFT')}{statusBtn('SKIPPED')}
        <a className="btn" href={`/api/export/text?type=kling&id=${k.id}`}>DOWNLOAD PROMPT</a>
        <Link href={`/projects/${p.slug}/builder?type=kling-final&kling=${k.id}`} className="btn btn-copy-secondary">PREPARE FINAL KLING PROMPT</Link>
      </div>

      <DirtyForm action={saveKling} className="space-y-4" >
        <input type="hidden" name="id" value={k.id} />
        <Section title="Clip plan">
          <div className="grid gap-3 sm:grid-cols-2">
            <Text name="title" label="Title" v={k.title} /><Text name="aspectRatio" label="Aspect ratio" v={k.aspectRatio || p.aspectRatio} />
            <div className="grid grid-cols-3 gap-2"><Text name="durationMin" label="Min (s)" type="number" v={k.durationMin} /><Text name="durationTarget" label="Preferred (s)" type="number" v={k.durationTarget} /><Text name="durationMax" label="Max (s)" type="number" v={k.durationMax} /></div>
            <Text name="purpose" label="Purpose" v={k.purpose} />
            <fieldset className="sm:col-span-2"><legend className="label">Related scenes</legend><div className="flex flex-wrap gap-x-4 gap-y-1">{scenes.map(s => <label key={s.id} className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" name="scenes" value={s.id} defaultChecked={k.scenes.some(x => x.sceneId === s.id)} className="h-4 w-4 accent-[#6A4E98]" />{sceneCode(s.order)} {s.title}</label>)}</div></fieldset>
            <Area name="foodState" label="Food state in this clip" v={k.foodState} rows={2} className="sm:col-span-2" />
          </div>
        </Section>

        <div className="space-y-2">
          <div className="flex items-center justify-between"><span className="eyebrow">PROMPT SECTIONS</span><span className="text-[12px] text-ink-secondary">Suggested structure — none are mandatory</span></div>
          <Collapsible index={1} title="Starting composition"><Area name="startingComposition" label="Starting composition" v={k.startingComposition} rows={4} /></Collapsible>
          <Collapsible index={2} title="Action sequence">
            <Area name="actionSequence" label="Action sequence (very detailed, continuous motion)" v={k.actionSequence} rows={8} />
            <div><div className="label">Major actions (count drives pre-flight)</div>{acts.map((a, i) => <input key={i} type="text" name="action" defaultValue={a} className="input mb-1" aria-label={`Major action ${i + 1}`} />)}<Area name="newActions" label="Add major actions (one per line)" rows={3} /></div>
          </Collapsible>
          <Collapsible index={3} title="Physical behavior"><Area name="physicalMovement" label="Physical movement" v={k.physicalMovement} rows={4} /></Collapsible>
          <Collapsible index={4} title="Food physics"><Area name="foodPhysics" label="Food physics" v={k.foodPhysics} rows={4} /></Collapsible>
          <Collapsible index={5} title="Dialogue">
            <Area name="dialogue" label={`Dialogue (${wordCount(k.dialogue)} words)`} v={k.dialogue} rows={4} />{dw && <Warn>{dw}</Warn>}
            <div className="flex flex-wrap gap-5"><Check name="offScreen" label="Off-screen" v={k.offScreen} /><Check name="lipSync" label="Lip-sync required" v={k.lipSync} /></div>
          </Collapsible>
          <Collapsible index={6} title="Baby voice" needed={false}>
            <Check name="useProfileVoice" label="USE PROFILE VOICE" v={k.useProfileVoice} /><div className="text-[12px] text-ink-secondary">{p.babyChef?.voiceInstruction || 'No voice instruction on the Baby Chef profile.'}</div>
            <Area name="voiceOverride" label="Scene-specific voice override" v={k.voiceOverride} rows={3} />
          </Collapsible>
          <Collapsible index={7} title="Camera & focus"><Area name="cameraBehavior" label="Camera behavior" v={k.cameraBehavior} rows={3} /><Area name="focusBehavior" label="Focus behavior" v={k.focusBehavior} rows={3} /></Collapsible>
          <Collapsible index={8} title="ASMR & ambient audio"><Area name="asmrLines" label="ASMR (one sound per line)" v={k.asmrLines} rows={4} /><Area name="ambient" label="Ambient audio" v={k.ambient} rows={3} /></Collapsible>
          <Collapsible index={9} title="Lighting / style" needed={false}><Area name="lighting" label="Lighting / style" v={k.lighting} rows={3} /></Collapsible>
          <Collapsible index={10} title="Continuity & restrictions">
            <Area name="continuity" label="Continuity constraints" v={k.continuity} rows={3} /><Area name="restrictions" label="Restrictions" v={k.restrictions} rows={3} /><Area name="safety" label="Safety / adult assistance" v={k.safety} rows={2} />
          </Collapsible>
          <Collapsible index={11} title="Ending frame"><Area name="endingComposition" label="Ending composition (how the clip ends)" v={k.endingComposition} rows={3} /></Collapsible>
        </div>

        <Section title={`FINAL KLING PROMPT`} right={<span className="font-mono text-[12px] text-ink-secondary">{versions.find(v => v.active) ? `v${versions.find(v => v.active)!.version}` : 'no version yet'} · {wordCount(k.finalPrompt)} words</span>}>
          <p className="mb-2 text-xs text-ink-secondary">Pair each @image with its action: “@image1 … Transition to @image2 …”.</p>
          <PromptBox name="finalPrompt" label="Final Kling prompt" initial={k.finalPrompt} rows={16} copyLabel="COPY KLING PROMPT" />
          {!k.finalPrompt.trim() && skeleton && <details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold">Reference/action pairing starter</summary><pre className="mono mt-1 whitespace-pre-wrap rounded bg-sunken p-2">{skeleton}</pre><CopyButton text={skeleton} label="COPY STARTER" className="btn-sm mt-1" /></details>}
          <div className="mt-3 grid gap-3 sm:grid-cols-3"><Text name="promptReason" label="Reason for revision (saved with the new prompt version)" className="sm:col-span-2" /><Sel name="status" label="Status" v={k.status} options={KLING_STATUSES} /></div>
        </Section>
        <Section title="Notes"><Area name="notes" label="Notes" v={k.notes} rows={2} /></Section>
        <SubmitBtn>SAVE CLIP</SubmitBtn>
      </DirtyForm>

      <Section title="Prompt history">
        {versions.length === 0 ? <p className="text-sm text-ink-secondary">Versions appear when the prompt is saved/revised.</p> : versions.map(v => <details key={v.id} className="border-b border-line py-2 last:border-0"><summary className="cursor-pointer text-sm"><b>v{v.version}</b> {v.active && <Chip tone="APPROVED">ACTIVE</Chip>} · {fmtDate(v.createdAt)} · {v.reason}</summary><pre className="mono mt-2 whitespace-pre-wrap rounded bg-sunken p-2">{v.text}</pre><div className="mt-1 flex gap-2"><CopyButton text={v.text} label="COPY" className="btn-sm" />{!v.active && <form action={restoreKlingPrompt}><input type="hidden" name="id" value={v.id} /><SubmitBtn className="btn-sm" pendingText="…">Restore</SubmitBtn></form>}</div></details>)}
      </Section>

      <Section title="Video attempts made in Kling">
        <form action={recordKlingAttempt} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="klingId" value={k.id} />
          <Text name="externalName" label="External filename / ID" /><Field label="Optional video upload"><input type="file" name="file" accept="video/*" className="input" /></Field>
          <Text name="notes" label="Notes" className="sm:col-span-2" /><div className="sm:col-span-2"><SubmitBtn pendingText="Saving…">RECORD GENERATION #{(k.attempts[0]?.number ?? 0) + 1}</SubmitBtn></div></form>
        <div className="mt-4 space-y-3">{k.attempts.map(a => (
          <div key={a.id} className="rounded-lg border border-line p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2"><b>Generation {a.number}</b><Chip>{a.status}</Chip><span className="text-xs text-ink-secondary">{fmtDate(a.createdAt)} · {a.externalName || 'no external name'}</span></div>
            {a.asset && <video src={`/api/files/${a.assetId}`} controls className="mt-2 max-h-72 w-full rounded-lg bg-black" />}
            {a.notes && <p className="mt-1">{a.notes}</p>}
            {a.wrong && <p className="mt-1"><b className="text-[#A8513F]">Wrong:</b> {a.wrong}</p>}{a.change && <p><b className="text-[#3B6448]">Change:</b> {a.change}</p>}{a.keep && <p><b>Keep:</b> {a.keep}</p>}{a.promptNotes && <p><b>Prompt revision notes:</b> {a.promptNotes}</p>}
            <Link href={`/projects/${p.slug}/builder?type=kling-redo&kling=${k.id}&kattempt=${a.id}`} className="btn btn-sm mt-2">PREPARE KLING REDO PROMPT</Link>
            {a.status === 'REVIEW' && (
              <div className="mt-2 flex flex-wrap gap-2">
                <form action={reviewKlingAttempt}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="result" value="APPROVED" /><SubmitBtn className="btn-approve" pendingText="…">APPROVE</SubmitBtn></form>
                <details className="w-full rounded-lg border border-[#C8705C] bg-[#F6E3DE] p-2"><summary className="cursor-pointer font-semibold">FIX THIS VIDEO — what is wrong</summary>
                  <form action={reviewKlingAttempt} className="mt-2 grid gap-2 sm:grid-cols-2"><input type="hidden" name="id" value={a.id} /><input type="hidden" name="result" value="REDO" />
                    <Area name="wrong" label="What went wrong" rows={2} /><Area name="change" label="What must change" rows={2} /><Area name="keep" label="What must remain unchanged" rows={2} /><Area name="promptNotes" label="Prompt revision notes" rows={2} />
                    <div className="sm:col-span-2"><SubmitBtn className="btn-accent" pendingText="…">SAVE FIX</SubmitBtn></div></form></details>
              </div>)}
          </div>))}</div>
      </Section>
      <ConfirmForm action={deleteKling} message={`Delete ${code} and its history?`}><input type="hidden" name="id" value={k.id} /><button className="btn btn-sm btn-danger">Delete clip…</button></ConfirmForm>
    </div>
  );
}
