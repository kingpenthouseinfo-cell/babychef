'use server';
import { revalidatePath } from 'next/cache';
import { db } from '../db';
import { PROJECT_COLORS } from '../project-color';

/** Choose a recipe video's colour ('' = automatic). */
export async function setProjectColor(projectId: string, key: string): Promise<void> {
  const ok = PROJECT_COLORS.some(c => c.key === key);
  await db.project.update({ where: { id: projectId }, data: { color: ok ? key : null } as any });
  revalidatePath('/', 'layout');
}
