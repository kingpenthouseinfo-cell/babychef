import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProjectBySlug } from '@/lib/queries';

export default async function More({ params }: { params: { slug: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const b = `/projects/${p.slug}`;
  const tools: [string, string, string][] = [
    ['My Video Style', 'How every video should look, sound and move', '/settings/bible'], ['Keep It Consistent', 'Baby, kitchen, cookware, lighting', `${b}/continuity`], ['Example Pictures', 'Pictures to copy the look from', `${b}/references`],
    ['Ingredients', 'Every ingredient, with brand and product photos', `${b}/ingredients`], ['Script', 'Write it elsewhere, keep every version here', `${b}/script`], ['Short/Reel', 'Choose the moments for the short version', `${b}/short`],
    ['Pictures to Make', 'Every picture still to make, in order', '/queue'], ['Files', 'Everything in this video’s folder', `${b}/files`], ['Exports', 'Recipe card, scene list, all prompts (ZIP)', `/api/projects/${p.slug}/export?format=zip`],
    ['Write a Prompt', 'Have ChatGPT or Claude write a prompt for you', `${b}/builder`], ['Special Rules', 'Rules just for this recipe video', `${b}/overrides`], ['Scene details', 'Every scene field, in one list', `${b}/scenes`],
    ['Picture list', 'Every picture as a list, with filters', `${b}/images`], ['Prompt Templates', 'The building blocks behind each prompt', `${b}/prompts`], ['Fill from text', 'Paste text to fill things in, and see the last one', `${b}/fill`],
    ['Notes', 'Anything you want to remember', `${b}/notes`],
  ];
  return (
    <div>
      <h1 className="text-[34px] md:text-[40px]">More</h1>
      <p className="mt-1 text-[14px] text-ink-secondary">Tools you need now and then. Everything here already works in the background.</p>
      <div className="mt-6 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map(([t, d, href]) => (
          <Link key={t} href={href} className="rounded-[16px] border border-line bg-white p-5 transition hover:border-ink/30"><div className="text-[15.5px] font-semibold">{t}</div><div className="mt-1 text-[13.5px] text-ink-secondary">{d}</div></Link>
        ))}
      </div>
    </div>
  );
}
