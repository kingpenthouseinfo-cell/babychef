import '@/app/prompt-pages.css';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { SCENE_ORDER, IMAGE_ORDER, backfillPositions } from '@/lib/order';
import { sceneLabels } from '@/lib/scene-label';
import { imageLabel } from '@/lib/image-gen';
import { imageCode } from '@/lib/util';
import { Empty, fileUrl } from '@/components/ui';
import { PromptRow } from '@/components/prompt-row';
import { PromptImport } from '@/components/prompt-import';
import { PromptAddons } from '@/components/prompt-addons';
import { listAddons } from '@/lib/addons';

export const dynamic = 'force-dynamic';

/** IMAGE PROMPTS: every picture, one per row — small thumbnail, its prompt, COPY / EDIT / SAVE / CLEAR PROMPT. */
export default async function ImagePrompts({ params }: { params: { slug: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  await backfillPositions();
  const [scenes, imgs] = await Promise.all([
    db.scene.findMany({ where: { projectId: p.id }, orderBy: [...SCENE_ORDER] }),
    db.plannedImage.findMany({ where: { projectId: p.id }, orderBy: [...IMAGE_ORDER], include: { approvedAttempt: true, attempts: { orderBy: { number: 'desc' }, take: 1 } } }),
  ]);
  const [addons, allProjects] = await Promise.all([listAddons(), db.project.findMany({ where: { deletedAt: null }, orderBy: { title: 'asc' }, select: { id: true, title: true } })]);
  const lab = sceneLabels(scenes);
  const idxIn = (i: (typeof imgs)[number]) => imgs.filter(x => x.sceneId === i.sceneId).findIndex(x => x.id === i.id) + 1;
  const b = `/projects/${p.slug}`;
  return (
    <div className="prompt-page prompt-page--images" data-testid="image-prompts">
      <header className="prompt-page__head"><h1 className="prompt-page__title">Image Prompts</h1><p className="prompt-page__sub">{imgs.length} picture{imgs.length === 1 ? '' : 's'} · one prompt per row · copy, edit or clear any of them</p></header>
      <PromptAddons addons={addons.map(a => ({ id: a.id, text: a.text, position: a.position, projectIds: a.projectIds, enabled: a.enabled }))} projects={allProjects} currentProjectId={p.id} slug={p.slug} babyChefId={p.babyChefId ?? null} />
      <PromptImport kind="image" projectId={p.id} />
      {imgs.length === 0 && <Empty title="No pictures yet." hint="Add scenes first — each scene gets its pictures and prompts automatically." />}
      <ul className="prompt-page__list">
        {imgs.map(i => { const sh = i.approvedAttempt ?? i.attempts[0] ?? null; const sc = scenes.find(s => s.id === i.sceneId); return (
          <li key={i.id} className="prompt-row" data-testid="image-prompt-row" id={`pic-${i.id}`}>
            <Link href={`${b}/images/${i.id}`} className="prompt-row__thumb" aria-label={`Open ${i.title}`}>{sh ? <img src={fileUrl(sh.assetId, 240)} alt={i.title} loading="lazy" /> : <span className="prompt-row__thumb-empty">No picture yet</span>}</Link>
            <div className="prompt-row__main">
              <div className="prompt-row__meta"><span className="prompt-row__label" title={imageCode(i.seq)}>IMAGE {imageLabel(lab.get(i.sceneId) ?? '', idxIn(i) - 1)}</span><span className="prompt-row__code">{imageCode(i.seq)}</span><span className="prompt-row__scene">Scene {lab.get(i.sceneId)}{sc ? ` · ${sc.title}` : ''}</span></div>
              <h2 className="prompt-row__title">{i.title}</h2>
              <PromptRow kind="image" id={i.id} prompt={i.fullPrompt ?? ''} />
            </div>
          </li>); })}
      </ul>
    </div>
  );
}
