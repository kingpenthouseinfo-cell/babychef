import '@/app/prompt-pages.css';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { SCENE_ORDER, IMAGE_ORDER, backfillPositions } from '@/lib/order';
import { sceneLabels } from '@/lib/scene-label';
import { klingCode, imageCode } from '@/lib/util';
import { Empty, fileUrl } from '@/components/ui';
import { SubmitBtn } from '@/components/client';
import { PromptRow } from '@/components/prompt-row';
import { PromptImport } from '@/components/prompt-import';
import { PromptAddons } from '@/components/prompt-addons';
import { listAddons } from '@/lib/addons';
import { makeClipForScene } from '@/lib/actions/kling';

export const dynamic = 'force-dynamic';

/** VIDEO PROMPTS: every video clip, one per row — small thumbnails of its pictures, the video prompt, COPY / EDIT / SAVE / CLEAR PROMPT. */
export default async function VideoPrompts({ params }: { params: { slug: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  await backfillPositions();
  const [scenes, clips, imgs] = await Promise.all([
    db.scene.findMany({ where: { projectId: p.id }, orderBy: [...SCENE_ORDER] }),
    db.klingClip.findMany({ where: { projectId: p.id }, orderBy: { order: 'asc' }, include: { scenes: true, refs: { orderBy: { order: 'asc' }, include: { image: { include: { approvedAttempt: true } } } } } }),
    db.plannedImage.findMany({ where: { projectId: p.id, approvedAttemptId: { not: null } }, orderBy: [...IMAGE_ORDER], select: { sceneId: true } }),
  ]);
  const [addons, allProjects] = await Promise.all([listAddons('VIDEO'), db.project.findMany({ where: { deletedAt: null }, orderBy: { title: 'asc' }, select: { id: true, title: true } })]);
  const lab = sceneLabels(scenes);
  const b = `/projects/${p.slug}`;
  const clipScenes = new Set(clips.flatMap(c => c.scenes.map(s => s.sceneId)));
  const waiting = scenes.filter(s => !clipScenes.has(s.id) && imgs.some(i => i.sceneId === s.id));
  return (
    <div className="prompt-page prompt-page--videos" data-testid="video-prompts">
      <header className="prompt-page__head"><h1 className="prompt-page__title">Video Prompts</h1><p className="prompt-page__sub">{clips.length} video clip{clips.length === 1 ? '' : 's'} · one prompt per row · copy, edit or clear any of them</p></header>
      <PromptAddons kind="VIDEO" addons={addons.map(a => ({ id: a.id, text: a.text, position: a.position, projectIds: a.projectIds, enabled: a.enabled }))} projects={allProjects} currentProjectId={p.id} slug={p.slug} babyChefId={p.babyChefId ?? null} />
      <PromptImport kind="video" projectId={p.id} />
      {clips.length === 0 && waiting.length === 0 && <Empty title="No video clips yet." hint="Approve the pictures of a scene first, then its video prompt can be made here." />}
      <ul className="prompt-page__list">
        {clips.map(k => { const sid = k.scenes[0]?.sceneId; return (
          <li key={k.id} className="prompt-row" data-testid="video-prompt-row" id={`clip-${k.id}`}>
            <Link href={`${b}/kling/${k.id}`} className="prompt-row__thumbs" aria-label={`Open ${k.title}`}>
              {k.refs.length === 0 && <span className="prompt-row__thumb-empty">No pictures yet</span>}
              {k.refs.slice(0, 6).map(r => <span key={r.id} className="prompt-row__thumb prompt-row__thumb--small" title={`${imageCode(r.image.seq)} ${r.image.title}`}>{r.image.approvedAttempt ? <img src={fileUrl(r.image.approvedAttempt.assetId, 160)} alt={r.image.title} loading="lazy" /> : <span className="prompt-row__thumb-empty">–</span>}</span>)}
            </Link>
            <div className="prompt-row__main">
              <div className="prompt-row__meta"><span className="prompt-row__label">{klingCode(k.order)}</span>{sid && <span className="prompt-row__scene">Scene {lab.get(sid)}</span>}<span className="prompt-row__status">{k.status}</span><span className="prompt-row__count">{k.refs.length} picture{k.refs.length === 1 ? '' : 's'}</span></div>
              <h2 className="prompt-row__title">{k.title}</h2>
              <PromptRow kind="video" id={k.id} prompt={k.finalPrompt} />
            </div>
          </li>); })}
        {waiting.map(s => (
          <li key={s.id} className="prompt-row prompt-row--empty" data-testid="video-prompt-waiting">
            <span className="prompt-row__thumbs"><span className="prompt-row__thumb-empty">No video yet</span></span>
            <div className="prompt-row__main"><div className="prompt-row__meta"><span className="prompt-row__scene">Scene {lab.get(s.id)}</span></div><h2 className="prompt-row__title">{s.title}</h2>
              <p className="prompt-row__hint">This scene has approved pictures but no video prompt yet.</p>
              <form action={makeClipForScene}><input type="hidden" name="sceneId" value={s.id} /><SubmitBtn pendingText="Gathering…">Make video prompt</SubmitBtn></form></div>
          </li>))}
      </ul>
    </div>
  );
}
