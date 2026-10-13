/** The app is private and local: only the computer itself may stop or update it. */
export function isLocalRequest(req: Request): boolean {
  const host = (req.headers.get('host') || '').replace(/:\d+$/, '');
  if (host !== 'localhost' && host !== '127.0.0.1' && host !== '[::1]') return false;
  const origin = req.headers.get('origin');
  if (origin) { try { const h = new URL(origin).hostname; if (h !== 'localhost' && h !== '127.0.0.1' && h !== '[::1]') return false; } catch { return false; } }
  return true;
}
