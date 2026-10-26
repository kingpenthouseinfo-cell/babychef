'use client';
import { useRouter } from 'next/navigation';
import Storyboard, { type ClipInfo } from './Storyboard';
import { quickApprove, skipPicture, unskipPicture, removeOldVersions, countOldVersions, removeOldVersionsProject } from '@/lib/actions/pictures';
import { uploadToCard, approveLatest } from '@/lib/actions/generate';
import { uploadSceneClip, assignSceneClip, unassignSceneClip } from '@/lib/actions/clips';
import { saveOrder, countFolderMismatches, matchFolderToStoryboard } from '@/lib/actions/storyboard';
import type { SbBoard } from '@/lib/storyboard-order';
import type { toSavePayload } from '@/lib/storyboard-order';

/** Client wrapper: wires Save order to the server and opens a picture on click. Remounts when the saved data changes (new items get their real ids). */
export function StoryboardPage({ projectId, slug, board, sceneClips, tray }: { projectId: string; slug: string; board: SbBoard; sceneClips: Record<string, ClipInfo>; tray: ClipInfo[] }) {
  const router = useRouter();
  const sig = board.map(s => `${s.id}:${s.title}:${s.pictures.map(p => `${p.id}~${p.title}~${p.status}~${p.imageUrl ?? ''}~${p.skipped ? 1 : 0}~${p.versions ?? 0}~${p.info ?? ''}`).join(',')}`).join('|');
  return (
    <Storyboard
      key={sig}
      initial={board}
      onSave={async (payload: ReturnType<typeof toSavePayload>) => { const r = await saveOrder(projectId, payload); router.refresh(); return r; }}
      onCheckFolder={() => countFolderMismatches(projectId)}
      onMatchFolder={async () => { const r = await matchFolderToStoryboard(projectId); router.refresh(); return r; }}
      sceneClips={sceneClips}
      tray={tray}
      onUploadClip={async (sceneId, file) => { const fd = new FormData(); fd.set('projectId', projectId); if (sceneId) fd.set('sceneId', sceneId); fd.set('file', file); await uploadSceneClip(fd); router.refresh(); }}
      onAssignClip={async (sceneId, assetId) => { await assignSceneClip(projectId, sceneId, assetId); router.refresh(); }}
      onUnassignClip={async sceneId => { await unassignSceneClip(projectId, sceneId); router.refresh(); }}
      onReplacePicture={async (pictureId, file) => { const fd = new FormData(); fd.set('imageId', pictureId); fd.set('file', file); await uploadToCard(fd); const a = new FormData(); a.set('imageId', pictureId); await approveLatest(a); router.refresh(); }}
      onApprove={async id => { const fd = new FormData(); fd.set('id', id); await quickApprove(fd); router.refresh(); }}
      onSetUsed={async (id, used) => { const fd = new FormData(); fd.set('id', id); await (used ? unskipPicture(fd) : skipPicture(fd)); router.refresh(); }}
      onRemoveOld={async id => { const fd = new FormData(); fd.set('id', id); await removeOldVersions(fd); router.refresh(); }}
      onCleanAll={() => countOldVersions(projectId)}
      onCleanAllDo={async () => { await removeOldVersionsProject(projectId); router.refresh(); }}
      onOpenPicture={id => router.push(`/projects/${slug}/images/${id}`)}
    />
  );
}
