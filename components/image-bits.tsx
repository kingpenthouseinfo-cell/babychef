import Link from 'next/link';
import { Chip, Thumb, fileUrl } from './ui';
import { CopyButton } from './client';
import { CardUpload } from './card-upload';
import { imageCode, sceneCode } from '@/lib/util';
import { expectedFilename, nextVersion, withFilename } from '@/lib/naming';
import type { ChecklistEntry } from '@/lib/queries';

export function RefThumbs({ list, max = 6 }: { list: ChecklistEntry[]; max?: number }) {
  if (!list.length) return <div className="text-xs text-ink-secondary">no references attached</div>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.slice(0, max).map(c => (
        <div key={c.id} className="relative w-12" title={`${c.label} (${c.required ? 'REQUIRED' : 'OPTIONAL'})`}>
          {c.assetId ? <img src={fileUrl(c.assetId, 120)} alt={c.label} loading="lazy" className={`aspect-square w-12 rounded-md object-cover ring-2 ${c.packageCritical ? 'ring-red-600' : c.required ? 'ring-ink' : 'ring-neutral-300'}`} /> : <div className="flex aspect-square w-12 items-center justify-center rounded-md bg-[#F8EFD9] text-[9px] font-bold text-[#8A6216] ring-2 ring-amber-400">WAIT</div>}
        </div>
      ))}
      {list.length > max && <div className="flex h-12 w-12 items-center justify-center rounded-md bg-sunken text-xs">+{list.length - max}</div>}
    </div>
  );
}

export function ChecklistText({ list }: { list: ChecklistEntry[] }) {
  if (!list.length) return <p className="text-sm text-ink-secondary">No references attached. Attach at least the Baby Chef master and kitchen master.</p>;
  return (
    <ol className="list-decimal space-y-1 pl-5 text-sm">
      {list.map(c => (
        <li key={c.id}>
          {c.label} <span className={`text-[11px] font-bold ${c.required ? 'text-ink' : 'text-ink-secondary'}`}>{c.required ? 'REQUIRED' : 'OPTIONAL'}</span>
          {c.packageCritical && <> <Chip tone="PACKAGE CRITICAL">PACKAGE CRITICAL</Chip></>}
          {c.missing && c.kind === 'APPROVED_IMAGE' && <span className="ml-1 text-xs font-semibold text-[#8A6216]">(not approved yet)</span>}
        </li>
      ))}
    </ol>
  );
}

export function ImageCard({ img, slug, checklist, selectable }: { img: any; slug: string; checklist: ChecklistEntry[]; selectable?: boolean }) {
  const code = imageCode(img.seq);
  const thumb = img.approvedAttempt?.assetId ?? img.attempts?.[img.attempts.length - 1]?.assetId;
  const blocked = img.dependsOn && img.dependsOn.status !== 'APPROVED';
  const href = `/projects/${slug}/images/${img.id}`;
  const expected = expectedFilename({ slug, sceneOrder: img.scene.order, seq: img.seq, title: img.title, version: nextVersion((img.attempts ?? []).map((a: any) => a.number)) });
  return (
    <div className="card flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><div className="flex items-center gap-2"><span className="font-mono text-sm font-bold">{code}</span><Chip>{img.status}</Chip>{img.priority === 'HIGH' && <Chip tone="HIGH">HIGH</Chip>}</div>
          <div className="text-xs text-ink-secondary">{sceneCode(img.scene.order)} {img.scene.title}</div></div>
        {selectable && <input type="checkbox" name="ids" value={img.id} className="mt-1 h-5 w-5" aria-label={`Select ${code}`} />}
      </div>
      <Link href={href}><Thumb id={thumb} alt={img.title} w={480} /></Link>
      <Link href={href} className="font-semibold leading-tight hover:underline">{img.title}</Link>
      <div className="text-xs text-ink-secondary">{img.shotType}</div>
      <RefThumbs list={checklist} />
      {blocked && <div className="text-xs font-semibold text-[#8A6216]">Waiting for {imageCode(img.dependsOn.seq)}.</div>}
      <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
        <Link href={href} className="btn btn-sm">Open</Link>
        <CopyButton text={withFilename(img.contPrompt || img.fullPrompt, expected)} label="Copy prompt" className="btn-sm" />
        <CopyButton text={expected} label="Copy filename" variant="secondary" className="btn-sm" />
        <CardUpload imageId={img.id} label={img.attempts?.length ? 'Replace photo' : 'Upload photo'} className="btn btn-sm btn-copy" />
        {img.status === 'REVIEW' && <Link href={`${href}#review`} className="btn btn-sm btn-accent">Review</Link>}
      </div>
    </div>
  );
}
