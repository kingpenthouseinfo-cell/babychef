'use client';
import { useRouter } from 'next/navigation';
import Storyboard from './Storyboard';
import { saveOrder } from '@/lib/actions/storyboard';
import type { SbBoard } from '@/lib/storyboard-order';
import type { toSavePayload } from '@/lib/storyboard-order';

/** Client wrapper: wires Save order to the server and opens a picture on click. Remounts when the saved data changes (new items get their real ids). */
export function StoryboardPage({ projectId, slug, board }: { projectId: string; slug: string; board: SbBoard }) {
  const router = useRouter();
  const sig = board.map(s => `${s.id}:${s.title}:${s.pictures.map(p => `${p.id}~${p.title}~${p.status}~${p.imageUrl ?? ''}`).join(',')}`).join('|');
  return (
    <Storyboard
      key={sig}
      initial={board}
      onSave={async (payload: ReturnType<typeof toSavePayload>) => { await saveOrder(projectId, payload); router.refresh(); }}
      onOpenPicture={id => router.push(`/projects/${slug}/images/${id}`)}
    />
  );
}
