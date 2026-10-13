import { db } from './db';
import { deriveCode, uniqueCode } from './project-code';

/** Give every project a unique 3-letter code (kept if it already has one). */
export async function ensureProjectCodes(): Promise<number> {
  const all = await db.project.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, slug: true, title: true, code: true } });
  const taken = new Set(all.filter(p => p.code).map(p => p.code!.toUpperCase()));
  let n = 0;
  for (const p of all) {
    if (p.code) continue;
    const c = uniqueCode(deriveCode(p.title || p.slug), taken);
    taken.add(c);
    await db.project.update({ where: { id: p.id }, data: { code: c } });
    n++;
  }
  return n;
}

/** A free code for a new project called `title`. */
export async function newProjectCode(title: string): Promise<string> {
  const taken = new Set((await db.project.findMany({ where: { code: { not: null } }, select: { code: true } })).map(p => p.code!.toUpperCase()));
  return uniqueCode(deriveCode(title), taken);
}
