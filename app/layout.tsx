import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Shell } from '@/components/nav';
import { ensureDefaults, getSettings } from '@/lib/settings';
import { ensureBible } from '@/lib/bible';
import { db } from '@/lib/db';

export const metadata: Metadata = { title: 'Baby Chef Studio', description: 'Production manager for Baby Chef cooking videos' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await ensureDefaults();
  await ensureBible();
  const [s, queueCount] = await Promise.all([getSettings(), db.plannedImage.count({ where: { status: 'READY', project: { deletedAt: null } } })]);
  return (
    <html lang="en"><body><Shell name={s.appName} queueCount={queueCount}>{children}</Shell></body></html>
  );
}
