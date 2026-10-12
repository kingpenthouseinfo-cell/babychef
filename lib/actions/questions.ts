'use server';
import { revalidatePath } from 'next/cache';
import { db } from '../db';
import { str, strRaw } from '../util';
import { logActivity } from '../activity';
import { syncQuestions } from '../questions';

const PROJECT_FIELDS = ['recipeYield', 'prepTime', 'cookTime', 'longDuration', 'shortDuration', 'mainHook', 'finishedFood', 'recipeSource', 'ctaCustom', 'longHook', 'shortHook'];
const ING_FIELDS = ['quantity', 'unit', 'brand', 'packageSize', 'prepNote'];
const SCENE_FIELDS = ['narrative', 'foodAfter', 'foodBefore', 'adultNotes', 'dialogue', 'mainAction'];
const CHEF_FIELDS = ['voiceInstruction', 'dialogueStyle', 'personality', 'recurringJokes'];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Write an answer to the place it belongs, so nobody has to hunt for the original form field. */
async function applyAnswer(projectId: string, target: string | null, value: string) {
  if (!target || !value.trim()) return;
  const [kind, a, b] = target.split(':');
  const dot = target.split('.');
  if (dot[0] === 'project' && PROJECT_FIELDS.includes(dot[1])) { await db.project.update({ where: { id: projectId }, data: { [dot[1]]: value } as any }); return; }
  if (dot[0] === 'ingredient' && ING_FIELDS.includes(dot[2])) { await db.ingredient.update({ where: { id: dot[1] }, data: { [dot[2]]: value } as any }); return; }
  if (dot[0] === 'scene' && SCENE_FIELDS.includes(dot[2])) { await db.scene.update({ where: { id: dot[1] }, data: { [dot[2]]: value } as any }); return; }
  if (dot[0] === 'chef' && CHEF_FIELDS.includes(dot[1])) { const p = await db.project.findUnique({ where: { id: projectId } }); if (p?.babyChefId) await db.babyChef.update({ where: { id: p.babyChefId }, data: { [dot[1]]: value } as any }); return; }
  if (kind === 'append') { const field = a.split('.')[1], label = b; const p = await db.project.findUniqueOrThrow({ where: { id: projectId } }); const cur = (p as any)[field] || ''; await db.project.update({ where: { id: projectId }, data: { [field]: `${cur}${cur ? '\n' : ''}${label}: ${value}` } as any }); return; }
  if (kind === 'replace') {
    const ph = target.slice('replace:'.length);
    const re = new RegExp(esc(ph), 'g');
    const p = await db.project.findUniqueOrThrow({ where: { id: projectId } });
    const pd: any = {};
    for (const f of ['recipeOriginal', 'recipeAdapted', 'recipeNotes', 'description', 'mainHook', 'finishedFood', 'recipeYield', 'cookTime', 'prepTime']) { const v = (p as any)[f]; if (typeof v === 'string' && re.test(v)) pd[f] = v.replace(re, value); re.lastIndex = 0; }
    if (Object.keys(pd).length) await db.project.update({ where: { id: projectId }, data: pd });
    for (const s of await db.scene.findMany({ where: { projectId } })) {
      const sd: any = {};
      for (const f of ['narrative', 'mainAction', 'dialogue', 'notes', 'foodBefore', 'foodDuring', 'foodAfter']) { const v = (s as any)[f]; if (typeof v === 'string' && re.test(v)) sd[f] = v.replace(re, value); re.lastIndex = 0; }
      if (Object.keys(sd).length) await db.scene.update({ where: { id: s.id }, data: sd });
    }
    return;
  }
  if (kind === 'decide') { // contradiction: record the decision; never rewrite the recipe text silently
    const p = await db.project.findUniqueOrThrow({ where: { id: projectId } });
    const data: any = { recipeNotes: `${p.recipeNotes ? p.recipeNotes + '\n' : ''}Decision — ${a} time: ${value}` };
    if (a === 'bake' || a === 'cook') data.cookTime = value;
    await db.project.update({ where: { id: projectId }, data });
  }
}

export async function answerQuestion(fd: FormData) {
  const id = str(fd, 'id')!;
  const q = await db.projectQuestion.findUniqueOrThrow({ where: { id } });
  let value = strRaw(fd, 'answer').trim();
  if (value === 'Other') value = strRaw(fd, 'other').trim();
  if (!value) return;
  await applyAnswer(q.projectId, q.target, value);
  await db.projectQuestion.update({ where: { id }, data: { status: 'ANSWERED', answer: value, answeredAt: new Date() } });
  await logActivity(`Answered: ${q.question}`, null, q.projectId);
  await syncQuestions(q.projectId);
  revalidatePath('/', 'layout');
}
export async function setQuestionStatus(fd: FormData) {
  const id = str(fd, 'id')!, status = str(fd, 'status')!;
  if (!['OPEN', 'UNKNOWN', 'NOT_NEEDED'].includes(status)) return;
  await db.projectQuestion.update({ where: { id }, data: { status, answer: null, answeredAt: null, ...(status === 'UNKNOWN' ? { priority: 'LATER' } : {}) } });
  revalidatePath('/', 'layout');
}
export async function addQuestion(fd: FormData) {
  const projectId = str(fd, 'projectId')!, question = str(fd, 'question');
  if (!question) return;
  await db.projectQuestion.create({ data: { projectId, key: `manual:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, group: 'OTHER', question, answerType: 'long', priority: str(fd, 'priority') === 'SOON' ? 'SOON' : 'LATER', source: 'MANUAL' } });
  revalidatePath('/', 'layout');
}
export async function deleteQuestion(fd: FormData) {
  await db.projectQuestion.deleteMany({ where: { id: str(fd, 'id')!, source: 'MANUAL' } });
  revalidatePath('/', 'layout');
}
