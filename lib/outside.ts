/**
 * Did this request come from outside this computer (through a tunnel or reverse proxy)?
 * Pure and edge-safe, shared by the gate (middleware.ts) and the route checks.
 * Next itself adds x-forwarded-for/host (with the real connection address), so those only count when they name a PUBLIC address or host.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const hostOnly = (h: string) => h.replace(/:\d+$/, '').toLowerCase();
export const privateHost = (h: string) => LOCAL_HOSTS.has(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h.endsWith('.local') || /^169\.254\./.test(h);
const privateIp = (ip: string) => { const t = ip.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/^::ffff:/, ''); return !t || t === '::1' || /^127\./.test(t) || /^10\./.test(t) || /^192\.168\./.test(t) || /^172\.(1[6-9]|2\d|3[01])\./.test(t) || /^169\.254\./.test(t) || t.startsWith('fe80:') || /^f[cd]/.test(t); };

export function isOutside(h: Headers): boolean {
  if (['cf-connecting-ip', 'cf-ray', 'true-client-ip', 'ngrok-trace-id', 'forwarded', 'x-real-ip'].some(k => h.has(k))) return true;
  const host = hostOnly(h.get('host') || '');
  if (!privateHost(host)) return true;
  const fh = h.get('x-forwarded-host');
  if (fh && !privateHost(hostOnly(fh.split(',')[0]))) return true;
  const xff = h.get('x-forwarded-for');
  if (xff && xff.split(',').some(ip => !privateIp(ip))) return true;
  return false;
}
/** Strictly this computer (not even the home network). */
export function isThisComputer(h: Headers): boolean {
  if (isOutside(h)) return false;
  const host = hostOnly(h.get('host') || '');
  if (!LOCAL_HOSTS.has(host)) return false;
  const xff = h.get('x-forwarded-for');
  if (xff && xff.split(',').some(ip => { const t = ip.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/^::ffff:/, ''); return !(t === '::1' || /^127\./.test(t)); })) return false;
  return true;
}
