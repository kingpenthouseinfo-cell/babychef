/** The app is private and local: only this computer itself may stop or update it, or open pictures without a signed link. */
const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);
/** Headers a tunnel or reverse proxy adds. A request carrying any of them did NOT come straight from this computer's own browser. */
export const FORWARD_HEADERS = ['x-forwarded-for', 'x-forwarded-host', 'forwarded', 'cf-connecting-ip', 'cf-ray', 'x-real-ip', 'true-client-ip', 'ngrok-trace-id'];

export function isLocalRequest(req: Request): boolean {
  if (FORWARD_HEADERS.some(h => req.headers.has(h))) return false;
  const host = (req.headers.get('host') || '').replace(/:\d+$/, '');
  if (!LOCAL.has(host)) return false;
  const origin = req.headers.get('origin');
  if (origin) { try { if (!LOCAL.has(new URL(origin).hostname)) return false; } catch { return false; } }
  return true;
}
