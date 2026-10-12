import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { buildChecklist, getProjectBySlug, imageInclude, refPool, shotSummary } from '@/lib/queries';
import { Empty, Section, Sel, Text, Field, Chip } from '@/components/ui';
import { ImageCard } from '@/components/image-bits';
import { CopyButton, SubmitBtn } from '@/components/client';
import { createImage, batchImages } from '@/lib/actions/image';
import { IMAGE_STATUSES, PRIORITIES, SHOT_TYPES, IMAGE_REF_ROLES } from '@/lib/constants';
import { imageCode, sceneCode } from '@/lib/util';
import { AddPictureFields } from '@/components/add-picture-fields';
import { sceneLabels } from '@/lib/scene-label';

export default async function Images({ params, searchParams }: { params: { slug: string }; searchParams: { status?: string; scene?: string; shot?: string; ingredient?: string; keep?: string; add?: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const [all, scenes, pool] = await Promise.all([
    db.plannedImage.findMany({ where: { projectId: p.id }, orderBy: [{ scene: { pos: 'asc' } }, { pos: 'asc' }, { seq: 'asc' }], include: imageInclude }),
    db.scene.findMany({ where: { projectId: p.id }, orderBy: [{ pos: 'asc' }, { order: 'asc' }] }),
    refPool(p),
  ]);
  const lab = sceneLabels(scenes);
  const nextSeq = all.reduce((m, i) => Math.max(m, i.seq), 0) + 1;
  const st = searchParams.status;
  const list = all.filter(i =>
    (!st || st === 'ALL' || i.status === st || (st === 'PLANNED' && i.status === 'PROMPT DRAFT')) &&
    (!searchParams.scene || i.sceneId === searchParams.scene) && (!searchParams.shot || i.shotType === searchParams.shot) &&
    (!searchParams.ingredient || (i.ingredients || '').toLowerCase().includes(searchParams.ingredient.toLowerCase())) &&
    (!searchParams.keep || i.scene.shortKeep));
  const base = `/projects/${p.slug}/images`;
  const summary = shotSummary(all);
  const counts = (s: string) => all.filter(i => i.status === s).length;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        {['ALL', ...IMAGE_STATUSES.filter(s => ['PLANNED', 'READY', 'WAITING', 'REVIEW', 'APPROVED', 'REDO', 'REJECTED'].includes(s))].map(s => (
          <Link key={s} href={`${base}?status=${s}`} className={`btn btn-sm ${(st || 'ALL') === s ? 'btn-primary' : ''}`}>{s}{s !== 'ALL' && ` (${counts(s)})`}</Link>
        ))}
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{list.map(i => <ImageCard key={i.id} img={i} slug={p.slug} checklist={buildChecklist(i)} selectable />)}</div>
        </form>
      )}

      <section id="add" className="card">
        <h2 className="mb-3">+ Add planned image</h2>
        {scenes.length === 0 ? <p className="text-sm text-ink-secondary">Create a scene first (Scenes tab).</p> : (
          <form action={createImage} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="projectId" value={p.id} />
            <div className="space-y-3 sm:col-span-2">
              <AddPictureFields ctx={{ slug: p.slug, sceneOrder: (scenes.find(s => s.id === (searchParams.scene || scenes[0].id)) ?? scenes[0]).order, nextSeq }} sceneId={searchParams.scene || scenes[0].id}
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
