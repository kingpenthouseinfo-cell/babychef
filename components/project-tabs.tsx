'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function ProjectTabs({ slug }: { slug: string }) {
  const path = usePathname();
  const base = `/projects/${slug}`;
  const items: [string, string][] = [['', 'Overview'], ['/recipe', 'Recipe'], ['/ingredients', 'Ingredients'], ['/script', 'Script'], ['/scenes', 'Scenes'], ['/images', 'Images'], ['/kling', 'Kling Clips'], ['/short', 'Short Version'], ['/references', 'References'], ['/continuity', 'Continuity'], ['/builder', 'Prompt Builder'], ['/overrides', 'Overrides'], ['/prompts', 'Templates'], ['/publishing', 'Publishing'], ['/files', 'Files'], ['/notes', 'Notes']];
  return (
    <nav className="-mx-4 mb-5 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label="Project sections">
      {items.map(([s, l]) => {
        const href = base + s;
        const active = s === '' ? path === base : path.startsWith(href);
        return <Link key={s} href={href} className={`tab ${active ? 'tab-active' : ''}`}>{l}</Link>;
      })}
    </nav>
  );
}
