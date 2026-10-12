import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { syncQuestions } from '@/lib/questions';
import { addQuestion, setQuestionStatus } from '@/lib/actions/questions';
import { QuestionCard } from '@/components/question-card';
import { SubmitBtn } from '@/components/client';

const GROUPS = ['RECIPE', 'BABY CHEF', 'VIDEO STYLE', 'SCENES', 'OTHER'];

export default async function Questions({ params }: { params: { slug: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  await syncQuestions(p.id);
  const all = await db.projectQuestion.findMany({ where: { projectId: p.id }, orderBy: { createdAt: 'asc' } });
  const open = all.filter(q => q.status === 'OPEN');
  const soon = open.filter(q => q.priority === 'SOON');
  const later = [...open.filter(q => q.priority !== 'SOON'), ...all.filter(q => q.status === 'UNKNOWN')];
  const answered = all.filter(q => q.status === 'ANSWERED');
  const skipped = all.filter(q => q.status === 'NOT_NEEDED');
  const grouped = (list: typeof all) => GROUPS.map(g => [g, list.filter(q => q.group === g)] as const).filter(([, l]) => l.length > 0);
  return (
    <div className="max-w-[860px] space-y-6">
      <div><h1 className="text-[34px] md:text-[40px]">Missing Info</h1><p className="mt-1 text-[14px] text-ink-secondary">{open.length === 0 ? 'Nothing needed right now.' : `${open.length} thing${open.length > 1 ? 's' : ''} still need answers. Answers go straight into the recipe and prompts.`}</p></div>
      {open.length === 0 && later.length === 0 && <div className="rounded-lg border border-sage-mid bg-sage-tint p-4 text-[14px] text-sage-deep">✓ Nothing needed right now.</div>}
      {soon.length > 0 && <section><h2 className="eyebrow mb-2 !font-sans text-[#8A6216]">NEED THIS SOON</h2>
        {grouped(soon).map(([g, l]) => <div key={g} className="mb-4"><div className="eyebrow mb-1.5">{g}</div><ul className="space-y-3">{l.map(q => <QuestionCard key={q.id} q={q} soon />)}</ul></div>)}</section>}
      {later.length > 0 && <section><h2 className="eyebrow mb-2 !font-sans">CAN ANSWER LATER</h2>
        {grouped(later).map(([g, l]) => <div key={g} className="mb-4"><div className="eyebrow mb-1.5">{g}</div><ul className="space-y-3">{l.map(q => <QuestionCard key={q.id} q={q} />)}</ul></div>)}</section>}
      <details className="card"><summary className="cursor-pointer text-[14px] font-semibold">+ Add question</summary>
        <form action={addQuestion} className="mt-3 space-y-2"><input type="hidden" name="projectId" value={p.id} />
          <label className="block"><span className="label">What do you need to find out?</span><input name="question" required className="input" placeholder="e.g. Ask Mom whether she uses breadcrumbs in the beef filling" /></label>
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="priority" value="SOON" className="accent-[#4C6B52]" /> I need this soon</label>
          <SubmitBtn pendingText="Adding…">ADD QUESTION</SubmitBtn></form></details>
      <details className="card"><summary className="cursor-pointer text-[14px] font-semibold">ANSWERED ({answered.length})</summary>
        <ul className="mt-2 space-y-1 text-[13px]">{answered.map(q => <li key={q.id}>✓ {q.question} <b>{q.answer}</b></li>)}{answered.length === 0 && <li className="text-ink-muted">Nothing answered yet.</li>}</ul>
        {skipped.length > 0 && <><div className="eyebrow mt-3">NOT NEEDED</div><ul className="mt-1 space-y-1 text-[13px]">{skipped.map(q => <li key={q.id} className="flex items-center justify-between gap-2"><span className="text-ink-secondary">{q.question}</span><form action={setQuestionStatus}><input type="hidden" name="id" value={q.id} /><input type="hidden" name="status" value="OPEN" /><button className="btn btn-sm btn-ghost">Ask again</button></form></li>)}</ul></>}
      </details>
    </div>
  );
}
