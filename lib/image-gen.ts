import { db } from './db';
import { planScene } from './image-plan';
import { writePrompt, camOf } from './image-prompt-auto';
import { IMAGE_ORDER, SCENE_ORDER, orderedPictures } from './order';
import { imageCode } from './util';
import { versionPrompt } from './prompt-versions';
import { autoAttachReferences } from './auto-refs';
import { logActivity } from './activity';

export const padLabel = (l: string) => l.replace(/^(\d+)/, d => d.padStart(2, '0'));
/** IMAGE 01.1 — friendly label (scene label + position in the scene). The permanent ID stays IMG-nnn. */
export const imageLabel = (sceneLabel: string, idx: number) => `${padLabel(sceneLabel)}.${idx}`;

export type CardStatus = 'PROMPT READY' | 'IMAGE NEEDED' | 'IMAGE UPLOADED' | 'APPROVED' | 'NEEDS REVISION';
export function cardStatus(i: { status: string; fullPrompt?: string | null }): CardStatus {
  if (i.status === 'APPROVED') return 'APPROVED';
  if (i.status === 'REVIEW') return 'IMAGE UPLOADED';
  if (i.status === 'REDO' || i.status === 'REJECTED') return 'NEEDS REVISION';
  if (i.status === 'GENERATING' || i.status === 'WAITING') return 'IMAGE NEEDED';
  return (i.fullPrompt ?? '').trim() ? 'PROMPT READY' : 'IMAGE NEEDED';
}

/** Write (or rewrite) the full prompt text for one picture from the scene, the chef profile and the pictures around it. */
export async function composePromptFor(imageId: string): Promise<string> {
  const img = await db.plannedImage.findUniqueOrThrow({ where: { id: imageId }, include: { scene: true, project: { include: { babyChef: true, scenes: true, ingredients: true } }, refs: true } });
  const all = await orderedPictures(img.projectId);
  const i = all.findIndex(x => x.id === imageId);
  const prev = i > 0 ? all[i - 1] : null;
  const cam = camOf({ title: img.title, shotType: img.shotType, seq: img.seq, purpose: img.purpose } as any, `${img.title} ${img.purpose ?? ''}`);
  return writePrompt({
    aspect: img.aspectRatio || img.project.aspectRatio, chef: img.project.babyChef, scene: img.scene as any,
    img: { title: img.title, purpose: img.purpose, shotType: img.shotType, cam, crop: img.cropImportance, foodState: img.foodState, expression: img.expression, cookware: img.cookware, utensils: img.utensils, ingredients: img.ingredients, seq: img.seq },
    prev: prev ? { code: imageCode(prev.seq), title: prev.title } : null,
    hasBabyRef: img.refs.some(r => r.role === 'MASTER BABY'), hasKitchenRef: img.refs.some(r => r.role === 'MASTER KITCHEN'),
    scenes: img.project.scenes as any, ingredientNames: img.project.ingredients.map(x => x.name),
  });
}

/** Write (or rewrite) a picture's full prompt from the scene. Locked prompts are left alone; the old text is kept as a version. */
export async function writePromptFor(imageId: string, reason: string) {
  const img = await db.plannedImage.findUniqueOrThrow({ where: { id: imageId } });
  if (img.promptStatus === 'LOCKED') return;
  const text = await composePromptFor(imageId);
  await versionPrompt(imageId, 'FULL', img.fullPrompt ?? '', text, reason);
  await db.plannedImage.update({ where: { id: imageId }, data: { fullPrompt: text, promptStatus: 'READY', ...(img.status === 'PLANNED' || img.status === 'PROMPT DRAFT' ? { status: 'READY' } : {}) } });
}

/** Fill every blank field of a picture from its scene (ingredients, cookware, utensils, camera, food state), then write the prompt if it has none. Anything already filled in is kept. */
export async function fillFromScene(imageId: string) {
  const img = await db.plannedImage.findUniqueOrThrow({ where: { id: imageId }, include: { scene: true } });
  const sc = img.scene;
  const data: Record<string, string> = {};
  const blank = (v?: string | null) => !(v ?? '').trim();
  const pick = (k: keyof typeof img, v?: string | null) => { if (blank(img[k] as any) && !blank(v)) data[k as string] = v!.trim(); };
  pick('ingredients', sc.ingredients); pick('cookware', sc.cookware); pick('utensils', sc.utensils); pick('cameraAngle', sc.cameraAngle);
  pick('foodState', sc.foodDuring || sc.foodAfter || sc.foodBefore); pick('bodyPosition', sc.babyPosition);
  pick('purpose', sc.mainAction || sc.narrative);
  if (Object.keys(data).length) await db.plannedImage.update({ where: { id: imageId }, data });
  if (blank(img.fullPrompt)) await writePromptFor(imageId, 'Written automatically from the scene');
}

/** Plan pictures for scenes that have none (or one scene), chain them, attach references and write all prompts. Never touches existing pictures. */
export async function planProjectImages(projectId: string, onlySceneId?: string | null): Promise<number> {
  const scenes = await db.scene.findMany({ where: { projectId, ...(onlySceneId ? { id: onlySceneId } : {}) }, orderBy: [...SCENE_ORDER], include: { images: true } });
  const newIds: string[] = [];
  for (const sc of scenes) {
    if (!onlySceneId && sc.images.length) continue;
    const have = new Set(sc.images.map(i => i.title.toLowerCase()));
    let pos = sc.images.reduce((m, i) => Math.max(m, i.pos), 0);
    for (const a of planScene(sc as any)) {
      if (have.has(a.title.toLowerCase())) continue;
      const max = await db.plannedImage.aggregate({ where: { projectId }, _max: { seq: true } });
      const img = await db.plannedImage.create({ data: { projectId, sceneId: sc.id, seq: (max._max.seq ?? 0) + 1, pos: ++pos, title: a.title.slice(0, 140), purpose: a.text, why: a.why, foodState: a.foodState || null, shotType: a.shotType, cropImportance: a.crop, autoPlanned: true } as any });
      newIds.push(img.id);
    }
  }
  const order = await db.plannedImage.findMany({ where: { projectId }, orderBy: [{ scene: { pos: 'asc' } }, { pos: 'asc' }, { seq: 'asc' }] });
  for (let k = 1; k < order.length; k++) if (newIds.includes(order[k].id)) await db.plannedImage.update({ where: { id: order[k].id }, data: { dependsOnId: order[k - 1].id } });
  for (const id of newIds) { await autoAttachReferences(id); await fillFromScene(id); }
  if (newIds.length) await logActivity(`Image plan: ${newIds.length} picture${newIds.length === 1 ? '' : 's'} planned`, null, projectId);
  return newIds.length;
}

