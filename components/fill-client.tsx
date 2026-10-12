'use client';
import { useMemo, useState, useTransition } from 'react';
import { CopyButton } from './client';
import { parseImport, IMPORT_TEMPLATE, IMPORT_PROMPT } from '@/lib/quick-import';
import { applyImport, type Choice } from '@/lib/actions/quick-import';

const NAMES: Record<string, string> = { title: 'Name', recipeName: 'Recipe name', cuisine: 'Cuisine', description: 'Description', mainHook: 'Hook', finishedFood: 'Finished food', recipeYield: 'Yield', prepTime: 'Prep time', cookTime: 'Cook time', longDuration: 'Long video length', shortDuration: 'Short/Reel length', recipeSource: 'Recipe source', ctaCustom: 'Ending line' };

export type FillProps = { slug: string | null; current: Record<string, string>; ingredientNames: string[]; sceneTitles: string[]; chefs: { id: string; name: string }[]; history: { at: string; created: string[]; skipped: string[]; warnings: string[] }[] };

/** FILL FROM TEXT — paste, check it, then fill in the form. Nothing is saved until FILL IN FORM. */
export function FillFromText({ slug, current, ingredientNames, sceneTitles, chefs, history }: FillProps) {
  const [text, setText] = useState('');
  const [checked, setChecked] = useState(false);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [chef, setChef] = useState<string | null>(null);
  const [showLast, setShowLast] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const parsed = useMemo(() => (checked ? parseImport(text) : null), [checked, text]);
  const chefMatch = parsed?.babyChef ? chefs.find(c => c.name.toLowerCase() === parsed.babyChef!.toLowerCase()) ?? chefs.find(c => c.name.toLowerCase().includes(parsed.babyChef!.toLowerCase()) || parsed.babyChef!.toLowerCase().includes(c.name.toLowerCase())) : undefined;
  const chefValue = chef ?? chefMatch?.id ?? (parsed?.babyChef ? 'NEW' : '');
  const conflicts = parsed ? Object.entries(parsed.fields).filter(([k, v]) => k !== 'title' && v && current[k]?.trim() && current[k].trim() !== v.trim()) : [];
  const recipeText = parsed ? [parsed.recipe, parsed.method ? `METHOD:\n${parsed.method}` : ''].filter(Boolean).join('\n\n') : '';
  const recipeConflict = !!recipeText && !!current.recipeOriginal?.trim() && current.recipeOriginal.trim() !== recipeText.trim();
  const setC = (k: string, v: Choice) => setChoices(c => ({ ...c, [k]: v }));
  const Pick = ({ k }: { k: string }) => (
    <span className="flex gap-1" role="radiogroup" aria-label={`What to do with ${k}`}>{(['KEEP', 'REPLACE', 'MERGE'] as Choice[]).map(c => <button key={c} type="button" onClick={() => setC(k, c)} aria-pressed={(choices[k] ?? 'KEEP') === c} className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${(choices[k] ?? 'KEEP') === c ? 'border-ink bg-ink text-white' : 'border-line text-ink-secondary'}`}>{c}</button>)}</span>
  );
  const dupIng = parsed?.ingredients.filter(i => ingredientNames.includes(i.name.toLowerCase())).length ?? 0;
  const nImg = parsed ? parsed.scenes.reduce((a, s) => a + s.images.length, 0) + parsed.strayImages.length : 0;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton text={IMPORT_TEMPLATE} label="COPY IMPORT TEMPLATE" variant="secondary" />
        <CopyButton text={IMPORT_PROMPT} label="COPY PROMPT FOR CHATGPT" variant="secondary" />
        {history.length > 0 && <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowLast(!showLast)}>VIEW LAST IMPORT</button>}
      </div>
      {showLast && history[0] && (
        <div className="card text-[13px]"><div className="eyebrow">LAST IMPORT · {new Date(history[0].at).toLocaleString()}</div>
          <ul className="mt-1 list-disc pl-5">{history[0].created.map((c, i) => <li key={i}>{c}</li>)}</ul>
          {history[0].skipped.length > 0 && <><div className="eyebrow mt-2">LEFT ALONE</div><ul className="list-disc pl-5 text-ink-secondary">{history[0].skipped.map((c, i) => <li key={i}>{c}</li>)}</ul></>}</div>
      )}
      <label className="block"><span className="label">PASTE YOUR INFO</span>
        <textarea value={text} onChange={e => { setText(e.target.value); setChecked(false); }} rows={14} className="input font-mono text-[13px]" placeholder={'Paste the recipe or Baby Chef Studio text here and I’ll fill in the form for you.\n\nNAME: …\nRECIPE: …\nINGREDIENTS: …\nSCENE 1: …'} aria-label="Paste your info" /></label>
      {!checked && <div className="flex gap-2"><button type="button" className="btn btn-primary" disabled={!text.trim()} onClick={() => setChecked(true)}>CHECK IT</button></div>}
      {parsed && (
        <section className="card space-y-3" aria-label="What I found">
          <div className="eyebrow">WHAT I FOUND</div>
          {parsed.found.length === 0 ? <p className="text-[13px] text-[#8A6216]">⚠ {parsed.warnings[0]}</p> : <p className="text-[14px]">✓ {parsed.found.join(' · ')}</p>}
          {parsed.warnings.filter(w => parsed.found.length > 0 || false).map((w, i) => <p key={i} className="text-[13px] text-[#8A6216]">⚠ {w}</p>)}
          {parsed.babyChef && (
            <label className="block"><span className="label">Baby Chef in the text: “{parsed.babyChef}”</span>
              <select className="input" value={chefValue} onChange={e => setChef(e.target.value)} aria-label="Which Baby Chef?">
                {chefMatch && <option value={chefMatch.id}>Use {chefMatch.name}</option>}
                {chefs.filter(c => c.id !== chefMatch?.id).map(c => <option key={c.id} value={c.id}>Use {c.name}</option>)}
                <option value="NEW">Create a new Baby Chef “{parsed.babyChef}”</option><option value="">Leave unassigned</option></select></label>
          )}
          {(conflicts.length > 0 || recipeConflict) && <div className="space-y-1.5"><div className="eyebrow">THESE ALREADY HAVE AN ANSWER</div>
            {conflicts.map(([k, v]) => <div key={k} className="flex flex-wrap items-center gap-2 text-[13px]"><span className="w-32 font-semibold">{NAMES[k] ?? k}</span><span className="min-w-0 flex-1 text-ink-secondary"><s>{current[k]}</s> → {v}</span><Pick k={k} /></div>)}
            {recipeConflict && <div className="flex flex-wrap items-center gap-2 text-[13px]"><span className="w-32 font-semibold">Recipe</span><span className="min-w-0 flex-1 text-ink-secondary">You already have a recipe. Replacing keeps the old one in its version history.</span><Pick k="recipe" /></div>}</div>}
          <ul className="space-y-0.5 text-[13px] text-ink-secondary">
            {Object.entries(parsed.fields).filter(([k]) => !conflicts.some(([c]) => c === k)).map(([k, v]) => <li key={k}>✓ {NAMES[k] ?? k}: <span className="text-ink">{v}</span></li>)}
            {recipeText && !recipeConflict && <li>✓ Recipe ({recipeText.length} characters)</li>}
            {parsed.ingredients.length > 0 && <li>✓ {parsed.ingredients.length - dupIng} new ingredient{parsed.ingredients.length - dupIng === 1 ? '' : 's'}{dupIng ? ` (${dupIng} already there — skipped)` : ''}</li>}
            {parsed.scenes.length > 0 && <li>✓ {parsed.scenes.length} scene{parsed.scenes.length > 1 ? 's' : ''}: {parsed.scenes.map(s => s.title + (sceneTitles.includes(s.title) ? ' (already there)' : '')).join(', ')}</li>}
            {nImg > 0 && <li>✓ {nImg} picture{nImg > 1 ? 's' : ''}</li>}
          </ul>
          {error && <p className="text-[13px] text-[#A8513F]">{error}</p>}
          <div className="flex flex-wrap gap-2"><button type="button" className="btn btn-primary" disabled={pending || parsed.found.length === 0} onClick={() => start(async () => { try { await applyImport({ text, slug, choices, chef: chefValue }); } catch (e: any) { if (!String(e?.message || '').includes('NEXT_REDIRECT')) setError('Something went wrong — nothing was changed.'); } })}>{pending ? 'Filling in…' : 'FILL IN FORM'}</button><button type="button" className="btn" onClick={() => setChecked(false)}>CANCEL</button></div>
          <p className="text-[12px] text-ink-secondary">Nothing is saved until you press FILL IN FORM. Blank spots like [temperature] become questions in Missing Info.</p>
        </section>
      )}
    </div>
  );
}
