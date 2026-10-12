import { db } from './db';
export async function logActivity(message: string, href?: string | null, projectId?: string | null) {
  try { await db.activity.create({ data: { message, href: href ?? null, projectId: projectId ?? null } }); } catch { /* non-critical */ }
}
