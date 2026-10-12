import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { ImportScenes } from '@/components/builder-client';
import { Section } from '@/components/ui';

export default async function ImportPage({ params, searchParams }: { params: { slug: string }; searchParams: { from?: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const from = searchParams.from ? await db.projectPrompt.findUnique({ where: { id: searchParams.from } }) : null;
  return (
    <div className="space-y-4">
      <Link href={`/projects/${p.slug}/builder`} className="text-sm underline">← Prompt builders</Link>
      <Section title="Import scenes from pasted AI text">
        <p className="mb-3 text-sm text-neutral-600">Paste the structured scene list from ChatGPT/Claude (headings like <code>### SCENE 01 — Title</code> with lines such as <code>FOOD STATE BEFORE:</code>). You get a preview first; nothing is saved or changed until you press import. If parsing does not fit your text, create scenes manually on the Scenes tab.</p>
        <ImportScenes projectId={p.id} initialText={from?.result ?? ''} />
      </Section>
    </div>
  );
}
