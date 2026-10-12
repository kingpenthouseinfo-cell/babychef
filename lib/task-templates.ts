// Editable "task instruction" templates used by the Prompt Builder (Production Brain).
// The builder prepends context blocks (bible, chef, recipe, references, ...) and appends one of these.
export type TaskTemplate = { code: string; name: string; category: string; purpose: string; description: string; text: string };

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    code: 'TPL-PLAN-OUTPUT', name: 'Production Plan — task & output format', category: 'SCENE BREAKDOWN',
    purpose: 'Turn the recipe into a complete Baby Chef production plan.', description: 'Task block of PREPARE PRODUCTION PLAN.',
    text: `YOUR TASK
Using ALL of the rules, the Baby Chef profile, the recipe and the project instructions above, turn this recipe into a complete Baby Chef production plan for "{{project_title}}".

Produce:
A. Clean Baby Chef script strategy
B. Long-form structure (target {{long_form_duration}})
C. Hook (a LONG-FORM HOOK and a SHORT-FORM HOOK)
D. Scene list
E. Food-state progression
F. Shot variety plan
G. Still-image requirements
H. Kling grouping suggestions
I. ASMR opportunities
J. Safety / adult-assistance notes
K. SHORT KEEP moments
L. Short-form hook / ending suggestions (target {{short_form_duration}})
M. Continuity risks

Do not create one scene per recipe sentence. Group related actions; add extra visual beats only when they improve clarity, pacing, food transformation, cinematography or humor.

OUTPUT FORMAT — structured Markdown with these exact headings so I can copy it back into my production tool:

## PROJECT SUMMARY
## HOOK
## BABY CHEF SCRIPT STRATEGY
## LONG-FORM STRUCTURE
## SCENES
For each scene use a heading like "### SCENE 01 — Title" followed by these labelled lines:
SCENE TITLE:
PURPOSE:
RECIPE STEP:
DIALOGUE:
BABY ACTION:
ADULT ASSISTANCE: (YES / NO / OPTIONAL + notes)
FOOD STATE BEFORE:
FOOD STATE DURING:
FOOD STATE AFTER:
MAIN SHOT:
INSERT SHOTS:
ASMR:
CAMERA:
SHORT KEEP: (YES / NO)
ESTIMATED DURATION:
PLANNED IMAGE ANCHORS:
KLING GROUPING NOTE:
## SHORT-FORM MOMENTS
## CONTINUITY RISKS
## PRODUCT REFERENCE NEEDS`,
  },
  {
    code: 'TPL-SCRIPT', name: 'Script — task & output format', category: 'SCRIPT',
    purpose: 'Write the actual Baby Chef script.', description: 'Task block of PREPARE SCRIPT PROMPT.',
    text: `YOUR TASK
Write the complete Baby Chef script for "{{project_title}}" ({{recipe_name}}). Target length: {{long_form_duration}} long-form, with a {{short_form_duration}} short-form strategy built in.

Rules for this script:
- Do NOT make the Baby Chef sound like a generic adult recipe narrator. Use the profile's voice, accent, personality and recurring phrases.
- Use short, natural dialogue when possible; preserve full instructional value and exact quantities.
- Use off-screen narration when useful (close-ups, hands-only shots).
- Allow ASMR pauses with no dialogue.
- Use personality naturally; avoid overusing jokes; humor comes from the cooking process and visual reactions.
- Open with a strong hook (not "Hi everyone, today we are making...") when suitable.
- Avoid long generic call-to-action endings; prefer a short character-based ending.
- Respect every adult-assistance and safety rule.
If the recipe is long, divide the script into parts.

OUTPUT STRUCTURE — for each beat give:
PART / SECTION:
SCENE:
ACTION:
DIALOGUE:
OFF-SCREEN NARRATION:
ASMR:
SHORT KEEP: (YES / NO)
REACTION:
SAFETY:
EDITING NOTE:`,
  },
  {
    code: 'TPL-SCRIPT-REV', name: 'Script revision — task', category: 'SCRIPT REVISION',
    purpose: 'Revise the current script.', description: 'Task block of PREPARE SCRIPT REVISION PROMPT.',
    text: `YOUR TASK
Revise the CURRENT SCRIPT above for "{{project_title}}". Keep recipe accuracy, quantities and the Baby Chef voice.

WHAT I WANT CHANGED:
(write here — e.g. faster pacing, funnier reactions, shorter, clearer quantities)

Keep production markers such as [SHORT KEEP], [ASMR], [REACTION], [OFF-SCREEN], [ADULT ASSIST], [HOOK], [BEAUTY SHOT], [VOICEOVER], [CAMERA INSERT], [IMPORTANT QUANTITY]. Return the complete revised script in the same structure, then a short list of what you changed.`,
  },
  {
    code: 'TPL-SCENES', name: 'Scene breakdown — task', category: 'SCENE BREAKDOWN',
    purpose: 'Convert the approved script into production scenes.', description: 'Task block of PREPARE SCENE BREAKDOWN PROMPT.',
    text: `YOUR TASK
Convert the approved script above into production scenes, preserving cooking chronology.

- Do NOT create one scene for every sentence.
- Do not fragment simple actions unnecessarily (pick up / show / put down belong in one sequence).
- Group related actions logically.
- Create additional visual beats only when they improve clarity, pacing, food transformation, cinematography or humor.
- Show repeated processes once clearly, then use montage.
- Keep the video moving: something meaningful should change frequently.

OUTPUT FORMAT — Markdown, one block per scene with a heading "### SCENE 01 — Title" and these labelled lines:
SCENE TITLE:
PURPOSE:
RECIPE STEP:
DIALOGUE:
BABY ACTION:
ADULT ASSISTANCE:
FOOD STATE BEFORE:
FOOD STATE DURING:
FOOD STATE AFTER:
MAIN SHOT:
INSERT SHOTS:
ASMR:
CAMERA:
SHORT KEEP:
ESTIMATED DURATION:
PLANNED IMAGE ANCHORS:
KLING GROUPING NOTE:`,
  },
  {
    code: 'TPL-IMGPLAN', name: 'Image plan — task', category: 'IMAGE PLANNING',
    purpose: 'Decide which still images are required to anchor the production.', description: 'Task block of PREPARE IMAGE PLAN PROMPT.',
    text: `YOUR TASK
Decide which still images are required to anchor this production (for the scene(s) given above).

Principles:
- ONE SCENE MAY REQUIRE MULTIPLE STILL IMAGES.
- Not every movement needs a still image.
- Choose image anchors based on meaningful state changes: visual change, camera change, ingredient transformation, action progression, need for Kling anchors, continuity.

For EVERY proposed image give:
IMAGE TITLE:
SCENE:
PURPOSE:
SHOT TYPE: (MAIN NARRATIVE SHOT / CINEMATIC INSERT / MACRO ASMR / REACTION SHOT / OVERHEAD / BEAUTY SHOT)
CAMERA ANGLE:
FRAMING:
VERTICAL CROP IMPORTANCE: (CRITICAL / PREFERRED / NOT IMPORTANT)
STARTING COMPOSITION: (describe spatial layers: bottom / middle / top / hands)
BABY VISIBILITY: (full baby / medium / torso + hands / hands only / food-only macro)
BABY EXPRESSION:
HAND POSITION:
INGREDIENT STATE:
FOOD TEXTURE:
FOOD COLOR:
ACTION MOMENT: (the exact instant captured: before pour / mid-pour / first contact / after addition)
PHYSICS:
WHAT MUST BE VISIBLE:
WHAT MUST NOT CHANGE:
WHAT MUST NOT APPEAR:
REFERENCE TYPES NEEDED:
DEPENDENCY ON PRIOR IMAGE:
POSSIBLE KLING GROUP:`,
  },
  {
    code: 'TPL-CONTREV', name: 'Continuity review — task', category: 'CONTINUITY REVIEW',
    purpose: 'Manual AI review of continuity.', description: 'Task block of PREPARE CONTINUITY REVIEW PROMPT.',
    text: `YOUR TASK
Review the scene descriptions, food-state progression and approved-image notes above for continuity problems.

Look for: ingredients that appear or vanish unexplained; food that regresses (cooked back to raw); quantity changes; cookware or kitchen changes; lighting changes; character changes; unsafe actions; repeated or slow sequences.
List each problem with the scene / image ID, why it is a problem, and a concrete fix.`,
  },
  {
    code: 'TPL-IMG-FULL-WRITER', name: 'Full image prompt writer — task', category: 'IMAGE GENERATION',
    purpose: 'Ask ChatGPT/Claude to WRITE the final full still-image generation prompt.', description: 'Task block of PREPARE FULL IMAGE PROMPT.',
    text: `YOUR TASK
Using the production context above, write a SINGLE copy-ready still-image generation prompt for {{image_id}} — {{image_title}}.

Do not write a storyboard summary. Describe the exact frame: it must be detailed, cinematic, physically realistic and grounded in the actual production state.

The prompt you write must contain, in this order:
1. FORMAT / STYLE — e.g. cinematic ultra-photorealistic 16:9 cooking-video frame
2. CHARACTER CONTINUITY — only as much detail as necessary (hands-only shots: do not invent face details)
3. ENVIRONMENT — kitchen, counter, stove, cookware
4. STARTING COMPOSITION — explicit spatial layers when several containers/tools interact (bottom layer / middle layer / top layer / baby hands); never leave object relationships ambiguous
5. CURRENT FOOD STATE — exactly what already exists
6. ACTION MOMENT — the exact instant to capture (before pour / mid-pour / first contact / after addition)
7. INGREDIENT DETAILS — real quantity (use recipe quantities as visual guidance: e.g. 2 tbsp oil is a small shallow pool, not a coated pan), texture, color, moisture, doneness for the CURRENT state
8. PHYSICS — believable behavior (gravity-driven streams, localized bubbles, no giant splashes, no floating liquid)
9. HAND / BODY POSITION
10. CAMERA — angle, lens look, distance, framing
11. LIGHTING
12. FOCUS / DEPTH OF FIELD
13. CONTINUITY — what must not change
14. RESTRICTIONS — what must not appear
15. ASPECT RATIO

The actual reference images are the source of truth. Do not contradict an approved image. Do not add ingredients that are not currently present. Do not advance the recipe beyond this frame. Respect every KNOWN CORRECTION listed above.

Return only the final image prompt (plus, if useful, a one-line list of which reference images to upload).`,
  },
  {
    code: 'TPL-IMG-CONT-WRITER', name: 'Continuation prompt writer — task', category: 'CONTINUATION IMAGE',
    purpose: 'Ask ChatGPT/Claude to WRITE a concise continuation prompt.', description: 'Task block of PREPARE CONTINUATION PROMPT.',
    text: `YOUR TASK
Write a concise CONTINUATION prompt for a ChatGPT image-generation conversation that already contains the Baby Chef and the previous approved frame ({{image_id}} — {{image_title}}).

Do not repeat the entire Baby Chef profile unless needed. Focus on:
- same Baby Chef, same kitchen, same camera continuity
- current cookware
- current ingredient state (and quantity)
- what CHANGES in this frame versus the previous approved frame
- the exact action moment
- relevant physics
- critical restrictions (including the KNOWN CORRECTIONS above)
- aspect ratio

Style example:
"Same baby chef, same kitchen, same stainless-steel pan and same camera continuity. Close-up of the pan and baby's hand. The pan contains exactly 2 tablespoons of sunflower oil forming a small shallow pool in the center; the outer stainless-steel edges remain dry and clearly visible. Baby holds a metal measuring spoon labeled '1/2 tsp' filled with cumin seeds above the oil. The seeds have not been poured yet. Do not add any other ingredient. Do not increase the oil quantity. 16:9 horizontal."

Return only the continuation prompt.`,
  },
  {
    code: 'TPL-IMG-REDO', name: 'Image redo prompt — task', category: 'IMAGE GENERATION',
    purpose: 'Prepare a redo prompt that corrects ONLY the failed problem.', description: 'Task block of PREPARE REDO PROMPT.',
    text: `YOUR TASK
Write a REDO prompt for {{image_id}} — {{image_title}} that corrects the problem in the failed attempt described above.

Change ONLY the listed problem where possible. Preserve every approved element of the prior result: same baby, same kitchen, same cookware, same framing, same camera angle, same lighting, same ingredient setup.

Structure:
1. "Use the same ..." line restating what stays identical
2. The exact correction, stated positively and with real quantities/shapes
3. "Do not change:" list (taken from WHAT MUST REMAIN UNCHANGED)
4. Any extra restriction needed so the same failure does not repeat

Return only the redo prompt.`,
  },
  {
    code: 'TPL-KLING-GROUP', name: 'Kling grouping — task', category: 'KLING',
    purpose: 'Decide how approved stills should be grouped into Kling clips.', description: 'Task block of PREPARE KLING GROUPING PROMPT.',
    text: `YOUR TASK
Decide how the approved still images above should be grouped into Kling video clips.

Remember: NOT EVERY STILL IMAGE REQUIRES ITS OWN CLIP. Several related images can be visual anchors (@image1, @image2, @image3) for one continuous clip. Group by logical continuity, dialogue length, physical complexity, visual transformation, duration, camera transition and reference compatibility. Do not combine too many unrelated physical actions into one clip.

For each proposed clip return:
KLING CLIP ID:
TITLE:
SCENES:
REFERENCE IMAGES: (ordered, with @image numbers)
ESTIMATED DURATION:
ACTION SEQUENCE:
DIALOGUE:
CAMERA APPROACH:
WHY THESE IMAGES BELONG TOGETHER:
SPLIT WARNING IF TOO COMPLEX:`,
  },
  {
    code: 'TPL-KLING-WRITER', name: 'Final Kling prompt writer — task', category: 'KLING',
    purpose: 'Ask ChatGPT/Claude to WRITE one complete Kling prompt.', description: 'Task block of PREPARE FINAL KLING PROMPT.',
    text: `YOUR TASK
Using the ordered reference images and context above, write ONE complete, copy-ready Kling / Video 3.0 Omni prompt for {{kling_id}} — {{kling_title}} (target {{kling_duration}} seconds).

Place @image1, @image2, etc. immediately BEFORE the actions they anchor:
@image1
(starting action) ...
Transition to @image2
(continuation) ...
Transition to @image3
(final action) ...
Do not treat each image as a separate video unless necessary.

Describe:
- the starting state
- exact CONTINUOUS physical movements (complete motion: grip, tilt, flow, landing, return upright) — never "baby pours coconut milk"
- food transformation over time (what it looks like first, during stirring, and at the end: color, texture, oil streaks)
- food physics for the ingredients involved
- dialogue placed BESIDE the action it describes ("As baby tilts the cup, Baby Chef says: ..."), not all at the end
- Baby Chef voice (profile voice; sync lips if the face is visible, otherwise off-screen narration; keep the same cultural accent)
- camera movement and when it happens, focus shifts, whether the camera stays locked, subject centering for crop safety; avoid excessive motion
- realistic layered ASMR and ambient audio — no cartoon sound effects
- motivated transitions (CUT, MATCH CUT, CAMERA REFRAME, NATURAL CONTINUATION, MACRO INSERT) — if two references differ a lot in composition, use a natural cut, never impossible morphing
- continuity
- RESTRICTIONS: do not change Baby Chef identity, kitchen or cookware; no extra or missing ingredients; do not alter product brand; do not jump the food to a later cooking stage; no extra fingers or distorted hands; no impossible liquid behavior; no cartoon animation
- ENDING STATE: state clearly how the clip ends, so the next scene can be planned

Return only the final Kling prompt.`,
  },
  {
    code: 'TPL-KLING-REDO', name: 'Kling redo prompt — task', category: 'KLING REVISION',
    purpose: 'Revise a Kling prompt after a failed generation.', description: 'Task block of PREPARE KLING REDO PROMPT.',
    text: `YOUR TASK
Revise the ORIGINAL KLING PROMPT above for {{kling_id}} — {{kling_title}} so that the next generation fixes the failed result described above.

- Keep the reference order (@image numbers) exactly the same.
- Change ONLY what the correction requires; keep everything listed under WHAT MUST REMAIN UNCHANGED.
- Keep the target duration unless the correction says otherwise.
- If the failure was caused by too much happening in one clip, say so and suggest how to split it.

Return the complete revised Kling prompt, then a short list of what you changed.`,
  },
];
