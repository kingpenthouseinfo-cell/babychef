// Runs once when the Next.js server starts: begin watching the local project folders.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startProjectWatcher } = await import('./lib/watcher');
    startProjectWatcher();
    try { const { backupDatabase } = await import('./lib/backup'); await backupDatabase('auto'); setInterval(() => { void backupDatabase('auto').catch(() => undefined); }, 6 * 60 * 60 * 1000); } catch (e) { console.error('[backup]', e); }
    try { const { ensureProjectCodes } = await import('./lib/project-codes'); await ensureProjectCodes(); } catch { /* database not ready yet */ }
    try { const { backfillPositions } = await import('./lib/order'); await backfillPositions(); } catch { /* database not ready yet */ }
  }
}
