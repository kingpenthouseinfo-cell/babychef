'use client';
import { useRef } from 'react';
import { setWatchFolders } from '@/lib/actions/settings';

/** A switch that saves itself. */
export function WatchToggle({ on }: { on: boolean }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={setWatchFolders}>
      <label className="relative inline-flex cursor-pointer items-center" aria-label="Watch folders for new pictures and clips">
        <input type="checkbox" name="watch" defaultChecked={on} className="peer sr-only" onChange={() => ref.current?.requestSubmit()} />
        <span className="h-7 w-12 rounded-full bg-[#D5D1DC] transition peer-checked:bg-[#6E9A76]" />
        <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </label>
    </form>
  );
}
