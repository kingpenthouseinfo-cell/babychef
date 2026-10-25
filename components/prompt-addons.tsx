'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createAddon, updateAddon, deleteAddon, applyAddons, previewAddons, removeAddonFromPrompts } from '@/lib/actions/addons';

type Addon = { id: string; text: string; position: 'START' | 'END'; projectIds: string[]; enabled: boolean };
type Proj = { id: string; title: string };

const where = (a: { projectIds: string[] }, projects: Proj[]) => (a.projectIds.length === 0 ? 'All projects' : a.projectIds.map(id => projects.find(p => p.id === id)?.title ?? 'a removed project').join(', '));

/** Sentences added to every picture prompt: saved permanently, at the beginning or the end, for all projects or the ones you pick. */
export function PromptAddons({ addons, projects, currentProjectId, slug, babyChefId }: { addons: Addon[]; projects: Proj[]; currentProjectId: string; slug: string; babyChefId: string | null }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [text, setText] = useState('');
  const [pos, setPos] = useState<'START' | 'END'>('END');
  const [all, setAll] = useState(true);
  const [picked, setPicked] = useState<string[]>([currentProjectId]);
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 7000); };
  const run = (label: string, fn: () => Promise<string | void>) => start(async () => { try { flash(`${label}…`); const r = await fn(); flash(r || '✓ Done'); router.refresh(); } catch (e: any) { flash(e?.message || 'That did not work.'); } });
  const ids = () => (all ? [] : picked);
  const toggle = (id: string) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
  const applyNow = (id: string | null, label: string) => run(label, async () => {
    const pre = await previewAddons(id);
    if (!pre.changed) return '✓ Every prompt already has it — nothing to change';
    if (!window.confirm(`Add ${id ? 'this sentence' : 'the saved sentences'} to ${pre.changed} picture prompt${pre.changed === 1 ? '' : 's'}?\n\nThe old text of each prompt is kept as a version.`)) return 'Nothing was changed.';
    const r = await applyAddons(id); return `✓ Added to ${r.changed} prompt${r.changed === 1 ? '' : 's'}${r.same ? ` (${r.same} already had it)` : ''}`;
  });
  return (
    <div className="prompt-addons" data-testid="prompt-addons">
      <div className="prompt-addons__bar">
        <details className="prompt-addons__menu" data-testid="prompt-settings">
          <summary className="prompt-row__btn" data-testid="prompt-settings-btn">PROMPT SETTINGS</summary>
          <div className="prompt-addons__links">
            <p>Everything that shapes these prompts:</p>
            <a href="#addons">Sentences added to every prompt</a>
            <Link href="/settings/bible">My Video Style (Production Bible)</Link>
            {babyChefId && <Link href={`/babychefs/${babyChefId}`}>Baby Chef profile (look, outfit, voice)</Link>}
            <Link href={`/projects/${slug}/overrides`}>Special Rules for this video</Link>
            <Link href={`/projects/${slug}/continuity`}>Keep It Consistent</Link>
            <Link href={`/projects/${slug}/prompts`}>Prompt templates</Link>
            <Link href="/settings">Settings (ChatGPT link and more)</Link>
          </div>
        </details>
        <span className="prompt-addons__msg" role="status" data-testid="addon-msg">{msg}</span>
      </div>
      <details id="addons" className="prompt-import" data-testid="addons-panel">
        <summary className="prompt-import__summary">Add a sentence to every prompt {addons.length ? `(${addons.length} saved)` : ''}</summary>
        <div className="prompt-import__body">
          <p className="prompt-import__help">Type a sentence once and it is saved for good. Choose whether it goes at the <b>beginning</b> or the <b>end</b> of each picture prompt, and which projects it is for. New and rewritten prompts get it automatically.</p>
          <textarea className="prompt-import__text" rows={3} aria-label="Sentence to add" data-testid="addon-text" value={text} onChange={e => setText(e.target.value)} placeholder="e.g. Make sure the image is not too contrasty and the baby’s skin has realistic texture, not too smooth." />
          <fieldset className="prompt-addons__field"><legend>Where in the prompt?</legend>
            <label><input type="radio" name="addon-pos" checked={pos === 'END'} onChange={() => setPos('END')} data-testid="addon-pos-end" /> At the end of each prompt</label>
            <label><input type="radio" name="addon-pos" checked={pos === 'START'} onChange={() => setPos('START')} data-testid="addon-pos-start" /> At the beginning of each prompt</label>
          </fieldset>
          <fieldset className="prompt-addons__field"><legend>Which projects?</legend>
            <label><input type="radio" name="addon-scope" checked={all} onChange={() => setAll(true)} data-testid="addon-scope-all" /> All projects</label>
            <label><input type="radio" name="addon-scope" checked={!all} onChange={() => setAll(false)} data-testid="addon-scope-pick" /> Only these:</label>
            {!all && <div className="prompt-addons__projects">{projects.map(p => <label key={p.id}><input type="checkbox" checked={picked.includes(p.id)} onChange={() => toggle(p.id)} data-testid="addon-proj" /> {p.title}</label>)}</div>}
          </fieldset>
          <div className="prompt-import__actions">
            <button type="button" className="prompt-row__btn prompt-row__btn--save" disabled={busy || !text.trim() || (!all && picked.length === 0)} data-testid="addon-save" onClick={() => run('Saving', async () => { await createAddon(text, pos, ids()); setText(''); return '✓ Saved. Use “Add to prompts now” below to put it in the prompts that already exist.'; })}>SAVE THIS SENTENCE</button>
            <button type="button" className="prompt-row__btn prompt-row__btn--copy" disabled={busy || !text.trim() || (!all && picked.length === 0)} data-testid="addon-save-apply" onClick={() => run('Saving', async () => { const { id } = await createAddon(text, pos, ids()); setText(''); const pre = await previewAddons(id); if (!pre.changed) return '✓ Saved. Every prompt already has it.'; if (!window.confirm(`Add it to ${pre.changed} picture prompt${pre.changed === 1 ? '' : 's'} now?\n\nThe old text of each prompt is kept as a version.`)) return '✓ Saved (the existing prompts were not changed).'; const r = await applyAddons(id); return `✓ Saved and added to ${r.changed} prompt${r.changed === 1 ? '' : 's'}`; })}>SAVE AND ADD TO PROMPTS NOW</button>
          </div>
          {addons.length > 0 && (
            <ul className="prompt-addons__list" data-testid="addon-list">
              {addons.map(a => (
                <li key={a.id} className="prompt-addons__item" data-testid="addon-item">
                  <textarea className="prompt-import__text" rows={2} defaultValue={a.text} aria-label="Saved sentence" onBlur={e => { if (e.target.value.trim() && e.target.value.trim() !== a.text) run('Saving', async () => { await updateAddon(a.id, { text: e.target.value }); return '✓ Sentence updated (use “Add to prompts now” to put the new wording in)'; }); }} />
                  <div className="prompt-addons__meta">
                    <label>Goes at the <select value={a.position} onChange={e => run('Saving', async () => { await updateAddon(a.id, { position: e.target.value as 'START' | 'END' }); })}><option value="END">end</option><option value="START">beginning</option></select></label>
                    <span>For: <b>{where(a, projects)}</b></span>
                    <label><input type="checkbox" checked={a.enabled} onChange={e => run('Saving', async () => { await updateAddon(a.id, { enabled: e.target.checked }); })} data-testid="addon-enabled" /> On</label>
                  </div>
                  <div className="prompt-addons__buttons">
                    <button type="button" className="prompt-row__btn prompt-row__btn--copy" disabled={busy || !a.enabled} data-testid="addon-apply" onClick={() => applyNow(a.id, 'Adding')}>ADD TO PROMPTS NOW</button>
                    <button type="button" className="prompt-row__btn" disabled={busy} data-testid="addon-takeout" onClick={() => { if (window.confirm('Take this sentence out of the prompts it was added to?\n\nThe old text of each prompt is kept as a version.')) run('Taking out', async () => { const r = await removeAddonFromPrompts(a.id); return `✓ Taken out of ${r.changed} prompt${r.changed === 1 ? '' : 's'}`; }); }}>TAKE OUT OF PROMPTS</button>
                    <button type="button" className="prompt-row__btn prompt-row__btn--clear" disabled={busy} data-testid="addon-delete" onClick={() => { if (window.confirm('Delete this saved sentence?\n\n(Prompts it was already added to keep it, unless you take it out first.)')) run('Deleting', async () => { await deleteAddon(a.id); }); }}>DELETE</button>
                  </div>
                </li>))}
            </ul>)}
          {addons.length > 1 && <div className="prompt-import__actions"><button type="button" className="prompt-row__btn prompt-row__btn--copy" disabled={busy} data-testid="addon-apply-all" onClick={() => applyNow(null, 'Adding')}>ADD ALL SAVED SENTENCES TO PROMPTS NOW</button></div>}
        </div>
      </details>
    </div>
  );
}
