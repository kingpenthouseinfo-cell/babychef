'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { uploadToCard } from '@/lib/actions/generate';

/** UPLOAD GENERATED IMAGE: the file goes straight onto this picture (project, scene and picture are already known). */
export function CardUpload({ imageId, label = 'UPLOAD GENERATED IMAGE', className = 'btn btn-copy' }: { imageId: string; label?: string; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  function pick(f?: File) {
    if (!f) return;
    if (/\.(heic|heif)$/i.test(f.name)) { setMsg('HEIC is not supported yet. Export it as JPG or PNG first.'); return; }
    const fd = new FormData(); fd.set('imageId', imageId); fd.set('file', f);
    setMsg('');
    start(async () => { try { await uploadToCard(fd); setMsg('UPLOAD COMPLETE ✓'); router.refresh(); } catch (e: any) { setMsg(e?.message || 'Upload failed'); } });
  }
  return (
    <span className="inline-flex flex-col gap-1">
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" data-testid={`upload-${imageId}`} aria-label={label} onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      <button type="button" className={className} disabled={pending} onClick={() => ref.current?.click()}>{pending ? 'Uploading…' : label}</button>
      {msg && <span role="status" className="text-[12.5px] font-medium text-[#46704F]">{msg}</span>}
    </span>
  );
}
