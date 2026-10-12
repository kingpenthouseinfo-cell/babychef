import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { DirtyForm, SubmitBtn } from '@/components/client';
import { Area, Section } from '@/components/ui';
import { saveOverrides } from '@/lib/actions/bible';
import { OVERRIDE_FIELDS } from '@/lib/bible';
import { parseJson } from '@/lib/util';
import Link from 'next/link';

export default async function Overrides({ params }: { params: { slug: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const doc = await db.projectDoc.findUnique({ where: { projectId_key: { projectId: p.id, key: 'overrides' } } });
  const d = parseJson<Record<string, string>>(doc?.data, {});
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-neutral-100 p-3 text-sm">Project-specific instructions <b>override</b> the Baby Chef profile, which overrides the global <Link href="/settings/bible" className="underline">Production Bible</Link>. They are included in every Production Brain prompt for this project.</div>
      <Section title="Production overrides">
        <DirtyForm action={saveOverrides} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="projectId" value={p.id} />
          {OVERRIDE_FIELDS.map(f => <Area key={f} name={`f:${f}`} label={f} v={d[f]} rows={3} />)}
          <div className="sm:col-span-2"><SubmitBtn>SAVE OVERRIDES</SubmitBtn></div></DirtyForm>
      </Section>
    </div>
  );
}
