import Link from 'next/link';
import type { JState, JStep } from '@/lib/journey';

const ICON: Record<JState, string> = { DONE: '✓', 'IN PROGRESS': '●', 'NOT STARTED': '○', 'NEEDS FIXING': '!', WAITING: '⏳' };
const CLS: Record<JState, string> = { DONE: 'text-[#3B6448]', 'IN PROGRESS': 'text-[#33507A]', 'NOT STARTED': 'text-ink-muted', 'NEEDS FIXING': 'text-[#A8513F]', WAITING: 'text-[#8A6216]' };
const WORD: Record<JState, string> = { DONE: 'Done', 'IN PROGRESS': 'In progress', 'NOT STARTED': 'Not started', 'NEEDS FIXING': 'Needs fixing', WAITING: 'Waiting' };

function Row({ s, hideDone, child = false }: { s: JStep; hideDone: boolean; child?: boolean }) {
  if (hideDone && s.state === 'DONE') return null;
  const body = (
    <>
      <span className={`w-6 shrink-0 text-center text-[18px] ${CLS[s.state]}`} aria-label={WORD[s.state]}>{ICON[s.state]}</span>
      <span className="min-w-0 flex-1"><span className={`block text-[15px] ${child ? '' : 'font-semibold'} ${s.state === 'NOT STARTED' ? 'text-ink-secondary' : ''}`}>{s.label}</span>{s.detail && <span className="block truncate text-[12px] text-ink-secondary">{s.detail}</span>}</span>
      <span className={`hidden text-[12px] font-semibold sm:inline ${CLS[s.state]}`}>{WORD[s.state]}</span>
    </>
  );
  const row = 'flex min-h-[48px] items-center gap-3 px-3 py-2';
  if (!s.children?.length) return <li><Link href={s.href} className={`${row} hover:bg-sunken`}>{body}</Link></li>;
  return (
    <li>
      <details>
        <summary className={`${row} cursor-pointer list-none hover:bg-sunken`}>{body}<span className="text-ink-muted" aria-hidden>▾</span></summary>
        <ul className="ml-6 border-l border-line">
          {s.children.map((c, i) => <Row key={i} s={c} hideDone={false} child />)}
          <li><Link href={s.href} className="block px-3 py-2 text-[12px] font-semibold text-blue-deep">Open this scene →</Link></li>
        </ul>
      </details>
    </li>
  );
}

export function JourneyList({ sections, hideDone }: { sections: { title: string; steps: JStep[] }[]; hideDone: boolean }) {
  return (
    <div className="space-y-5">
      {sections.map(sec => {
        const visible = hideDone ? sec.steps.filter(s => s.state !== 'DONE') : sec.steps;
        if (!visible.length) return null;
        return (
          <section key={sec.title}>
            <h2 className="mb-1.5 text-[12px] font-semibold tracking-[0.1em] text-ink-secondary">{sec.title}</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">{sec.steps.map((s, i) => <Row key={i} s={s} hideDone={hideDone} />)}</ul>
          </section>
        );
      })}
    </div>
  );
}
