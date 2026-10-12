import Link from 'next/link';
import { NavSearch, BottomNav, TopNavLinks } from './nav-client';
import { WatcherNotice } from './watcher-notice';

/** Top nav (64px). No sidebar. Task colours: sage = references, blue = prompts. */
export function Shell({ name, queueCount, unmatchedCount, children }: { name: string; queueCount: number; unmatchedCount: number; children: React.ReactNode }) {
  const [first, ...rest] = name.split(' ');
  return (
    <div className="min-h-screen pb-[72px] md:pb-0">
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-[1680px] items-center gap-4 px-4 md:h-16 md:gap-6 md:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 text-[17px] tracking-[-0.02em]">
            <span className="h-4 w-4 rounded-full bg-logo" aria-hidden />
            <span><b className="font-bold">{first}</b> <span className="text-ink-secondary">{rest.join(' ')}</span></span>
          </Link>
          <TopNavLinks queueCount={queueCount} unmatchedCount={unmatchedCount} />
          <div className="ml-auto flex items-center gap-4">
            <NavSearch />
            <span className="hidden items-center gap-1.5 font-mono text-[12px] text-ink-muted lg:inline-flex" title="Files are stored on this computer"><span className="h-1.5 w-1.5 rounded-full bg-sage-deep" />On this Mac</span>
            <Link href="/settings" className="hidden text-[14px] text-ink-secondary hover:text-ink md:inline">Settings</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1680px] px-4 py-5 md:px-6 md:py-7">{children}</main>
      <BottomNav queueCount={queueCount} unmatchedCount={unmatchedCount} />
      <WatcherNotice />
    </div>
  );
}
