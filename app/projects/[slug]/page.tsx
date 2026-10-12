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
import { ZONE, zoneOf } from '@/lib/words';
import { fileUrl } from '@/components/ui';
import { IMAGE_ORDER, orderedPictures } from '@/lib/order';
import { projectFolder } from '@/lib/files';

export default async function Overview({ params, searchParams }: { params: { slug: string }; searchParams: { filled?: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const [s, chefs, script] = await Promise.all([
    projectStats(p.id), db.babyChef.findMany({ where: { deletedAt: null }, orderBy: { displayName: 'asc' } }),
    db.scriptVersion.findFirst({ where: { projectId: p.id, isCurrent: true } })
  ]);
  const ns = await nextStep(p.id, p.slug);
  const b = `/projects/${p.slug}`;
  const n = ns.next;
  const z = n ? zoneOf(n.href) : null, Z = z ? ZONE[z.zone] : null;
  const folder = await projectFolder(p.id);
  const [heroImg, refs, fixImgs, qs, found, unmatched] = await Promise.all([
    n?.imageId ? db.plannedImage.findUnique({ where: { id: n.imageId }, include: { scene: true } }) : null,
    n?.imageId ? db.imageRef.findMany({ where: { imageId: n.imageId }, orderBy: { order: 'asc' }, include: { reference: { include: { asset: true } }, sourceImage: { include: { approvedAttempt: true } } } }) : [],
    db.plannedImage.findMany({ where: { projectId: p.id, status: 'REDO' }, orderBy: [...IMAGE_ORDER], take: 2, include: { attempts: { orderBy: { number: 'desc' }, take: 1 } } }),
    db.projectQuestion.findMany({ where: { projectId: p.id, status: 'OPEN' }, orderBy: { createdAt: 'asc' }, take: 4 }),
    db.attempt.findMany({ where: { image: { projectId: p.id }, notes: { startsWith: 'Detected automatically' } }, orderBy: { createdAt: 'desc' }, take: 3, include: { image: { include: { scene: true } } } }),
    db.unmatchedFile.findFirst({ where: { status: 'OPEN', relPath: { startsWith: `${folder}/` } }, orderBy: { foundAt: 'desc' } }),
  ]);
  const hist = searchParams.filled ? await db.projectDoc.findUnique({ where: { projectId_key: { projectId: p.id, key: 'importHistory' } } }) : null;
  let lastImport: { created: string[]; warnings: string[] } | null = null; try { lastImport = JSON.parse(hist?.data || '{}').items?.[0] ?? null; } catch { /* none */ }
  const order = await orderedPictures(p.id);
  const numOf = (id: string) => order.find(x => x.id === id)?.n;
  const sceneNo = (sceneId: string) => 1 + order.map(x => x.sceneId).filter((v, i, a) => a.indexOf(v) === i).indexOf(sceneId);
  const usingRefs = refs.map(r => ({ asset: r.reference?.asset?.id ?? r.sourceImage?.approvedAttempt?.assetId ?? null, label: r.sourceImage ? 'Previous picture' : (r.reference?.title ?? 'Example') })).slice(0, 4);
  const nQ = ns.questions.soon + ns.questions.later;
  const tile = (label: string, value: React.ReactNode, bg: string, bd: string, bar?: number) => (
    <div className="rounded-2xl border p-4" style={{ background: bg, borderColor: bd }}><div className="text-[13px] text-ink-secondary">{label}</div><div className="mt-1 font-serif text-[30px] leading-none">{value}</div>{bar !== undefined && <div className="mt-3 h-[4px] overflow-hidden rounded-full bg-white/70"><div className="h-full rounded-full bg-ink" style={{ width: `${bar}%` }} /></div>}</div>
  );
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        {lastImport && <div className="rounded-2xl border px-5 py-4 text-[14px]" style={{ background: '#EEF6EE', borderColor: '#CFE3D3' }} role="status"><b className="text-[#46704F]">✓ Filled in from your text.</b> {lastImport.created.slice(0, 6).join(' · ')}{lastImport.created.length > 6 ? ` · and ${lastImport.created.length - 6} more` : ''}{lastImport.warnings.length > 0 && <span className="mt-1 block text-[#8E6720]">{lastImport.warnings[0]}</span>}</div>}
        <section className="overflow-hidden rounded-[22px] border" style={{ background: Z?.bg ?? 'linear-gradient(135deg,#EAF4EC,#F1F7E8)', borderColor: Z?.bd ?? '#CFE3D3', boxShadow: '0 20px 40px -30px rgba(40,36,60,.5)' }} aria-label="What to do next">
          <div className={`grid ${usingRefs.length ? 'md:grid-cols-[1.15fr_1fr]' : ''}`}>
            <div className="p-6 md:p-8">
              <div className="text-[11.5px] font-bold uppercase tracking-[0.14em]" style={{ color: Z?.ink }}>WHAT TO DO NEXT</div>
              {n ? (<>
                {heroImg && <div className="mt-4 text-[14px] text-ink-secondary">Picture {numOf(heroImg.id)}</div>}
                <h2 className="mt-1 font-serif text-[34px] font-medium leading-[1.05] tracking-[-0.02em] md:text-[42px]">{heroImg ? heroImg.title : n.title}</h2>
                {heroImg ? <div className="mt-2 text-[14.5px] text-ink-secondary">Scene {sceneNo(heroImg.sceneId)} · {heroImg.scene.title}</div> : n.body && <div className="mt-2 text-[14.5px] text-ink-secondary">{n.body}</div>}
                {heroImg && <div className="mt-4"><Chip tone={heroImg.status}>{heroImg.status}</Chip></div>}
                <div className="mt-5 flex flex-wrap gap-2.5"><Link href={n.href} className={`btn ${Z!.btn} min-h-[46px] px-6 text-[15px]`}>{n.cta.charAt(0) + n.cta.slice(1).toLowerCase()}</Link>{s.ready > 0 && <Link href="/queue" className="btn min-h-[46px]">Pictures to make · {s.ready}</Link>}</div>
              </>) : (<><h2 className="mt-4 font-serif text-[34px] font-medium leading-[1.05]">Nothing needs you right now.</h2><p className="mt-2 text-[14.5px] text-ink-secondary">Everything for this recipe video is done or waiting.</p></>)}
            </div>
            {usingRefs.length > 0 && (
              <div className="border-t border-white/70 bg-white/55 p-6 md:border-l md:border-t-0">
                <div className="mb-3 flex items-center justify-between"><span className="eyebrow">USING</span><Link href={n!.href} className="rounded-full bg-[#E5EFFB] px-2.5 py-1 text-[11.5px] font-semibold text-blue-deep">Picked automatically</Link></div>
                <div className="grid grid-cols-2 gap-3">{usingRefs.map((r, i) => <div key={i}><div className="aspect-[4/3] overflow-hidden rounded-xl bg-sunken">{r.asset ? <img src={fileUrl(r.asset, 400)} alt={r.label} className="h-full w-full object-cover" /> : null}</div><div className="mt-1 text-[12.5px]"><b className="text-[#46704F]">✓</b> {r.label}</div></div>)}</div>
              </div>
            )}
          </div>
        </section>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {tile('Recipe', ns.done.includes('Recipe added') ? '✓' : '○', '#EAF4EC', '#CFE3D3')}
          {tile('Scenes', `${s.scenesComplete} / ${s.scenes}`, '#FDECF1', '#F0CDDA')}
          {tile('Pictures', `${s.approved} / ${s.images}`, '#FDECF1', '#F0CDDA', s.images ? Math.round(s.approved / s.images * 100) : 0)}
          {tile('Video Clips', `${s.clipsApproved} / ${s.clips}`, '#F1EAFB', '#DCCDEF', s.clips ? Math.round(s.clipsApproved / s.clips * 100) : 0)}
        </div>
        {(fixImgs.length > 0 || nQ > 0) && (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
            {fixImgs.length > 0 && <section className="flex flex-col rounded-[18px] border p-5" style={{ background: '#FBEEE9', borderColor: '#F0CFC6' }}>
              <div className="flex items-baseline justify-between"><span className="eyebrow text-[#A5473A]">NEEDS FIXING</span><span className="font-serif text-[20px]">{ns.fixing.length} {ns.fixing.length > 1 ? 'pictures' : 'picture'}</span></div>
              <div className="my-3 grid grid-cols-2 gap-3">{fixImgs.map(i => <div key={i.id}><div className="aspect-[4/3] overflow-hidden rounded-xl border-2 border-[#E9A99B] bg-sunken">{i.attempts[0] && <img src={fileUrl(i.attempts[0].assetId, 400)} alt={i.title} className="h-full w-full object-cover" />}</div><div className="mt-1 text-[12.5px]">Picture {numOf(i.id)} · {i.title}</div></div>)}</div>
              <Link href={`${b}/images/${fixImgs[0].id}`} className="btn mt-auto w-full">View</Link></section>}
            {nQ > 0 && <section className="flex flex-col rounded-[18px] border p-5" style={{ background: '#EEF6EE', borderColor: '#CFE3D3' }}>
              <div className="flex items-baseline justify-between"><span className="eyebrow text-[#4C6B52]">MISSING INFO</span><span className="font-serif text-[20px]">{nQ} {nQ > 1 ? 'questions' : 'question'}</span></div>
              <ul className="my-3 space-y-2 text-[14px]">{qs.map(q => <li key={q.id}>{q.question}</li>)}</ul>
              <Link href={`${b}/questions`} className="btn mt-auto w-full">Answer</Link></section>}
          </div>
        )}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
          <section className="card"><span className="eyebrow">STILL TO DO</span><ul className="mt-2 divide-y divide-line">{ns.todo.length === 0 && <li className="py-3 text-[14px] text-ink-secondary">Nothing left.</li>}{ns.todo.map((t, i) => <li key={i}><Link href={t.href} className="flex items-center justify-between py-3 text-[14px]">{t.text}<span className="text-ink-muted">›</span></Link></li>)}</ul></section>
          <section className="card"><span className="eyebrow">DONE</span><ul className="mt-2 divide-y divide-line">{ns.done.length === 0 && <li className="py-3 text-[14px] text-ink-secondary">Nothing finished yet.</li>}{ns.done.map((t, i) => <li key={i} className="py-3 text-[14px]"><span className="mr-2 text-[#46704F]">✓</span>{t}</li>)}</ul></section>
        </div>
        <details className="card"><summary className="cursor-pointer text-[14px] font-semibold">More details, settings and exports</summary><div className="mt-4 space-y-5">
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

        </div></details>
      </div>
      <aside className="space-y-4">
        <section className="card"><div className="flex items-center gap-2 text-[15px] font-semibold"><span className="h-[7px] w-[7px] rounded-full bg-[#6E9A76]" />Watching folder</div>
          <div className="mt-2 break-words text-[13px] text-ink-secondary">{folder} / 02 Images<br />New pictures attach to the right scene by file name.</div>
          {found.length > 0 && <><div className="eyebrow mt-4 border-t border-line pt-3">RECENTLY FOUND</div><ul className="mt-2 space-y-3">{found.map(f => <li key={f.id}><Link href={`${b}/images/${f.imageId}`} className="flex items-center gap-3"><img src={fileUrl(f.assetId, 120)} alt="" className="h-9 w-9 rounded-lg object-cover" /><span className="min-w-0 text-[13px]"><b className="block truncate font-semibold">Picture {numOf(f.imageId)} · {f.image.title}</b><span className="text-ink-secondary">Found {f.createdAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · Scene {sceneNo(f.image.sceneId)}</span></span></Link></li>)}</ul></>}
        </section>
        {unmatched && <section className="rounded-[18px] border border-dashed p-5" style={{ background: '#FBF1EA', borderColor: '#E8C5B2' }}><div className="font-semibold text-[#A5473A]">Unmatched file</div><div className="mt-1 break-all font-mono text-[12.5px]">{unmatched.name}</div><div className="mt-1 text-[13px] text-ink-secondary">{unmatched.reason}</div><Link href="/unmatched" className="btn btn-sm mt-3">Assign it</Link></section>}
      </aside>
    </div>
  );
}
