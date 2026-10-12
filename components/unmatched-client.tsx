'use client';
import { useState } from 'react';
import { assignUnmatched } from '@/lib/actions/watch';
import { SubmitBtn } from './client';

export type ProjOpt = { id: string; title: string; scenes: { id: string; label: string; images: { id: string; label: string; next: number }[] }[] };

/** Manual assignment: Project → Scene → Planned image → Attempt/version. */
export function AssignForm({ id, projects }: { id: string; projects: ProjOpt[] }) {
  const [pid, setPid] = useState(projects[0]?.id ?? '');
  const [sid, setSid] = useState('');
  const [iid, setIid] = useState('');
  const [ver, setVer] = useState('');
  const proj = projects.find(p => p.id === pid);
  const scene = proj?.scenes.find(s => s.id === sid);
  const img = scene?.images.find(i => i.id === iid);
  return (
    <form action={assignUnmatched} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="id" value={id} /><input type="hidden" name="imageId" value={iid} />
      <label className="block"><span className="label">Project</span><select className="input" value={pid} onChange={e => { setPid(e.target.value); setSid(''); setIid(''); }}>{projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
      <label className="block"><span className="label">Scene</span><select className="input" value={sid} onChange={e => { setSid(e.target.value); setIid(''); }}><option value="">— choose —</option>{proj?.scenes.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
      <label className="block"><span className="label">Planned image</span><select className="input" value={iid} onChange={e => { setIid(e.target.value); const n = scene?.images.find(i => i.id === e.target.value)?.next; setVer(n ? String(n) : ''); }} disabled={!scene}><option value="">— choose —</option>{scene?.images.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}</select></label>
      <label className="block"><span className="label">Attempt / version</span><input name="version" type="number" min={1} className="input" value={ver} onChange={e => setVer(e.target.value)} placeholder={img ? String(img.next) : 'v'} /></label>
      <div className="sm:col-span-2 lg:col-span-4"><SubmitBtn className="btn-primary" pendingText="Assigning…">Assign & rename</SubmitBtn> <span className="ml-2 text-[12px] text-ink-secondary">The file is renamed and moved into the project’s 02 Images folder and enters Review. Nothing is overwritten or deleted.</span></div>
    </form>
  );
}
