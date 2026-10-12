import { answerQuestion, setQuestionStatus, deleteQuestion } from '@/lib/actions/questions';
import { SubmitBtn } from './client';

export type QRow = { id: string; question: string; hint: string | null; answerType: string; choices: string | null; priority: string; blocksText: string | null; status: string; answer: string | null; source: string };

export function QuestionCard({ q }: { q: QRow }) {
  const choices: string[] = q.choices ? JSON.parse(q.choices) : [];
  return (
    <li className="card">
      {q.blocksText && <div className="mb-1 inline-block rounded-full bg-[#F8EFD9] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#8A6216] ring-1 ring-[#E7D3A0]">{q.blocksText}</div>}
      <div className="text-[15px] font-semibold leading-snug">{q.question}</div>
      {q.hint && <div className="text-[12px] text-ink-secondary">{q.hint}</div>}
      <form action={answerQuestion} className="mt-3 space-y-2">
        <input type="hidden" name="id" value={q.id} />
        {q.answerType === 'choice' ? (
          <div className="space-y-1.5">{choices.map(c => <label key={c} className="flex min-h-[40px] items-center gap-2 rounded-md border border-line px-3 text-[14px]"><input type="radio" name="answer" value={c} className="accent-[#4C6B52]" />{c}</label>)}
            <input name="other" className="input" placeholder="If other, type it here" aria-label="Other answer" /></div>
        ) : q.answerType === 'long' ? <textarea name="answer" rows={3} className="input" aria-label="Your answer" />
          : <input name="answer" className="input" aria-label="Your answer" inputMode={q.answerType === 'number' ? 'decimal' : undefined} />}
        <div className="flex flex-wrap gap-2"><SubmitBtn className="btn-primary" pendingText="Saving…">SAVE ANSWER</SubmitBtn></div>
      </form>
      <div className="mt-2 flex flex-wrap gap-2">
        {q.status !== 'UNKNOWN' && <form action={setQuestionStatus}><input type="hidden" name="id" value={q.id} /><input type="hidden" name="status" value="UNKNOWN" /><button className="btn btn-sm btn-ghost">I DON’T KNOW YET</button></form>}
        <form action={setQuestionStatus}><input type="hidden" name="id" value={q.id} /><input type="hidden" name="status" value="NOT_NEEDED" /><button className="btn btn-sm btn-ghost">NOT NEEDED</button></form>
        {q.source === 'MANUAL' && <form action={deleteQuestion}><input type="hidden" name="id" value={q.id} /><button className="btn btn-sm btn-ghost">Delete</button></form>}
      </div>
    </li>
  );
}
