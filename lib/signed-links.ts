import crypto from 'node:crypto';
import { headers } from 'next/headers';

/**
 * Short-lived signed links for direct image access (so a browser agent can open an image without being "logged in").
 * Nothing here makes pictures public: a link only works until it expires, and only for the exact thing it was made for.
 * The signing secret lives only in this running app (a restart invalidates old links).
 */
const g = globalThis as unknown as { __bcsLinkSecret?: string };
const secret = () => (g.__bcsLinkSecret ??= process.env.BCS_LINK_SECRET || crypto.randomBytes(32).toString('hex'));
export const LINK_TTL_SECONDS = 12 * 60 * 60;

export function sign(scope: string, ttl = LINK_TTL_SECONDS): { exp: number; sig: string } {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  return { exp, sig: crypto.createHmac('sha256', secret()).update(`${scope}.${exp}`).digest('hex').slice(0, 40) };
}
export function verify(scope: string, exp: string | null, sig: string | null): boolean {
  if (!exp || !sig) return false;
  const e = parseInt(exp, 10);
  if (!Number.isFinite(e) || e < Math.floor(Date.now() / 1000)) return false;
  const want = crypto.createHmac('sha256', secret()).update(`${scope}.${e}`).digest('hex').slice(0, 40);
  const a = Buffer.from(want), b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** http://localhost:3000 — the address this page was opened on. */
export function origin(): string {
  const h = headers();
  const host = h.get('host') || 'localhost:3000';
  const proto = h.get('x-forwarded-proto') || (/^(localhost|127\.0\.0\.1)/.test(host) ? 'http' : 'https');
  return `${proto}://${host}`;
}

const q = (o: Record<string, string | number>) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');

/** Full-resolution image bytes for an asset (or a planned picture id), as an absolute, expiring link. */
export function directImageUrl(assetId: string, extra: Record<string, string> = {}): string {
  const { exp, sig } = sign(`img:${assetId}`);
  return `${origin()}/api/images/${assetId}/file?${q({ ...extra, exp, sig })}`;
}
export const downloadImageUrl = (assetId: string, name: string) => directImageUrl(assetId, { download: '1', name });
export function zipUrl(imageId: string): string { const { exp, sig } = sign(`zip:${imageId}`); return `${origin()}/api/ai-refs/${imageId}/zip?${q({ exp, sig })}`; }
export function manifestUrl(slug: string, imageId: string): string { const { exp, sig } = sign(`manifest:${imageId}`); return `${origin()}/api/projects/${slug}/images/${imageId}/references?${q({ exp, sig })}`; }
