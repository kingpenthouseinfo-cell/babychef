import Link from 'next/link';
import { fileUrl } from './ui';
import { SubmitBtn } from './client';
import { setAiRef, addAiExtra, removeAiExtra } from '@/lib/actions/ai-refs';
import type { AiMasters, AiRef, AiRefSet } from '@/lib/ai-refs';

type Opts = { images: { value: string; label: string }[]; refs: { value: string; label: string }[] };

const dl = (r: AiRef) => `${fileUrl(r.assetId!)}?download=1&name=${encodeURIComponent(r.dlName)}`;

function Tile({ r, big = false }: { r: AiRef; big?: boolean }) {
  return (
    <div className={big ? 'w-full' : 'w-[104px] shrink-0'} data-testid="ai-ref" data-role={r.role}>
      <div className="eyebrow !text-[10.5px]">{r.label}{r.tag ? ` · ${r.tag}` : ''}{r.overridden ? ' ✎' : ''}</div>
      {r.assetId ? (
        <a href={fileUrl(r.assetId)} target="_blank" rel="noreferrer" title="View full size"><img src={`${fileUrl(r.assetId, big ? 900 : 220)}`} alt={`${r.label} ${r.title ?? ''}`} className={`${big ? 'max-h-[420px] w-full object-contain' : 'aspect-[4/3] w-full object-cover'} mt-1 rounded-md border border-line bg-sunken`} /></a>
      ) : <div className={`${big ? 'h-[120px]' : 'aspect-[4/3]'} mt-1 flex items-center justify-center rounded-md border border-dashed border-line-strong bg-sunken text-[11px] text-ink-muted`}>none yet</div>}
      {r.title && <div className="mt-0.5 truncate text-[11.5px] text-ink-secondary" title={r.title}>{r.title}</div>}
      {r.assetId && <div className="mt-0.5 flex gap-2 text-[11.5px] font-semibold"><a className="text-blue-deep underline" href={fileUrl(r.assetId)} target="_blank" rel="noreferrer">VIEW</a><a className="text-blue-deep underline" href={dl(r)} data-testid="ai-ref-download">DOWNLOAD</a></div>}
    </div>
  );
}

/** AI GENERATION REFERENCES for one picture: Baby Chef, kitchen, outfit, the closest approved picture before and after (production order), extras. */
export function AiReferences({ set, opts, projectSlug, compact = true }: { set: AiRefSet; opts: Opts; projectSlug: string; compact?: boolean }) {
  const have = set.refs.filter(r => r.assetId).length;
  return (
    <div className="rounded-lg border border-line bg-surface p-3" data-testid="ai-refs" aria-label="AI references">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="eyebrow">AI REFERENCES <span className="font-sans normal-case text-ink-muted">· pictures to give ChatGPT for {set.tag}</span></div>
        <div className="flex flex-wrap gap-1.5">
          {have > 0 && <a className="btn btn-sm btn-copy" href={`/api/ai-refs/${set.imageId}/zip`} data-testid="ai-refs-zip">DOWNLOAD REFERENCES</a>}
          <Link className="btn btn-sm" href={`/projects/${projectSlug}/images/${set.imageId}/references`}>OPEN REFERENCE PACK</Link>
        </div>
      </div>
      <div className="mt-2 flex gap-2.5 overflow-x-auto pb-1">{set.refs.map(r => <Tile key={r.key} r={r} />)}</div>
      <p className="mt-1 text-[11.5px] text-ink-secondary">Continuity only: same Baby Chef, kitchen, outfit and look. The prompt for this picture decides the food and the action.</p>
      {compact ? (
        <details className="mt-1.5 text-[12.5px]"><summary className="cursor-pointer font-semibold text-ink-secondary">Change references</summary><Changers set={set} opts={opts} /></details>
      ) : <Changers set={set} opts={opts} />}
    </div>
  );
}

function Changers({ set, opts }: { set: AiRefSet; opts: Opts }) {
  const sel = 'input h-9 min-w-[160px] max-w-[260px] text-[12.5px]';
  return (
    <div className="mt-2 space-y-2">
      {(['previous', 'next'] as const).map(w => (
        <form key={w} action={setAiRef} className="flex flex-wrap items-center gap-2"><input type="hidden" name="imageId" value={set.imageId} /><input type="hidden" name="which" value={w} />
          <span className="w-24 text-[12px] font-semibold">{w === 'previous' ? 'CHANGE BEFORE' : 'CHANGE AFTER'}</span>
          <select name="pick" className={sel} aria-label={`Change ${w} reference`} defaultValue=""><option value="">Automatic (closest approved)</option>{opts.images.filter(o => o.value !== set.imageId).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          <SubmitBtn className="btn btn-sm" pendingText="Saving…">CHANGE</SubmitBtn></form>
      ))}
      <form action={addAiExtra} className="flex flex-wrap items-center gap-2"><input type="hidden" name="imageId" value={set.imageId} />
        <span className="w-24 text-[12px] font-semibold">+ ADD EXTRA</span>
        <select name="pick" className={sel} aria-label="Add extra reference" defaultValue=""><option value="">Choose a picture…</option>
          <optgroup label="Approved pictures">{opts.images.filter(o => o.value !== set.imageId).map(o => <option key={o.value} value={`img:${o.value}`}>{o.label}</option>)}</optgroup>
          {opts.refs.length > 0 && <optgroup label="Reference pictures">{opts.refs.map(o => <option key={o.value} value={`ref:${o.value}`}>{o.label}</option>)}</optgroup>}</select>
        <SubmitBtn className="btn btn-sm" pendingText="Adding…">+ ADD EXTRA REFERENCE</SubmitBtn></form>
      {set.refs.filter(r => r.role === 'EXTRA').map(r => (
        <form key={r.key} action={removeAiExtra} className="flex items-center gap-2 text-[12px]"><input type="hidden" name="imageId" value={set.imageId} /><input type="hidden" name="key" value={r.key} /><span>Extra: {r.title}</span><button className="btn btn-sm btn-ghost" aria-label={`Remove extra ${r.title}`}>✕ remove</button></form>
      ))}
    </div>
  );
}

/** The project's permanent references, shown once at the top of the Images page. */
export function ProjectReferences({ masters }: { masters: AiMasters }) {
  const list = [masters.baby, masters.kitchen, masters.outfit].filter(Boolean) as AiRef[];
  return (
    <section className="card" aria-label="Project references" data-testid="project-refs">
      <div className="eyebrow">PROJECT REFERENCES</div>
      <p className="text-[12.5px] text-ink-secondary">The permanent pictures every image card reuses. Add or change them on the Baby Chef page.</p>
      {list.length === 0 ? <p className="mt-2 text-[13px] text-ink-secondary">No master pictures yet. Add a Baby Chef and kitchen picture under Baby Chefs → References.</p> : <div className="mt-2 flex flex-wrap gap-3">{list.map(r => <div key={r.key} className="w-[140px]"><Tile r={r} big={false} /></div>)}</div>}
    </section>
  );
}

export { Tile as AiRefTile };
