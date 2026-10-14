import { NextResponse, type NextRequest } from 'next/server';

/**
 * Keeps the app private when a tunnel / reverse proxy makes it reachable from outside this Mac.
 * Requests that come from outside (a public host name, or any forwarding header) may ONLY fetch signed reference resources.
 * Every page, form and other API stays closed to them. Normal use (localhost, or your home network) is unchanged.
 */
const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);
const FORWARD = ['x-forwarded-for', 'x-forwarded-host', 'forwarded', 'cf-connecting-ip', 'cf-ray', 'x-real-ip', 'true-client-ip', 'ngrok-trace-id'];
const OPEN = [/^\/api\/images\/[^/]+\/(file|download)$/, /^\/api\/projects\/[^/]+\/images\/[^/]+\/references$/, /^\/api\/ai-refs\/[^/]+\/zip$/];
const privateHost = (h: string) => LOCAL.has(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h.endsWith('.local') || /^[0-9.]+$/.test(h) || h.startsWith('[');

export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') || '').replace(/:\d+$/, '').toLowerCase();
  const forwarded = FORWARD.some(h => req.headers.has(h));
  const outside = forwarded || !privateHost(host);
  if (!outside) return NextResponse.next();
  if (req.method === 'GET' && OPEN.some(r => r.test(req.nextUrl.pathname))) return NextResponse.next();
  return new NextResponse('Not available from outside this computer.', { status: 403 });
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
