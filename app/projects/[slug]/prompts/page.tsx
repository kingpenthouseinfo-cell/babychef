import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { buildVars, render } from '@/lib/template-engine';
import { Chip, Empty, Section, Text } from '@/components/ui';
import { CopyButton, ConfirmForm, SubmitBtn } from '@/components/client';
import { LivePromptForm } from '@/components/prompt-form';
import { deleteProjectPrompt } from '@/lib/actions/prompts';
import { TEMPLATE_CATEGORIES } from '@/lib/constants';
import { imageCode, klingCode, sceneCode } from '@/lib/util';

export default async function Prompts({ params, searchParams }: { params: { slug: string }; searchParams: { cat?: string; tpl?: string; scene?: string; image?: string; kling?: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const [templates, scenes, images, clips, saved] = await Promise.all([
    db.promptTemplate.findMany({ where: { active: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
    db.scene.findMany({ where: { projectId: p.id }, orderBy: { order: 'asc' } }), db.plannedImage.findMany({ where: { projectId: p.id }, orderBy: { seq: 'asc' } }),
    db.klingClip.findMany({ where: { projectId: p.id }, orderBy: { order: 'asc' } }), db.projectPrompt.findMany({ where: { projectId: p.id }, orderBy: { createdAt: 'desc' } }),
  ]);
  const cat = searchParams.cat || 'SCRIPT';
  const inCat = templates.filter(t => t.category === cat);
  const tpl = templates.find(t => t.id === searchParams.tpl) ?? inCat.find(t => t.isDefault) ?? inCat[0];
  const img = images.find(i => i.id === searchParams.image);
  const kl = clips.find(k => k.id === searchParams.kling);
  const sc = scenes.find(s => s.id === searchParams.scene) ?? (img ? scenes.find(s => s.id === img.sceneId) : undefined);
  const vars = await buildVars(p.id, { sceneId: sc?.id, imageId: img?.id, klingId: kl?.id });
  const { out, missing } = tpl ? render(tpl.text, vars) : { out: '', missing: [] as string[] };
  const used = tpl ? [...new Set([...tpl.text.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)].map(m => m[1]))] : [];
  const base = `/projects/${p.slug}/prompts`;
  const qs = (o: Record<string, string>) => `${base}?${new URLSearchParams({ ...(sc ? { scene: sc.id } : {}), ...(img ? { image: img.id } : {}), ...(kl ? { kling: kl.id } : {}), ...o }).toString()}`;
  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-sunken p-3 text-sm">These tools only <b>prepare text</b> from your stored project data. Copy it into ChatGPT/Claude yourself — Baby Chef Studio never calls an AI service.</div>
      <div className="flex flex-wrap gap-1.5">{TEMPLATE_CATEGORIES.map(c => <Link key={c} href={qs({ cat: c })} className={`btn btn-sm ${c === cat ? 'btn-primary' : ''}`}>{c}</Link>)}</div>
      {inCat.length === 0 ? <Empty title="No templates in this category." hint="Create one under Prompt Templates."><Link href="/templates" className="btn">Open templates</Link></Empty> : (
        <>
          <form className="grid gap-3 sm:grid-cols-4" method="get"><input type="hidden" name="cat" value={cat} />
            <label className="block"><span className="label">Template</span><select name="tpl" defaultValue={tpl?.id} className="input">{inCat.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <label className="block"><span className="label">Scene</span><select name="scene" defaultValue={sc?.id || ''} className="input"><option value="">—</option>{scenes.map(s => <option key={s.id} value={s.id}>{sceneCode(s.order)} {s.title}</option>)}</select></label>
            <label className="block"><span className="label">Picture</span><select name="image" defaultValue={img?.id || ''} className="input"><option value="">—</option>{images.map(i => <option key={i.id} value={i.id}>{imageCode(i.seq)} {i.title}</option>)}</select></label>
            <label className="block"><span className="label">Video clip</span><select name="kling" defaultValue={kl?.id || ''} className="input"><option value="">—</option>{clips.map(k => <option key={k.id} value={k.id}>{klingCode(k.order)} {k.title}</option>)}</select></label>
            <div><button className="btn btn-primary">PREPARE PROMPT</button></div></form>
          {tpl && (
            <>
              <Section title="Template"><p className="mb-2 text-xs text-ink-secondary">{tpl.purpose}</p><pre className="mono max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-sunken p-3">{tpl.text}</pre></Section>
              <Section title="Info used">
                <div className="grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-3">{used.map(k => <div key={k} className={missing.includes(k) ? 'text-[#8A6216]' : ''}><b className="font-mono">{`{{${k}}}`}</b> {missing.includes(k) ? '— not set' : `— ${(vars[k] ?? '').slice(0, 50).replace(/\n/g, ' ')}${(vars[k] ?? '').length > 50 ? '…' : ''}`}</div>)}</div>
                {missing.length > 0 && <p className="mt-2 text-xs font-semibold text-[#8A6216]">Some variables are empty ({missing.length}). Fill them in the project or edit the prompt below.</p>}
              </Section>
              <Section title="Final assembled prompt (editable)">
                <LivePromptForm projectId={p.id} templateId={tpl.id} category={cat} initial={out} name={tpl.name} imageId={img?.id} klingId={kl?.id} />
              </Section>
            </>
          )}
        </>
      )}
      <Section title="Saved project prompts">
        {saved.length === 0 ? <p className="text-sm text-ink-secondary">None yet.</p> : saved.map(s => <details key={s.id} className="border-b border-line py-2 last:border-0"><summary className="cursor-pointer text-sm"><b>{s.name}</b> <Chip>{s.category}</Chip></summary><pre className="mono mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-sunken p-2">{s.text}</pre><div className="mt-1 flex gap-2"><CopyButton text={s.text} label="COPY" className="btn-sm" /><ConfirmForm action={deleteProjectPrompt} message="Delete this saved prompt?"><input type="hidden" name="id" value={s.id} /><button className="btn btn-sm btn-danger">Delete</button></ConfirmForm></div></details>)}
      </Section>
    </div>
  );
}
void Text; void SubmitBtn;
