export function slugify(s: string): string {
  return (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'untitled';
}
export const pad = (n: number, w = 2) => String(n).padStart(w, '0');
export const sceneCode = (order: number) => `SC${pad(order)}`;
export const imageCode = (seq: number) => `IMG-${pad(seq, 3)}`;
export const klingCode = (order: number) => `KLING-${pad(order)}`;
export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
export function fmtDay(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  try { return s ? (JSON.parse(s) as T) : fallback; } catch { return fallback; }
}
export function lines(s: string | null | undefined): string[] {
  return (s || '').split('\n').map(x => x.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);
}
export function wordCount(s: string | null | undefined): number {
  return (s || '').trim().split(/\s+/).filter(Boolean).length;
}
export function orientationOf(w?: number | null, h?: number | null): string {
  if (!w || !h) return 'UNKNOWN';
  const r = w / h;
  if (r > 1.05) return 'LANDSCAPE';
  if (r < 0.95) return 'PORTRAIT';
  return 'SQUARE';
}
export function ratioLabel(w?: number | null, h?: number | null): string {
  if (!w || !h) return '';
  const r = w / h;
  const known: [string, number][] = [['16:9', 16 / 9], ['9:16', 9 / 16], ['1:1', 1], ['4:3', 4 / 3], ['3:4', 3 / 4], ['3:2', 1.5], ['2:3', 2 / 3]];
  for (const [l, v] of known) if (Math.abs(r - v) < 0.03) return l;
  return `${w}×${h}`;
}
export function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}
export function strRaw(fd: FormData, k: string): string {
  return String(fd.get(k) ?? '');
}
export function bool(fd: FormData, k: string): boolean {
  const v = fd.get(k);
  return v === 'on' || v === 'true' || v === '1';
}
export function int(fd: FormData, k: string): number | null {
  const v = str(fd, k);
  if (v === null) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}
/** Pick whitelisted text fields from a form; blank -> null. */
export function pickText(fd: FormData, keys: string[]): Record<string, string | null> {
  const o: Record<string, string | null> = {};
  for (const k of keys) if (fd.has(k)) o[k] = str(fd, k);
  return o;
}
export function pickBools(fd: FormData, keys: string[]): Record<string, boolean> {
  const o: Record<string, boolean> = {};
  for (const k of keys) o[k] = bool(fd, k);
  return o;
}
