import { db } from './db';
import { imageCode, sceneCode, klingCode, parseJson, lines, ratioLabel } from './util';
import { CROP_GUIDANCE, CONTINUITY_FIELDS } from './constants';
import { getSettings } from './settings';

export const VARIABLES = [
  'project_title','recipe_name','cuisine','baby_name','baby_personality','baby_profile','dialogue_style','recurring_jokes','safety_rules','voice_instruction','kitchen',
  'recipe_text','script_text','scene_list','scene_code','scene_title','scene_narrative','scene_action','scene_dialogue','scene_cookware','scene_utensils','scene_adult',
  'food_state_before','food_state_during','food_state_after','food_progression','approved_images',
  'image_id','image_title','full_prompt','starting_composition','action_moment','image_ingredients','ingredient_state','camera','must_be_visible','must_not_change','must_not_appear',
  'continuity_bible','corrections','principles','crop_guidance',
  'short_keep_moments','short_hook','short_timeline','short_edit_notes','hook','finished_food_description','long_form_duration','short_form_duration','cta',
  'ingredient_list','ingredient_brand_references',
  'kling_id','kling_title','kling_duration','kling_references','kling_start','kling_actions','kling_movement','kling_food_physics','kling_dialogue','kling_voice','kling_camera','kling_focus','kling_asmr','kling_ambient','kling_lighting','kling_continuity','kling_restrictions','kling_ending','kling_final_prompt','kling_last_wrong','kling_last_change','kling_last_keep',
];

export function render(text: string, vars: Record<string, string>): { out: string; missing: string[] } {
  const missing = new Set<string>();
  const out = text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_m, k: string) => {
    const v = vars[k];
    if (v === undefined) return `{{${k}}}`;
    if (!v.trim()) { missing.add(k); return '(not set)'; }
    return v;
  });
  return { out, missing: [...missing] };
}

const v = (s: string | null | undefined) => (s ?? '').trim();

