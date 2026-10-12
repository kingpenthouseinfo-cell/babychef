import Link from 'next/link';

const ITEMS: [string, string][] = [['/settings#general', 'General'], ['/settings#defaults', 'Video Defaults'], ['/settings/bible', 'My Video Style'], ['/templates', 'Prompt Templates'], ['/settings#tools', 'External Tool Links'], ['/settings#naming', 'File Naming'], ['/settings#storage', 'Storage']];

export function SettingsNav({ active }: { active: string }) {
  return (
    <nav className="-mx-4 mb-5 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0" aria-label="Settings sections">
      {ITEMS.map(([h, l]) => <Link key={h} href={h} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium transition ${active === l ? 'bg-blue-light text-blue-deep' : 'text-ink-secondary hover:bg-sunken'}`}>{l}</Link>)}
    </nav>
  );
}
