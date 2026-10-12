'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '../db';
import { str } from '../util';
import { applyRecipeText } from '../recipe-store';
import { logActivity } from '../activity';

/** RE-PARSE RECIPE: uses the saved original recipe text, creates missing ingredient records, replaces the structured method. Nothing else is touched. */
export async function reparseRecipe(fd: FormData) {
  const p = await db.project.findUniqueOrThrow({ where: { id: str(fd, 'projectId')! } });
  const text = (p.recipeOriginal || p.recipeAdapted || '').trim();
  if (!text) throw new Error('There is no saved recipe text to re-read');
  const r = await applyRecipeText(p.id, text);
  await logActivity(`Recipe re-read: ${r.added} ingredient${r.added === 1 ? '' : 's'} added, ${r.sections} method sections`, `/projects/${p.slug}/recipe`, p.id);
  revalidatePath('/', 'layout');
  redirect(`/projects/${p.slug}/recipe?fixed=1`);
}
