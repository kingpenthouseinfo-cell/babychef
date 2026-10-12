import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { FillFromText } from '@/components/fill-client';

export default async function Fill({ params }: { params: { slug: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const [chefs, ings, scenes, hist] = await Promise.all([
    db.babyChef.findMany({ where: { deletedAt: null }, orderBy: { displayName: 'asc' } }),
    db.ingredient.findMany({ where: { projectId: p.id }, select: { name: true } }), db.scene.findMany({ where: { projectId: p.id }, select: { title: true } }),
    db.projectDoc.findUnique({ where: { projectId_key: { projectId: p.id, key: 'importHistory' } } }),
  ]);
  const current: Record<string, string> = {};
  for (const k of ['title', 'recipeName', 'cuisine', 'description', 'mainHook', 'finishedFood', 'recipeYield', 'prepTime', 'cookTime', 'longDuration', 'shortDuration', 'recipeSource', 'ctaCustom', 'recipeOriginal']) current[k] = ((p as any)[k] ?? '') as string;
  let history: any[] = []; try { history = JSON.parse(hist?.data || '{}').items ?? []; } catch { /* none */ }
  return (<div className="space-y-4"><div><h1 className="text-[26px]">Fill from text</h1><p className="text-[13px] text-ink-secondary">Paste the recipe or Baby Chef Studio text here and I’ll fill in the form for you.</p></div>
    <FillFromText slug={p.slug} current={current} ingredientNames={ings.map(i => i.name.toLowerCase())} sceneTitles={scenes.map(s => s.title)} chefs={chefs.map(c => ({ id: c.id, name: c.displayName }))} history={history} /></div>);
}
