// Runs once when the Next.js server starts: begin watching the local project folders.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startProjectWatcher } = await import('./lib/watcher');
    startProjectWatcher();
  }
}
