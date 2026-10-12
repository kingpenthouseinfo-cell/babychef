import Link from 'next/link';
import { db } from '@/lib/db';
import { ensureBible, currentBibleVersion } from '@/lib/bible';
import { PageHeader, Chip, Check, Text, Area, Section } from '@/components/ui';
import { ConfirmForm, DirtyForm, SubmitBtn } from '@/components/client';
import { addBibleSection, moveBibleSection, resetBibleSection, restoreBibleVersion, saveBibleSection } from '@/lib/actions/bible';
import { fmtDate } from '@/lib/util';
import { SettingsNav } from '@/components/settings-nav';

export default async function BiblePage({ searchParams }: { searchParams: { s?: string } }) {
  await ensureBible();
  const [secs, versions, v] = await Promise.all([db.bibleSection.findMany({ orderBy: { order: 'asc' } }), db.bibleVersion.findMany({ orderBy: { version: 'desc' }, take: 15 }), currentBibleVersion()]);
  const sel = secs.find(s => s.key === searchParams.s) ?? secs[0];
  return (
    <>
      <PageHeader title="My Video Style" sub={<>Your permanent rules for how every video should look and sound. Current version <b>v{v}</b>. <Link href="/settings" className="underline">← Settings</Link></>} />
      <SettingsNav active="My Video Style" />
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface p-3 text-[13px]"><span className="eyebrow mr-1">Rule hierarchy</span><span className="rounded-md bg-sunken px-2.5 py-1">Project overrides</span>→<span className="rounded-md bg-sunken px-2.5 py-1">Baby Chef profile</span>→<span className="rounded-md bg-blue-light px-2.5 py-1 font-semibold text-blue-deep">Global Production Bible · editing</span><span className="text-ink-secondary">More specific rules win. Approved reference images remain the visual source of truth.</span></div>
      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <nav className="card max-h-[75vh] space-y-0.5 overflow-y-auto p-2" aria-label="Rule sections">
          {secs.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1">
              <Link href={`/settings/bible?s=${s.key}`} className={`flex-1 rounded-lg px-2.5 py-2 text-sm ${s.key === sel?.key ? 'bg-[#F1EAFB] font-semibold text-[#6A4E98]' : 'hover:bg-sunken'} ${!s.active ? 'opacity-50' : ''}`}>{i + 1}. {s.title}</Link>
              <form action={moveBibleSection}><input type="hidden" name="key" value={s.key} /><input type="hidden" name="dir" value="up" /><button className="btn btn-sm px-1.5" aria-label="Move up">↑</button></form>
              <form action={moveBibleSection}><input type="hidden" name="key" value={s.key} /><input type="hidden" name="dir" value="down" /><button className="btn btn-sm px-1.5" aria-label="Move down">↓</button></form>
            </div>
          ))}
          <form action={addBibleSection} className="flex gap-1 pt-2"><input name="title" className="input" placeholder="+ custom section title" aria-label="New section title" /><button className="btn btn-sm">Add</button></form>
        </nav>
        <div className="space-y-5">
          {sel && (
            <Section title={sel.title} right={<span className="text-xs text-ink-secondary">updated {fmtDate(sel.updatedAt)}</span>}>
              <DirtyForm action={saveBibleSection} className="space-y-3" key={sel.id + sel.updatedAt.toISOString()}>
                <input type="hidden" name="key" value={sel.key} />
                <Text name="title" label="Section title" v={sel.title} />
                <Area name="content" label="Rule content" v={sel.content} rows={18} mono />
                <Area name="notes" label="Notes" v={sel.notes} rows={2} />
                <Text name="versionNote" label="Version note (optional)" placeholder="e.g. Faster pacing added" />
                <Check name="active" label="Active (include in prompts)" v={sel.active} />
                <div className="flex flex-wrap gap-2"><SubmitBtn className="btn-accent">Save as v{v + 1}</SubmitBtn></div>
              </DirtyForm>
              {sel.defaultContent && <ConfirmForm action={resetBibleSection} message="Reset this section to the original default text? Your edits to this section will be replaced (an earlier bible version keeps them)." className="mt-3"><input type="hidden" name="key" value={sel.key} /><button className="btn btn-sm">Reset to default</button></ConfirmForm>}
            </Section>
          )}
          <Section title="PAST VERSIONS">
            {versions.map(x => (
              <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-1.5 text-sm last:border-0">
                <span><b>v{x.version}</b> {x.version === v && <Chip tone="APPROVED">CURRENT</Chip>} <span className="text-ink-secondary">{fmtDate(x.createdAt)} · {x.note}</span></span>
                {x.version !== v && <ConfirmForm action={restoreBibleVersion} message={`Restore all sections to version ${x.version}? This creates a new version.`}><input type="hidden" name="id" value={x.id} /><button className="btn btn-sm">Restore</button></ConfirmForm>}
              </div>))}
          </Section>
        </div>
      </div>
    </>
  );
}
void SubmitBtn;
