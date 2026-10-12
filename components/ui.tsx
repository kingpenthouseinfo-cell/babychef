import Link from 'next/link';
import { Lightbox } from './client';
import { statusWords } from '@/lib/words';

const statusClass = (k: string) => 'st-' + k.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** StatusBadge — the single status component used everywhere (status palette, separate from task colours). */
export function Chip({ children, tone }: { children: React.ReactNode; tone?: string }) {
  const k = tone ?? String(children);
  const cls = k === 'PACKAGE CRITICAL' || k === 'HIGH' ? 'chip-nodot' : '';
  return <span className={`chip ${statusClass(k)} ${cls}`}>{typeof children === 'string' ? statusWords(children) : children}</span>;
}
/** Gold Standard marker: small “GS” monogram, no star. */
export const GoldBadge = () => <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-xs border border-gold-border bg-gold-bg px-1.5 py-[3px] text-[10px] font-semibold leading-none tracking-[0.08em] text-gold-text" title="Gold Standard">GS <span className="hidden sm:inline">GOLD STANDARD</span></span>;

export function PageHeader({ title, sub, children }: { title: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h1 className="break-words">{title}</h1>{sub && <div className="mt-1 text-[14px] text-ink-secondary">{sub}</div>}</div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
export function Empty({ title, hint, children }: { title: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong bg-surface/70 p-8 text-center">
      <div className="text-[15px] font-semibold">{title}</div>
      {hint && <p className="mx-auto mt-1 max-w-md text-[13px] text-ink-secondary">{hint}</p>}
      {children && <div className="mt-4 flex justify-center gap-2">{children}</div>}
    </div>
  );
}
export function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return <section className="card"><div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-[17px]">{title}</h2>{right}</div>{children}</section>;
}
export function Field({ label, children, hint, className = '' }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return <label className={`block ${className}`}><span className="label">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-ink-secondary">{hint}</span>}</label>;
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
  <label className="flex min-h-[32px] items-center gap-2 text-[13px]"><input type="checkbox" name={name} defaultChecked={!!v} className="h-4 w-4 accent-[#4C6B52]" />{label}</label>
);

export const fileUrl = (id: string, w?: number) => `/api/files/${id}${w ? `?w=${w}` : ''}`;
export function Thumb({ id, alt, className = '', w = 480, ratio = 'aspect-[4/3]' }: { id?: string | null; alt: string; className?: string; w?: number; ratio?: string }) {
  if (!id) return <div className={`${ratio} flex w-full items-center justify-center rounded-md border border-line bg-[repeating-linear-gradient(135deg,#ECE9EC_0_8px,#E5E1E5_8px_16px)] text-xs text-ink-muted ${className}`}>no image</div>;
  return <img src={fileUrl(id, w)} alt={alt} loading="lazy" className={`${ratio} w-full rounded-md border border-line bg-sunken object-cover ${className}`} />;
}
export function BigImage({ id, alt, imgClass, wrapClass, w = 640 }: { id: string; alt: string; imgClass?: string; wrapClass?: string; w?: number }) {
  return <Lightbox src={fileUrl(id)} thumb={fileUrl(id, w)} alt={alt} imgClass={imgClass} wrapClass={wrapClass} />;
}
export function Tabs({ items, active }: { items: [string, string][]; active: string }) {
  return (
    <nav className="-mx-4 mb-5 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label="Project sections">
      {items.map(([href, label]) => <Link key={href} href={href} className={`tab ${active === href ? 'tab-active' : ''}`}>{label}</Link>)}
    </nav>
  );
}
export function Stat({ label, value, href, tone }: { label: string; value: React.ReactNode; href?: string; tone?: string }) {
  const inner = <div className={`rounded-lg border border-line bg-surface p-4 transition ${href ? 'hover:border-ink/30' : ''}`}><div className={`font-mono text-[26px] font-medium leading-none ${tone ?? ''}`}>{value}</div><div className="eyebrow mt-2">{label}</div></div>;
  return href ? <Link href={href}>{inner}</Link> : inner;
}
export function ProgressBar({ pct }: { pct: number }) {
  return <div className="h-1 w-full overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-btn-sage" style={{ width: `${pct}%` }} /></div>;
}
export function Warn({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-[#E7D3A0] bg-[#F8EFD9] px-3 py-2 text-[13px] text-[#8A6216]"><b>WARNING:</b> {children}</div>;
}
