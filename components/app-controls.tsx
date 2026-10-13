'use client';
import { useEffect, useState } from 'react';

type Check = { canUpdate: boolean; behind?: number | null; reason?: string };

/** Check for updates, update and quit — all from inside the app. */
export function AppControls() {
  const [info, setInfo] = useState<Check | null>(null);
  const [busy, setBusy] = useState<'' | 'check' | 'update' | 'quit'>('check');
  const [msg, setMsg] = useState('');
  const [gone, setGone] = useState('');

  async function check() {
    setBusy('check'); setMsg('');
    try { setInfo(await (await fetch('/api/update')).json()); } catch { setMsg('Could not check right now.'); }
    setBusy('');
  }
  useEffect(() => { check(); }, []);

  async function waitBack() {
    // the app goes away while it updates, then comes back: reload when it answers again
    let sawDown = false;
    for (let i = 0; i < 600; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try { const r = await fetch('/api/update', { cache: 'no-store' }); if (r.ok && sawDown) { location.reload(); return; } } catch { sawDown = true; }
    }
    setMsg('Still working. If nothing happens, click the Baby Chef Studio icon again.');
  }
  async function update() {
    setBusy('update'); setMsg('');
    const r = await fetch('/api/update', { method: 'POST' }).then(x => x.json()).catch(() => ({ ok: false }));
    if (!r.ok) { setMsg(r.error || 'Could not start the update.'); setBusy(''); return; }
    setGone('Updating… this takes a few minutes. The page will reload by itself when it is ready. Please keep this window open.');
    waitBack();
  }
  async function quit() {
    if (!window.confirm('Quit Baby Chef Studio? Your recipes and pictures stay saved. Click the Baby Chef Studio icon to open it again.')) return;
    setBusy('quit');
    await fetch('/api/quit', { method: 'POST' }).catch(() => null);
    setGone('Baby Chef Studio has stopped. Click its icon to open it again. You can close this tab.');
  }
  if (gone) return <p className="mt-3 rounded-lg bg-[#EAF4EC] p-4 text-[14px]" role="status">{gone}</p>;
  return (
    <div className="mt-3 space-y-3">
      <div className="text-[14px]" data-testid="update-status">
        {busy === 'check' ? 'Checking for updates…' : !info?.canUpdate ? (info?.reason ?? 'Updates are not available for this copy.') : info.behind == null ? (info.reason ?? 'Could not check right now.') : info.behind > 0 ? `✓ A new version is ready (${info.behind} change${info.behind === 1 ? '' : 's'}).` : 'You have the newest version.'}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-approve" disabled={!info?.canUpdate || busy !== ''} onClick={update}>{busy === 'update' ? 'Updating…' : 'UPDATE NOW'}</button>
        <button type="button" className="btn" disabled={busy !== ''} onClick={check}>Check again</button>
        <button type="button" className="btn btn-ghost" disabled={busy !== ''} onClick={quit}>QUIT BABY CHEF STUDIO</button>
      </div>
      {msg && <p className="text-[13px] text-[#A5473A]" role="status">{msg}</p>}
    </div>
  );
}
