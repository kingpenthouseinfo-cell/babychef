/** Deterministic writer for the final ChatGPT Image prompt in the Baby Chef house style (no AI). */
import { negativeStates, DEFAULT_NEGATIVE, type NSScene } from './negative-states';
import type { Cam } from './image-plan';

export type PromptCtx = {
  aspect?: string;
  chef?: { displayName?: string | null; age?: string | null; gender?: string | null; skinTone?: string | null; hair?: string | null; outfit?: string | null; accessories?: string | null; lighting?: string | null; kitchen?: string | null; typicalExpressions?: string | null } | null;
  scene: NSScene & { purpose?: string | null; dialogue?: string | null; babyReaction?: string | null; adultAssist?: string | null; adultNotes?: string | null; cookware?: string | null; utensils?: string | null; babyPosition?: string | null; cameraAngle?: string | null; asmr?: string | null; safetyNotes?: string | null };
  img: { title: string; purpose?: string | null; shotType: string; cam?: Cam; crop?: string; foodState?: string | null; expression?: string | null; cookware?: string | null; utensils?: string | null; ingredients?: string | null; seq: number };
  prev?: { code: string; title: string } | null;
  hasBabyRef?: boolean; hasKitchenRef?: boolean;
  scenes: NSScene[]; ingredientNames: string[];
};

const c1 = (s?: string | null) => (s ?? '').replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '');
const sent = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? '' : '.') : '');

export function camOf(img: PromptCtx['img'], text: string): Cam {
  if (img.cam) return img.cam;
  if (/macro/i.test(img.shotType)) return 'macro';
  if (/reaction/i.test(img.shotType)) return 'reaction';
  if (/overhead/i.test(img.shotType)) return 'overhead';
  if (/beauty/i.test(img.shotType)) return 'beauty';
  if (/insert/i.test(img.shotType)) return /counter|roll/i.test(text) ? 'counter' : 'closeup';
  return (['three-quarter', 'medium', 'elevated', 'straight'] as Cam[])[img.seq % 4];
}
const OPEN: Record<Cam, string> = {
  'three-quarter': 'three-quarter medium shot in the same approved Baby Chef kitchen', medium: 'medium shot in the same approved Baby Chef kitchen', elevated: 'slightly elevated three-quarter shot in the same approved Baby Chef kitchen', straight: 'straight-on medium shot in the same approved Baby Chef kitchen',
  closeup: 'close-up', macro: 'macro food shot', overhead: 'overhead shot', counter: 'counter-level food shot', reaction: 'reaction close-up', beauty: 'beauty shot of the food',
};

function expressionFor(text: string, cam: Cam, saved?: string | null): { exp: string; look: string } {
  const t = text.toLowerCase();
  let exp = c1(saved);
  if (!exp) exp = /scotch bonnet|pepper|spicy|hot/.test(t) ? 'suspicious, wide-eyed' : /tast|bite|eat|first bite/.test(t) ? 'delighted and impressed' : /finished|golden|reveal|proud|hold/.test(t) ? 'proud' : /knead|fold|crimp|roll|pinch|rub|stir|brown|mix|cut|chop/.test(t) ? 'serious focused little-chef' : /pour|add|sprinkle/.test(t) ? 'curious' : /oops|struggl|relax|heavy|sticky/.test(t) ? 'frustrated but adorable' : 'curious and cheerful';
  const look = cam === 'reaction' || cam === 'beauty' || /to the camera|at the camera|says|speak|talk|dialogue/.test(t) ? 'looks directly into the camera' : /scotch bonnet|pepper/.test(t) ? 'looks suspiciously at the Scotch bonnet' : 'looks down at the food while working';
  return { exp, look };
}
function physics(t: string): string {
  const l = t.toLowerCase();
  if (/pour/.test(l)) return 'The source container is held above the destination, tilted so the stream falls straight down by gravity and gathers in the receiving container.';
  if (/stir|mix|whisk/.test(l)) return 'The utensil sits in the mixture and pushes the ingredients around it, so the texture visibly responds to the movement.';
  if (/knead/.test(l)) return 'The dough is pressed, folded and rotated by small guided hands, with natural creases where it folds.';
  if (/roll/.test(l)) return 'The rolling pin presses the dough flat, the dough widens and thins under the pressure, with a natural slightly irregular edge.';
  if (/cut|chop|slice|dice/.test(l)) return 'The ingredient is held safely in place while the adult hand controls the knife, and cut pieces collect naturally on the board.';
  if (/fold|crimp|seal|fill|assembl/.test(l)) return 'The filling sits on one half of the pastry, the edges align and press together, and the fork leaves clean parallel crimp marks.';
  if (/brown|fry|sizzl|saut/.test(l)) return 'The food contacts the hot surface with a gentle realistic sizzle, with small pieces moving under the spoon.';
  return '';
}
function adult(sc: PromptCtx['scene'], text: string): string {
  const need = sc.adultAssist === 'YES' || /knife|stove|hot|oven|boil|oil|scotch bonnet|tray|blender/i.test(`${text} ${sc.safetyNotes ?? ''}`);
  if (!need && sc.adultAssist !== 'OPTIONAL') return '';
  const what = /knife|chop|slice|cut/i.test(text) ? 'controls the knife' : /oven|bake|tray/i.test(text) ? 'handles the hot tray and oven' : /stove|skillet|pan|fry|brown|sizzl|oil|boil/i.test(text) ? 'controls the heat and holds the hot pan' : /scotch bonnet/i.test(text) ? 'handles the Scotch bonnet' : 'guides the work';
  return `The same adult hand (consistent in every image) ${what}${c1(sc.adultNotes) ? `: ${c1(sc.adultNotes)}` : ''}; Baby Chef only does the safe part of the job.`;
}

