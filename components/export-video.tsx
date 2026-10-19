'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

type PlanClip = { order: number; kind: 'scene' | 'unassigned'; included: boolean; sceneLabel: string | null; title: string; name: string; missing: boolean; duration: number; width: number; height: number; hasAudio: boolean; warn: string | null };
type Plan = { project: { title: string; slug: string }; clips: PlanClip[]; assignedCount: number; unassignedCount: number; includedCount: number; totalSeconds: number; missing: string[]; warnings: string[]; ffmpeg: boolean; saved: { resolution: '1080p' | '4k'; fps: number; includeUnassigned: boolean }; running: Job | null; history: Job[] };
type Job = { id: string; status: 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELED'; progress: number; stage: string | null; error: string | null; resolution: string; resolutionLabel: string; fps: number; clipCount: number; version: number; encoder: string | null; assetId: string | null; durationSeconds: number | null; fileName: string | null };

const mmss = (s: number) => { const t = Math.round(s); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
const words = (s: number) => { const t = Math.round(s), m = Math.floor(t / 60), r = t % 60; return m ? `${m} minute${m === 1 ? '' : 's'} ${r} second${r === 1 ? '' : 's'}` : `${r} second${r === 1 ? '' : 's'}`; };

/** EXPORT FULL VIDEO: a button on the Video Clips page that opens a panel. Joins the clips in storyboard order into one 1080p / 4K MP4. */
export function ExportVideo({ slug, projectTitle }: { slug: string; projectTitle: string }) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<'1080p' | '4k'>('1080p');
  const [fps, setFps] = useState(30);
  const [inc, setInc] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const base = `/api/projects/${slug}/video-export`;

  const load = useCallback(async (includeUnassigned?: boolean, first = false) => {
    try {
      const r = await fetch(`${base}${includeUnassigned === undefined ? '' : `?includeUnassigned=${includeUnassigned ? 1 : 0}`}`, { cache: 'no-store' });
      const j: Plan = await r.json();
      setPlan(j);
      if (first) { setRes(j.saved.resolution); setFps(j.saved.fps); setInc(j.saved.includeUnassigned); if (j.running) setJob(j.running); }
      setErr('');
    } catch { setErr('Could not read the clips. Is the app still running?'); }
  }, [base]);

  useEffect(() => { if (open) void load(undefined, true); }, [open, load]);

  // follow a running export
  useEffect(() => {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    if (!job || job.status !== 'RUNNING') return;
    timer.current = setInterval(async () => {
      try { const r = await fetch(`${base}/${job.id}`, { cache: 'no-store' }); if (r.ok) setJob(await r.json()); } catch { /* keep trying */ }
    }, 1000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [job?.id, job?.status, base]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resolution: res, fps, includeUnassigned: inc }) });
      const j = await r.json();
      if (!r.ok) { setErr(j.error || 'Could not start the export.'); return; }
      setJob({ id: j.id, status: 'RUNNING', progress: 0, stage: 'Starting', error: null, resolution: res, resolutionLabel: res === '4k' ? '4K UHD' : '1080p', fps, clipCount: plan?.includedCount ?? 0, version: 0, encoder: null, assetId: null, durationSeconds: null, fileName: null });
    } finally { setBusy(false); }
  };
  const cancel = async () => { if (job) await fetch(`${base}/${job.id}/cancel`, { method: 'POST' }); };
  const reveal = async (assetId: string) => { const r = await fetch('/api/reveal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetId }) }).then(x => x.json()).catch(() => null); if (r && !r.ok && r.path) { await navigator.clipboard.writeText(r.path).catch(() => undefined); setErr('Finder only opens on a Mac — the folder path was copied instead.'); } };
  const again = () => { setJob(null); void load(inc); };
  const close = () => { setOpen(false); };

  const included = plan?.clips.filter(c => c.included) ?? [];
  const blocked = !plan || !plan.ffmpeg || plan.includedCount === 0 || plan.missing.length > 0;

  return (
    <>
      <button type="button" className="btn btn-primary min-h-[48px] px-6 text-[15px]" data-testid="export-open" onClick={() => setOpen(true)}>EXPORT FULL VIDEO</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 p-4 md:p-10" role="dialog" aria-modal="true" aria-label="Export full video" data-testid="export-panel">
          <div className="w-full max-w-[640px] rounded-[20px] bg-white p-5 shadow-md md:p-7">
            <div className="flex items-start justify-between gap-3">
              <div><div className="eyebrow">EXPORT FULL VIDEO</div><h2 className="text-[26px] leading-tight">{projectTitle}</h2></div>
              <button type="button" className="btn btn-sm btn-ghost" onClick={close} aria-label="Close" data-testid="export-close">✕</button>
            </div>

            {/* ---------- progress ---------- */}
            {job && job.status === 'RUNNING' && (
              <div className="mt-5" data-testid="export-running">
                <div className="eyebrow">EXPORTING VIDEO</div>
                <div className="mt-2 h-[14px] overflow-hidden rounded-full bg-sunken"><div className="h-full rounded-full bg-[#6A8FC7] transition-all" style={{ width: `${job.progress}%` }} /></div>
                <dl className="mt-3 grid gap-1 text-[14px]"><div>Progress: <b data-testid="export-percent">{job.progress}%</b></div><div>Resolution: <b>{job.resolutionLabel}</b></div><div>Status: <b data-testid="export-stage">{job.stage || 'Working'}</b></div></dl>
                <p className="mt-2 text-[12.5px] text-ink-secondary">You can keep using Baby Chef Studio while this runs.</p>
                <button type="button" className="btn mt-4 min-h-[48px] px-6" onClick={cancel} data-testid="export-cancel">CANCEL EXPORT</button>
              </div>
            )}

            {/* ---------- done ---------- */}
            {job && job.status === 'DONE' && (
              <div className="mt-5" data-testid="export-done">
                <div className="eyebrow text-[#46704F]">VIDEO READY</div>
                <div className="mt-1 text-[20px] font-semibold">{projectTitle}</div>
                <div className="mt-1 text-[14px]">{job.resolutionLabel} · MP4 · {job.fps} fps</div>
                <div className="text-[14px]">Duration: <b>{mmss(job.durationSeconds ?? 0)}</b></div>
                <div className="text-[14px]">Saved to <b>Final Videos</b> as <span className="font-mono text-[12.5px]">{job.fileName}</span></div>
                {err && <p className="mt-2 text-[13px] text-[#A5473A]" role="status">{err}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <a className="btn btn-approve min-h-[48px] px-6" href={`/api/files/${job.assetId}`} target="_blank" rel="noreferrer" data-testid="export-play">PLAY VIDEO</a>
                  <button type="button" className="btn min-h-[48px] px-6" onClick={() => job.assetId && reveal(job.assetId)} data-testid="export-reveal">SHOW IN FOLDER</button>
                  <button type="button" className="btn min-h-[48px] px-6" onClick={again} data-testid="export-again">EXPORT AGAIN</button>
                </div>
              </div>
            )}

            {job && (job.status === 'FAILED' || job.status === 'CANCELED') && (
              <div className="mt-5" data-testid={job.status === 'FAILED' ? 'export-failed' : 'export-canceled'}>
                <div className={`eyebrow ${job.status === 'FAILED' ? 'text-[#A5473A]' : ''}`}>{job.status === 'FAILED' ? 'EXPORT FAILED' : 'EXPORT CANCELED'}</div>
                <p className="mt-1 text-[14px]">{job.status === 'FAILED' ? job.error : 'The export was stopped. Your clips and project are untouched, and the unfinished file was removed.'}</p>
                <button type="button" className="btn btn-primary mt-4 min-h-[48px] px-6" onClick={again}>BACK TO EXPORT OPTIONS</button>
              </div>
            )}

            {/* ---------- options ---------- */}
            {!job && (
              <div className="mt-4" data-testid="export-options">
                {!plan && <p className="text-[14px] text-ink-secondary">Reading the clips…</p>}
                {plan && (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-center text-[13px]">
                      <div className="rounded-xl bg-sunken p-2"><div className="text-[22px] font-semibold" data-testid="export-assigned">{plan.assignedCount}</div>Clips on scenes</div>
                      <div className="rounded-xl bg-sunken p-2"><div className="text-[22px] font-semibold" data-testid="export-unassigned">{plan.unassignedCount}</div>Not on a scene</div>
                      <div className="rounded-xl bg-sunken p-2"><div className="text-[22px] font-semibold" data-testid="export-total">{mmss(plan.totalSeconds)}</div>Total length</div>
                    </div>

                    <fieldset className="mt-4"><legend className="eyebrow">EXPORT QUALITY</legend>
                      <label className="mt-1 flex items-center gap-2 text-[14.5px]"><input type="radio" name="res" checked={res === '1080p'} onChange={() => setRes('1080p')} data-testid="export-res-1080p" /> 1080p, 1920 × 1080</label>
                      <label className="mt-1 flex items-center gap-2 text-[14.5px]"><input type="radio" name="res" checked={res === '4k'} onChange={() => setRes('4k')} data-testid="export-res-4k" /> 4K UHD, 3840 × 2160</label>
                    </fieldset>

                    <fieldset className="mt-4"><legend className="eyebrow">CLIPS NOT ASSIGNED TO A SCENE</legend>
                      <label className="mt-1 flex items-center gap-2 text-[14.5px]"><input type="radio" name="unassigned" checked={!inc} onChange={() => { setInc(false); void load(false); }} data-testid="export-unassigned-no" /> Do not include unassigned clips</label>
                      <label className="mt-1 flex items-center gap-2 text-[14.5px]"><input type="radio" name="unassigned" checked={inc} onChange={() => { setInc(true); void load(true); }} data-testid="export-unassigned-yes" /> Include unassigned clips at the end</label>
                      <p className="mt-1 text-[12.5px] text-ink-secondary">{inc ? `${plan.unassignedCount} unassigned clip${plan.unassignedCount === 1 ? '' : 's'} will be added after the last scene clip, in file-name order.` : `${plan.unassignedCount} unassigned clip${plan.unassignedCount === 1 ? '' : 's'} will be left out.`}</p>
                    </fieldset>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-[14.5px]">
                      <div><div className="eyebrow">FORMAT</div>MP4</div>
                      <label><div className="eyebrow">FRAME RATE</div><select className="input mt-1" value={fps} onChange={e => setFps(parseInt(e.target.value, 10))} data-testid="export-fps"><option value={24}>24 fps</option><option value={30}>30 fps</option><option value={60}>60 fps</option></select></label>
                    </div>

                    <div className="mt-5 rounded-xl border border-line bg-surface p-3" data-testid="export-summary">
                      <div className="eyebrow">READY TO EXPORT</div>
                      <div className="mt-1 text-[14.5px]"><b>{plan.assignedCount}</b> scene clip{plan.assignedCount === 1 ? '' : 's'}{inc ? ` + ${plan.unassignedCount} unassigned at the end` : `, ${plan.unassignedCount} unassigned clip${plan.unassignedCount === 1 ? '' : 's'} excluded`}</div>
                      <div className="text-[14.5px]">Estimated video length: <b>{words(plan.totalSeconds)}</b></div>
                      <div className="text-[14.5px]">Resolution: <b>{res === '4k' ? '4K UHD' : '1080p'}</b> · Format: <b>MP4</b> · {fps} fps</div>
                      {plan.missing.length > 0 && <p className="mt-2 text-[13.5px] font-semibold text-[#A5473A]" data-testid="export-missing">Missing or unreadable: {plan.missing.join(', ')}. Fix or take them off the scene before exporting.</p>}
                      {!plan.ffmpeg && <p className="mt-2 text-[13.5px] font-semibold text-[#A5473A]">FFmpeg was not found. Double-click Baby Chef Studio to update (it comes with the app), or install FFmpeg.</p>}
                      {plan.includedCount === 0 && plan.ffmpeg && <p className="mt-2 text-[13.5px] text-ink-secondary">No clips yet. Drop a finished video on its scene on the Storyboard.</p>}
                      {plan.warnings.map((w, i) => <p key={i} className="mt-1 text-[12.5px] text-[#8E6720]">⚠ {w}</p>)}
                      <details className="mt-2"><summary className="cursor-pointer text-[13.5px] font-semibold text-blue-deep" data-testid="export-view-clips">VIEW CLIPS INCLUDED ({included.length})</summary>
                        <ol className="mt-2 space-y-1 text-[13px]" data-testid="export-clip-list">
                          {included.map(c => <li key={c.order} className={c.missing ? 'text-[#A5473A]' : ''}><b>{c.order}.</b> {c.kind === 'scene' ? `Scene ${c.sceneLabel} · ${c.title}` : 'Not on a scene'} <span className="text-ink-secondary">— {c.name} · {c.missing ? 'MISSING' : mmss(c.duration)}{c.width ? ` · ${c.width}×${c.height}` : ''}</span></li>)}
                          {included.length === 0 && <li className="text-ink-secondary">Nothing selected.</li>}
                        </ol></details>
                    </div>

                    {err && <p className="mt-3 text-[13.5px] font-semibold text-[#A5473A]" role="alert" data-testid="export-error">{err}</p>}
                    <button type="button" className="btn btn-accent mt-5 min-h-[52px] w-full px-6 text-[16px]" disabled={blocked || busy} onClick={start} data-testid="export-start">{busy ? 'STARTING…' : 'START EXPORT'}</button>

                    {plan.history.length > 0 && (
                      <details className="mt-4"><summary className="cursor-pointer text-[13.5px] font-semibold text-ink-secondary">PREVIOUS EXPORTS ({plan.history.length})</summary>
                        <ul className="mt-2 space-y-1 text-[13px]" data-testid="export-history">
                          {plan.history.map(h => <li key={h.id} className="flex flex-wrap items-center gap-2"><span className="font-mono text-[12px]">{h.fileName}</span><span className="text-ink-secondary">{h.resolutionLabel} · {mmss(h.durationSeconds ?? 0)}</span>{h.assetId && <a className="font-semibold text-blue-deep hover:underline" href={`/api/files/${h.assetId}`} target="_blank" rel="noreferrer">Play</a>}</li>)}
                        </ul></details>)}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
