import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { buildVars, render } from '@/lib/template-engine';
import { Area, Check, Chip, Empty, Section, Sel, Text, Warn, fileUrl } from '@/components/ui';
import { ConfirmForm, CopyButton, DirtyForm, SubmitBtn } from '@/components/client';
import { addShortItem, collectShortKeep, deleteShortItem, moveShortItem, saveShort, saveShortItem } from '@/lib/actions/short';
import { VERTICAL_OPTIONS } from '@/lib/constants';
import { imageCode, klingCode, sceneCode } from '@/lib/util';

const fmt = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
const DOT: Record<string, { c: string; l: string }> = { 'VERTICAL SAFE': { c: '#4E7A5C', l: 'Vertical safe' }, 'MAY REQUIRE REFRAMING': { c: '#C99A3A', l: 'May require reframe' }, 'NOT IDEAL FOR VERTICAL': { c: '#C8705C', l: 'Not ideal' } };
const NOTES: [string, string][] = [['mustKeepLines', 'Must-keep dialogue'], ['jumpCuts', 'Jump cuts'], ['montage', 'Montage'], ['asmrKeep', 'ASMR'], ['cropNotes', 'Crop notes'], ['onScreenText', 'On-screen text'], ['subtitles', 'Subtitles'], ['music', 'Music'], ['transitions', 'Transitions'], ['transcriptCues', 'Transcript cues'], ['editNotes', 'Editing instructions']];

