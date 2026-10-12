'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Tab dots carry the task colour: sage = references/ingredients, pink = images, blue = script/scenes/prompts, purple = video/publishing.
const C = { sage: '#4C6B52', pink: '#9A4A60', blue: '#3E6290', purple: '#6A55A2', none: '#8C8792' };
const PRIMARY: [string, string, keyof typeof C][] = [['', 'Overview', 'none'], ['/start', 'Start to Finish', 'blue'], ['/questions', 'Missing Info', 'blue'], ['/recipe', 'Recipe', 'none'], ['/ingredients', 'Ingredients', 'sage'], ['/story', 'Scenes & Pictures', 'pink'], ['/kling', 'Video Clips', 'purple'], ['/publishing', 'Post Video', 'purple']];
const MORE: [string, string, keyof typeof C][] = [['/script', 'Script', 'blue'], ['/short', 'Short/Reel', 'purple'], ['/references', 'Example Pictures', 'sage'], ['/continuity', 'Keep It Consistent', 'none'], ['/builder', 'Write a Prompt', 'blue'], ['/overrides', 'Special Rules', 'blue'], ['/scenes', 'Scene details', 'blue'], ['/images', 'Picture list', 'pink'], ['/prompts', 'Prompt templates', 'blue'], ['/files', 'Files', 'purple'], ['/notes', 'Notes', 'none']];

export function ProjectTabs({ slug, title, progress }: { slug: string; title: string; progress: number }) {
  const path = usePathname();
  const base = `/projects/${slug}`;
  const active = (s: string) => (s === '' ? path === base : path.startsWith(base + s));
  const moreActive = MORE.some(([s]) => active(s));
  const tab = ([s, l, c]: [string, string, keyof typeof C]) => (
    <Link key={s} href={base + s} aria-current={active(s) ? 'page' : undefined} className={`tab ${active(s) ? 'tab-active' : ''}`} style={active(s) ? { boxShadow: `inset 0 -2px 0 ${C[c === 'none' ? 'none' : c] === C.none ? '#1E1D22' : C[c]}` } : undefined}>
      <span className="h-[7px] w-[7px] rounded-full" style={{ background: C[c] }} aria-hidden />{l}
    </Link>
  );
  return (
    <div className="-mx-4 mb-5 border-b border-line bg-surface md:-mx-6" role="navigation" aria-label="Project sections">
      <div className="mx-auto flex max-w-[1680px] items-center gap-5 overflow-x-auto px-4 md:px-6">
        <div className="hidden shrink-0 items-center gap-2 border-r border-line pr-5 md:flex"><span className="max-w-[200px] truncate text-[14px] font-semibold">{title}</span><span className="font-mono text-[11px] text-ink-muted">{progress}%</span></div>
        <div className="flex items-center gap-[14px]">
          {PRIMARY.map(tab)}
          <details className="group relative hidden md:block">
            <summary className={`tab list-none cursor-pointer ${moreActive ? 'tab-active' : ''}`}>More ▾</summary>
            <div className="absolute right-0 top-full z-30 mt-1 min-w-[190px] rounded-lg border border-line bg-surface p-1.5 shadow-md">
              {MORE.map(([s, l, c]) => <Link key={s} href={base + s} className="flex min-h-[36px] items-center gap-2 rounded-md px-3 text-[13px] hover:bg-sunken"><span className="h-[7px] w-[7px] rounded-full" style={{ background: C[c] }} />{l}</Link>)}
            </div>
          </details>
          <div className="flex items-center gap-[14px] md:hidden">{MORE.map(tab)}</div>
        </div>
      </div>
    </div>
  );
}
