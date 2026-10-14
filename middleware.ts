import { NextResponse, type NextRequest } from 'next/server';
import { isOutside } from '@/lib/outside';

/**
 * Keeps the app private when a tunnel / reverse proxy makes it reachable from outside this Mac.
 * Requests that come from outside (a public host name, or a public client address behind a proxy) may ONLY fetch signed reference resources.
 * Every page, form and other API stays closed to them. Normal use (localhost, or your home network) is unchanged.
 */
const OPEN = [/^\/api\/images\/[^/]+\/(file|download)$/, /^\/api\/projects\/[^/]+\/images\/[^/]+\/references$/, /^\/api\/ai-refs\/[^/]+\/zip$/];

export function middleware(req: NextRequest) {
  if (!isOutside(req.headers)) return NextResponse.next();
  if (req.method === 'GET' && OPEN.some(r => r.test(req.nextUrl.pathname))) return NextResponse.next();
  return new NextResponse('Not available from outside this computer.', { status: 403 });
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
