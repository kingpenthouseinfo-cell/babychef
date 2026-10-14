import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { aiReferencesFor } from '@/lib/ai-refs';
import { AiRefTile } from '@/components/ai-references';
import { fileUrl } from '@/components/ui';
import { CopyButton } from '@/components/client';
import { manifestUrl } from '@/lib/signed-links';

export const dynamic = 'force-dynamic';

/** Clean reference pack page: only the pictures to give ChatGPT for this one picture. */
export default async function ReferencesPage({ params }: { params: { slug: string; imageId: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const img = await db.plannedImage.findFirst({ where: { id: params.imageId, projectId: p.id }, include: { scene: true } });
  if (!img) notFound();
  const set = await aiReferencesFor(p.id, img.id);
  if (!set) notFound();
  const dl = (assetId: string, name: string) => `${fileUrl(assetId)}?download=1&name=${encodeURIComponent(name)}`;
  const have = set.refs.filter(r => r.assetId);
  const manifest = manifestUrl(p.slug, img.id);
  const byRole = (role: string) => set.refs.find(r => r.role === role && r.assetId);
  return (
    <div className="max-w-[1000px] space-y-5">
      <Link href={`/projects/${p.slug}/images`} className="text-[13px] text-ink-secondary hover:text-ink">← Picture List</Link>
      <div><div className="eyebrow">CURRENT IMAGE</div><h1 className="text-[32px]">{set.tag} · {set.title}</h1>
        <p className="text-[13.5px] text-ink-secondary">Scene {img.scene.title}</p></div>
      <div className="flex flex-wrap gap-2">
        {have.length > 0 && <a className="btn btn-copy" href={`/api/ai-refs/${img.id}/zip`}>DOWNLOAD ALL REFERENCES</a>}
        {([['BABY', 'DOWNLOAD BABY CHEF'], ['KITCHEN', 'DOWNLOAD KITCHEN'], ['OUTFIT', 'DOWNLOAD OUTFIT'], ['BEFORE', 'DOWNLOAD PREVIOUS'], ['AFTER', 'DOWNLOAD NEXT']] as const).map(([role, label]) => { const r = byRole(role); return r ? <a key={role} className="btn" href={dl(r.assetId!, r.dlName)}>{label}</a> : null; })}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {set.refs.map(r => <div key={r.key} className="card"><AiRefTile r={r} big /></div>)}
      </div>
      <div className="card text-[13px]" data-testid="manifest-box"><div className="eyebrow">FOR AUTOMATION</div>
        <p className="mt-1 text-ink-secondary">Every picture above opens as a normal image from its OPEN FULL IMAGE link, so nothing has to be downloaded first. The list below says exactly which files belong to this picture. Links expire after 12 hours.</p>
        <div className="mt-1 break-all font-mono text-[11.5px]">{manifest}</div><div className="mt-2 flex flex-wrap gap-2"><a className="btn btn-sm" href={manifest} target="_blank" rel="noreferrer">OPEN REFERENCE LIST (JSON)</a><CopyButton text={manifest} label="COPY REFERENCE LIST LINK" variant="secondary" className="btn-sm" /></div></div>
      <div className="card text-[13.5px]"><div className="eyebrow">HOW TO USE THESE</div>
        <p className="mt-1">These pictures are for continuity only. Use them to keep the same Baby Chef, kitchen, outfit, lighting, cookware, scale and photographic style. Do not copy the pose, action, camera or food state from the neighbouring pictures. The prompt for {set.tag} decides the exact action and food state. Do not add ingredients or cooking stages from a later picture.</p></div>
    </div>
  );
}
