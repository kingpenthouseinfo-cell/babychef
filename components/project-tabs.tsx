'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const PRIMARY: [string, string][] = [['', 'Overview'], ['/start', 'Start to Finish'], ['/questions', 'Missing Info'], ['/recipe', 'Recipe'], ['/story', 'Scenes & Pictures'], ['/kling', 'Video Clips'], ['/publishing', 'Post Video']];
const MORE: { head: string; items: [string, string, boolean?][] }[] = [
  { head: 'Style', items: [['/settings/bible', 'My Video Style', true], ['/continuity', 'Keep It Consistent'], ['/references', 'Example Pictures']] },
  { head: 'Work', items: [['/ingredients', 'Ingredients'], ['/script', 'Script'], ['/short', 'Short/Reel'], ['/queue', 'Pictures to Make', true], ['/files', 'Files']] },
  { head: 'Advanced', items: [['/builder', 'Write a Prompt'], ['/overrides', 'Special Rules'], ['/scenes', 'Scene details'], ['/images', 'Picture list'], ['/prompts', 'Prompt templates'], ['/notes', 'Notes']] },
];

export function ProjectTabs({ slug, missing }: { slug: string; missing: number }) {
  const path = usePathname();
  const base = `/projects/${slug}`;
  const active = (s: string) => (s === '' ? path === base : s === '/story' ? path.startsWith(base + '/story') || path.startsWith(base + '/images/') : path.startsWith(base + s));
  const moreActive = path === base + '/more' || MORE.some(g => g.items.some(([s, , abs]) => !abs && path.startsWith(base + s))) && !active('/story');
  const tab = ([s, l]: [string, string]) => (
    <Link key={s} href={base + s} aria-current={active(s) ? 'page' : undefined} className={`relative inline-flex items-center gap-2 whitespace-nowrap px-3.5 py-3.5 text-[14px] transition ${active(s) ? 'font-semibold text-ink' : 'font-medium text-ink-secondary hover:text-ink'}`} style={active(s) ? { boxShadow: 'inset 0 -2px 0 #1E1D22' } : undefined}>
      {l}{s === '/questions' && missing > 0 && <span className="inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-[#F4E8CF] px-1.5 text-[12px] font-semibold text-[#8E6720]">{missing}</span>}
    </Link>
  );
  return (
    <div className="-mx-4 my-5 border-b border-line md:-mx-0" role="navigation" aria-label="Recipe video sections">
      <div className="flex items-center overflow-x-auto px-4 md:flex-wrap md:overflow-visible md:px-0">
        {PRIMARY.map(tab)}
        <span className="mx-2 h-5 w-px shrink-0 bg-line-strong" aria-hidden />
        <details className="group relative">
          <summary className={`inline-flex cursor-pointer list-none items-center whitespace-nowrap px-3.5 py-3.5 text-[14px] ${moreActive ? 'font-semibold text-ink' : 'font-medium text-ink-secondary hover:text-ink'}`}>More ▾</summary>
          <div className="absolute left-0 top-full z-30 mt-1 w-[240px] rounded-[14px] border border-line bg-white p-2 shadow-md">
            {MORE.map(g => <div key={g.head}><div className="eyebrow px-3 pb-1 pt-3">{g.head}</div>{g.items.map(([s, l, abs]) => <Link key={s} href={abs ? s : base + s} className="flex min-h-[36px] items-center rounded-md px-3 text-[14px] hover:bg-sunken">{l}</Link>)}</div>)}
            <div className="mt-1 border-t border-line pt-1"><Link href={`${base}/more`} className="flex min-h-[36px] items-center rounded-md px-3 text-[14px] font-semibold text-blue-deep hover:bg-sunken">All tools →</Link></div><div className="eyebrow px-3 pb-1 pt-3">Export</div><a href={`/api/projects/${slug}/export?format=zip`} className="flex min-h-[36px] items-center rounded-md px-3 text-[14px] hover:bg-sunken">Save everything as ZIP</a>
          </div>
        </details>
      </div>
    </div>
  );
}
