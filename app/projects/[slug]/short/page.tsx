import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { buildVars, render } from '@/lib/template-engine';
import { Area, Check, Chip, Empty, Section, Sel, Text, Warn } from '@/components/ui';
import { ConfirmForm, CopyButton, DirtyForm, SubmitBtn } from '@/components/client';
import { addShortItem, collectShortKeep, deleteShortItem, moveShortItem, saveShort, saveShortItem } from '@/lib/actions/short';
import { VERTICAL_OPTIONS } from '@/lib/constants';
import { imageCode, klingCode, sceneCode } from '@/lib/util';

const fmt = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;

export default async function ShortPage({ params }: { params: { slug: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const sv = await db.shortVersion.findUnique({ where: { projectId: p.id }, include: { items: { orderBy: { order: 'asc' }, include: { scene: true, kling: true } } } });
  const [scenes, clips, tpl] = await Promise.all([
    db.scene.findMany({ where: { projectId: p.id }, orderBy: { order: 'asc' } }), db.klingClip.findMany({ where: { projectId: p.id }, orderBy: { order: 'asc' } }),
    db.promptTemplate.findUnique({ where: { code: 'TPL-CAPCUT' } }),
  ]);
  const items = sv?.items ?? [];
  const total = items.reduce((a, i) => a + i.seconds, 0);
  const target = sv?.targetSeconds ?? 55;
  let t = 0;
  const vars = await buildVars(p.id);
  const capcut = tpl ? render(tpl.text, vars).out : '';
  const keepCount = scenes.filter(s => s.shortKeep).length;
  return (
    <div className="space-y-5">
      <Section title="Short version plan" right={<span className="text-sm">Target ~{target}s · <b>TOTAL ESTIMATED SHORT LENGTH {fmt(total)}</b></span>}>
        {total > target && <div className="mb-3"><Warn>Estimated total ({total}s) exceeds the target ({target}s).</Warn></div>}
        <div className="flex flex-wrap gap-2">
          <form action={collectShortKeep}><input type="hidden" name="projectId" value={p.id} /><SubmitBtn className="btn-primary" pendingText="…">COLLECT SHORT KEEP SCENES ({keepCount})</SubmitBtn></form>
        </div>
        {items.length === 0 ? <div className="mt-3"><Empty title="No short-form moments yet." hint="Mark scenes SHORT KEEP, then collect them here — or add moments manually below." /></div> : (
          <div className="mt-4 space-y-3">{items.map((it, n) => {
            const s0 = t; t += it.seconds;
            return (
              <div key={it.id} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-center gap-2"><span className="font-mono font-bold">{n + 1}.</span><span className="text-sm font-semibold">{fmt(s0)}–{fmt(t)}</span>
                  <span className="text-sm">{it.scene ? `${sceneCode(it.scene.order)} ${it.scene.title}` : it.kling ? `${klingCode(it.kling.order)} ${it.kling.title}` : 'Custom moment'}</span>
                  <Chip tone={it.vertical === 'VERTICAL SAFE' ? 'APPROVED' : it.vertical === 'NOT IDEAL FOR VERTICAL' ? 'REDO' : 'WAITING'}>{it.vertical}</Chip>
                  <div className="ml-auto flex gap-1"><form action={moveShortItem}><input type="hidden" name="id" value={it.id} /><input type="hidden" name="dir" value="up" /><button className="btn btn-sm" aria-label="Move up">↑</button></form><form action={moveShortItem}><input type="hidden" name="id" value={it.id} /><input type="hidden" name="dir" value="down" /><button className="btn btn-sm" aria-label="Move down">↓</button></form></div></div>
                {it.visual && <p className="mt-1 text-sm">{it.visual}</p>}{it.dialogue && <p className="text-sm italic">“{it.dialogue}”</p>}
                <details className="mt-2"><summary className="cursor-pointer text-xs font-semibold">Edit moment</summary>
                  <DirtyForm action={saveShortItem} className="mt-2 grid gap-2 sm:grid-cols-2"><input type="hidden" name="id" value={it.id} />
                    <Sel name="sceneId" label="Related scene" v={it.sceneId} options={[['', '— none —'], ...scenes.map(s => [s.id, `${sceneCode(s.order)} ${s.title}`] as [string, string])]} />
                    <Sel name="klingId" label="Related Kling clip" v={it.klingId} options={[['', '— none —'], ...clips.map(c => [c.id, `${klingCode(c.order)} ${c.title}`] as [string, string])]} />
                    <Text name="imageIds" label="Related image(s)" v={it.imageIds} placeholder="IMG-001, IMG-002" /><Text name="seconds" label="Estimated duration (s)" type="number" v={it.seconds} />
                    <Area name="visual" label="Visual description" v={it.visual} rows={2} /><Area name="dialogue" label="Dialogue" v={it.dialogue} rows={2} />
                    <Text name="reason" label="Reason to keep" v={it.reason} /><Sel name="vertical" label="Vertical crop" v={it.vertical} options={VERTICAL_OPTIONS} />
                    <div className="flex flex-wrap gap-4 sm:col-span-2"><Check name="hookImp" label="Hook" v={it.hookImp} /><Check name="comedyImp" label="Comedy" v={it.comedyImp} /><Check name="recipeImp" label="Recipe" v={it.recipeImp} /><Check name="foodImp" label="Food transformation" v={it.foodImp} /></div>
                    <Text name="notes" label="Notes" v={it.notes} className="sm:col-span-2" /><div className="flex gap-2 sm:col-span-2"><SubmitBtn className="btn-sm btn-primary">Save</SubmitBtn></div></DirtyForm>
                  <ConfirmForm action={deleteShortItem} message="Remove this moment from the short?" className="mt-2"><input type="hidden" name="id" value={it.id} /><button className="btn btn-sm btn-danger">Remove</button></ConfirmForm></details>
              </div>);
          })}</div>
        )}
        <details className="mt-4 rounded-lg border border-line p-3"><summary className="cursor-pointer text-sm font-semibold">+ Add moment manually</summary>
          <form action={addShortItem} className="mt-2 grid gap-2 sm:grid-cols-2"><input type="hidden" name="projectId" value={p.id} />
            <Sel name="sceneId" label="Scene" options={[['', '— none —'], ...scenes.map(s => [s.id, `${sceneCode(s.order)} ${s.title}`] as [string, string])]} />
            <Sel name="klingId" label="Kling clip" options={[['', '— none —'], ...clips.map(c => [c.id, `${klingCode(c.order)} ${c.title}`] as [string, string])]} />
            <Text name="visual" label="Visual" /><Text name="seconds" label="Seconds" type="number" v={5} /><div><SubmitBtn className="btn-sm btn-primary">Add</SubmitBtn></div></form></details>
      </Section>

      <DirtyForm action={saveShort} className="space-y-5"><input type="hidden" name="projectId" value={p.id} />
        <Section title="Hook & ending">
          <div className="grid gap-3 sm:grid-cols-2">
            <Text name="targetSeconds" label="Target length (seconds)" type="number" v={target} /><Text name="hook" label="SHORT HOOK" v={sv?.hook} />
            <Area name="hookVisual" label="HOOK VISUAL" v={sv?.hookVisual} rows={2} /><Area name="hookDialogue" label="HOOK DIALOGUE" v={sv?.hookDialogue} rows={2} />
            <Area name="endVisual" label="SHORT ENDING VISUAL" v={sv?.endVisual} rows={2} /><Area name="endDialogue" label="SHORT ENDING DIALOGUE" v={sv?.endDialogue} rows={2} />
            <Text name="cta" label="CALL TO ACTION" v={sv?.cta} className="sm:col-span-2" />
          </div></Section>
        <Section title="CapCut / editing notes">
          <div className="grid gap-3 sm:grid-cols-2">
            {([['editNotes', 'Editing instructions'], ['transcriptCues', 'Transcript cues'], ['mustKeepLines', 'Lines that must remain'], ['jumpCuts', 'Suggested jump cuts'], ['montage', 'Suggested montage points'], ['asmrKeep', 'ASMR moments to preserve'], ['music', 'Music notes'], ['cropNotes', 'Crop notes'], ['onScreenText', 'On-screen text ideas'], ['transitions', 'Transition notes'], ['subtitles', 'Subtitle notes']] as [string, string][]).map(([k, l]) => <Area key={k} name={k} label={l} v={(sv as any)?.[k]} rows={3} />)}
          </div></Section>
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
void imageCode;
