import Link from 'next/link';
import { MobileNav } from './client';

export const NAV: [string, string][] = [['/', 'Dashboard'], ['/projects', 'Projects'], ['/babychefs', 'Baby Chefs'], ['/queue', 'Prompt Queue'], ['/references', 'References'], ['/corrections', "Don't Do This"], ['/templates', 'Prompt Templates'], ['/settings', 'Settings']];

export function NavLinks() {
  return <>{NAV.map(([h, l]) => <Link key={h} href={h} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100">{l}</Link>)}</>;
}

export function Shell({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-56 shrink-0 border-r border-line bg-white p-4 lg:block">
        <Link href="/" className="mb-5 block text-lg font-bold tracking-tight">{name}</Link>
        <nav aria-label="Primary"><NavLinks /></nav>
        <form action="/search" className="mt-5"><input name="q" placeholder="Search…" aria-label="Search" className="input" /></form>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="relative sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-white px-4 lg:hidden">
          <Link href="/" className="font-bold tracking-tight">{name}</Link>
          <MobileNav><nav aria-label="Primary mobile"><NavLinks /><form action="/search" className="mt-2"><input name="q" placeholder="Search…" aria-label="Search" className="input" /></form></nav></MobileNav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
