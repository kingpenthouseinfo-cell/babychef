import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { Area, Empty, Section, Sel } from '@/components/ui';
import { SubmitBtn, ConfirmForm, DirtyForm } from '@/components/client';
import { addNote, deleteNote, saveDoc } from '@/lib/actions/project';
import { NOTE_CATEGORIES, LONGFORM_FIELDS } from '@/lib/constants';
import { fmtDate, parseJson } from '@/lib/util';

export default async function Notes({ params }: { params: { slug: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const [notes, lf] = await Promise.all([db.projectNote.findMany({ where: { projectId: p.id }, orderBy: { createdAt: 'desc' } }), db.projectDoc.findUnique({ where: { projectId_key: { projectId: p.id, key: 'longform' } } })]);
  const d = parseJson<Record<string, string>>(lf?.data, {});
  return (
    <div className="space-y-5">
      <Section title="Add note">
        <form action={addNote} className="space-y-2"><input type="hidden" name="projectId" value={p.id} /><Sel name="category" label="Category" options={NOTE_CATEGORIES} /><Area name="content" label="Note" rows={4} /><SubmitBtn>ADD NOTE</SubmitBtn></form>
      </Section>
      {notes.length === 0 ? <Empty title="No notes yet." /> : NOTE_CATEGORIES.map(c => {
        const ns = notes.filter(n => n.category === c); if (!ns.length) return null;
        return <Section key={c} title={c}>{ns.map(n => <div key={n.id} className="mb-3 border-b border-line pb-3 last:border-0"><div className="text-xs text-neutral-500">{fmtDate(n.createdAt)}</div><p className="whitespace-pre-wrap text-sm">{n.content}</p><ConfirmForm action={deleteNote} message="Delete this note?"><input type="hidden" name="id" value={n.id} /><button className="btn btn-sm btn-danger mt-1">Delete</button></ConfirmForm></div>)}</Section>;
      })}
      <Section title="Long-form editing notes">
        <DirtyForm action={saveDoc} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="projectId" value={p.id} /><input type="hidden" name="key" value="longform" />
          {LONGFORM_FIELDS.map(f => <Area key={f} name={`f:${f}`} label={f} v={d[f]} rows={2} />)}
          <div className="sm:col-span-2"><SubmitBtn>SAVE EDITING NOTES</SubmitBtn></div></DirtyForm>
      </Section>
    </div>
  );
}
