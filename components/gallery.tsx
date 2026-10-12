'use client';
import { useEffect, useState, useTransition } from 'react';
import { RevealButton } from './image-workspace';
import { setGoldBulk, linkRefsToImage } from '@/lib/actions/babychef';
import { IMAGE_REF_ROLES } from '@/lib/constants';

export type GTile = { id: string; assetId: string; title: string; category: string; version: number; gold: boolean; hasNotes: boolean; code: string };
export type ImgTarget = { id: string; label: string };

/** Reference gallery: S/M/L size, multi-select, bulk bar (Link to image / Mark Gold Standard / Show in Finder), Space = large preview. */
export function Gallery({ tiles, targets }: { tiles: GTile[]; targets: ImgTarget[] }) {
  const [size, setSize] = useState<'S' | 'M' | 'L'>('M');
  const [sel, setSel] = useState<string[]>([]);
  const [link, setLink] = useState(false);
  const [big, setBig] = useState<string | null>(null);
  const [img, setImg] = useState(''); const [role, setRole] = useState('CUSTOM REFERENCE');
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  useEffect(() => { try { const s = localStorage.getItem('bcs-gallery-size'); if (s === 'S' || s === 'M' || s === 'L') setSize(s); } catch { /* ignore */ } }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === ' ' && sel.length) { e.preventDefault(); setBig(b => (b ? null : tiles.find(t => t.id === sel[0])?.assetId ?? null)); }
      if (e.key === 'Escape') { setBig(null); setLink(false); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [sel, tiles]);
  const cols = size === 'S' ? 'grid-cols-3 md:grid-cols-5 xl:grid-cols-6' : size === 'M' ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';
  const toggle = (id: string) => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const chosen = tiles.filter(t => sel.includes(t.id));
  const allGold = chosen.length > 0 && chosen.every(t => t.gold);
  return (
    <div>
      <div className="mb-3 flex items-center justify-end"><div role="group" aria-label="Thumbnail size" className="flex gap-1 rounded-md bg-sunken p-1 text-[11px] font-semibold">
        {(['S', 'M', 'L'] as const).map(s => <button key={s} type="button" onClick={() => { setSize(s); try { localStorage.setItem('bcs-gallery-size', s); } catch { /* ignore */ } }} aria-pressed={size === s} className={`rounded-sm px-2.5 py-1 ${size === s ? 'bg-surface shadow-sm' : 'text-ink-secondary'}`}>{s}</button>)}</div></div>
      {sel.length > 0 && (
        <div className="fixed inset-x-0 bottom-14 z-40 flex flex-wrap items-center gap-x-4 gap-y-2 bg-ink px-4 py-2.5 text-[13px] text-white md:sticky md:inset-x-auto md:top-[72px] md:bottom-auto md:z-20 md:mb-3 md:rounded-lg">
          <b>{sel.length} selected</b>
          <button type="button" className="hover:underline" onClick={() => setLink(!link)}>Link to image…</button>
          <button type="button" className="hover:underline" disabled={pending} onClick={() => start(async () => { await setGoldBulk(sel, !allGold); })}>{allGold ? 'Remove Gold Standard' : 'Mark Gold Standard'}</button>
          {chosen[0] && <RevealButton assetId={chosen[0].assetId} label="Show in Finder" className="hover:underline" />}
          <button type="button" className="ml-auto text-white/70 hover:text-white" onClick={() => { setSel([]); setLink(false); }}>Clear</button>
          {link && (
            <div className="flex w-full flex-wrap items-center gap-2 border-t border-white/20 pt-2 text-ink">
              <select value={img} onChange={e => setImg(e.target.value)} className="input !w-auto min-w-[240px] !py-1.5 text-[13px]" aria-label="Picture"><option value="">Choose a picture…</option>{targets.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
              <select value={role} onChange={e => setRole(e.target.value)} className="input !w-auto !py-1.5 text-[13px]" aria-label="Role">{IMAGE_REF_ROLES.map(r => <option key={r}>{r}</option>)}</select>
              <button type="button" disabled={!img || pending} className="btn btn-sm btn-approve" onClick={() => start(async () => { await linkRefsToImage(img, sel, role); setMsg(`Linked ${sel.length} reference(s)`); setLink(false); setTimeout(() => setMsg(''), 2500); })}>Link</button>
            </div>
          )}
        </div>
      )}
      {msg && <p className="mb-2 text-[13px] font-medium text-sage-deep" role="status">{msg}</p>}
      <ul className={`grid gap-4 ${cols}`}>
        {tiles.map(t => {
          const on = sel.includes(t.id);
          return (
            <li key={t.id}>
              <button type="button" onClick={() => toggle(t.id)} aria-pressed={on} aria-label={`${t.title} (${t.category})${on ? ', selected' : ''}`}
                className={`relative block w-full overflow-hidden rounded-lg border bg-sunken text-left transition ${on ? 'border-ink ring-2 ring-ink' : 'border-line hover:border-ink/30'}`}>
                <img src={`/api/files/${t.assetId}?w=${size === 'L' ? 800 : 480}`} alt="" loading="lazy" className={`w-full object-cover ${size === 'L' ? 'aspect-[4/3]' : 'aspect-[4/5]'}`} />
                {t.gold && <span className="absolute left-2 top-2 rounded-xs border border-gold-border bg-gold-bg px-1.5 py-[3px] text-[10px] font-semibold leading-none text-gold-text">GS</span>}
                <span className="absolute bottom-2 left-2 rounded-xs bg-surface/85 px-1.5 py-0.5 font-mono text-[10px] text-ink-secondary">{t.category}</span>
                {t.hasNotes && <span className="absolute bottom-2 right-2 h-2 w-2 rounded-full bg-[#C99A3A]" title="Has notes" />}
                {on && <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-sage-deep text-[12px] text-white">✓</span>}
              </button>
              <div className="mt-1.5 flex items-baseline justify-between gap-2"><span className="truncate text-[13px] font-semibold">{t.title}</span><span className="font-mono text-[11px] text-ink-muted">v{t.version}</span></div>
              <div className="truncate text-[12px] text-ink-secondary">{t.category}</div>
            </li>
          );
        })}
      </ul>
      {big && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setBig(null)} role="dialog" aria-label="Large preview"><img src={`/api/files/${big}`} alt="" className="max-h-full max-w-full rounded-md" /></div>}
    </div>
  );
}
