'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type Item = { href: string; label: string; dot?: string };
const MAIN: Item[] = [
  { href: '/', label: 'Home' }, { href: '/projects', label: 'Recipe Videos' }, { href: '/babychefs', label: 'Baby Chefs', dot: '#4C6B52' }, { href: '/settings', label: 'Settings' },
];
const MORE: Item[] = [{ href: '/queue', label: 'Pictures to Make' }, { href: '/references', label: 'Example Pictures' }, { href: '/corrections', label: "Don't Do This" }, { href: '/templates', label: 'Prompt Templates' }, { href: '/settings/bible', label: 'My Video Style' }, { href: '/search', label: 'Search' }];

const isActive = (path: string, href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));

export function TopNavLinks({ queueCount, unmatchedCount }: { queueCount: number; unmatchedCount: number }) {
  const path = usePathname();
  return (
    <nav className="hidden items-center gap-0.5 md:flex" aria-label="Primary">
      {MAIN.map(i => (
        <Link key={i.href} href={i.href} className={`flex h-9 items-center gap-1.5 whitespace-nowrap rounded-[9px] border px-3.5 text-[14px] transition ${isActive(path, i.href) ? 'border-line-strong bg-white font-semibold text-ink' : 'border-transparent font-medium text-ink-secondary hover:bg-[#F1EFF5] hover:text-ink'}`} aria-current={isActive(path, i.href) ? 'page' : undefined}>
          {i.label}
        </Link>
      ))}
      <details className="relative">
        <summary className="flex h-9 cursor-pointer list-none items-center rounded-[9px] px-3.5 text-[14px] font-medium text-ink-secondary hover:bg-[#F1EFF5] hover:text-ink">More ▾{queueCount > 0 && <span className="ml-1 font-mono text-[12px] text-blue-deep">{queueCount}</span>}</summary>
        <div className="absolute right-0 top-full z-50 mt-2 min-w-[210px] rounded-[14px] border border-line bg-white p-1.5 shadow-md">
          {MORE.filter(m => m.href !== '/search').map(m => <Link key={m.href} href={m.href} className="flex min-h-[36px] items-center justify-between rounded-md px-3 text-[13px] hover:bg-sunken">{m.label}{m.href === '/queue' && queueCount > 0 && <span className="font-mono text-[12px] text-blue-deep">{queueCount}</span>}</Link>)}
        </div>
      </details>
      {unmatchedCount > 0 && <Link href="/unmatched" className="rounded-full bg-[#F8EFD9] px-3 py-1 text-[12px] font-semibold text-[#8A6216] ring-1 ring-[#E7D3A0]">Unmatched {unmatchedCount}</Link>}
    </nav>
  );
}

export function NavSearch() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ref.current?.focus(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  return (
    <form className="relative hidden lg:block" onSubmit={e => { e.preventDefault(); const q = ref.current?.value.trim(); if (q) router.push(`/search?q=${encodeURIComponent(q)}`); }} role="search">
      <input ref={ref} aria-label="Search" placeholder="Search pictures, scenes, recipes" className="h-9 w-[260px] rounded-[9px] border border-line-strong bg-white pl-8 pr-10 text-[13.5px] outline-none placeholder:text-[#8A8592] focus:border-blue-deep" />
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#8A8592]" aria-hidden>⌕</span><kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-ink-muted">⌘K</kbd>
    </form>
  );
}

export function BottomNav({ queueCount, unmatchedCount }: { queueCount: number; unmatchedCount: number }) {
  const path = usePathname();
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [path]);
  const tabs: Item[] = [{ href: '/', label: 'Home' }, { href: '/projects', label: 'Recipe Videos' }, { href: '/queue', label: 'Pictures' }, { href: '/references', label: 'Examples' }];
  return (
    <div className="md:hidden">
      {more && (
        <div className="fixed inset-x-0 bottom-14 z-40 border-t border-line bg-surface p-3 shadow-md" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <form action="/search" className="mb-2"><input name="q" placeholder="Search pictures, scenes, recipes" aria-label="Search" className="input" /></form>
          {[{ href: '/babychefs', label: 'Baby Chefs' }, { href: '/settings', label: 'Settings' }, { href: '/unmatched', label: `Unmatched files${unmatchedCount ? ` (${unmatchedCount})` : ''}` }, ...MORE.filter(m => m.href !== '/search')].map(m => <Link key={m.href} href={m.href} className="flex min-h-[44px] items-center px-2 text-[15px]">{m.label}</Link>)}
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t border-line bg-surface" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} aria-label="Primary mobile">
        {tabs.map(t => (
          <Link key={t.href} href={t.href} className={`flex h-14 flex-1 flex-col items-center justify-center text-[11px] ${isActive(path, t.href) ? 'font-semibold text-ink' : 'text-ink-secondary'}`}>
            <span className="relative">{t.label}{t.href === '/queue' && queueCount > 0 && <span className="absolute -right-3 -top-2 font-mono text-[10px] text-blue-deep">{queueCount}</span>}</span>
          </Link>
        ))}
        <button onClick={() => setMore(!more)} className={`flex h-14 flex-1 flex-col items-center justify-center text-[11px] ${more ? 'font-semibold text-ink' : 'text-ink-secondary'}`} aria-expanded={more}>More</button>
      </nav>
    </div>
  );
}
