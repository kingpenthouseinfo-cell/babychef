import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getProjectBySlug, shotSummary } from '@/lib/queries';
import { Chip, Empty, Section, Thumb } from '@/components/ui';
import { ConfirmForm } from '@/components/client';
import { SceneForm } from '@/components/scene-form';
import { moveScene, deleteScene } from '@/lib/actions/script';
import { imageCode, sceneCode } from '@/lib/util';

export default async function Scenes({ params, searchParams }: { params: { slug: string }; searchParams: { view?: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const scenes = await db.scene.findMany({ where: { projectId: p.id }, orderBy: { order: 'asc' }, include: { images: { orderBy: { seq: 'asc' }, include: { approvedAttempt: true } } } });
  const base = `/projects/${p.slug}/scenes`;
  const summary = shotSummary(scenes.flatMap(s => s.images.length ? s.images.map(i => ({ shotType: i.shotType })) : [{ shotType: s.shotPriority }]));
  // food progression grouped by ingredient token
  const prog = new Map<string, { sc: string; txt: string }[]>();
  for (const s of scenes) for (const ing of (s.ingredients || '').split(',').map(x => x.trim()).filter(Boolean)) {
    const arr = prog.get(ing) ?? []; arr.push({ sc: `${sceneCode(s.order)} ${s.title}`, txt: s.foodAfter || s.foodDuring || s.foodBefore || '(no food state)' }); prog.set(ing, arr);
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        <Link href={base} className={`btn btn-sm ${searchParams.view !== 'progression' && searchParams.view !== 'new' ? 'btn-primary' : ''}`}>Scenes</Link>
        <Link href={`${base}?view=progression`} className={`btn btn-sm ${searchParams.view === 'progression' ? 'btn-primary' : ''}`}>Food progression</Link>
        <Link href={`${base}?view=new`} className="btn btn-sm">+ ADD SCENE</Link>
        <Link href={`/projects/${p.slug}/builder?type=scenes`} className="btn btn-sm btn-primary">PREPARE SCENE BREAKDOWN PROMPT</Link>
        <Link href={`/projects/${p.slug}/builder?type=image-plan`} className="btn btn-sm btn-primary">PREPARE IMAGE PLAN PROMPT</Link>
        <Link href={`/projects/${p.slug}/builder?type=continuity`} className="btn btn-sm">CONTINUITY REVIEW PROMPT</Link>
        <Link href={`/projects/${p.slug}/import`} className="btn btn-sm">IMPORT SCENES FROM TEXT</Link>
      </div>
      {Object.keys(summary).length > 0 && <div className="rounded-xl border border-line bg-white p-3 text-sm"><b>Shot variety (informational):</b> {Object.entries(summary).map(([k, v]) => `${v} × ${k.toLowerCase()}`).join(' · ')}{!summary['BEAUTY SHOT'] ? ' · 0 beauty shots' : ''}</div>}
      {searchParams.view === 'new' && <Section title="Add scene"><SceneForm projectId={p.id} /></Section>}
      {searchParams.view === 'progression' ? (
        <Section title="Food progression by ingredient">
          {prog.size === 0 ? <p className="text-sm text-neutral-500">Add ingredient names (comma separated) and food-state fields to scenes to see progression.</p> :
            [...prog.entries()].map(([ing, steps]) => <div key={ing} className="mb-4"><h3 className="mb-1">{ing}</h3><ol className="space-y-1 border-l-2 border-line pl-3 text-sm">{steps.map((s, i) => <li key={i}><b>{s.sc}:</b> {s.txt}</li>)}</ol></div>)}
          <h3 className="mb-1 mt-6">All scenes — before / during / after</h3>
          <div className="space-y-2 text-sm">{scenes.map(s => <div key={s.id} className="rounded-lg bg-neutral-50 p-2"><b>{sceneCode(s.order)} {s.title}</b><div className="grid gap-1 sm:grid-cols-3"><div><i>Before:</i> {s.foodBefore || '—'}</div><div><i>During:</i> {s.foodDuring || '—'}</div><div><i>After:</i> {s.foodAfter || '—'}</div></div></div>)}</div>
        </Section>
      ) : scenes.length === 0 ? <Empty title="No scenes yet." hint="Scenes are cooking/storytelling stages. Each scene can contain many planned images."><Link href={`${base}?view=new`} className="btn btn-primary">+ ADD SCENE</Link></Empty> : (
        <div className="space-y-4">{scenes.map(s => (
          <section key={s.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><div className="font-mono text-sm font-bold">{sceneCode(s.order)}</div><h2>{s.title}</h2></div>
              <div className="flex flex-wrap items-center gap-1.5"><Chip>{s.status}</Chip>{s.shortKeep && <Chip tone="SELECTED">SHORT KEEP</Chip>}{s.hook && <Chip>HOOK</Chip>}{s.adultAssist === 'YES' && <Chip tone="WAITING">ADULT ASSIST</Chip>}
                <form action={moveScene}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="dir" value="up" /><button className="btn btn-sm" aria-label="Move scene up">↑</button></form>
                <form action={moveScene}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="dir" value="down" /><button className="btn btn-sm" aria-label="Move scene down">↓</button></form></div>
            </div>
            <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
              <div className="rounded-lg bg-amber-50 p-2"><div className="label">Before</div>{s.foodBefore || '—'}</div><div className="rounded-lg bg-amber-50 p-2"><div className="label">During</div>{s.foodDuring || '—'}</div><div className="rounded-lg bg-amber-50 p-2"><div className="label">After</div>{s.foodAfter || '—'}</div>
            </div>
            {s.images.length > 0 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{s.images.map(i => <Link key={i.id} href={`/projects/${p.slug}/images/${i.id}`} className="w-24 shrink-0"><Thumb id={i.approvedAttempt?.assetId} alt={i.title} w={200} /><div className="mt-0.5 text-[11px] font-semibold">{imageCode(i.seq)}</div><Chip>{i.status}</Chip></Link>)}</div>}
            <div className="mt-3 flex flex-wrap gap-2"><Link href={`/projects/${p.slug}/images?scene=${s.id}&add=1`} className="btn btn-sm">+ ADD IMAGE</Link></div>
            <details className="mt-3 rounded-lg border border-line p-3"><summary className="cursor-pointer text-sm font-semibold">Edit scene</summary><div className="mt-3"><SceneForm projectId={p.id} s={s} /></div>
              <ConfirmForm action={deleteScene} message={`Delete ${sceneCode(s.order)} "${s.title}"? Scenes with images cannot be deleted.`} className="mt-3"><input type="hidden" name="id" value={s.id} /><button className="btn btn-sm btn-danger">Delete scene…</button></ConfirmForm></details>
          </section>))}</div>
      )}
    </div>
  );
}
