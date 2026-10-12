import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getProjectBySlug, projectStats } from '@/lib/queries';
import { Chip } from '@/components/ui';
import { DirtyForm, SubmitBtn, ConfirmForm } from '@/components/client';
import { Area, Check, ProgressBar, Section, Sel, Stat, Text } from '@/components/ui';
import { updateProject, archiveProject } from '@/lib/actions/project';
import { PROJECT_STATUSES } from '@/lib/constants';
import { nextStep } from '@/lib/next-step';

export default async function Overview({ params }: { params: { slug: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const [s, chefs, script] = await Promise.all([
    projectStats(p.id), db.babyChef.findMany({ where: { deletedAt: null }, orderBy: { displayName: 'asc' } }),
    db.scriptVersion.findFirst({ where: { projectId: p.id, isCurrent: true } })
  ]);
  const ns = await nextStep(p.id, p.slug);
  const toneBtn = { pink: 'btn-accent', blue: 'btn-copy', sage: 'btn-approve', purple: 'btn-primary', amber: 'btn-primary' } as const;
  const b = `/projects/${p.slug}`;
  return (
    <div className="space-y-5">
      <section className="rounded-xl border-2 border-ink bg-white p-5 md:p-6" aria-label="What do I do next?">
        <div className="eyebrow text-ink-secondary">WHAT DO I DO NEXT?</div>
        {ns.next ? (<>
          <h2 className="mt-1 text-[22px] font-semibold leading-tight md:text-[26px]">{ns.next.title}</h2>
          {ns.next.body && <p className="mt-1 text-[14px] text-ink-secondary">{ns.next.body}</p>}
          <div className="mt-4 flex flex-wrap gap-2"><Link href={ns.next.href} className={`btn ${toneBtn[ns.next.tone]} min-h-[48px] px-6 text-[15px]`}>{ns.next.cta}</Link><Link href={ns.next.href} className="btn min-h-[48px] px-5">CONTINUE WHERE I LEFT OFF</Link></div>
        </>) : (<><h2 className="mt-1 text-[22px] font-semibold">Nothing needs you right now.</h2><p className="mt-1 text-[14px] text-ink-secondary">Everything for this recipe video is done or waiting.</p></>)}
      </section>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-3">
        {([['NEEDS FIXING', ns.fixing, 'text-[#A8513F]'], ['WAITING', ns.waiting, 'text-[#8A6216]'], ['STILL TO DO', ns.todo, 'text-blue-deep']] as const).map(([h, list, c]) => list.length > 0 && (
          <section key={h} className="card"><div className={`eyebrow ${c}`}>{h}</div><ul className="mt-2 space-y-1.5 text-[13px]">{list.slice(0, 6).map((t, i) => <li key={i}><Link href={t.href} className="underline-offset-2 hover:underline">{t.text}</Link></li>)}{list.length > 6 && <li className="text-ink-muted">+ {list.length - 6} more</li>}</ul></section>
        ))}
        {ns.done.length > 0 && <section className="card"><div className="eyebrow text-sage-deep">DONE</div><ul className="mt-2 space-y-1.5 text-[13px]">{ns.done.map((t, i) => <li key={i}>✓ {t}</li>)}</ul></section>}
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-ink bg-white p-3"><div className="min-w-0 flex-1 text-sm"><b>Let ChatGPT plan it</b> — your style rules + Baby Chef + recipe in one copy-ready prompt.</div><Link href={`/projects/${p.slug}/builder?type=plan`} className="btn btn-primary">MAKE THE PLAN PROMPT</Link><Link href={`/projects/${p.slug}/overrides`} className="btn">Special rules for this video</Link></div>
      <Section title="More details">
        <div className="mb-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          <div><span className="label">Recipe</span>{p.recipeName || '—'}</div><div><span className="label">Cuisine</span>{p.cuisine || '—'}</div>
          <div><span className="label">Aspect</span>{p.aspectRatio}{p.verticalCrop ? ' + vertical crop' : ''}</div><div><span className="label">Targets</span>Long {p.longDuration || '—'} · Short {p.shortDuration || '—'}</div>
        </div>
        <ProgressBar pct={s.progress} />
        <div className="mt-1 text-xs text-ink-secondary">{s.approved} of {s.images} images approved ({s.progress}%)</div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <Stat label="Script" value={script ? `v${script.version}` : '—'} href={`${b}/script`} />
          <Stat label={`Scenes (${s.scenesComplete} done)`} value={s.scenes} href={`${b}/scenes`} />
          <Stat label="Pictures" value={s.planned} href={`${b}/images?status=PLANNED`} />
          <Stat label="Ready" value={s.ready} href={`${b}/images?status=READY`} />
          <Stat label="Waiting" value={s.waiting} href={`${b}/images?status=WAITING`} />
          <Stat label="Check this" value={s.review} href={`${b}/images?status=REVIEW`} />
          <Stat label="Looks good" value={s.approved} href={`${b}/images?status=APPROVED`} tone="text-[#3B6448]" />
          <Stat label="Needs fixing" value={s.redo} href={`${b}/images?status=REDO`} tone="text-[#A8513F]" />
          <Stat label="Video clips" value={s.clips} href={`${b}/kling`} />
          <Stat label="Video ready" value={s.clipsReady} href={`${b}/kling`} />
          <Stat label="Video looks good" value={s.clipsApproved} href={`${b}/kling`} />
          <Stat label="Short moments" value={s.shortItems} href={`${b}/short`} />
          <Stat label="Post items" value={`${s.publishingSelected}/${s.publishing}`} href={`${b}/publishing`} />
        </div>
      </Section>
      <Section title="Recipe video settings">
        <DirtyForm action={updateProject} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={p.id} /><input type="hidden" name="_vc" value="1" />
          <Text name="title" label="Project title" v={p.title} required />
          <Text name="slug" label="Slug" v={p.slug} hint="Used in URLs and file names" />
          <Text name="recipeName" label="Recipe name" v={p.recipeName} />
          <Text name="cuisine" label="Cuisine" v={p.cuisine} />
          <Sel name="babyChefId" label="Baby Chef" v={p.babyChefId} options={[['', '— none —'], ...chefs.map(c => [c.id, c.displayName] as [string, string])]} />
          <Sel name="status" label="Status" v={p.status} options={PROJECT_STATUSES} />
          <Text name="longDuration" label="Long-form target" v={p.longDuration} />
          <Text name="shortDuration" label="Short-form target" v={p.shortDuration} />
          <Text name="aspectRatio" label="Primary aspect ratio" v={p.aspectRatio} />
          <div className="flex items-end"><Check name="verticalCrop" label="Vertical crop required" v={p.verticalCrop} /></div>
          <Area name="description" label="Description" v={p.description} className="sm:col-span-2" />
          <Area name="mainHook" label="Main video hook" v={p.mainHook} hint="e.g. Baby breaks open a finished patty, revealing steam, then says LOOK PON DAT!" />
          <Area name="finishedFood" label="Finished food description" v={p.finishedFood} />
          <Text name="longHook" label="Long-form hook (if different)" v={p.longHook} />
          <Text name="shortHook" label="Short-form hook (if different)" v={p.shortHook} />
          <Sel name="ctaPreference" label="CTA preference" v={p.ctaPreference} options={['Minimal', 'Funny character-based', 'No CTA', 'Custom']} />
          <Text name="ctaCustom" label="Custom CTA text" v={p.ctaCustom} />
          <div className="sm:col-span-2"><SubmitBtn>SAVE</SubmitBtn></div>
        </DirtyForm>
      </Section>
      <div className="flex flex-wrap gap-2 text-sm">
        <a className="btn" href={`/api/projects/${p.slug}/export?format=json`}>Export JSON</a>
        <a className="btn" href={`/api/projects/${p.slug}/export?format=zip`}>SAVE EVERYTHING AS ZIP</a>
        <a className="btn" href={`/api/projects/${p.slug}/export?format=csv&table=ingredients`}>Ingredients CSV</a>
        <a className="btn" href={`/api/projects/${p.slug}/export?format=csv&table=scenes`}>Scenes CSV</a>
        <a className="btn" href={`/api/projects/${p.slug}/export?format=csv&table=images`}>Images CSV</a>
        <ConfirmForm action={archiveProject} message={`Put "${p.title}" away? You can find it again under the Archived filter.`}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="mode" value="archive" /><button className="btn">Put away</button></ConfirmForm>
        <ConfirmForm action={archiveProject} message={`Delete "${p.title}"? It disappears from the app. The pictures and files already saved in its folder on your computer are not touched.`}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="mode" value="delete" /><button className="btn btn-danger">Delete this recipe video</button></ConfirmForm>
      </div>
    </div>
  );
}
