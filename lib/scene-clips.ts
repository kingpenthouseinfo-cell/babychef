import { db } from './db';

/** A scene can hold several video clips, in play order. `clipIds` is the list; `videoAssetId` mirrors the first clip (older code and old data only have that). */
export function sceneClipIds(sc: { clipIds?: string | null; videoAssetId?: string | null }): string[] {
  try { const a = sc.clipIds ? JSON.parse(sc.clipIds) : null; if (Array.isArray(a)) return a.filter((x): x is string => typeof x === 'string'); } catch { /* fall through */ }
  return sc.videoAssetId ? [sc.videoAssetId] : [];
}
export function approvedClipIds(sc: { approvedClipIds?: string | null }): string[] {
  try { const a = sc.approvedClipIds ? JSON.parse(sc.approvedClipIds) : null; if (Array.isArray(a)) return a.filter((x): x is string => typeof x === 'string'); } catch { /* none */ }
  return [];
}
export async function setSceneClips(sceneId: string, ids: string[]): Promise<void> {
  const uniq = ids.filter((x, i) => ids.indexOf(x) === i);
  const cur: any = await db.scene.findUnique({ where: { id: sceneId }, select: { approvedClipIds: true } as any });
  const approved = approvedClipIds(cur ?? {}).filter(x => uniq.includes(x)); // a clip that leaves the scene loses its approval
  await db.scene.update({ where: { id: sceneId }, data: { clipIds: JSON.stringify(uniq), videoAssetId: uniq[0] ?? null, approvedClipIds: JSON.stringify(approved) } as any });
}
/** Take a clip off every scene of the project that holds it. */
export async function removeClipEverywhere(projectId: string, assetId: string): Promise<void> {
  const scenes: any[] = await db.scene.findMany({ where: { projectId } });
  for (const sc of scenes) { const ids = sceneClipIds(sc); if (ids.includes(assetId)) await setSceneClips(sc.id, ids.filter(x => x !== assetId)); }
}
export async function sceneHasClip(projectId: string, assetId: string): Promise<boolean> {
  const scenes: any[] = await db.scene.findMany({ where: { projectId } });
  return scenes.some(sc => sceneClipIds(sc).includes(assetId));
}