export default async function ShortPage({ params }: { params: { slug: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const sv = await db.shortVersion.findUnique({ where: { projectId: p.id }, include: { items: { orderBy: { order: 'asc' }, include: { scene: { include: { images: { orderBy: { seq: 'asc' }, include: { approvedAttempt: true } } } }, kling: true } } } });
  const [scenes, clips, tpl] = await Promise.all([
    db.scene.findMany({ where: { projectId: p.id }, orderBy: { order: 'asc' } }), db.klingClip.findMany({ where: { projectId: p.id }, orderBy: { order: 'asc' } }),
    db.promptTemplate.findUnique({ where: { code: 'TPL-CAPCUT' } }),
  ]);
  const items = sv?.items ?? [];
  const total = items.reduce((a, i) => a + i.seconds, 0);
  const target = sv?.targetSeconds ?? 55;
  const delta = total - target;
  const vars = await buildVars(p.id);
  const capcut = tpl ? render(tpl.text, vars).out : '';
  const keepCount = scenes.filter(s => s.shortKeep).length;
  const pct = Math.min(100, (total / Math.max(target, total, 1)) * 100), mark = Math.min(100, (target / Math.max(target, total, 1)) * 100);
  let t = 0;
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line bg-grad-purple px-5 py-4">
          <div><div className="eyebrow text-purple-deep">SHORT VERSION</div><h2 className="mt-1 text-[22px]">Mini edit plan</h2></div>
          <div className="min-w-[260px] flex-1">
            <div className="mb-1 flex items-center justify-between text-[12px]"><span>Target <b className="font-mono">{fmt(target)}</b></span><span className={delta > 0 ? 'text-[#8A6216]' : 'text-sage-deep'}>Estimate <b className="font-mono">{fmt(total)}</b> · {delta > 0 ? `+${delta}s` : delta < 0 ? `${delta}s` : 'on target'}</span></div>
            <div className="relative h-2 overflow-hidden rounded-full bg-white/70"><div className="h-full rounded-full bg-btn-blue" style={{ width: `${pct}%` }} /><span className="absolute top-0 h-full w-0.5 bg-ink" style={{ left: `${mark}%` }} aria-hidden /></div>
          </div>
          <div className="text-[12px] text-ink-secondary">{items.length} moment{items.length === 1 ? '' : 's'} selected</div>
        </div>
        {delta > 0 && <div className="px-5 pt-4"><Warn>Estimated total ({total}s) exceeds the target ({target}s). This is only a warning.</Warn></div>}
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <form action={collectShortKeep}><input type="hidden" name="projectId" value={p.id} /><SubmitBtn className="btn-primary" pendingText="…">COLLECT SHORT KEEP SCENES ({keepCount})</SubmitBtn></form>
              <details className="relative"><summary className="btn cursor-pointer list-none">+ Add moment</summary>
                <form action={addShortItem} className="absolute left-0 top-full z-20 mt-2 grid w-[320px] gap-2 rounded-lg border border-line bg-surface p-3 shadow-md"><input type="hidden" name="projectId" value={p.id} />
                  <Sel name="sceneId" label="Scene" options={[['', '— none —'], ...scenes.map(s => [s.id, `${sceneCode(s.order)} ${s.title}`] as [string, string])]} />
                  <Sel name="klingId" label="Kling clip" options={[['', '— none —'], ...clips.map(c => [c.id, `${klingCode(c.order)} ${c.title}`] as [string, string])]} />
                  <Text name="visual" label="Visual" /><Text name="seconds" label="Seconds" type="number" v={5} /><SubmitBtn className="btn-sm btn-primary">Add</SubmitBtn></form></details>
            </div>
            {items.length === 0 ? <Empty title="No short-form moments yet." hint="Mark scenes SHORT KEEP, then collect them here — or add moments manually." /> : (
              <ol className="space-y-3">
                {items.map((it, n) => {
                  const s0 = t; t += it.seconds;
                  const thumb = it.scene?.images.find(i => i.approvedAttempt)?.approvedAttempt?.assetId;
                  const tags = [it.hookImp && 'HOOK', it.foodImp && 'FOOD REVEAL', it.comedyImp && 'COMEDY', it.recipeImp && 'PROCESS'].filter(Boolean) as string[];
                  const where = [it.scene && sceneCode(it.scene.order), it.imageIds, it.kling && klingCode(it.kling.order)].filter(Boolean).join(' · ');
                  const d = DOT[it.vertical] ?? DOT['MAY REQUIRE REFRAMING'];
                  return (
                    <li key={it.id} className="rounded-lg border border-line bg-surface p-3">
                      <div className="flex items-center gap-3">
                        <span className="hidden select-none text-ink-muted sm:block" aria-hidden>⋮⋮</span>
                        <span className="w-[86px] shrink-0 font-mono text-[12px] text-purple-deep">{fmt(s0)}–{fmt(t)}</span>
                        <span className="h-14 w-12 shrink-0 overflow-hidden rounded-md bg-[repeating-linear-gradient(135deg,#EFE8FB_0_6px,#E5DBF6_6px_12px)]">{thumb && <img src={fileUrl(thumb, 160)} alt="" className="h-full w-full object-cover" />}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap gap-1">{tags.map(x => <span key={x} className="rounded-xs bg-purple-tint px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-purple-deep">{x}</span>)}</div>
                          <div className="truncate text-[14px] font-semibold">{it.visual || it.scene?.title || it.kling?.title || 'Moment'}</div>
                          {it.dialogue && <div className="truncate text-[12px] italic text-ink-secondary">“{it.dialogue}”</div>}
                          <div className="font-mono text-[11px] text-ink-muted">{where}</div>
                        </div>
                        <span className="hidden items-center gap-1.5 text-[12px] md:flex"><span className="h-1.5 w-1.5 rounded-full" style={{ background: d.c }} />{d.l}</span>
                        <div className="flex flex-col gap-1"><form action={moveShortItem}><input type="hidden" name="id" value={it.id} /><input type="hidden" name="dir" value="up" /><button className="btn btn-sm px-2" aria-label="Move up">↑</button></form><form action={moveShortItem}><input type="hidden" name="id" value={it.id} /><input type="hidden" name="dir" value="down" /><button className="btn btn-sm px-2" aria-label="Move down">↓</button></form></div>
                      </div>
                      <details className="mt-2"><summary className="cursor-pointer text-[12px] font-semibold text-ink-secondary">Edit moment</summary>
                        <DirtyForm action={saveShortItem} className="mt-2 grid gap-2 sm:grid-cols-2"><input type="hidden" name="id" value={it.id} />
                          <Sel name="sceneId" label="Related scene" v={it.sceneId} options={[['', '— none —'], ...scenes.map(s => [s.id, `${sceneCode(s.order)} ${s.title}`] as [string, string])]} />
                          <Sel name="klingId" label="Related Kling clip" v={it.klingId} options={[['', '— none —'], ...clips.map(c => [c.id, `${klingCode(c.order)} ${c.title}`] as [string, string])]} />
                          <Text name="imageIds" label="Related image(s)" v={it.imageIds} placeholder="IMG-001, IMG-002" /><Text name="seconds" label="Estimated duration (s)" type="number" v={it.seconds} />
                          <Area name="visual" label="Visual description" v={it.visual} rows={2} /><Area name="dialogue" label="Dialogue" v={it.dialogue} rows={2} />
                          <Text name="reason" label="Reason to keep" v={it.reason} /><Sel name="vertical" label="Vertical crop" v={it.vertical} options={VERTICAL_OPTIONS} />
                          <div className="flex flex-wrap gap-4 sm:col-span-2"><Check name="hookImp" label="Hook" v={it.hookImp} /><Check name="comedyImp" label="Comedy" v={it.comedyImp} /><Check name="recipeImp" label="Recipe" v={it.recipeImp} /><Check name="foodImp" label="Food transformation" v={it.foodImp} /></div>
                          <Text name="notes" label="Notes" v={it.notes} className="sm:col-span-2" /><div className="sm:col-span-2"><SubmitBtn className="btn-sm btn-primary">Save</SubmitBtn></div></DirtyForm>
                        <ConfirmForm action={deleteShortItem} message="Remove this moment from the short?" className="mt-2"><input type="hidden" name="id" value={it.id} /><button className="btn btn-sm btn-danger">Remove</button></ConfirmForm></details>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* CapCut notes */}
          <aside className="space-y-2.5 self-start rounded-lg border border-purple-mid bg-grad-purple p-4">
            <div className="eyebrow text-purple-deep">CAPCUT NOTES</div>
            {NOTES.filter(([k]) => (sv as any)?.[k]).map(([k, l]) => <div key={k} className="rounded-md bg-surface p-3"><div className="text-[12px] font-semibold">{l}</div><p className="mt-0.5 whitespace-pre-wrap text-[12px] leading-snug text-ink-secondary">{(sv as any)[k]}</p></div>)}
            {!NOTES.some(([k]) => (sv as any)?.[k]) && <p className="text-[12px] text-ink-secondary">Add editing notes below — they show up here and in the CapCut prompt.</p>}
            <CopyButton text={capcut} label="Copy CapCut editing prompt" className="mt-2 min-h-[48px] w-full" />
          </aside>
        </div>
      </section>

      <DirtyForm action={saveShort} className="space-y-5"><input type="hidden" name="projectId" value={p.id} />
        <Section title="Hook & ending">
          <div className="grid gap-3 sm:grid-cols-2">
            <Text name="targetSeconds" label="Target length (seconds)" type="number" v={target} /><Text name="hook" label="SHORT HOOK" v={sv?.hook} />
            <Area name="hookVisual" label="HOOK VISUAL" v={sv?.hookVisual} rows={2} /><Area name="hookDialogue" label="HOOK DIALOGUE" v={sv?.hookDialogue} rows={2} />
            <Area name="endVisual" label="SHORT ENDING VISUAL" v={sv?.endVisual} rows={2} /><Area name="endDialogue" label="SHORT ENDING DIALOGUE" v={sv?.endDialogue} rows={2} />
            <Text name="cta" label="CALL TO ACTION" v={sv?.cta} className="sm:col-span-2" />
          </div></Section>
        <Section title="CapCut / editing notes">
          <div className="grid gap-3 sm:grid-cols-2">{NOTES.map(([k, l]) => <Area key={k} name={k} label={l} v={(sv as any)?.[k]} rows={3} />)}</div></Section>
        <SubmitBtn>SAVE SHORT VERSION</SubmitBtn>
      </DirtyForm>
      <Section title="CapCut editing prompt (copy into CapCut AI or an editing assistant)">
        <p className="mb-2 text-xs text-ink-secondary">Built from the “CapCut Editing Prompt” template and the timeline above. Save the form first so notes are included.</p>
        <pre className="mono max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-sunken p-3">{capcut}</pre>
        <div className="mt-2"><CopyButton text={capcut} label="COPY CAPCUT EDITING PROMPT" /></div>
      </Section>
    </div>
  );
}
void imageCode; void Chip;
