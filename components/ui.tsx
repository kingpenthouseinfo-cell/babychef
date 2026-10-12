import Link from 'next/link';
import { Lightbox } from './client';

const CHIP: Record<string, string> = {
  PLANNED: 'bg-neutral-100 text-neutral-700 border-neutral-300', 'PROMPT DRAFT': 'bg-sky-50 text-sky-800 border-sky-300', READY: 'bg-emerald-50 text-emerald-800 border-emerald-400',
  GENERATING: 'bg-indigo-50 text-indigo-800 border-indigo-300', 'GENERATING EXTERNALLY': 'bg-indigo-50 text-indigo-800 border-indigo-300',
  WAITING: 'bg-amber-50 text-amber-900 border-amber-400', REVIEW: 'bg-violet-50 text-violet-800 border-violet-300', APPROVED: 'bg-green-100 text-green-900 border-green-500',
  REDO: 'bg-orange-50 text-orange-900 border-orange-400', REJECTED: 'bg-red-50 text-red-800 border-red-300', SKIPPED: 'bg-neutral-100 text-neutral-500 border-neutral-300',
  DRAFT: 'bg-sky-50 text-sky-800 border-sky-300', LOCKED: 'bg-neutral-800 text-white border-neutral-800', COMPLETE: 'bg-green-100 text-green-900 border-green-500',
  'IN PROGRESS': 'bg-sky-50 text-sky-800 border-sky-300', SUPERSEDED: 'bg-neutral-100 text-neutral-500 border-neutral-300',
  PUBLISHED: 'bg-green-100 text-green-900 border-green-500', SELECTED: 'bg-emerald-50 text-emerald-800 border-emerald-400', GENERATED: 'bg-violet-50 text-violet-800 border-violet-300',
  'NEEDS PROMPT': 'bg-neutral-100 text-neutral-700 border-neutral-300', 'PROMPT READY': 'bg-sky-50 text-sky-800 border-sky-300',
  HIGH: 'bg-red-50 text-red-800 border-red-300', 'PACKAGE CRITICAL': 'bg-red-600 text-white border-red-600', GOLD: 'bg-yellow-100 text-yellow-900 border-yellow-500',
};
export function Chip({ children, tone }: { children: React.ReactNode; tone?: string }) {
  const k = tone ?? String(children);
  return <span className={`chip ${CHIP[k] ?? 'bg-neutral-100 text-neutral-700 border-neutral-300'}`}>{children}</span>;
}
export const GoldBadge = () => <span className="chip border-yellow-500 bg-yellow-100 text-yellow-900">★ GOLD STANDARD</span>;

export function PageHeader({ title, sub, children }: { title: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h1 className="break-words">{title}</h1>{sub && <div className="mt-0.5 text-sm text-neutral-500">{sub}</div>}</div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
export function Empty({ title, hint, children }: { title: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-line bg-white/60 p-8 text-center">
      <div className="font-semibold">{title}</div>
      {hint && <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500">{hint}</p>}
      {children && <div className="mt-4 flex justify-center gap-2">{children}</div>}
    </div>
  );
}
export function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return <section className="card"><div className="mb-3 flex items-center justify-between gap-2"><h2>{title}</h2>{right}</div>{children}</section>;
}
export function Field({ label, children, hint, className = '' }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return <label className={`block ${className}`}><span className="label">{label}</span>{children}{hint && <span className="mt-0.5 block text-xs text-neutral-500">{hint}</span>}</label>;
}
type P = { name: string; label: string; v?: string | number | null; hint?: string; className?: string; required?: boolean; placeholder?: string; type?: string };
export const Text = ({ name, label, v, hint, className, required, placeholder, type = 'text' }: P) => (
  <Field label={label} hint={hint} className={className}><input className="input" type={type} name={name} defaultValue={v ?? ''} required={required} placeholder={placeholder} /></Field>
);
export const Area = ({ name, label, v, hint, className, rows = 3, id, placeholder, mono }: P & { rows?: number; id?: string; mono?: boolean }) => (
  <Field label={label} hint={hint} className={className}><textarea id={id} className={`input ${mono ? 'mono' : ''}`} name={name} rows={rows} defaultValue={v ?? ''} placeholder={placeholder} /></Field>
);
export const Sel = ({ name, label, v, options, className, hint }: { name: string; label: string; v?: string | null; options: (string | [string, string])[]; className?: string; hint?: string }) => (
  <Field label={label} className={className} hint={hint}>
    <select className="input" name={name} defaultValue={v ?? ''}>
      {options.map(o => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return <option key={val} value={val}>{lab}</option>; })}
    </select>
  </Field>
);
export const Check = ({ name, label, v }: { name: string; label: string; v?: boolean }) => (
  <label className="flex min-h-[32px] items-center gap-2 text-sm"><input type="checkbox" name={name} defaultChecked={!!v} className="h-4 w-4" />{label}</label>
);

export const fileUrl = (id: string, w?: number) => `/api/files/${id}${w ? `?w=${w}` : ''}`;
export function Thumb({ id, alt, className = '', w = 480, ratio = 'aspect-[4/3]' }: { id?: string | null; alt: string; className?: string; w?: number; ratio?: string }) {
  if (!id) return <div className={`${ratio} flex w-full items-center justify-center rounded-lg bg-neutral-100 text-xs text-neutral-400 ${className}`}>no image</div>;
  return <img src={fileUrl(id, w)} alt={alt} loading="lazy" className={`${ratio} w-full rounded-lg bg-neutral-100 object-cover ${className}`} />;
}
export function BigImage({ id, alt }: { id: string; alt: string }) {
  return <Lightbox src={fileUrl(id)} thumb={fileUrl(id, 640)} alt={alt} />;
}
export function Tabs({ items, active }: { items: [string, string][]; active: string }) {
  return (
    <nav className="-mx-4 mb-5 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label="Project sections">
      {items.map(([href, label]) => <Link key={href} href={href} className={`tab ${active === href ? 'tab-active' : ''}`}>{label}</Link>)}
    </nav>
  );
}
export function Stat({ label, value, href, tone }: { label: string; value: React.ReactNode; href?: string; tone?: string }) {
  const inner = <div className={`rounded-xl border border-line bg-white p-3 ${href ? 'hover:border-ink' : ''}`}><div className={`text-2xl font-semibold ${tone ?? ''}`}>{value}</div><div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</div></div>;
  return href ? <Link href={href}>{inner}</Link> : inner;
}
export function ProgressBar({ pct }: { pct: number }) {
  return <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-ink" style={{ width: `${pct}%` }} /></div>;
}
export function Warn({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900"><b>WARNING:</b> {children}</div>;
}
