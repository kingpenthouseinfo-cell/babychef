import { NextRequest } from 'next/server';
import { GET as serve } from '../file/route';

export const dynamic = 'force-dynamic';

/** Same as /file but the browser saves it (Content-Disposition: attachment). Same signed-link rules. */
export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const u = new URL(req.url); u.searchParams.set('download', '1');
  return serve(new NextRequest(u, req), ctx);
}
