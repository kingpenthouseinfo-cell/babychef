'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { testCloudAccess, saveReferenceBase, type BridgeResult } from '@/lib/actions/automation';

/** CLOUD REFERENCE ACCESS: LOCAL ONLY or AVAILABLE, with a test. */
export function CloudReferenceStatus({ projectId, base, source }: { projectId: string; base: string | null; source: 'settings' | 'env' | null }) {
  const [res, setRes] = useState<BridgeResult | null>(null);
  const [pending, start] = useTransition();
  const on = !!base;
  return (
    <section className="card" aria-label="Cloud reference access" data-testid="cloud-status">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><div className="eyebrow">CLOUD REFERENCE ACCESS</div>
          <div className="mt-0.5 flex items-center gap-2"><span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${on ? 'bg-[#DDEBDD] text-[#3F6B47]' : 'bg-[#F4E8CF] text-[#8E6720]'}`} data-testid="cloud-state">{on ? 'AVAILABLE' : 'LOCAL ONLY'}</span></div></div>
        <div className="flex flex-wrap gap-2"><button type="button" className="btn btn-sm" disabled={pending} onClick={() => start(async () => setRes(await testCloudAccess(projectId)))}>{pending ? 'Testing…' : 'TEST CLOUD ACCESS'}</button>
          <Link className="btn btn-sm btn-ghost" href="/settings#automation">Change in Settings</Link></div>
      </div>
      {on ? <p className="mt-1 text-[12.5px] text-ink-secondary"><span className="font-mono">{base}</span> · Signed references expire after 12 hours.{source === 'env' ? ' (Set by PUBLIC_REFERENCE_BASE_URL.)' : ''}</p>
        : <p className="mt-1 text-[12.5px] text-ink-secondary">Reference links work in this browser but cannot be fetched by a cloud automation session. To allow that on purpose, add a secure https address in Settings → Automation.</p>}
      {res && (
        <div className={`mt-2 rounded-lg border p-3 text-[12.5px] ${res.state === 'READY' ? 'border-sage-mid bg-[#EAF4EC]' : 'border-[#E7D3A0] bg-[#F8EFD9]'}`} role="status" data-testid="cloud-result">
          <div className="font-semibold">{res.message}</div>
          {res.localUrl && <div className="mt-1 break-all"><span className="eyebrow">LOCAL URL</span><div className="font-mono text-[11.5px]">{res.localUrl}</div></div>}
          {res.externalUrl && <div className="mt-1 break-all"><span className="eyebrow">EXTERNAL URL</span><div className="font-mono text-[11.5px]">{res.externalUrl}</div></div>}
          {res.checks.map((c, i) => <div key={i}>{c}</div>)}
        </div>
      )}
    </section>
  );
}

/** Settings → Automation → External Reference Base URL */
export function ReferenceBaseForm({ base, source }: { base: string | null; source: 'settings' | 'env' | null }) {
  const [v, setV] = useState(source === 'settings' ? base ?? '' : '');
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (value: string) => start(async () => { const fd = new FormData(); fd.set('base', value); setMsg(await saveReferenceBase(fd)); if (!value) setV(''); });
  return (
    <div className="mt-3 space-y-2">
      <label className="block"><span className="label">External reference base URL (https)</span>
        <input className="input" value={v} onChange={e => setV(e.target.value)} placeholder="https://abc123.your-tunnel.example.com" aria-label="External reference base URL" /></label>
      <div className="flex flex-wrap gap-2"><button type="button" className="btn btn-approve" disabled={pending} onClick={() => run(v)}>SAVE ADDRESS</button><button type="button" className="btn btn-ghost" disabled={pending} onClick={() => run('')}>Clear</button></div>
      {source === 'env' && <p className="text-[12.5px] text-ink-secondary">Currently set by the PUBLIC_REFERENCE_BASE_URL environment variable: <span className="font-mono">{base}</span></p>}
      {msg && <p className={`text-[13px] ${msg.ok ? 'text-[#46704F]' : 'text-[#A5473A]'}`} role="status">{msg.message}</p>}
    </div>
  );
}
