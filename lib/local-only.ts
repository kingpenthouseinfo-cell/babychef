import { isThisComputer } from './outside';

/** The app is private and local: only this computer itself may stop or update it, or open pictures without a signed link. */
export function isLocalRequest(req: Request): boolean {
  if (!isThisComputer(req.headers)) return false;
  const origin = req.headers.get('origin');
  if (origin) { try { const h = new URL(origin).hostname; if (h !== 'localhost' && h !== '127.0.0.1' && h !== '[::1]') return false; } catch { return false; } }
  return true;
}
