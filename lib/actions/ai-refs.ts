'use server';
import { revalidatePath } from 'next/cache';
import { db } from '../db';
import { str } from '../util';

type Over = { prev?: string; next?: string; extra?: { k: 'img' | 'ref'; id: string }[] };
const read = async (imageId: string): Promise<Over> => { const i = await db.plannedImage.findUniqueOrThrow({ where: { id: imageId }, select: { aiRefs: true } }); try { return i.aiRefs ? JSON.parse(i.aiRefs) : {}; } catch { return {}; } };
const write = async (imageId: string, o: Over) => { await db.plannedImage.update({ where: { id: imageId }, data: { aiRefs: JSON.stringify(o) } as any }); revalidatePath('/', 'layout'); };

/** CHANGE under BEFORE / AFTER: pick another approved picture ('' = go back to automatic). */
export async function setAiRef(fd: FormData) {
  const imageId = str(fd, 'imageId')!, which = str(fd, 'which'), pick = str(fd, 'pick') ?? '';
  const o = await read(imageId);
  const k = which === 'next' ? 'next' : 'prev';
  if (pick && pick !== imageId) o[k] = pick; else delete o[k];
  await write(imageId, o);
}
/** + ADD EXTRA REFERENCE: an approved picture ("img:ID") or a saved reference picture ("ref:ID"). */
export async function addAiExtra(fd: FormData) {
  const imageId = str(fd, 'imageId')!, pick = str(fd, 'pick') ?? '';
  const m = /^(img|ref):(.+)$/.exec(pick);
  if (!m) return;
  const o = await read(imageId);
  o.extra = [...(o.extra ?? []).filter(e => !(e.k === m[1] && e.id === m[2])), { k: m[1] as 'img' | 'ref', id: m[2] }];
  await write(imageId, o);
}
export async function removeAiExtra(fd: FormData) {
  const imageId = str(fd, 'imageId')!, key = str(fd, 'key') ?? '';
  const m = /^extra:(img|ref):(.+)$/.exec(key);
  if (!m) return;
  const o = await read(imageId);
  o.extra = (o.extra ?? []).filter(e => !(e.k === m[1] && e.id === m[2]));
  await write(imageId, o);
}
