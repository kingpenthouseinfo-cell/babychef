'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setProjectColor } from '@/lib/actions/project-color';
import { PROJECT_COLORS } from '@/lib/project-color';

/** The project's colour dot in the header: click to pick a different pastel (or back to automatic). */
export function ProjectColorPicker({ projectId, current, isAuto }: { projectId: string; current: string; isAuto: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const pick = (key: string) => start(async () => { await setProjectColor(projectId, key); setOpen(false); router.refresh(); });
  const cur = PROJECT_COLORS.find(c => c.key === current) ?? PROJECT_COLORS[0];
  return (
    <span className="relative inline-flex align-middle">
      <button type="button" onClick={() => setOpen(o => !o)} aria-label="Change this video's colour" aria-expanded={open} title="This video's colour — click to change" data-testid="project-color-btn"
        className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-white shadow-sm" style={{ background: cur.dot }} />
      {open && (
        <span className="absolute left-0 top-[34px] z-40 w-[232px] rounded-[14px] border border-line bg-white p-3 shadow-md" role="dialog" aria-label="Pick a colour" data-testid="project-color-pop">
          <span className="block text-[12px] font-semibold text-ink-secondary">This video’s colour</span>
          <span className="mt-2 flex flex-wrap gap-2">
            {PROJECT_COLORS.map(c => <button key={c.key} type="button" onClick={() => pick(c.key)} title={c.label} aria-label={c.label} data-testid={`project-color-${c.key}`} className="h-[28px] w-[28px] rounded-full" style={{ background: c.dot, boxShadow: c.key === current && !isAuto ? '0 0 0 3px #fff, 0 0 0 5px #1E1D22' : undefined }} />)}
          </span>
          <button type="button" onClick={() => pick('')} className="mt-3 text-[12.5px] font-semibold text-blue-deep hover:underline" data-testid="project-color-auto">{isAuto ? '✓ Automatic' : 'Use automatic colour'}</button>
        </span>)}
    </span>
  );
}
