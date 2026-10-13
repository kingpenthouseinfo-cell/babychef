import { NextResponse } from 'next/server';
import { isLocalRequest } from '@/lib/local-only';

export const dynamic = 'force-dynamic';

/** Quit Baby Chef Studio (the button in Settings). Data is untouched. */
export async function POST(req: Request) {
  if (!isLocalRequest(req)) return NextResponse.json({ error: 'Only from this computer' }, { status: 403 });
  setTimeout(() => process.exit(0), 400);
  return NextResponse.json({ ok: true });
}