export async function buildVars(projectId: string, opts: { sceneId?: string | null; imageId?: string | null; klingId?: string | null } = {}) {
  const [p, settings] = await Promise.all([
    db.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        babyChef: true,
        ingredients: { orderBy: { order: 'asc' }, include: { references: { where: { deletedAt: null, active: true } } } },
        scenes: { orderBy: { order: 'asc' }, include: { images: { orderBy: { seq: 'asc' }, include: { approvedAttempt: true } } } },
        scripts: { where: { isCurrent: true }, take: 1 },
        docs: true, short: { include: { items: { orderBy: { order: 'asc' }, include: { scene: true, kling: true } } } },
      },
    }),
    getSettings(),
  ]);
  const b = p.babyChef;
  const doc = (k: string) => parseJson<Record<string, string>>(p.docs.find(d => d.key === k)?.data, {});
  const cont = doc('continuity');
  const contText = CONTINUITY_FIELDS.filter(f => v(cont[f])).map(f => `${f}: ${cont[f]}`).join('\n');
  const babyProfile = b ? [
    `Name: ${b.displayName}`, b.age && `Age: ${b.age}`, b.gender && `Gender: ${b.gender}`, b.appearance && `Appearance: ${b.appearance}`,
    b.skinTone && `Skin tone: ${b.skinTone}`, b.facialFeatures && `Face: ${b.facialFeatures}`, b.hair && `Hair: ${b.hair}`, b.bodyNotes && `Body/proportions: ${b.bodyNotes}`,
    b.outfit && `Outfit: ${b.outfit}`, b.accessories && `Accessories: ${b.accessories}`,
  ].filter(Boolean).join('\n') : '';
  const kitchen = [b?.kitchen && `Kitchen: ${b.kitchen}`, b?.lighting && `Lighting: ${b.lighting}`, b?.cinematography && `Cinematography: ${b.cinematography}`].filter(Boolean).join('\n');
  const ingList = p.ingredients.map(i => `- ${[i.quantity, i.unit, i.name].filter(Boolean).join(' ')}${i.prepNote ? ', ' + i.prepNote : ''}${i.brand ? ` [${i.brand}${i.product ? ' ' + i.product : ''}]` : ''}`).join('\n');
  const brandRefs = p.ingredients.filter(i => i.references.length || i.brand).map(i => {
    const imp = i.importance === 'PACKAGE_CRITICAL' ? 'PACKAGE CRITICAL' : i.importance === 'TEXTURE_CRITICAL' ? 'TEXTURE/APPEARANCE CRITICAL' : 'optional';
    return `- ${i.name}${i.brand ? ' (' + i.brand + ')' : ''} — ${imp}; reference images to upload: ${i.references.map(r => r.category).join(', ') || 'none uploaded'}`;
  }).join('\n');
  const script = p.scripts[0];
  const keep = p.scenes.filter(s => s.shortKeep).map(s => `- ${sceneCode(s.order)} ${s.title}${s.babyReaction ? ': ' + s.babyReaction : ''}`).join('\n');
  const progression = p.scenes.map(s => `${sceneCode(s.order)} ${s.title}: BEFORE ${v(s.foodBefore) || '?'} → DURING ${v(s.foodDuring) || '?'} → AFTER ${v(s.foodAfter) || '?'}`).join('\n');
  const approved = p.scenes.flatMap(s => s.images.filter(i => i.approvedAttemptId).map(i => `- ${imageCode(i.seq)} (${sceneCode(s.order)}) ${i.title}`)).join('\n');
  const corr = await db.correction.findMany({ where: { OR: [{ projectId }, { babyChefId: p.babyChefId ?? '__none__' }, { AND: [{ projectId: null }, { babyChefId: null }] }] } });
  const cta = p.ctaPreference === 'Custom' ? v(p.ctaCustom) : p.ctaPreference;
  const timeline = (() => { let t = 0; return (p.short?.items ?? []).map(i => { const s = t; t += i.seconds; const f = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; return `${f(s)}–${f(t)} ${v(i.visual) || v(i.scene?.title) || v(i.kling?.title) || 'Moment'}${i.dialogue ? ` — "${i.dialogue}"` : ''}`; }).join('\n'); })();
  const sh = p.short;
  const editNotes = sh ? [['Editing instructions', sh.editNotes], ['Transcript cues', sh.transcriptCues], ['Lines that must remain', sh.mustKeepLines], ['Jump cuts', sh.jumpCuts], ['Montage points', sh.montage], ['ASMR to preserve', sh.asmrKeep], ['Music', sh.music], ['Crop notes', sh.cropNotes], ['On-screen text', sh.onScreenText], ['Transitions', sh.transitions], ['Subtitles', sh.subtitles]].filter(([, x]) => v(x as string)).map(([k, x]) => `${k}: ${x}`).join('\n') : '';

  const vars: Record<string, string> = {
    project_title: p.title, recipe_name: v(p.recipeName) || p.title, cuisine: v(p.cuisine), baby_name: v(b?.displayName), baby_personality: v(b?.personality),
    baby_profile: babyProfile, dialogue_style: v(b?.dialogueStyle), recurring_jokes: [b?.recurringJokes, b?.recurringReacts].filter(Boolean).join('; '),
    safety_rules: v(b?.safetyRules), voice_instruction: v(b?.voiceInstruction), kitchen,
    recipe_text: v(p.recipeAdapted) || v(p.recipeOriginal), script_text: v(script?.content),
    scene_list: p.scenes.map(s => `${sceneCode(s.order)} ${s.title}`).join('\n'),
    scene_code: '', scene_title: '', scene_narrative: '', scene_action: '', scene_dialogue: '', scene_cookware: '', scene_utensils: '', scene_adult: '',
    food_state_before: '', food_state_during: '', food_state_after: '', food_progression: progression, approved_images: approved,
    image_id: '', image_title: '', full_prompt: '', starting_composition: '', action_moment: '', image_ingredients: '', ingredient_state: '', camera: '',
    must_be_visible: '', must_not_change: '', must_not_appear: '',
    continuity_bible: contText, corrections: corr.map(c => `- ${c.title}: ${v(c.correct)}`).join('\n'),
    principles: settings.principles, crop_guidance: CROP_GUIDANCE,
    short_keep_moments: keep, short_hook: v(p.shortHook) || v(sh?.hook) || v(p.mainHook), short_timeline: timeline, short_edit_notes: editNotes,
    hook: v(p.mainHook) || v(p.longHook), finished_food_description: v(p.finishedFood),
    long_form_duration: v(p.longDuration), short_form_duration: v(p.shortDuration), cta,
    ingredient_list: ingList, ingredient_brand_references: brandRefs,
  };

  const scene = opts.sceneId ? p.scenes.find(s => s.id === opts.sceneId) : undefined;
  const img = opts.imageId ? await db.plannedImage.findUnique({ where: { id: opts.imageId }, include: { scene: true } }) : null;
  const sc = scene ?? img?.scene;
  if (sc) Object.assign(vars, {
    scene_code: sceneCode(sc.order), scene_title: sc.title, scene_narrative: v(sc.narrative), scene_action: v(sc.mainAction), scene_dialogue: v(sc.dialogue),
    scene_cookware: v(sc.cookware), scene_utensils: v(sc.utensils), scene_adult: `${sc.adultAssist}${sc.adultNotes ? ' — ' + sc.adultNotes : ''}`,
    food_state_before: v(sc.foodBefore), food_state_during: v(sc.foodDuring), food_state_after: v(sc.foodAfter),
  });
  if (img) Object.assign(vars, {
    image_id: imageCode(img.seq), image_title: img.title, full_prompt: img.fullPrompt, starting_composition: v(img.startingComposition), action_moment: v(img.actionMoment),
    image_ingredients: v(img.ingredients), ingredient_state: v(img.ingredientState),
    camera: [img.cameraAngle, img.cameraDistance, img.lens, img.depthOfField && `DoF ${img.depthOfField}`, img.focusPoint && `focus ${img.focusPoint}`].filter(Boolean).join(', '),
    must_be_visible: lines(img.mustBeVisible).map(x => '- ' + x).join('\n'), must_not_change: lines(img.mustNotChange).map(x => '- ' + x).join('\n'), must_not_appear: lines(img.mustNotAppear).map(x => '- ' + x).join('\n'),
  });
  if (opts.klingId) {
    const k = await db.klingClip.findUnique({ where: { id: opts.klingId }, include: { refs: { orderBy: { order: 'asc' }, include: { image: true } }, attempts: { orderBy: { number: 'desc' }, take: 1 } } });
    if (k) {
      const la = k.attempts[0];
      Object.assign(vars, {
        kling_id: klingCode(k.order), kling_title: k.title, kling_duration: String(k.durationTarget ?? ''),
        kling_references: k.refs.map((r, i) => `@image${i + 1} = ${imageCode(r.image.seq)} ${r.image.title}`).join('\n'),
        kling_start: v(k.startingComposition),
        kling_actions: [v(k.actionSequence), ...parseJson<string[]>(k.majorActions, []).map((a, i) => `${i + 1}. ${a}`)].filter(Boolean).join('\n'),
        kling_movement: v(k.physicalMovement), kling_food_physics: v(k.foodPhysics), kling_dialogue: v(k.dialogue),
        kling_voice: k.useProfileVoice ? v(b?.voiceInstruction) : v(k.voiceOverride),
        kling_camera: v(k.cameraBehavior), kling_focus: v(k.focusBehavior), kling_asmr: v(k.asmrLines), kling_ambient: v(k.ambient), kling_lighting: v(k.lighting),
        kling_continuity: v(k.continuity), kling_restrictions: v(k.restrictions), kling_ending: v(k.endingComposition), kling_final_prompt: k.finalPrompt,
        kling_last_wrong: v(la?.wrong), kling_last_change: v(la?.change), kling_last_keep: v(la?.keep),
      });
    }
  }
  return vars;
}

/** Pick the default template for a publishing asset type. */
export function templateCodeFor(platform: string, type: string): string {
  if (platform === 'YouTube Long Form') {
    if (type === 'Title') return 'TPL-YT-TITLE';
    if (type === 'Chapters') return 'TPL-YT-CHAP';
    if (type.startsWith('Thumbnail')) return 'TPL-YT-THUMB';
    return 'TPL-YT-DESC';
  }
  return ({ 'YouTube Shorts': 'TPL-YTS', Facebook: 'TPL-FB', Instagram: 'TPL-IG', TikTok: 'TPL-TT' } as Record<string, string>)[platform] ?? 'TPL-GENERAL';
}
export { ratioLabel };
