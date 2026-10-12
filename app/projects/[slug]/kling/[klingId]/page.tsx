import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { Area, BigImage, Check, Chip, Field, Section, Sel, Text, Thumb, Warn } from '@/components/ui';
import { AttachImageForm, ConfirmForm, CopyButton, DirtyForm, PromptBox, SubmitBtn } from '@/components/client';
import { addKlingRef, deleteKling, moveKlingRef, recordKlingAttempt, removeKlingRef, restoreKlingPrompt, reviewKlingAttempt, saveKling, setKlingStatus } from '@/lib/actions/kling';
import { dialogueWarning, preflight } from '@/lib/kling';
import { KLING_STATUSES } from '@/lib/constants';
import { fmtDate, imageCode, klingCode, parseJson, ratioLabel, sceneCode, wordCount } from '@/lib/util';

export default async function KlingPage({ params }: { params: { slug: string; klingId: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const k = await db.klingClip.findFirst({ where: { id: params.klingId, projectId: p.id }, include: { refs: { orderBy: { order: 'asc' }, include: { image: { include: { approvedAttempt: { include: { asset: true } }, attempts: { include: { asset: true }, orderBy: { number: 'desc' }, take: 1 }, scene: true } } } }, scenes: true, attempts: { orderBy: { number: 'desc' }, include: { asset: true } } } });
  if (!k) notFound();
  const [scenes, imgs, versions] = await Promise.all([
    db.scene.findMany({ where: { projectId: p.id }, orderBy: { order: 'asc' } }),
    db.plannedImage.findMany({ where: { projectId: p.id }, orderBy: { seq: 'asc' }, include: { approvedAttempt: true } }),
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
      <Link href={`/projects/${p.slug}/kling`} className="text-sm underline">← All Kling clips</Link>
      <div className="flex flex-wrap items-center gap-3"><span className="font-mono text-2xl font-bold">{code}</span><h1 className="text-xl">{k.title}</h1><Chip>{k.status}</Chip></div>

      <Section title="Kling preview & pre-flight check" right={<span className="text-xs text-neutral-500">warnings never block you</span>}>
        <div className="mb-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
          <div><div className="label">Duration</div>{k.durationTarget ? `${k.durationTarget} sec` : '—'}</div><div><div className="label">References</div>{refRows.filter(x => x.approved).length} approved / {refRows.length}</div>
          <div><div className="label">Scenes</div>{linkedScenes.map(s => sceneCode(s.order)).join(', ') || '—'}</div><div><div className="label">Major actions</div>{acts.length}</div><div><div className="label">Dialogue</div>{wordCount(k.dialogue)} words</div>
        </div>
        {warnings.length === 0 ? <div className="rounded-lg bg-green-50 p-2 text-sm font-semibold text-green-900">PRE-FLIGHT: no warnings.</div> : <ul className="space-y-1.5">{warnings.map((w, i) => <li key={i}><Warn>{w.text}</Warn></li>)}</ul>}
        <div className="mt-3 flex flex-wrap gap-2"><CopyButton text={k.finalPrompt} label="COPY KLING PROMPT" />
          {k.status !== 'READY' && statusBtn('READY', 'btn-accent')}{statusBtn('GENERATING EXTERNALLY')}{statusBtn('DRAFT')}{statusBtn('SKIPPED')}
          <a className="btn" href={`/api/export/text?type=kling&id=${k.id}`}>DOWNLOAD PROMPT</a></div>
        <div className="mt-3 rounded-lg bg-neutral-50 p-3"><div className="label">Production Brain — have ChatGPT / Claude WRITE the Kling prompt</div><div className="flex flex-wrap gap-2"><Link href={`/projects/${p.slug}/builder?type=kling-final&kling=${k.id}`} className="btn btn-sm btn-primary">PREPARE FINAL KLING PROMPT</Link></div></div>
      </Section>

      <Section title="Reference images (@image order)">
        {refRows.length === 0 && <p className="text-sm text-neutral-500">Attach approved images. Order = @image1, @image2, …</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{refRows.map(x => (
          <div key={x.r.id} className="rounded-lg border border-line p-2">
            <div className="mb-1 flex items-center justify-between"><span className="font-mono font-bold">@image{x.n}</span>{x.approved ? <Chip tone="APPROVED">APPROVED</Chip> : <Chip tone="WAITING">NOT APPROVED</Chip>}</div>
            {x.asset ? <BigImage id={x.asset.id} alt={x.label} /> : <Thumb alt="none" />}
            <div className="mt-1 text-xs"><b>{imageCode(x.r.image.seq)}</b> {x.r.image.title}</div>
            <div className="text-[11px] text-neutral-500">{x.orientation}{x.asset?.width ? ` · ${ratioLabel(x.asset.width, x.asset.height)} (${x.asset.width}×${x.asset.height})` : ''}</div>
            <div className="mt-1 flex gap-1"><form action={moveKlingRef}><input type="hidden" name="id" value={x.r.id} /><input type="hidden" name="dir" value="up" /><button className="btn btn-sm" aria-label="Move up">↑</button></form><form action={moveKlingRef}><input type="hidden" name="id" value={x.r.id} /><input type="hidden" name="dir" value="down" /><button className="btn btn-sm" aria-label="Move down">↓</button></form><form action={removeKlingRef}><input type="hidden" name="id" value={x.r.id} /><button className="btn btn-sm btn-danger">Remove</button></form></div>
          </div>))}</div>
        <AttachImageForm action={addKlingRef} klingId={k.id} options={imgs.filter(i => !attached.has(i.id)).map(i => ({ id: i.id, label: `${imageCode(i.seq)} ${i.title}`, approved: !!i.approvedAttemptId }))} />
        <p className="mt-1 text-xs text-neutral-500">Non-approved images can be attached; they trigger a warning (“IMG-0xx is not approved. Continue anyway?” — see pre-flight).</p>
      </Section>

      <DirtyForm action={saveKling} className="space-y-4" >
        <input type="hidden" name="id" value={k.id} />
        <Section title="Prompt">
          <p className="mb-2 text-xs text-neutral-500">Suggested structure: REFERENCE IMAGES · STARTING COMPOSITION · ACTION SEQUENCE · PHYSICAL BEHAVIOR · FOOD PHYSICS · DIALOGUE · BABY VOICE · CAMERA · FOCUS · ASMR · AMBIENT AUDIO · LIGHTING/STYLE · CONTINUITY · RESTRICTIONS · ENDING FRAME. Pair each @image with its action, e.g. “@image1 … Transition to @image2 …”.</p>
          <PromptBox name="finalPrompt" label="FINAL KLING PROMPT" initial={k.finalPrompt} rows={18} copyLabel="COPY KLING PROMPT" />
          {!k.finalPrompt.trim() && skeleton && <details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold">Reference/action pairing starter</summary><pre className="mono mt-1 whitespace-pre-wrap rounded bg-neutral-50 p-2">{skeleton}</pre><CopyButton text={skeleton} label="COPY STARTER" className="btn-sm mt-1" /></details>}
          <div className="mt-3 grid gap-3 sm:grid-cols-3"><Text name="promptReason" label="Reason for revision (saved with the new prompt version)" className="sm:col-span-2" /><Sel name="status" label="Status" v={k.status} options={KLING_STATUSES} /></div>
          <div className="mt-2"><Link href={`/projects/${p.slug}/prompts?cat=KLING&kling=${k.id}`} className="btn btn-sm">PREPARE KLING PROMPT from template</Link></div>
        </Section>
        <Section title="Clip plan">
          <div className="grid gap-3 sm:grid-cols-2">
            <Text name="title" label="Title" v={k.title} /><Text name="aspectRatio" label="Aspect ratio" v={k.aspectRatio || p.aspectRatio} />
            <div className="grid grid-cols-3 gap-2"><Text name="durationMin" label="Min (s)" type="number" v={k.durationMin} /><Text name="durationTarget" label="Preferred (s)" type="number" v={k.durationTarget} /><Text name="durationMax" label="Max (s)" type="number" v={k.durationMax} /></div>
            <Text name="purpose" label="Purpose" v={k.purpose} />
            <fieldset className="sm:col-span-2"><legend className="label">Related scenes</legend><div className="flex flex-wrap gap-x-4 gap-y-1">{scenes.map(s => <label key={s.id} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="scenes" value={s.id} defaultChecked={k.scenes.some(x => x.sceneId === s.id)} className="h-4 w-4" />{sceneCode(s.order)} {s.title}</label>)}</div></fieldset>
            <Area name="startingComposition" label="Starting composition" v={k.startingComposition} rows={4} /><Area name="endingComposition" label="Ending composition (ending frame)" v={k.endingComposition} rows={4} />
            <Area name="foodState" label="Food state in this clip" v={k.foodState} rows={3} className="sm:col-span-2" />
            <Area name="actionSequence" label="Action sequence (very detailed)" v={k.actionSequence} rows={8} className="sm:col-span-2" />
            <div className="sm:col-span-2"><div className="label">Major actions (count drives pre-flight)</div>
              {acts.map((a, i) => <input key={i} name="action" defaultValue={a} className="input mb-1" aria-label={`Major action ${i + 1}`} />)}
              <Area name="newActions" label="Add major actions (one per line)" rows={3} /></div>
            <Area name="physicalMovement" label="Physical movement" v={k.physicalMovement} rows={3} /><Area name="foodPhysics" label="Food physics" v={k.foodPhysics} rows={3} />
          </div>
        </Section>
        <Section title="Dialogue, voice & sound">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Area name="dialogue" label={`Dialogue (${wordCount(k.dialogue)} words)`} v={k.dialogue} rows={4} />{dw && <div className="mt-2"><Warn>{dw}</Warn></div>}</div>
            <div className="space-y-1"><Check name="useProfileVoice" label="USE PROFILE VOICE" v={k.useProfileVoice} /><div className="text-xs text-neutral-500">{p.babyChef?.voiceInstruction || 'No voice instruction on the Baby Chef profile.'}</div><Check name="offScreen" label="Off-screen" v={k.offScreen} /><Check name="lipSync" label="Lip-sync required" v={k.lipSync} /></div>
            <Area name="voiceOverride" label="Scene-specific voice override" v={k.voiceOverride} rows={3} />
            <Area name="asmrLines" label="ASMR (one sound per line)" v={k.asmrLines} rows={4} /><Area name="ambient" label="Ambient audio" v={k.ambient} rows={4} />
            <Area name="cameraBehavior" label="Camera behavior" v={k.cameraBehavior} rows={3} /><Area name="focusBehavior" label="Focus behavior" v={k.focusBehavior} rows={3} />
            <Area name="lighting" label="Lighting / style" v={k.lighting} rows={3} /><Area name="continuity" label="Continuity constraints" v={k.continuity} rows={3} />
            <Area name="safety" label="Safety / adult assistance" v={k.safety} rows={3} /><Area name="restrictions" label="Restrictions" v={k.restrictions} rows={3} />
            <Area name="notes" label="Notes" v={k.notes} rows={2} className="sm:col-span-2" />
          </div>
        </Section>
        <SubmitBtn>SAVE CLIP</SubmitBtn>
      </DirtyForm>

      <Section title="Prompt history">
        {versions.length === 0 ? <p className="text-sm text-neutral-500">Versions appear when the prompt is saved/revised.</p> : versions.map(v => <details key={v.id} className="border-b border-line py-2 last:border-0"><summary className="cursor-pointer text-sm"><b>v{v.version}</b> {v.active && <Chip tone="APPROVED">ACTIVE</Chip>} · {fmtDate(v.createdAt)} · {v.reason}</summary><pre className="mono mt-2 whitespace-pre-wrap rounded bg-neutral-50 p-2">{v.text}</pre><div className="mt-1 flex gap-2"><CopyButton text={v.text} label="COPY" className="btn-sm" />{!v.active && <form action={restoreKlingPrompt}><input type="hidden" name="id" value={v.id} /><SubmitBtn className="btn-sm" pendingText="…">Restore</SubmitBtn></form>}</div></details>)}
      </Section>

      <Section title="Generation record (external Kling attempts)">
        <form action={recordKlingAttempt} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="klingId" value={k.id} />
          <Text name="externalName" label="External filename / ID" /><Field label="Optional video upload"><input type="file" name="file" accept="video/*" className="input" /></Field>
          <Text name="notes" label="Notes" className="sm:col-span-2" /><div className="sm:col-span-2"><SubmitBtn pendingText="Saving…">RECORD GENERATION #{(k.attempts[0]?.number ?? 0) + 1}</SubmitBtn></div></form>
        <div className="mt-4 space-y-3">{k.attempts.map(a => (
          <div key={a.id} className="rounded-lg border border-line p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2"><b>Generation {a.number}</b><Chip>{a.status}</Chip><span className="text-xs text-neutral-500">{fmtDate(a.createdAt)} · {a.externalName || 'no external name'}</span></div>
            {a.asset && <video src={`/api/files/${a.assetId}`} controls className="mt-2 max-h-72 w-full rounded-lg bg-black" />}
            {a.notes && <p className="mt-1">{a.notes}</p>}
            {a.wrong && <p className="mt-1"><b className="text-red-700">Wrong:</b> {a.wrong}</p>}{a.change && <p><b className="text-green-800">Change:</b> {a.change}</p>}{a.keep && <p><b>Keep:</b> {a.keep}</p>}{a.promptNotes && <p><b>Prompt revision notes:</b> {a.promptNotes}</p>}
            <Link href={`/projects/${p.slug}/builder?type=kling-redo&kling=${k.id}&kattempt=${a.id}`} className="btn btn-sm mt-2">PREPARE KLING REDO PROMPT</Link>
            {a.status === 'REVIEW' && (
              <div className="mt-2 flex flex-wrap gap-2">
                <form action={reviewKlingAttempt}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="result" value="APPROVED" /><SubmitBtn className="btn-accent" pendingText="…">APPROVE</SubmitBtn></form>
                <details className="w-full rounded-lg border border-orange-300 bg-orange-50 p-2"><summary className="cursor-pointer font-semibold">REDO — what went wrong</summary>
                  <form action={reviewKlingAttempt} className="mt-2 grid gap-2 sm:grid-cols-2"><input type="hidden" name="id" value={a.id} /><input type="hidden" name="result" value="REDO" />
                    <Area name="wrong" label="What went wrong" rows={2} /><Area name="change" label="What must change" rows={2} /><Area name="keep" label="What must remain unchanged" rows={2} /><Area name="promptNotes" label="Prompt revision notes" rows={2} />
                    <div className="sm:col-span-2"><SubmitBtn className="btn-accent" pendingText="…">SAVE REDO</SubmitBtn></div></form></details>
              </div>)}
          </div>))}</div>
      </Section>
      <ConfirmForm action={deleteKling} message={`Delete ${code} and its history?`}><input type="hidden" name="id" value={k.id} /><button className="btn btn-sm btn-danger">Delete clip…</button></ConfirmForm>
    </div>
  );
}
