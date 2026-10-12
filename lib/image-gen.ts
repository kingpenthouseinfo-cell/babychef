import { db } from './db';
import { planScene } from './image-plan';
import { writePrompt, camOf } from './image-prompt-auto';
import { IMAGE_ORDER, orderedPictures } from './order';
import { imageCode } from './util';

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
void planScene; void IMAGE_ORDER;
