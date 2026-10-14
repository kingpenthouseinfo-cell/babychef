'use server';
import { revalidatePath } from 'next/cache';
import { db } from '../db';
import { str } from '../util';
import { normalizeBase, publicBase, savePublicBase, isExternalBase } from '../automation-config';
import { signedImagePath } from '../signed-links';

export type BridgeResult = { state: 'READY' | 'NOT_CONFIGURED' | 'NOT_REACHABLE' | 'NO_IMAGE' | 'UNSAFE'; message: string; localUrl?: string; externalUrl?: string; checks: string[] };

/** Settings → Automation → External Reference Base URL ('' clears it). */
export async function saveReferenceBase(fd: FormData): Promise<{ ok: boolean; message: string }> {
  const v = (str(fd, 'base') ?? '').trim();
  if (!v) { savePublicBase(null); revalidatePath('/', 'layout'); return { ok: true, message: publicBase().base ? 'Cleared. (An address set by the PUBLIC_REFERENCE_BASE_URL environment variable is still in use.)' : 'Cleared. Reference links work on this computer only.' }; }
  const n = normalizeBase(v);
  if (!n.ok) return { ok: false, message: n.error };
  savePublicBase(n.base);
  revalidatePath('/', 'layout');
  return { ok: true, message: `Saved. New reference links will use ${n.base}. Old links are not kept; fresh ones are made each time.` };
}

/** TEST CLOUD ACCESS: make a fresh signed link for one real picture and check it end to end. */
export async function testCloudAccess(projectId: string): Promise<BridgeResult> {
  const checks: string[] = [];
  const img = await db.plannedImage.findFirst({ where: { projectId, OR: [{ approvedAttemptId: { not: null } }, { attempts: { some: {} } }] }, include: { approvedAttempt: true, attempts: { orderBy: { number: 'desc' }, take: 1 } }, orderBy: { seq: 'asc' } });
  const a = img?.approvedAttempt ?? img?.attempts[0];
  const ref = a ? null : await db.reference.findFirst({ where: { deletedAt: null, OR: [{ projectId }, { kind: 'MASTER' }] }, orderBy: { createdAt: 'asc' } });
  const assetId = a?.assetId ?? ref?.assetId;
  const { base } = publicBase();
  const port = process.env.PORT || '3000';
  if (!assetId) return { state: 'NO_IMAGE', message: 'Add or upload at least one picture first, then test.', checks };
  const path = signedImagePath(assetId);
  const localUrl = `http://localhost:${port}${path}`;
  if (!base) return { state: 'NOT_CONFIGURED', message: 'EXTERNAL REFERENCE URL NOT CONFIGURED. Reference links work on this computer only.', localUrl, checks };
  const externalUrl = `${base}${path}`;
  try {
    const r = await fetch(externalUrl, { signal: AbortSignal.timeout(10000) });
    const ct = r.headers.get('content-type') || '';
    if (r.status === 200 && /^image\//.test(ct)) checks.push(`✓ The signed link returned the picture (${ct}).`);
    else return { state: 'NOT_REACHABLE', message: `EXTERNAL REFERENCE URL NOT REACHABLE. The address answered ${r.status}${ct ? ` (${ct})` : ''}. Check that your tunnel is running and points at this app.`, localUrl, externalUrl, checks };
    if (!isExternalBase(base)) checks.push('(This address is on this computer, so the unsigned-link check was skipped.)');
    else {
    const bare = await fetch(externalUrl.split('?')[0], { signal: AbortSignal.timeout(10000) });
    if (bare.status === 403) checks.push('✓ The same address without the signature is refused (403).');
    else return { state: 'UNSAFE', message: `The picture was reachable WITHOUT a valid signature (answered ${bare.status}). Do not use this address until that is fixed.`, localUrl, externalUrl, checks };
    }
  } catch (e: any) {
    return { state: 'NOT_REACHABLE', message: `EXTERNAL REFERENCE URL NOT REACHABLE (${e?.message || 'no answer'}). Check that your tunnel is running.`, localUrl, externalUrl, checks };
  }
  return { state: 'READY', message: 'EXTERNAL REFERENCE URL READY', localUrl, externalUrl, checks };
}
