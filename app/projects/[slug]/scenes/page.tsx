import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getProjectBySlug, shotSummary } from '@/lib/queries';
import { Chip, Empty, Section, fileUrl } from '@/components/ui';
import { ConfirmForm } from '@/components/client';
import { SceneForm } from '@/components/scene-form';
import { moveScene, deleteScene } from '@/lib/actions/script';
import { imageCode, sceneCode } from '@/lib/util';

const SHOT_SHORT: Record<string, string> = { 'MAIN NARRATIVE SHOT': 'Medium', 'CINEMATIC INSERT': 'Insert', 'MACRO ASMR': 'Macro', 'REACTION SHOT': 'Reaction', OVERHEAD: 'Overhead', TRANSITION: 'Transition', 'BEAUTY SHOT': 'Beauty' };

export default async function Scenes({ params, searchParams }: { params: { slug: string }; searchParams: { view?: string; scene?: string; edit?: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const scenes = await db.scene.findMany({ where: { projectId: p.id }, orderBy: { order: 'asc' }, include: { images: { orderBy: { seq: 'asc' }, include: { approvedAttempt: true } } } });
  const base = `/projects/${p.slug}/scenes`;
  const view = searchParams.view;
  const sel = scenes.find(s => s.id === (searchParams.edit || searchParams.scene)) ?? scenes[0];
  const editing = scenes.find(s => s.id === searchParams.edit);
  const summary = shotSummary(scenes.flatMap(s => s.images.length ? s.images.map(i => ({ shotType: i.shotType })) : [{ shotType: s.shotPriority }]));
  const prog = new Map<string, { sc: string; txt: string }[]>();
  for (const s of scenes) for (const ing of (s.ingredients || '').split(',').map(x => x.trim()).filter(Boolean)) {
    const arr = prog.get(ing) ?? []; arr.push({ sc: `${sceneCode(s.order)} ${s.title}`, txt: s.foodAfter || s.foodDuring || s.foodBefore || '(no food state)' }); prog.set(ing, arr);
  }
  const tab = (href: string, label: string, on: boolean, cls = '') => <Link href={href} className={`rounded-full px-3.5 py-1.5 text-[13px] transition ${on ? 'bg-blue-light font-semibold text-blue-deep' : 'text-ink-secondary ring-1 ring-line hover:text-ink'} ${cls}`}>{label}</Link>;
  const kv = (k: string, v: string | null | undefined, warn = false) => v ? <div className="grid grid-cols-[110px_1fr] gap-3 py-1.5 text-[13px]"><dt className="text-ink-secondary">{k}</dt><dd className={warn ? 'text-[#8A6216]' : ''}>{v}</dd></div> : null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {tab(base, 'Scenes', !view || view === 'cards', '')}{tab(`${base}?view=progression`, 'Food progression', view === 'progression')}{tab(`${base}?view=new`, '+ ADD SCENE', view === 'new')}
        <span className="mx-1 hidden h-5 w-px bg-line md:block" />
        <Link href={`/projects/${p.slug}/builder?type=scenes`} className="btn btn-sm btn-copy-secondary">PREPARE SCENE BREAKDOWN PROMPT</Link>
        <Link href={`/projects/${p.slug}/builder?type=image-plan`} className="btn btn-sm btn-copy-secondary">PREPARE IMAGE PLAN PROMPT</Link>
        <Link href={`/projects/${p.slug}/builder?type=continuity`} className="btn btn-sm">CONTINUITY REVIEW PROMPT</Link>
        <Link href={`/projects/${p.slug}/import`} className="ml-auto text-[13px] font-medium text-blue-deep">Import scenes from text</Link>
      </div>
      {Object.keys(summary).length > 0 && <div className="rounded-lg border border-line bg-surface p-3 text-[13px]"><b>Shot variety (informational):</b> {Object.entries(summary).map(([k, v]) => `${v} × ${k.toLowerCase()}`).join(' · ')}{!summary['BEAUTY SHOT'] ? ' · 0 beauty shots' : ''}</div>}

      {view === 'new' && <Section title="Add scene"><SceneForm projectId={p.id} /></Section>}

      {view === 'progression' ? (
        <Section title="Food progression by ingredient">
          {prog.size === 0 ? <p className="text-sm text-ink-secondary">Add ingredient names (comma separated) and food-state fields to scenes to see progression.</p> :
            [...prog.entries()].map(([ing, steps]) => <div key={ing} className="mb-4"><h3 className="mb-1">{ing}</h3><ol className="space-y-1 border-l-2 border-line pl-3 text-sm">{steps.map((s, i) => <li key={i}><b>{s.sc}:</b> {s.txt}</li>)}</ol></div>)}
          <h3 className="mb-1 mt-6">All scenes — before / during / after</h3>
          <div className="space-y-2 text-sm">{scenes.map(s => <div key={s.id} className="rounded-lg bg-sunken p-2"><b>{sceneCode(s.order)} {s.title}</b><div className="grid gap-1 sm:grid-cols-3"><div><i>Before:</i> {s.foodBefore || '—'}</div><div><i>During:</i> {s.foodDuring || '—'}</div><div><i>After:</i> {s.foodAfter || '—'}</div></div></div>)}</div>
        </Section>
      ) : scenes.length === 0 ? (
        view === 'new' ? null : <Empty title="No scenes yet." hint="Scenes are cooking/storytelling stages. Each scene can contain many planned images."><Link href={`${base}?view=new`} className="btn btn-primary">+ ADD SCENE</Link></Empty>
      ) : (
        <div className="grid gap-0 overflow-hidden rounded-lg border border-line bg-surface xl:grid-cols-[minmax(0,1fr)_420px]">
          {/* production cards */}
          <div className="p-5">
            <div className="mb-3 flex items-baseline gap-2"><h2>Scenes</h2><span className="font-mono text-[12px] text-ink-secondary">{scenes.length} total</span></div>
            <div className="grid gap-3 md:grid-cols-2">
              {scenes.map(s => (
                <Link key={s.id} href={`${base}?scene=${s.id}`} scroll={false} aria-current={sel?.id === s.id}
                  className={`block rounded-lg border bg-surface p-3.5 transition hover:border-ink/30 ${sel?.id === s.id ? 'border-ink shadow-md' : 'border-line'}`}>
                  <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5"><span className="font-mono text-[12px] text-ink-secondary">{sceneCode(s.order)}</span>{s.shortKeep && <span className="rounded-xs bg-purple-tint px-1.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-purple-deep">SHORT KEEP</span>}</span><Chip>{s.status}</Chip></div>
                  <div className="mt-2 text-[14px] font-bold uppercase leading-tight tracking-[0.02em]">{s.title}</div>
                  {s.dialogue && <div className="mt-1 truncate text-[12px] italic text-ink-secondary">“{s.dialogue.replace(/^"|"$/g, '')}”</div>}
                  <div className="mt-2.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <div className="rounded-md border border-pink-mid bg-pink-tint/50 p-2"><div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-pink-deep">BEFORE</div><div className="line-clamp-2 text-[12px] leading-tight">{s.foodBefore || '—'}</div></div>
                    <span className="text-ink-muted">→</span>
                    <div className="rounded-md border border-blue-mid bg-blue-tint/60 p-2"><div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-blue-deep">AFTER</div><div className="line-clamp-2 text-[12px] leading-tight">{s.foodAfter || '—'}</div></div>
                  </div>
                  <div className="mt-2 truncate font-mono text-[11px] text-ink-secondary">{SHOT_SHORT[s.shotPriority] ?? s.shotPriority}{s.cameraAngle ? ` · ${s.cameraAngle}` : ''}{s.images.length ? ' · ' + s.images.map(i => imageCode(i.seq)).join(' · ') : ''}</div>
                </Link>
              ))}
            </div>
          </div>

          {/* scene panel */}
          {sel && (
            <aside className="border-t border-line bg-surface p-5 xl:border-l xl:border-t-0">
              <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><span className="font-mono text-[14px]">{sceneCode(sel.order)}</span><Chip>{sel.status}</Chip></span>
                <span className="flex gap-1"><form action={moveScene}><input type="hidden" name="id" value={sel.id} /><input type="hidden" name="dir" value="up" /><button className="btn btn-sm px-2" aria-label="Move scene up">↑</button></form><form action={moveScene}><input type="hidden" name="id" value={sel.id} /><input type="hidden" name="dir" value="down" /><button className="btn btn-sm px-2" aria-label="Move scene down">↓</button></form></span></div>
              <h2 className="mt-2 text-[22px]">{sel.title}</h2>
              <div className="eyebrow mb-2 mt-4">FOOD PROGRESSION</div>
              <div className="relative space-y-3">
                <span className="absolute bottom-4 left-1/2 top-4 w-px bg-line-strong" aria-hidden />
                {([['BEFORE', sel.foodBefore, 'border-pink-mid bg-grad-pink text-pink-deep'], ['DURING', sel.foodDuring, 'border-purple-mid bg-grad-purple text-purple-deep'], ['AFTER', sel.foodAfter, 'border-blue-mid bg-grad-blue text-blue-deep']] as const).map(([l, t, c]) => (
                  <div key={l} className={`relative flex gap-3 rounded-lg border p-3 ${c}`}><span className="h-12 w-14 shrink-0 rounded-md bg-[repeating-linear-gradient(135deg,rgba(255,255,255,.7)_0_6px,rgba(255,255,255,.35)_6px_12px)]" aria-hidden /><div className="min-w-0"><div className="text-[10px] font-semibold uppercase tracking-[0.12em]">{l}</div><div className="text-[13px] leading-snug text-ink">{t || '—'}</div></div></div>
                ))}
              </div>
              <dl className="mt-4 divide-y divide-line">
                {kv('Narrative', sel.narrative)}{kv('Dialogue', sel.dialogue)}{kv('Cooking action', sel.mainAction)}{kv('Baby reaction', sel.babyReaction)}{kv('Camera', [sel.cameraAngle, sel.cameraMovement].filter(Boolean).join(' · '))}{kv('ASMR', sel.asmr)}{kv('Safety', [sel.adultAssist === 'YES' ? 'Adult assist' : '', sel.adultNotes, sel.safetyNotes].filter(Boolean).join(' · '), true)}
              </dl>
              <div className="eyebrow mb-2 mt-4">IMAGES IN THIS SCENE</div>
              {sel.images.length === 0 ? <p className="text-[13px] text-ink-secondary">No planned images yet.</p> : (
                <div className="grid grid-cols-3 gap-2">{sel.images.map(i => <Link key={i.id} href={`/projects/${p.slug}/images/${i.id}`}>{i.approvedAttempt ? <img src={fileUrl(i.approvedAttempt.assetId, 240)} alt={i.title} className="aspect-video w-full rounded-md border border-line object-cover" /> : <div className="aspect-video w-full rounded-md border border-pink-mid bg-[repeating-linear-gradient(135deg,#F7E3EA_0_6px,#F1D5DF_6px_12px)]" />}<div className="mt-0.5 font-mono text-[11px] text-ink-secondary">{imageCode(i.seq)}</div></Link>)}</div>
              )}
              <div className="mt-4 flex flex-col gap-2"><Link href={`/projects/${p.slug}/images?scene=${sel.id}&add=1#add`} className="btn">+ ADD IMAGE</Link><Link href={`${base}?edit=${sel.id}#editor`} className="btn btn-primary">Open full scene editor</Link></div>
            </aside>
          )}
        </div>
      )}

      {editing && (
        <section id="editor" className="card scroll-mt-24"><div className="mb-3 flex items-center justify-between"><h2>Edit {sceneCode(editing.order)} · {editing.title}</h2><Link href={`${base}?scene=${editing.id}`} className="text-[13px] underline">Close editor</Link></div>
          <SceneForm projectId={p.id} s={editing} />
          <ConfirmForm action={deleteScene} message={`Delete ${sceneCode(editing.order)} "${editing.title}"? Scenes with images cannot be deleted.`} className="mt-4"><input type="hidden" name="id" value={editing.id} /><button className="btn btn-sm btn-danger">Delete scene…</button></ConfirmForm></section>
      )}
    </div>
  );
}
