import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Shell } from '@/components/nav';
import { ensureDefaults, getSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'Baby Chef Studio', description: 'Production manager for Baby Chef cooking videos' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await ensureDefaults();
  const s = await getSettings();
  return (
    <html lang="en"><body><Shell name={s.appName}>{children}</Shell></body></html>
  );
}
