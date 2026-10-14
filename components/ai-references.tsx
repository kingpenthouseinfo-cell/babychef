import Link from 'next/link';
import { fileUrl } from './ui';
import { CopyButton } from './client';
import { directImageUrl, downloadImageUrl } from '@/lib/signed-links';
import { AiRefChangers } from './ai-ref-changers';
import type { AiMasters, AiRef, AiRefSet } from '@/lib/ai-refs';

type Opts = { images: { value: string; label: string }[]; refs: { value: string; label: string }[] };

const dl = (r: AiRef) => `${fileUrl(r.assetId!)}?download=1&name=${encodeURIComponent(r.dlName)}`;
const direct = (r: AiRef) => directImageUrl(r.assetId!);

function Tile({ r, big = false }: { r: AiRef; big?: boolean }) {
  return (
    <div className={big ? 'w-full' : 'w-[132px] shrink-0'} data-testid="ai-ref" data-role={r.role}>
      <div className="eyebrow !text-[10.5px]">{r.label}{r.tag ? ` · ${r.tag}` : ''}{r.overridden ? ' ✎' : ''}</div>
      {r.assetId ? (
        <a href={fileUrl(r.assetId)} target="_blank" rel="noreferrer" title="View full size"><img src={`${fileUrl(r.assetId, big ? 900 : 220)}`} alt={`${r.label} ${r.title ?? ''}`} className={`${big ? 'max-h-[420px] w-full object-contain' : 'aspect-[4/3] w-full object-cover'} mt-1 rounded-md border border-line bg-sunken`} /></a>
      ) : <div className={`${big ? 'h-[120px]' : 'aspect-[4/3]'} mt-1 flex items-center justify-center rounded-md border border-dashed border-line-strong bg-sunken text-[11px] text-ink-muted`}>none yet</div>}
      {r.title && <div className="mt-0.5 truncate text-[11.5px] text-ink-secondary" title={r.title}>{r.title}</div>}
      {r.assetId && (
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] font-semibold">
          <a className="text-blue-deep underline" href={fileUrl(r.assetId)} target="_blank" rel="noreferrer">VIEW</a>
          <a className="text-blue-deep underline" href={direct(r)} target="_blank" rel="noreferrer" data-testid="ai-ref-open-full">OPEN FULL IMAGE</a>
          <CopyButton text={direct(r)} label="COPY IMAGE LINK" variant="secondary" className="btn-sm px-1.5 py-0 text-[11px]" />
          <a className="text-blue-deep underline" href={dl(r)} data-testid="ai-ref-download">DOWNLOAD</a>
        </div>
      )}
      {big && r.assetId && <div className="mt-1 break-all font-mono text-[11px] text-ink-secondary" data-testid="ai-ref-link">{direct(r)}</div>}
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
  return <AiRefChangers imageId={set.imageId} extras={set.refs.filter(r => r.role === 'EXTRA').map(r => ({ key: r.key, title: r.title ?? 'extra' }))} opts={opts} />;
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
