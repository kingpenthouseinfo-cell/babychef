import fs from 'node:fs';
import path from 'node:path';

/**
 * Cloud reference bridge: an optional https address through which a cloud automation can fetch the signed reference images.
 * Stored in a tiny file next to the database (read synchronously so link builders stay simple); PUBLIC_REFERENCE_BASE_URL also works.
 * Unset = localhost only, exactly as before.
 */
const dbFile = () => path.resolve(process.cwd(), 'prisma', (process.env.DATABASE_URL || 'file:./dev.db').replace(/^file:/, ''));
const cfgFile = () => path.join(path.dirname(dbFile()), 'automation.json');
const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);

export function normalizeBase(input: string): { ok: true; base: string } | { ok: false; error: string } {
  const t = input.trim();
  if (!t) return { ok: false, error: 'Paste the https address of your secure tunnel.' };
  let u: URL;
  try { u = new URL(t); } catch { return { ok: false, error: 'That is not a web address. It should look like https://abc123.example.com' }; }
  if (u.username || u.password) return { ok: false, error: 'The address must not contain a username or password.' };
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && LOCAL.has(u.hostname))) return { ok: false, error: 'An address outside this computer must start with https:// (http is only allowed for localhost).' };
  return { ok: true, base: u.origin };
}

let cache: { at: number; v: { base: string | null; source: 'settings' | 'env' | null } } | null = null;
export function publicBase(): { base: string | null; source: 'settings' | 'env' | null } {
  if (cache && Date.now() - cache.at < 2000) return cache.v;
  let v: { base: string | null; source: 'settings' | 'env' | null } = { base: null, source: null };
  try {
    const j = JSON.parse(fs.readFileSync(cfgFile(), 'utf8'));
    const n = typeof j.publicReferenceBaseUrl === 'string' ? normalizeBase(j.publicReferenceBaseUrl) : null;
    if (n?.ok) v = { base: n.base, source: 'settings' };
  } catch { /* none saved */ }
  if (!v.base && process.env.PUBLIC_REFERENCE_BASE_URL) { const n = normalizeBase(process.env.PUBLIC_REFERENCE_BASE_URL); if (n.ok) v = { base: n.base, source: 'env' }; }
  cache = { at: Date.now(), v };
  return v;
}
export function savePublicBase(base: string | null) {
  fs.writeFileSync(cfgFile(), JSON.stringify(base ? { publicReferenceBaseUrl: base } : {}, null, 2));
  cache = null;
}
export const isExternalBase = (b: string | null) => !!b && !LOCAL.has(new URL(b).hostname);
