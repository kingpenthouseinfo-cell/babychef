export type BibleDefault = { key: string; title: string; content: string };

const L = (...x: string[]) => x.join('\n');

export const BIBLE_DEFAULTS: BibleDefault[] = [
  { key: 'philosophy', title: 'Overall Video Philosophy', content: L(
    'Baby Chef videos combine three things:',
    '1. A REAL COOKING TUTORIAL — the viewer should genuinely learn how to prepare the recipe.',
    '2. A CINEMATIC FOOD VIDEO — professional food cinematography, realistic textures, believable movement and satisfying ASMR.',
    '3. AN ENTERTAINING BABY CHARACTER — the Baby Chef provides personality, reactions, humor and charm.',
    'The baby must not turn the video into a cartoon. The cooking remains substantive and accurate.',
    'The videos should feel like professionally filmed cooking shows where the chef happens to be an adorable baby.') },
  { key: 'recipe-planning', title: 'Recipe Planning Rules', content: L(
    'When converting a recipe into a Baby Chef production:',
    '- preserve ingredient quantities accurately',
    '- preserve recipe chronology',
    '- identify preparation stages and important techniques',
    '- identify visually important transformations (texture, color or state changes)',
    '- identify where an audience genuinely needs to see the technique',
    '- identify repetitive actions that can later become montage',
    '- identify the final food payoff',
    '- identify natural comedy opportunities',
    '- identify safe adult-assistance moments',
    '- identify possible ASMR opportunities',
    '- identify which steps deserve main shots and which deserve cinematic inserts',
    'Do not blindly create one scene for every written recipe sentence. Scenes are determined by visual storytelling and cooking logic.') },
  { key: 'script', title: 'Script Rules', content: L(
    '- recipe instructions must remain accurate',
    '- state exact quantities when useful',
    '- important technique information must not be lost',
    '- dialogue should sound like the Baby Chef character, not a generic adult narrator; natural and conversational',
    '- long explanations may use off-screen narration during close-ups',
    '- do not force the baby\'s face into every instructional moment',
    '- narration must match what is actually visible',
    '- do not describe an ingredient that has not appeared unless intentionally narrating ahead',
    '- allow moments without dialogue so ASMR can be heard',
    '- avoid unnecessary speeches and generic long call-to-action endings',
    '- a character-based CTA is preferred when appropriate') },
  { key: 'dialogue', title: 'Baby Dialogue Rules', content: L(
    'Dialogue planning should consider: age/personality of the selected Baby Chef, cultural/cuisine profile, voice/accent instructions from the Baby Chef profile, clarity for viewers, natural toddler personality, recipe accuracy and pacing.',
    'Prefer shorter spoken lines. Very long technical explanations can be split across visible dialogue, off-screen narration, on-screen text or a separate close-up sequence.',
    'The selected Baby Chef profile determines accent, language style, recurring phrases, personality, cultural tone and recurring jokes.',
    'Do not apply one Baby Chef\'s dialect rules to a different Baby Chef (e.g. never use Jamaican dialogue rules for a Sri Lankan Tamil Baby Chef or vice versa).') },
  { key: 'humor', title: 'Humor Rules', content: L(
    'Humor should come naturally from the cooking process. Useful patterns:',
    '- spicy ingredient → baby becomes suspicious',
    '- dough resists → baby argues with the dough',
    '- cooking takes time → baby becomes impatient',
    '- butter appears → baby is delighted',
    '- food looks dry → baby acts offended',
    '- someone reaches for finished food → baby protects the plate',
    '- heavy ingredient → baby struggles comedically',
    'Do NOT force a joke into every sentence. Visual reactions can be the joke. Recurring character humor comes from the Baby Chef profile. Humor must never interfere with recipe accuracy.') },
  { key: 'hook', title: 'Hook Rules', content: L(
    'Plan a visually compelling opening. Do not assume every video starts with "Hi everyone, today we\'re making…".',
    'Preferred approach when suitable: finished food reveal, breaking/cutting/opening food, steam, stretch, filling, crispy texture, Baby Chef reaction, memorable dialogue — then transition into the recipe.',
    'Identify a LONG-FORM HOOK and a SHORT-FORM HOOK; they may differ.') },
  { key: 'scene-breakdown', title: 'Scene Breakdown Rules', content: L(
    'Think in terms of visual cooking progression. Every scene should consider: purpose, cooking action, Baby Chef action, food state BEFORE / DURING / AFTER, camera approach, dialogue, ASMR, comedy/reaction opportunity, safety, whether it is SHORT KEEP, whether it needs one image or several image anchors, and whether it can later combine with other moments in one Kling clip.',
    'Do not fragment scenes unnecessarily. Do not create separate scenes for "pick ingredient up", "show ingredient" and "put ingredient down" when they occur in one continuous sequence.') },
  { key: 'cooking-action', title: 'Cooking Action Rules', content: L(
    'NEVER reduce an important cooking action to a vague instruction such as "Baby chops onion." Describe continuous physical action.',
    'CUTTING: ingredient placed on board → adult assistance where necessary → outer skin removed if applicable → ingredient positioned safely → controlled cut begins → slices accumulate → ingredient may rotate → cross-cut → chopped pieces gather → pieces transfer to receiving bowl.',
    'POURING: source container positioned over receiving container → hands establish grip → container gradually tilts → ingredient begins flowing/falling → stream or pieces behave according to gravity → receiving container visibly accumulates → final pieces/liquid fall → source container returns upright.',
    'STIRRING: starting food state → utensil enters mixture → utensil physically pushes/folds/moves ingredients → ingredients respond → texture and color change gradually → finished state visible.',
    'KNEADING: press → fold → rotate → repeat → dough gradually becomes cohesive.',
    'ROLLING: dough positioned → rolling pin contacts dough → rolls forward/back → dough spreads → may rotate → continues to desired thickness.',
    'ASSEMBLY: filling scooped → transferred → spoon removed → pastry folded → edges aligned → pressed → crimped → completed item lifted.',
    'Actions must look continuous rather than like disconnected AI poses.') },
  { key: 'food-state', title: 'Food State Rules', content: L(
    'Food progression is one of the most important continuity systems. Every cooking sequence has a BEFORE, DURING and AFTER. Food cannot randomly regress to an earlier state. Maintain chronological food progression.',
    'GROUND BEEF: raw pink → partially browned → mostly browned → aromatics added → seasoned → liquid added → reduced moist filling → cooled filling.',
    'DOUGH: dry flour mixture → grated butter present → crumbly mixture → water added → shaggy dough → cohesive dough → rested dough → rolled dough → filled pastry.',
    'LENTILS: raw red/orange lentils → rinsed → water added → turmeric added → partially softened → cooked thick lentils → tempering incorporated → coconut milk added → finished creamy dal.') },
  { key: 'food-realism', title: 'Food Realism Rules', content: L(
    '- raw food looks raw; cooked food never suddenly looks raw again',
    '- butter melts gradually; onions soften and brown gradually; ground beef changes from pink to browned gradually',
    '- liquids have appropriate viscosity',
    '- dough does not jump instantly from powder to perfect dough',
    '- custards do not look like cake; dal does not become pureed unless the recipe requires it',
    '- ingredients never randomly disappear or duplicate',
    '- ingredient quantities stay believable relative to cookware',
    '- avoid glossy plastic-looking AI food') },
  { key: 'food-physics', title: 'Food Physics Rules', content: L(
    'Explain physical behavior in prompts. Match the actual ingredient and cooking stage.',
    'EGGS: shell visibly separates; white stretches naturally; yolk falls under gravity and stays intact when required; liquid surface ripples; nearby yolks wobble.',
    'OIL: correct quantity relative to pan; realistic pooling; heat shimmer where appropriate; localized bubbles; ripples around falling spices; no exaggerated splashes.',
    'COCONUT MILK: opaque, creamy, slightly thick; steady stream; pools temporarily; forms white swirls before blending.',
    'JAGGERY: coarse or crumbly when dry; falls in irregular clumps; partially dissolves; small pieces may remain; becomes smooth caramel liquid only when the recipe requires.',
    'MUSTARD SEEDS: tiny popping motion, localized movement, realistic crackle, no explosive cartoon behavior.',
    'CURRY LEAVES: natural leaf movement; sharp sizzle on hot oil; glossier/wilted after frying.') },
  { key: 'still-images', title: 'Still Image Planning Rules', content: L(
    'ONE SCENE MAY REQUIRE MULTIPLE STILL IMAGES. Determine how many still-image anchors are actually needed. Example — Scene "Brown Beef": IMG-A medium shot of Baby Chef and skillet; IMG-B close-up of raw beef entering skillet; IMG-C macro of partially browned beef. These are not separate scenes.',
    'Select images based on: meaningful visual change, camera change, ingredient transformation, action progression, need for Kling visual anchors, and continuity.',
    'Do not create images for every tiny movement.') },
  { key: 'camera', title: 'Camera & Cinematography Rules', content: L(
    'Shot types: MAIN NARRATIVE SHOT (clearly shows what is happening), CINEMATIC INSERT (food texture and interest), MACRO ASMR (extreme detail for sound/texture), REACTION SHOT (baby expression), OVERHEAD (spatial arrangement/technique), BEAUTY SHOT (finished food). A sequence may use a main shot plus inserts.',
    'Avoid the same front-facing shot for the whole video. Vary among medium shots, three-quarter angles, slightly elevated side angles, overhead, counter-level, food close-ups, macros, reactions and beauty shots — always with a reason, never random novelty.',
    'Default aesthetic: ultra-photorealistic; professional food-video cinematography; natural skin texture; realistic food texture; shallow depth of field where appropriate; warm natural lighting; realistic reflections and shadows; subtle bokeh; cinematic focus shifts; controlled slow push-ins; subtle handheld movement when appropriate.',
    'Avoid: cartoon look, plastic baby, plastic food, exaggerated fake bokeh, impossible depth of field, excessive lens distortion.') },
  { key: 'asmr', title: 'ASMR Rules', content: L(
    'ASMR is an intentional production tool. Identify moments such as: eggshell cracking, egg dropping, flour falling, spice sprinkling, knife chopping, cutting-board contact, oil pouring, beef sizzling, curry leaves crackling, mustard seeds popping, whisking, stirring, liquid pouring, rolling pin movement, fork crimping, crispy crust breaking, steam, spoon scraping.',
    'Audio stays realistic — no cartoon sound effects. Dialogue should sometimes pause so the real food sound can be heard.') },
  { key: 'pacing', title: 'Pacing Rules', content: L(
    'Previous Baby Chef videos became too slow when moments were held too long. Prioritize fast, interesting progression — without making every action unnaturally fast. Something meaningful should change frequently: action, camera, food state, expression, dialogue, ingredient, ASMR, close-up, reaction or visual transformation.',
    'Avoid dead air, repetitive scenes and unnecessary ingredient-placement footage.',
    'Ingredient introduction should be efficient: pick up → show → say amount → react if useful → put down naturally → cut. Do not create a separate long shot for returning every ingredient.') },
  { key: 'long-form', title: 'Long-Form Rules', content: L(
    'The long-form video should: teach the recipe completely; include important quantities; show major cooking stages; show techniques that affect the final result; preserve Baby Chef personality; use varied visuals; contain short-form-worthy moments; avoid artificial filler.',
    'A long video should not become long merely because clips are slow. If the recipe naturally supports 7–9 minutes that is fine; do not pad.',
    'Repetitive processes (e.g. making eight patties): show the first assembly clearly (roll, fill, fold, align, crimp), then use montage/shorter cuts for the repeats.') },
  { key: 'short-form', title: 'Short-Form Rules', content: L(
    'Short-form target is commonly 45–60 seconds. It is NOT the full recipe sped up. Prioritize: strong hook, visually satisfying cooking, funny Baby Chef moments, major transformation stages, cinematic ASMR, final payoff, memorable ending. After the opening hook it should still roughly follow recipe progression.',
    'Mark highly valuable moments [SHORT KEEP]: strongest hook, funniest reaction, iconic dialogue, important visual transformation, intense sizzle, satisfying pour, beautiful close-up, final food reveal, bite/reaction, ending joke. Not every instructional step is SHORT KEEP.') },
  { key: 'crop', title: '16:9 to 9:16 Crop Rules', content: L(
    'The master is generally 16:9 landscape; important footage should be reusable for 9:16 Shorts/Reels.',
    'For important main narrative shots keep essential content (Baby Chef, hands, main bowl/pan, ingredient, essential utensil) within approximately the central 55–60 percent of the landscape frame when practical. Avoid layouts with the baby far left and the food far right when both are needed to understand the action. Cinematic macro inserts may ignore crop-safe framing.',
    'Label each shot/image: VERTICAL CRITICAL, VERTICAL PREFERRED or NOT IMPORTANT.') },
  { key: 'references', title: 'Reference Image Rules', content: L(
    'ACTUAL APPROVED IMAGES ARE THE VISUAL SOURCE OF TRUTH. Instruct the external AI to inspect supplied reference images carefully and identify: current cookware, current bowl, ingredients already present, food state, object positions, Baby Chef position, camera angle, lighting, visible clothing and current cooking stage.',
    'If an old text description conflicts with an approved image: FOLLOW THE APPROVED IMAGE. Do not reset the visual state from an older prompt.',
    'Default reference priority: 1) current approved / previous approved frame; 2) project-specific reference; 3) master baby reference; 4) master kitchen reference; 5) product / ingredient reference; 6) text description. Priority varies by task: Master Baby controls character identity; Previous Approved Frame controls current food state. State clearly which reference controls which visual property.',
    'Do not force every master reference into every prompt; keep the reference checklist practical. Normally the next frame receives: master baby/kitchen if needed, previous approved frame, relevant ingredient/product references, relevant correction references.') },
  { key: 'product-refs', title: 'Ingredient Product Reference Rules', content: L(
    'PACKAGE CRITICAL: use the supplied product reference to reproduce the visible package as closely as possible — package shape, brand, color scheme, label placement, main visible text, cap/lid where visible. Do not substitute another brand when the package is visible.',
    'TEXTURE / APPEARANCE CRITICAL: the package need not appear. Use the reference to understand ingredient color, thickness, texture, consistency and appearance.',
    'OPTIONAL: the reference is supplementary only.') },
  { key: 'character', title: 'Character Continuity Rules', content: L(
    'Within one project preserve: same face, age, proportions, skin tone, hair, outfit, accessories and general personality. Never redesign the Baby Chef between frames. Use the selected Baby Chef Master References.') },
  { key: 'kitchen', title: 'Kitchen Continuity Rules', content: L(
    'Preserve: same cabinets, countertop, stove, background, lighting direction, cookware (unless the recipe requires another utensil) and general environment. Different camera angles are encouraged; different kitchen identities are not.') },
  { key: 'safety', title: 'Safety / Adult Assistance Rules', content: L(
    'The character may be approximately one year old. Use adult hands or safe staging for: sharp knives, hot pans, stove controls, boiling water, ovens, hot trays, Scotch bonnet preparation and heavy cooking equipment.',
    'The baby can be involved through guided hands, watching, pointing, stirring safely when staged, holding safe ingredients and presenting ingredients. Never depict an infant independently performing obviously dangerous real-world kitchen actions.') },
  { key: 'kling', title: 'Kling Planning Rules', content: L(
    'NOT EVERY STILL IMAGE REQUIRES ITS OWN KLING CLIP. Multiple related images can serve as visual anchors (@image1, @image2, @image3…) for one continuous video prompt (e.g. egg carton/reaching → egg cracking → chalaza removal).',
    'Group by: logical continuity, dialogue length, physical complexity, visual transformation, duration, camera transition and reference compatibility. Do not combine too many unrelated physical actions in one clip.') },
  { key: 'editing', title: 'Editing Rules', content: L(
    'Edit externally (e.g. CapCut). Cut dead air, montage repeated actions, preserve ASMR moments and lines that must remain, keep crop-safe framing for vertical versions, use realistic audio and avoid cartoon effects.') },
  { key: 'publishing', title: 'Publishing Philosophy', content: L(
    'Natural, conversational copy. No spammy clickbait and no generic AI-sounding advertising. Titles are strong but not misleading and include useful search terms. Prefer character-based CTAs over long generic ones.') },
  { key: 'never', title: 'Things Never To Do', content: L(
    '- never change the Baby Chef\'s identity, outfit or kitchen between frames',
    '- never let ingredients appear, vanish or duplicate without explanation',
    '- never let food regress to an earlier cooking state',
    '- never change ingredient quantities',
    '- never replace a visible branded package with another brand',
    '- never show an infant independently doing dangerous kitchen actions',
    '- never override an approved reference image with older text',
    '- never use cartoon looks, plastic baby/food or cartoon sound effects') },
  { key: 'custom', title: 'Custom Additional Rules', content: '' },
];