export function writePrompt(c: PromptCtx): string {
  const { scene: sc, img } = c;
  const text = `${img.title} ${img.purpose ?? ''} ${sc.mainAction ?? ''}`;
  const cam = camOf(img, text);
  const chef = c.chef;
  const name = c1(chef?.displayName) || 'Baby Chef';
  const { exp, look } = expressionFor(text + ' ' + (sc.dialogue ?? '') + ' ' + (sc.babyReaction ?? ''), cam, img.expression);
  const parts: string[] = [];
  const kitchenWords = cam === 'closeup' || cam === 'macro' || cam === 'overhead' || cam === 'counter' || cam === 'beauty' ? ' in the same approved Baby Chef kitchen' : '';
  parts.push(`Ultra-photorealistic cinematic ${OPEN[cam]}${/kitchen/.test(OPEN[cam]) ? '' : kitchenWords}.`);
  const subject = c1(img.purpose) || c1(sc.mainAction) || c1(sc.narrative) || img.title;
  const clean = subject.replace(/^(close[- ]?up|macro|overhead|medium|wide)( shot)?( of)?\s+/i, '');
  parts.push(cam === 'macro' ? sent(clean) : sent(`${c.hasBabyRef ? 'The exact same Baby Chef from the approved reference images' : name}: ${clean}`));
  if (cam !== 'macro') parts.push(`${name} ${look} with a ${exp} expression${c1(sc.dialogue) ? ' while speaking' : ''}.`);
  const a = adult(sc, text); if (a) parts.push(a);
  const fs = c1(img.foodState) || c1(sc.foodDuring) || c1(sc.foodAfter) || c1(sc.foodBefore);
  if (fs) parts.push(`Exact food state at this moment: ${sent(fs)}`);
  const ing = c1(img.ingredients) || c1(sc.ingredients); if (ing) parts.push(`Ingredients present: ${sent(ing)}`);
  const ck = c1(img.cookware) || c1(sc.cookware), ut = c1(img.utensils) || c1(sc.utensils);
  if (ck || ut) parts.push(`Cookware and utensils: ${[ck, ut].filter(Boolean).join('; ')} — the same pieces as the previous approved image.`);
  const ph = physics(text); if (ph) parts.push(ph);
  if (c1(sc.cameraAngle) && cam !== 'macro') parts.push(`Camera: ${sent(c1(sc.cameraAngle))}`);
  if (cam === 'macro' || img.crop === 'NOT IMPORTANT') parts.push('Fill the 16:9 frame with the food detail; this insert does not need to follow the vertical-crop rule.');
  else parts.push(`Keep ${name}, hands, food and essential cookware tightly grouped within the central 55–60% of the ${c.aspect || '16:9'} frame so the image can later crop cleanly to 9:16.`);
  parts.push(`Warm natural kitchen lighting${c1(chef?.lighting) ? ` (${c1(chef!.lighting)})` : ''}, professional food-video cinematography, realistic ${cam === 'macro' ? 'food' : 'baby skin and food'} texture, ${cam === 'macro' || cam === 'closeup' ? 'shallow depth of field with the main food detail razor sharp' : 'shallow depth of field with the hands and food remaining clearly readable'}, realistic shadows and reflections, subtle natural bokeh, cinematic focus${['medium', 'three-quarter', 'elevated', 'straight', 'reaction'].includes(cam) ? ' and natural 35mm-style perspective with no wide-angle distortion' : ''}.`);
  if (cam !== 'macro' && (c.hasBabyRef || chef)) parts.push(`Maintain the exact same Baby Chef identity, face, age${c1(chef?.age) ? ` (${c1(chef!.age)})` : ''}, skin tone${c1(chef?.skinTone) ? ` (${c1(chef!.skinTone)})` : ''}, hair${c1(chef?.hair) ? ` (${c1(chef!.hair)})` : ''}, outfit${c1(chef?.outfit) ? ` (${c1(chef!.outfit)}${c1(chef?.accessories) ? `, ${c1(chef!.accessories)}` : ''})` : ''} and proportions as the approved reference.`);
  parts.push(c.prev ? `Same baby, same outfit, same kitchen, same cookware, same counter and same lighting as the previous approved image (${c.prev.code} — ${c.prev.title}); advance only the food state described above.` : 'Same baby, same outfit, same kitchen, same cookware, same counter and same lighting as the approved references.');
  if (c.hasKitchenRef) parts.push('Keep the exact kitchen, countertop, backsplash, cabinets, stove and window placement from the approved kitchen reference.');
  const neg = negativeStates(sc, { title: img.title, purpose: img.purpose, ingredients: ing, foodTexture: fs }, c.scenes, c.ingredientNames);
  if (neg.length) parts.push(neg.join(' '));
  parts.push('Realistic food, not plastic, not artificially wet-shiny, no fake CGI steam. ' + DEFAULT_NEGATIVE);
  return parts.filter(Boolean).join(' ');
}
