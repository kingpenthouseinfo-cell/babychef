import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { getSettings } from '@/lib/settings';
import { BLOCK_LABELS, BUILDERS, BuilderType, TARGETS, Target, buildPrompt } from '@/lib/prompt-builder';
import { BuilderEditor, ContextForm } from '@/components/builder-client';
import { Chip, Section, Warn } from '@/components/ui';
import { CopyButton, SubmitBtn, ConfirmForm } from '@/components/client';
import { applyResult, deleteSavedPrompt, saveResult } from '@/lib/actions/builder';
import { fmtDate, imageCode, klingCode, parseJson, sceneCode } from '@/lib/util';

type SP = { type?: string; image?: string; kling?: string; attempt?: string; kattempt?: string; scene?: string; target?: string; go?: string; inc?: string | string[]; bs?: string | string[]; note?: string };
const arr = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

export default async function BuilderPage({ params, searchParams }: { params: { slug: string }; searchParams: SP }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const base = `/projects/${p.slug}/builder`;
  const type = (searchParams.type && searchParams.type in BUILDERS ? searchParams.type : null) as BuilderType | null;

  if (!type) {
    const groups = ['Planning', 'Images', 'Kling'] as const;
    return (
      <div className="space-y-5">
        <div className="rounded-lg bg-ink px-4 py-3 text-sm text-white"><b>PRODUCTION BRAIN</b> — assembles your permanent production rules + Baby Chef + project context into a copy-ready prompt. You paste it into ChatGPT or Claude yourself. No AI service is called.</div>
        {groups.map(g => (
          <Section key={g} title={g}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(Object.keys(BUILDERS) as BuilderType[]).filter(k => BUILDERS[k].group === g).map(k => (
                <Link key={k} href={`${base}?type=${k}`} className="rounded-lg border border-line p-3 hover:border-ink"><div className="font-semibold">PREPARE {BUILDERS[k].label.toUpperCase()}</div><div className="mt-1 text-xs text-ink-secondary">{BUILDERS[k].help}</div></Link>
              ))}
            </div>
          </Section>
        ))}
        <p className="text-xs text-ink-secondary">Image and Kling builders can also be opened from an image page or a Kling clip page.</p>
      </div>
    );
  }

  const def = BUILDERS[type];
  const [settings, images, clips, scenes] = await Promise.all([
    getSettings(),
    db.plannedImage.findMany({ where: { projectId: p.id }, orderBy: { seq: 'asc' }, include: { attempts: { orderBy: { number: 'asc' } }, scene: true } }),
    db.klingClip.findMany({ where: { projectId: p.id }, orderBy: { order: 'asc' }, include: { attempts: { orderBy: { number: 'desc' } } } }),
    db.scene.findMany({ where: { projectId: p.id }, orderBy: { order: 'asc' } }),
  ]);
  const submitted = searchParams.go === '1';
  const inc = arr(searchParams.inc);
  const off = submitted ? def.blocks.filter(b => !inc.includes(b) && !def.required.includes(b)) : [];
  const on = submitted ? def.extra.filter(b => inc.includes(b)) : [];
  const bs = arr(searchParams.bs);
  const target = (TARGETS.includes(searchParams.target as Target) ? searchParams.target : 'CHATGPT') as Target;
  const imageId = searchParams.image || null, klingId = searchParams.kling || null;
  const res = await buildPrompt(p.id, type, { imageId, klingId, attemptId: searchParams.attempt, klingAttemptId: searchParams.kattempt, sceneId: searchParams.scene }, { target, off, on, bibleKeys: submitted && bs.length ? bs : undefined, note: searchParams.note });
  const linkLabel = imageId ? images.find(i => i.id === imageId) : null;
  const klLabel = klingId ? clips.find(k => k.id === klingId) : null;
  const label = `${def.purpose}${linkLabel ? ` ${imageCode(linkLabel.seq)}` : ''}${klLabel ? ` ${klingCode(klLabel.order)}` : ''}`;
  const sel = imageId ? images.find(i => i.id === imageId) : null;
  const saved = (await db.projectPrompt.findMany({ where: { projectId: p.id, category: def.purpose }, orderBy: { createdAt: 'desc' } })).filter(s => {
    const m = parseJson<Record<string, any>>(s.meta, {});
    return (!imageId || m.imageId === imageId) && (!klingId || m.klingId === klingId);
  });
  const applyTo: [string, string][] = type === 'image-full' ? [['image-full', 'USE RESULT AS FULL PROMPT']] : type === 'image-cont' ? [['image-cont', 'USE RESULT AS CONTINUATION PROMPT']] : type === 'image-redo' ? [['image-full', 'USE RESULT AS FULL PROMPT'], ['image-cont', 'USE RESULT AS CONTINUATION PROMPT']] : type === 'kling-final' || type === 'kling-redo' ? [['kling', 'USE RESULT AS KLING PROMPT']] : type === 'script' || type === 'script-revision' ? [['script', 'SAVE RESULT AS NEW SCRIPT VERSION']] : [];
  const metaJson = JSON.stringify(res.meta);

  return (
    <div className="space-y-4">
      <div>
        <h1>Prompt Builder</h1>
        <p className="mt-1 text-[14px] text-ink-secondary">Assembles a copy-ready text prompt for ChatGPT / Claude · no AI called · 12 builders</p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          {(['Planning', 'Images', 'Kling'] as const).map(g => (
            <div key={g} className="flex flex-wrap items-center gap-1.5"><span className="eyebrow mr-1">{g}</span>
              {(Object.keys(BUILDERS) as BuilderType[]).filter(k => BUILDERS[k].group === g).map(k => (
                <Link key={k} href={`${base}?type=${k}${BUILDERS[k].needs === 'image' || BUILDERS[k].needs === 'attempt' ? (imageId ? `&image=${imageId}` : '') : ''}${(BUILDERS[k].needs === 'kling' || BUILDERS[k].needs === 'klingAttempt') && klingId ? `&kling=${klingId}` : ''}`}
                  className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition ${k === type ? 'bg-blue-light text-blue-deep' : 'text-ink-secondary hover:bg-sunken'}`}>{BUILDERS[k].label}</Link>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg bg-ink px-4 py-2.5 text-sm text-white">No AI is called. This screen only <b>assembles text</b>. Copy it into {target === 'CLAUDE' ? 'Claude' : target === 'GENERIC AI' ? 'your AI tool' : 'ChatGPT'} yourself, then paste the answer back below.</div>
      {res.warnings.map((w, i) => <Warn key={i}>{w}</Warn>)}
      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)_280px]">
        {/* LEFT: context included */}
        <aside className="order-2 xl:order-1">
          <ContextForm>
            <input type="hidden" name="type" value={type} /><input type="hidden" name="go" value="1" />
            <Section title="Context included">
              <ul className="space-y-1.5 text-sm">
                {res.blocks.map(b => (
                  <li key={b.key}>
                    <label className="flex items-start gap-2">
                      <input type="checkbox" name="inc" value={b.key} defaultChecked={b.on || (b.required && !b.empty)} disabled={b.required} className="mt-1 h-4 w-4" />
                      <span><span className={b.on ? 'font-semibold' : 'text-ink-secondary'}>{b.on ? '✓' : b.empty ? '○' : '✗'} {b.label}</span>{b.required && <span className="ml-1 text-[10px] font-bold text-[#A8513F]">REQUIRED</span>}<span className="block text-xs text-ink-secondary">{b.detail}</span></span>
                    </label>
                    {b.required && <input type="hidden" name="inc" value={b.key} />}
                  </li>
                ))}
              </ul>
              {def.blocks.includes('bible') && (
                <details className="mt-3 rounded-lg border border-line p-2"><summary className="cursor-pointer text-xs font-semibold">Production Bible sections ({res.bibleSections.filter(s => s.included).length}/{res.bibleSections.length})</summary>
                  <div className="mt-2 space-y-1">{res.bibleSections.map(s => <label key={s.key} className="flex items-center gap-2 text-xs"><input type="checkbox" name="bs" value={s.key} defaultChecked={s.included} className="h-3.5 w-3.5" />{s.title}</label>)}</div></details>
              )}
            </Section>
            <div className="mt-4 space-y-3">
              {(def.needs === 'image' || def.needs === 'attempt') && (
                <label className="block"><span className="label">Planned image</span><select name="image" defaultValue={imageId || ''} className="input"><option value="">— choose —</option>{images.map(i => <option key={i.id} value={i.id}>{imageCode(i.seq)} {i.title}</option>)}</select></label>
              )}
              {def.needs === 'attempt' && sel && (
                <label className="block"><span className="label">Failed attempt</span><select name="attempt" defaultValue={searchParams.attempt || ''} className="input"><option value="">latest REDO / latest</option>{sel.attempts.map(a => <option key={a.id} value={a.id}>Attempt {a.number} ({a.status})</option>)}</select></label>
              )}
              {(def.needs === 'kling' || def.needs === 'klingAttempt') && (
                <label className="block"><span className="label">Kling clip</span><select name="kling" defaultValue={klingId || ''} className="input"><option value="">— choose —</option>{clips.map(k => <option key={k.id} value={k.id}>{klingCode(k.order)} {k.title}</option>)}</select></label>
              )}
              {def.needs === 'klingAttempt' && klLabel && (
                <label className="block"><span className="label">Failed generation</span><select name="kattempt" defaultValue={searchParams.kattempt || ''} className="input"><option value="">latest REDO / latest</option>{klLabel.attempts.map(a => <option key={a.id} value={a.id}>Generation {a.number} ({a.status})</option>)}</select></label>
              )}
              {type === 'image-plan' && <label className="block"><span className="label">Scene (optional)</span><select name="scene" defaultValue={searchParams.scene || ''} className="input"><option value="">all scenes</option>{scenes.map(s => <option key={s.id} value={s.id}>{sceneCode(s.order)} {s.title}</option>)}</select></label>}
              <label className="block"><span className="label">Prompt target</span><select name="target" defaultValue={target} className="input">{TARGETS.map(t => <option key={t}>{t}</option>)}</select></label>
              <label className="block"><span className="label">Special instructions (optional)</span><textarea name="note" defaultValue={searchParams.note} rows={3} className="input" placeholder="e.g. Problem: too much oil in the pan." /></label>
              <button className="btn btn-primary w-full">REBUILD FROM TEMPLATE</button>
            </div>
          </ContextForm>
        </aside>

        {/* CENTER: final prompt */}
        <div className="order-1 space-y-4 xl:order-2">
          <Section title={`${def.purpose}${linkLabel ? ` · ${imageCode(linkLabel.seq)} ${linkLabel.title} · ${sceneCode(linkLabel.scene.order)}` : ''}${klLabel ? ` · ${klingCode(klLabel.order)} ${klLabel.title}` : ''}`}>
            <BuilderEditor projectId={p.id} initial={res.text} meta={metaJson} label={label} chatgpt={settings.url_ChatGPT} claude={settings.url_Claude} />
          </Section>
        </div>

        {/* RIGHT: metadata */}
        <aside className="order-3 space-y-4">
          <Section title="Template & versions">
            <dl className="space-y-1.5 text-xs">
              <div><dt className="label">Task template</dt><dd>{res.templateName ?? '—'} <Link href="/templates" className="underline">edit</Link></dd></div>
              <div><dt className="label">Production Bible version</dt><dd>v{String(res.meta.bibleVersion)} <Link href="/settings/bible" className="underline">edit rules</Link></dd></div>
              <div><dt className="label">Recipe version</dt><dd>v{String(res.meta.recipeVersion)}</dd></div>
              <div><dt className="label">Baby Chef</dt><dd>{String(res.meta.chefName ?? '—')}{res.meta.chefUpdatedAt ? <span className="text-ink-muted"> · updated {fmtDate(String(res.meta.chefUpdatedAt))}</span> : null}</dd></div>
              <div><dt className="label">Target</dt><dd>{target}</dd></div>
              <div><dt className="label">Built</dt><dd>{fmtDate(String(res.meta.createdAt))}</dd></div>
            </dl>
          </Section>
          {(type === 'plan' || type === 'scenes') && <div className="card"><div className="eyebrow mb-1">Import scenes from text</div><p className="mb-3 text-[12px] text-ink-secondary">Available on Production Plan and Scene breakdown builders: paste the AI&apos;s scene list to create SC cards.</p><Link href={`/projects/${p.slug}/import`} className="btn btn-sm">IMPORT SCENES FROM TEXT</Link></div>}
        </aside>
      </div>

      <Section title={`Saved versions & pasted-back results (${saved.length})`}>
        {saved.length === 0 ? <p className="text-sm text-ink-secondary">Save a version to keep the exact prompt you copied, then paste the AI&apos;s answer here.</p> : saved.map(s => {
          const m = parseJson<Record<string, any>>(s.meta, {});
          return (
            <div key={s.id} className="mb-4 rounded-lg border border-line p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm"><b>{s.name}</b>{s.id === saved[0]?.id && <Chip tone="CURRENT">CURRENT</Chip>}<span className="text-xs text-ink-secondary">{fmtDate(s.createdAt)} · Bible v{m.bibleVersion} · Recipe v{m.recipeVersion} · {m.target}{m.userEdited ? ' · edited by you' : ''}</span></div>
              <div className="mt-1 text-[11px] text-ink-secondary">Context: {(m.blocks || []).map((b: string) => BLOCK_LABELS[b] || b).join(', ')}</div>
              <details className="mt-2"><summary className="cursor-pointer text-xs font-semibold">Show saved prompt</summary><pre className="mono mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-sunken p-2">{s.text}</pre><CopyButton text={s.text} label="COPY" className="btn-sm mt-1" /></details>
              <form action={saveResult} className="mt-2 space-y-2"><input type="hidden" name="id" value={s.id} />
                <label className="block"><span className="label">PASTE RESULT from ChatGPT / Claude</span><textarea name="result" defaultValue={s.result ?? ''} rows={6} className="input mono" /></label>
                <div className="flex flex-wrap gap-2"><SubmitBtn className="btn-sm" pendingText="…">SAVE RESULT</SubmitBtn>
                  {applyTo.map(([to, lab]) => <button key={to} type="submit" formAction={applyResult.bind(null, to)} className="btn btn-sm btn-accent">{lab}</button>)}
                  {s.result && <CopyButton text={s.result} label="COPY RESULT" className="btn-sm" />}
                  {(type === 'plan' || type === 'scenes') && s.result && <Link href={`/projects/${p.slug}/import?from=${s.id}`} className="btn btn-sm">IMPORT SCENES FROM RESULT</Link>}</div></form>
              <ConfirmForm action={deleteSavedPrompt} message="Delete this saved version?" className="mt-2"><input type="hidden" name="id" value={s.id} /><button className="btn btn-sm btn-danger">Delete</button></ConfirmForm>
            </div>);
        })}
      </Section>
    </div>
  );
}
