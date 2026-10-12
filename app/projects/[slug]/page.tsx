import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getProjectBySlug, projectStats } from '@/lib/queries';
import { DirtyForm, SubmitBtn, ConfirmForm } from '@/components/client';
import { Area, Check, ProgressBar, Section, Sel, Stat, Text } from '@/components/ui';
import { updateProject, archiveProject } from '@/lib/actions/project';
import { PROJECT_STATUSES } from '@/lib/constants';

export default async function Overview({ params }: { params: { slug: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const [s, chefs, script] = await Promise.all([
    projectStats(p.id), db.babyChef.findMany({ where: { deletedAt: null }, orderBy: { displayName: 'asc' } }),
    db.scriptVersion.findFirst({ where: { projectId: p.id, isCurrent: true } }),
  ]);
  const b = `/projects/${p.slug}`;
  return (
    <div className="space-y-5">
      <Section title="Production summary">
        <div className="mb-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          <div><span className="label">Recipe</span>{p.recipeName || '—'}</div><div><span className="label">Cuisine</span>{p.cuisine || '—'}</div>
          <div><span className="label">Aspect</span>{p.aspectRatio}{p.verticalCrop ? ' + vertical crop' : ''}</div><div><span className="label">Targets</span>Long {p.longDuration || '—'} · Short {p.shortDuration || '—'}</div>
        </div>
        <ProgressBar pct={s.progress} />
        <div className="mt-1 text-xs text-neutral-500">{s.approved} of {s.images} images approved ({s.progress}%)</div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <Stat label="Script" value={script ? `v${script.version}` : '—'} href={`${b}/script`} />
          <Stat label={`Scenes (${s.scenesComplete} done)`} value={s.scenes} href={`${b}/scenes`} />
          <Stat label="Planned images" value={s.planned} href={`${b}/images?status=PLANNED`} />
          <Stat label="Ready" value={s.ready} href={`${b}/images?status=READY`} />
          <Stat label="Waiting" value={s.waiting} href={`${b}/images?status=WAITING`} />
          <Stat label="Review" value={s.review} href={`${b}/images?status=REVIEW`} />
          <Stat label="Approved" value={s.approved} href={`${b}/images?status=APPROVED`} tone="text-green-800" />
          <Stat label="Redo" value={s.redo} href={`${b}/images?status=REDO`} tone="text-orange-800" />
          <Stat label="Kling clips" value={s.clips} href={`${b}/kling`} />
          <Stat label="Kling ready" value={s.clipsReady} href={`${b}/kling`} />
          <Stat label="Kling approved" value={s.clipsApproved} href={`${b}/kling`} />
          <Stat label="Short moments" value={s.shortItems} href={`${b}/short`} />
          <Stat label="Publishing items" value={`${s.publishingSelected}/${s.publishing}`} href={`${b}/publishing`} />
        </div>
      </Section>
      <Section title="Project settings">
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
        <a className="btn" href={`/api/projects/${p.slug}/export?format=zip`}>EXPORT PROJECT (ZIP)</a>
        <a className="btn" href={`/api/projects/${p.slug}/export?format=csv&table=ingredients`}>Ingredients CSV</a>
        <a className="btn" href={`/api/projects/${p.slug}/export?format=csv&table=scenes`}>Scenes CSV</a>
        <a className="btn" href={`/api/projects/${p.slug}/export?format=csv&table=images`}>Images CSV</a>
        <ConfirmForm action={archiveProject} message={`Archive project "${p.title}"? You can find it under the ARCHIVED filter.`}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="mode" value="archive" /><button className="btn">Archive</button></ConfirmForm>
        <ConfirmForm action={archiveProject} message={`Delete project "${p.title}"? It will be hidden from the app (soft delete — data stays in the database file).`}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="mode" value="delete" /><button className="btn btn-danger">Delete…</button></ConfirmForm>
      </div>
    </div>
  );
}
