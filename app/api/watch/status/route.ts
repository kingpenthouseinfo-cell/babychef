import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { watcherStatus } from '@/lib/watcher';

export const dynamic = 'force-dynamic';

export async function GET() {
  const w = watcherStatus();
  const unmatched = await db.unmatchedFile.count({ where: { status: 'OPEN' } });
  return NextResponse.json({ ...w, unmatched });
}
