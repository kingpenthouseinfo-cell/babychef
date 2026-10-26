'use client';
import { useRef, useState, useTransition, type HTMLAttributes } from 'react';
import { useRouter } from 'next/navigation';
import { uploadToCard } from '@/lib/actions/generate';
import { recordKlingAttempt } from '@/lib/actions/kling';
import { uploadSceneClip } from '@/lib/actions/clips';

const isFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
const IMG = /\.(png|jpe?g|webp)$/i, VID = /\.(mp4|mov|m4v|webm)$/i;

type Props = HTMLAttributes<HTMLDivElement> & { hint: string; onFiles: (files: File[]) => Promise<string | void> };

/** Drag-and-drop target: wraps a card/section, shows a drop hint while a file is dragged over it. */
function Zone({ hint, onFiles, children, className = '', ...rest }: Props) {
  const router = useRouter();
  const [over, setOver] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, start] = useTransition();
  const depth = useRef(0);
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4500); };
  return (
    <div data-testid="drop-zone" {...rest} data-drop="1" className={`relative ${className}`}
      onDragEnter={e => { if (!isFiles(e)) return; e.preventDefault(); e.stopPropagation(); depth.current++; setOver(true); }}
      onDragOver={e => { if (!isFiles(e)) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; }}
      onDragLeave={e => { if (!isFiles(e)) return; depth.current = Math.max(0, depth.current - 1); if (depth.current === 0) setOver(false); }}
      onDrop={e => {
        if (!isFiles(e)) return;
        e.preventDefault(); e.stopPropagation(); depth.current = 0; setOver(false);
        const files = Array.from(e.dataTransfer.files);
        start(async () => { try { const r = await onFiles(files); if (r) flash(r); router.refresh(); } catch (err: any) { flash(err?.message || 'That did not work. Try again.'); } });
      }}>
      {children}
      {(over || busy) && <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] border-2 border-dashed border-[#6A8FC7] bg-white/85 p-3 text-center text-[13px] font-semibold text-blue-deep" role="status">{busy ? 'Uploading…' : hint}</div>}
      {msg && !over && !busy && <div className="pointer-events-none absolute inset-x-2 bottom-2 z-20 rounded-md bg-[#EAF4EC] px-2 py-1 text-center text-[12px] font-semibold text-[#3F6B47] shadow" role="status" data-testid="drop-msg">{msg}</div>}
    </div>
  );
}

/** Drop a PNG/JPG/WebP onto a picture to put it on that picture (named and filed automatically). */
export function ImageDrop({ imageId, hint = 'Drop the picture here', children, ...rest }: HTMLAttributes<HTMLDivElement> & { imageId: string; hint?: string }) {
  return (
    <Zone {...rest} hint={hint} onFiles={async files => {
      if (files.some(f => /\.(heic|heif)$/i.test(f.name))) return 'HEIC pictures are not supported yet. Export as JPG or PNG first.';
      const pics = files.filter(f => f.type.startsWith('image/') || IMG.test(f.name));
      if (!pics.length) return 'Drop a PNG, JPG or WebP picture.';
      const fd = new FormData(); fd.set('imageId', imageId); fd.set('file', pics[0]);
      await uploadToCard(fd);
      return pics.length > 1 ? 'UPLOAD COMPLETE ✓ (only the first picture was used)' : 'UPLOAD COMPLETE ✓';
    }}>{children}</Zone>
  );
}

/** Drop a video (MP4/MOV/WebM) onto a clip to record it as the next video attempt. */
export function VideoDrop({ klingId, hint = 'Drop the video here', children, ...rest }: HTMLAttributes<HTMLDivElement> & { klingId: string; hint?: string }) {
  return (
    <Zone {...rest} hint={hint} onFiles={async files => {
      const vids = files.filter(f => f.type.startsWith('video/') || VID.test(f.name));
      if (!vids.length) return 'Drop a video file (MP4, MOV or WebM).';
      const fd = new FormData(); fd.set('klingId', klingId); fd.set('file', vids[0]); fd.set('externalName', vids[0].name);
      await recordKlingAttempt(fd);
      return 'VIDEO SAVED ✓';
    }}>{children}</Zone>
  );
}

/** Drop finished video files onto a scene (or, with no scene, onto the strip at the top): they are saved in the project's 06 Video Clips folder and, for a scene, added to that scene's clips in play order. */
export function SceneClipDrop({ projectId, sceneId = null, hint, children, ...rest }: HTMLAttributes<HTMLDivElement> & { projectId: string; sceneId?: string | null; hint: string }) {
  return (
    <Zone {...rest} hint={hint} onFiles={async files => {
      const vids = files.filter(f => f.type.startsWith('video/') || VID.test(f.name));
      if (!vids.length) return 'Drop a video file (MP4, MOV, M4V or WebM).';
      for (const f of vids) { const fd = new FormData(); fd.set('projectId', projectId); if (sceneId) fd.set('sceneId', sceneId); fd.set('file', f); await uploadSceneClip(fd); }
      return sceneId ? `✓ ${vids.length} clip${vids.length === 1 ? '' : 's'} added to this scene` : `✓ ${vids.length} clip${vids.length === 1 ? '' : 's'} saved (see the Unassigned tab or the Storyboard)`;
    }}>{children}</Zone>
  );
}
