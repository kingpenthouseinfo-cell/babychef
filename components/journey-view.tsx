import Link from 'next/link';
import type { JState, JStep } from '@/lib/journey';

const WORD: Record<JState, string> = { DONE: 'Done', 'IN PROGRESS': 'In progress', 'NOT STARTED': 'Not started', 'NEEDS FIXING': 'Needs fixing', WAITING: 'Waiting' };
const BAND: Record<string, { bg: string; ink: string; bd: string }> = {
  'GET READY': { bg: 'linear-gradient(135deg,#EAF4EC,#F1F7E8)', ink: '#4C6B52', bd: '#CFE3D3' },
  'PLAN THE VIDEO': { bg: 'linear-gradient(135deg,#EAF4EC,#F1F7E8)', ink: '#4C6B52', bd: '#CFE3D3' },
  'MAKE THE PICTURES': { bg: 'linear-gradient(135deg,#FDECF1,#F9EEF7)', ink: '#9A4A64', bd: '#F0CDDA' },
  'CHECK PICTURES': { bg: 'linear-gradient(135deg,#FDECF1,#F9EEF7)', ink: '#9A4A64', bd: '#F0CDDA' },
  'MAKE VIDEO CLIPS': { bg: 'linear-gradient(135deg,#F1EAFB,#F6ECF8)', ink: '#6A4E98', bd: '#DCCDEF' },
  'SHORT / REEL': { bg: 'linear-gradient(135deg,#F1EAFB,#F6ECF8)', ink: '#6A4E98', bd: '#DCCDEF' },
  'POST VIDEO': { bg: 'linear-gradient(135deg,#F1EAFB,#F6ECF8)', ink: '#6A4E98', bd: '#DCCDEF' },
  FINISH: { bg: 'linear-gradient(135deg,#F1EAFB,#F6ECF8)', ink: '#6A4E98', bd: '#DCCDEF' },
};

function Icon({ state }: { state: JState }) {
  const base = 'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold';
  if (state === 'DONE') return <span className={`${base} bg-[#E6EEE3] text-[#46704F]`} aria-label="Done">✓</span>;
  if (state === 'NEEDS FIXING') return <span className={`${base} bg-[#F5E1DB] text-[#A5473A]`} aria-label="Needs fixing">!</span>;
  if (state === 'WAITING') return <span className={`${base} bg-[#F4E8CF] text-[#8E6720]`} aria-label="Waiting">◷</span>;
  if (state === 'IN PROGRESS') return <span className={`${base} bg-[#E3EAF2] text-[#46638A]`} aria-label="In progress">●</span>;
  return <span className={`${base} border border-line-strong bg-white`} aria-label="Not started" />;
}

function Row({ s, hideDone, child = false, open = false }: { s: JStep; hideDone: boolean; child?: boolean; open?: boolean }) {
  if (hideDone && s.state === 'DONE') return null;
  const body = (
    <>
      <Icon state={s.state} />
      <span className="min-w-0 flex-1"><span className={`block text-[15px] ${child ? '' : 'font-medium'} ${s.state === 'NOT STARTED' ? 'text-ink-secondary' : ''}`}>{s.label}</span></span>
      <span className="max-w-[45%] truncate text-right text-[13px] text-ink-secondary">{s.detail ?? (s.state === 'NOT STARTED' || s.state === 'DONE' ? '' : WORD[s.state])}</span>
    </>
  );
  const row = 'flex min-h-[48px] items-center gap-3 px-4 py-2';
  if (!s.children?.length) return <li><Link href={s.href} className={`${row} hover:bg-sunken`}>{body}<span className="text-ink-muted" aria-hidden>›</span></Link></li>;
  return (
    <li>
      <details open={open}>
        <summary className={`${row} cursor-pointer list-none hover:bg-sunken`}>{body}<span className="text-ink-muted" aria-hidden>▸</span></summary>
        <ul className="border-t border-line bg-[#FAF9FC] px-3 py-1">
          {s.children.map((c, i) => <Row key={i} s={c} hideDone={false} child />)}
          <li><Link href={s.href} className="block px-4 py-2 text-[12.5px] font-semibold text-blue-deep">Open this scene →</Link></li>
        </ul>
      </details>
    </li>
  );
}

export function JourneyList({ sections, hideDone }: { sections: { title: string; steps: JStep[] }[]; hideDone: boolean }) {
  return (
    <div className="space-y-4">
      {sections.map(sec => {
        const visible = hideDone ? sec.steps.filter(s => s.state !== 'DONE') : sec.steps;
        if (!visible.length) return null;
        const b = BAND[sec.title] ?? BAND['GET READY'];
        const done = sec.steps.filter(s => s.state === 'DONE').length;
        return (
          <section key={sec.title} className="overflow-hidden rounded-[18px] border bg-white" style={{ borderColor: b.bd }}>
            <h2 className="flex items-center justify-between px-4 py-2.5 font-sans text-[11.5px] font-bold uppercase tracking-[0.14em]" style={{ background: b.bg, color: b.ink }}><span>{sec.title}</span><span>{done} / {sec.steps.length}</span></h2>
            <ul className="divide-y divide-line">{sec.steps.map((s, i) => <Row key={i} s={s} hideDone={hideDone} open={sec.title === 'MAKE THE PICTURES' && i === sec.steps.findIndex(x => x.state !== 'DONE' && x.state !== 'NOT STARTED')} />)}</ul>
          </section>
        );
      })}
    </div>
  );
}
