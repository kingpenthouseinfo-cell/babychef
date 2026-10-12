'use client';
import { useState } from 'react';

/** The answer box, with an optional one-tap suggestion chip (for example “Use 375°F”). */
export function AnswerField({ long, numeric, suggestion }: { long?: boolean; numeric?: boolean; suggestion?: string }) {
  const [v, setV] = useState('');
  return (
    <div>
      {long ? <textarea name="answer" rows={3} value={v} onChange={e => setV(e.target.value)} className="input" aria-label="Your answer" />
        : <input name="answer" value={v} onChange={e => setV(e.target.value)} className="input" aria-label="Your answer" inputMode={numeric ? 'decimal' : undefined} />}
      {suggestion && <button type="button" onClick={() => setV(suggestion)} className="mt-2 rounded-full bg-[#E5EFFB] px-3 py-1 text-[12.5px] font-semibold text-blue-deep">Use {suggestion}</button>}
    </div>
  );
}
