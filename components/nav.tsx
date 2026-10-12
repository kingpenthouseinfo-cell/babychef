import Link from 'next/link';
import { NavSearch, BottomNav, TopNavLinks } from './nav-client';
import { WatcherNotice } from './watcher-notice';

/** Top nav (64px). No sidebar. Task colours: sage = references, blue = prompts. */
export function Shell({ name, queueCount, unmatchedCount, children }: { name: string; queueCount: number; unmatchedCount: number; children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-[72px] md:pb-0">
      <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex min-h-[56px] max-w-[1320px] items-center gap-3 px-4 md:min-h-[64px] md:gap-7 md:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] font-serif text-[18px] italic text-white" style={{ background: 'linear-gradient(135deg,#F2AFC4,#A991DA)' }} aria-hidden>b</span>
            <span className="whitespace-nowrap font-serif text-[20px] font-medium tracking-[-0.01em]">{name}</span>
          </Link>
          <TopNavLinks queueCount={queueCount} unmatchedCount={unmatchedCount} />
          <div className="ml-auto flex items-center gap-4">
            <NavSearch />
            <span className="hidden items-center gap-1.5 whitespace-nowrap text-[12.5px] text-ink-secondary lg:inline-flex" title="Files are stored on this computer"><span className="h-[7px] w-[7px] rounded-full bg-[#6E9A76]" />On this Mac</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1320px] px-4 py-6 md:px-8 md:py-8">{children}</main>
      <BottomNav queueCount={queueCount} unmatchedCount={unmatchedCount} />
      <WatcherNotice />
    </div>
  );
}
