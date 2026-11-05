import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { buildChecklist, getProjectBySlug, imageInclude, refPool, shotSummary } from '@/lib/queries';
import { Empty, Section, Sel, Text, Field, Chip } from '@/components/ui';
import { stepInfosForScene, type StepInfo } from '@/lib/step-dialogue';
import { MergedBack } from '@/components/picture-merge';
import { ImageCard } from '@/components/image-bits';
import { CopyButton, SubmitBtn } from '@/components/client';
import { createImage, batchImages } from '@/lib/actions/image';
import { IMAGE_STATUSES, PRIORITIES, SHOT_TYPES, IMAGE_REF_ROLES } from '@/lib/constants';
import { imageCode, sceneCode } from '@/lib/util';
import { AddPictureFields } from '@/components/add-picture-fields';
import { ProjectReferences } from '@/components/ai-references';
import { CloudReferenceStatus } from '@/components/cloud-reference-status';
import { publicBase } from '@/lib/automation-config';
import { aiReferencesForProject, aiRefOptions, projectMasters } from '@/lib/ai-refs';
import { getSettings } from '@/lib/settings';
import { sceneLabels } from '@/lib/scene-label';
import { fileUrl } from '@/components/ui';

export default async function Images({ params, searchParams }: { params: { slug: string }; searchParams: { status?: string; scene?: string; shot?: string; ingredient?: string; keep?: string; view?: string; add?: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const [all, scenes, pool] = await Promise.all([
    db.plannedImage.findMany({ where: { projectId: p.id }, orderBy: [{ scene: { pos: 'asc' } }, { pos: 'asc' }, { seq: 'asc' }], include: imageInclude }),
    db.scene.findMany({ where: { projectId: p.id }, orderBy: [{ pos: 'asc' }, { order: 'asc' }] }),
    refPool(p),
  ]);
  const lab = sceneLabels(scenes);
  const [aiMap, aiOpts, masters, settings] = await Promise.all([aiReferencesForProject(p.id), aiRefOptions(p.id), projectMasters(p.id), getSettings()]);
  const chatgpt = settings.url_ChatGPT || 'https://chatgpt.com/';
  // which step and which dialogue each picture is for (pictures marked "don't use" are left out of the count)
  const notesOf = new Map<string, StepInfo | null>();
  const mergeOf = new Map<string, { siblings: { id: string; label: string }[]; merged: { id: string; label: string }[] }>();
  for (const sc of scenes) {
    const inScene = all.filter(y => y.sceneId === sc.id);
    const infos = stepInfosForScene(inScene as any, sc as any);
    for (const x of inScene) {
      notesOf.set(x.id, infos.get(x.id) ?? null);
      mergeOf.set(x.id, { siblings: inScene.filter(y => y.id !== x.id && y.status !== 'SKIPPED' && !(y as any).mergedInto).map(y => ({ id: y.id, label: `${imageCode(y.seq)} · ${y.title}` })), merged: inScene.filter(y => (y as any).mergedInto === x.id).map(y => ({ id: y.id, label: imageCode(y.seq) })) });
    }
  }
  const arrange = { scenes: scenes.map(s => ({ id: s.id, label: `Scene ${lab.get(s.id)} · ${s.title}` })), pictures: all.map((i, n) => ({ id: i.id, label: `Picture ${n + 1} · ${i.title}` })) };
  const nextSeq = all.reduce((m, i) => Math.max(m, i.seq), 0) + 1;
  const st = searchParams.status;
  const mergedAway = all.filter(i => (i as any).mergedInto).map(i => ({ id: i.id, label: `${imageCode(i.seq)} · ${i.title}`, into: imageCode(all.find(x => x.id === (i as any).mergedInto)?.seq ?? 0) }));
  const list = all.filter(i => !(i as any).mergedInto &&
    (!st || st === 'ALL' || i.status === st || (st === 'PLANNED' && i.status === 'PROMPT DRAFT')) &&
    (!searchParams.scene || i.sceneId === searchParams.scene) && (!searchParams.shot || i.shotType === searchParams.shot) &&
    (!searchParams.ingredient || (i.ingredients || '').toLowerCase().includes(searchParams.ingredient.toLowerCase())) &&
    (!searchParams.keep || i.scene.shortKeep));
  const base = `/projects/${p.slug}/images`;
  const summary = shotSummary(all);
  const counts = (s: string) => all.filter(i => i.status === s).length;
  const keepQs = (view: boolean) => { const q = new URLSearchParams(); for (const k of ['status', 'scene', 'shot', 'ingredient', 'keep'] as const) if (searchParams[k]) q.set(k, String(searchParams[k])); if (view) q.set('view', 'shots'); const t = q.toString(); return `${base}${t ? `?${t}` : ''}`; };
  // SCREENSHOT VIEW: only the picture and its info, tiny text, many to a screen — for taking screenshots
  if (searchParams.view === 'shots') {
    const tiles = list.filter(i => i.status !== 'SKIPPED');
    return (
      <div data-testid="shots-view">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <Link href={keepQs(false)} className="btn btn-sm btn-primary" data-testid="shots-off">◀ BACK TO FULL VIEW</Link>
          <span className="text-[12px] text-ink-secondary">Screenshot view · {tiles.length} picture{tiles.length === 1 ? '' : 's'}</span>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))' }}>
          {tiles.map(i => {
            const a = i.approvedAttempt?.assetId ?? i.attempts?.[i.attempts.length - 1]?.assetId;
            const n = notesOf.get(i.id);
            return (
              <div key={i.id} className="min-w-0 rounded-lg border border-line bg-white p-1.5 text-[10px] leading-[1.25]" data-testid="shot-tile">
                <div className="flex items-center gap-1"><span className="font-mono text-[10.5px] font-bold">{imageCode(i.seq)}</span><Chip>{i.status}</Chip></div>
                <div className="truncate text-ink-secondary">{sceneCode(i.scene.order)} {i.scene.title}</div>
                <div className="mt-1 aspect-[4/3] overflow-hidden rounded-md bg-sunken">{a ? <img src={fileUrl(a, 360)} alt={i.title} loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-ink-muted">no image</div>}</div>
                <div className="mt-1 text-[11px] font-semibold leading-tight">{i.title}</div>
                <div className="uppercase text-ink-secondary">{i.shotType}</div>
                {n && <div className="text-ink-secondary"><b className="text-[#46638A]">{n.stepEnd && n.stepEnd > n.stepNo ? `Steps ${n.stepNo}–${n.stepEnd}` : `Step ${n.stepNo}`} of {n.stepOf}:</b> {n.step}</div>}
                <div className="text-ink-secondary">{n?.says ? <>“{n.says}”</> : 'No dialogue for this picture.'}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        {['ALL', ...IMAGE_STATUSES.filter(s => ['PLANNED', 'READY', 'WAITING', 'REVIEW', 'APPROVED', 'REDO', 'REJECTED'].includes(s))].map(s => (
          <Link key={s} href={`${base}?status=${s}`} className={`btn btn-sm ${(st || 'ALL') === s ? 'btn-primary' : ''}`}>{s}{s !== 'ALL' && ` (${counts(s)})`}</Link>
        ))}
        <Link href={keepQs(true)} className="btn btn-sm" data-testid="shots-on" title="Show only the pictures and their info, small, so many fit on one screen">SCREENSHOT VIEW</Link>
        <a href="#add" className="btn btn-sm btn-accent">+ ADD IMAGE</a>
      </div>
      <form className="flex flex-wrap gap-2" method="get">
        {st && <input type="hidden" name="status" value={st} />}
        <select name="scene" defaultValue={searchParams.scene || ''} className="input max-w-[220px]" aria-label="Filter by scene"><option value="">All scenes</option>{scenes.map(s => <option key={s.id} value={s.id}>{sceneCode(s.order)} {s.title}</option>)}</select>
        <select name="shot" defaultValue={searchParams.shot || ''} className="input max-w-[220px]" aria-label="Filter by shot type"><option value="">All shot types</option>{SHOT_TYPES.map(s => <option key={s}>{s}</option>)}</select>
        <input name="ingredient" defaultValue={searchParams.ingredient} placeholder="Ingredient…" className="input max-w-[160px]" aria-label="Filter by ingredient" />
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="keep" value="1" defaultChecked={!!searchParams.keep} />Short Keep</label>
        <button className="btn">Filter</button>
      </form>
      <ProjectReferences masters={masters} />
      <CloudReferenceStatus projectId={p.id} base={publicBase().base} source={publicBase().source} />
      {Object.keys(summary).length > 0 && <div className="text-xs text-ink-secondary">Shot variety: {Object.entries(summary).map(([k, v]) => `${v} × ${k.toLowerCase()}`).join(' · ')}</div>}

      {all.length === 0 ? <Empty title="No planned images yet." hint="Add images to your Scenes. A scene can have many images, numbered IMG-001, IMG-002… across the project." /> : list.length === 0 ? <Empty title="No images match this filter." /> : (
        <form action={batchImages} className="space-y-3">
          <details className="card"><summary className="cursor-pointer text-sm font-semibold">Batch actions for selected images</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2"><Sel name="status" label="Set status" options={IMAGE_STATUSES} /><button name="op" value="status" className="btn btn-sm">Apply status</button></div>
              <div className="space-y-2"><Field label="Reference"><select name="target" className="input"><option value="">— choose —</option>{pool.groups.map(g => <optgroup key={g.label} label={g.label}>{g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>)}</select></Field>
                <Sel name="role" label="Role" options={IMAGE_REF_ROLES} /><div className="flex gap-2"><button name="op" value="addRef" className="btn btn-sm">Add reference</button><button name="op" value="removeRef" className="btn btn-sm btn-danger" onClick={undefined}>Remove reference</button></div></div>
              <div className="flex items-end"><CopyButton text={list.map(i => imageCode(i.seq)).join(', ')} label="COPY IMAGE IDS (filtered)" className="btn-sm" /></div>
            </div></details>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{list.map(i => <ImageCard key={i.id} img={i} slug={p.slug} pcode={p.code} checklist={buildChecklist(i)} selectable ai={aiMap.get(i.id)} aiOpts={aiOpts} chatgpt={chatgpt} arrange={arrange} merge={mergeOf.get(i.id)} notes={notesOf.get(i.id) ?? null} />)}</div>
        </form>
      )}
      <MergedBack items={mergedAway} />

      <section id="add" className="card">
        <h2 className="mb-3">+ Add planned image</h2>
        {scenes.length === 0 ? <p className="text-sm text-ink-secondary">Create a scene first (Scenes tab).</p> : (
          <form action={createImage} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="projectId" value={p.id} />
            <div className="space-y-3 sm:col-span-2">
              <AddPictureFields ctx={{ slug: p.slug, code: p.code, sceneOrder: (scenes.find(s => s.id === (searchParams.scene || scenes[0].id)) ?? scenes[0]).order, nextSeq }} sceneId={searchParams.scene || scenes[0].id}
                scenes={scenes.map(s => ({ id: s.id, order: s.order, label: `Scene ${lab.get(s.id)} · ${s.title}` }))}
                extra={<><Sel name="shotType" label="Shot type" options={SHOT_TYPES} /><Sel name="priority" label="Priority" v="NORMAL" options={PRIORITIES} /></>} />
            </div>
            <div className="sm:col-span-2"><SubmitBtn pendingText="Creating…">ADD PICTURE</SubmitBtn></div>
          </form>
        )}
      </section>
    </div>
  );
}
