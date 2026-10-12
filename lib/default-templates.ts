import { TASK_TEMPLATES } from './task-templates';
type T = { code: string; name: string; category: string; purpose: string; description: string; text: string };

const COMMON = `Baby Chef: {{baby_name}}
Personality: {{baby_personality}}
Voice / accent: {{voice_instruction}}`;

export const DEFAULT_TEMPLATES: T[] = [
  {
    code: 'TPL-IMGGEN', name: 'Image Generation (Full)', category: 'IMAGE GENERATION',
    purpose: 'Assemble a full image prompt from the planned image fields.', description: 'Use "Prepare prompt" on an image to fill this.',
    text: `{{image_id}} — {{image_title}} (scene {{scene_code}}: {{scene_title}})

BABY CHEF
{{baby_profile}}

KITCHEN
{{kitchen}}

STARTING COMPOSITION
{{starting_composition}}

ACTION MOMENT
{{action_moment}}

INGREDIENT STATE
{{image_ingredients}} — {{ingredient_state}}

CAMERA
{{camera}}

MUST BE VISIBLE
{{must_be_visible}}

MUST NOT CHANGE
{{must_not_change}}

MUST NOT APPEAR
{{must_not_appear}}

CONTINUITY
{{continuity_bible}}

PRINCIPLES
{{principles}}`,
  },
  {
    code: 'TPL-IMGCONT', name: 'Continuation Image', category: 'CONTINUATION IMAGE',
    purpose: 'Short prompt for use inside an ongoing ChatGPT conversation.', description: '',
    text: `Same baby chef, same kitchen, same cookware.

{{image_title}}.

{{starting_composition}}

{{action_moment}}

Ingredient state: {{ingredient_state}}

Must be visible: {{must_be_visible}}
Must not change: {{must_not_change}}
Do not add: {{must_not_appear}}`,
  },
  {
    code: 'TPL-KLING', name: 'Kling Prompt', category: 'KLING',
    purpose: 'Structured multi-reference Kling prompt.', description: '',
    text: `{{kling_id}} — {{kling_title}} (target {{kling_duration}} seconds)

REFERENCE IMAGES
{{kling_references}}

STARTING COMPOSITION
{{kling_start}}

ACTION SEQUENCE
{{kling_actions}}

PHYSICAL BEHAVIOR
{{kling_movement}}

FOOD PHYSICS
{{kling_food_physics}}

DIALOGUE
{{kling_dialogue}}

BABY VOICE
{{kling_voice}}

CAMERA
{{kling_camera}}

FOCUS
{{kling_focus}}

ASMR
{{kling_asmr}}

AMBIENT AUDIO
{{kling_ambient}}

LIGHTING / STYLE
{{kling_lighting}}

CONTINUITY
{{kling_continuity}}

RESTRICTIONS
{{kling_restrictions}}

ENDING FRAME
{{kling_ending}}`,
  },
  {
    code: 'TPL-CAPCUT', name: 'CapCut Editing Prompt', category: 'CAPCUT',
    purpose: 'Instructions for CapCut AI editing or an editing assistant.', description: '',
    text: `Help me edit a vertical short from a Baby Chef cooking video.

Project: {{project_title}} ({{recipe_name}})
Target length: {{short_form_duration}}
Hook: {{short_hook}}

SHORT TIMELINE
{{short_timeline}}

EDITING NOTES
{{short_edit_notes}}

Crop 16:9 → 9:16 keeping the Baby Chef, hands, bowl/pan and ingredient in the central 55–60% of the frame. Preserve ASMR moments and the lines marked "must remain".`,
  },
  {
    code: 'TPL-SHORT', name: 'Short Form Plan', category: 'SHORT FORM',
    purpose: 'Ask for a short-form edit plan from SHORT KEEP moments.', description: '',
    text: `Plan a {{short_form_duration}} short from my Baby Chef video "{{project_title}}".

Hook: {{short_hook}}
SHORT KEEP moments:
{{short_keep_moments}}

Finished food: {{finished_food_description}}

Suggest the best order, timing, and ending joke. Start with the strongest hook.`,
  },
  {
    code: 'TPL-YT-TITLE', name: 'YouTube Title', category: 'YOUTUBE',
    purpose: 'Title options + chapters/description share this category; asset type picks the matching default.', description: 'Used for: Title',
    text: `Write 10 YouTube title options for a Baby Chef cooking video.

Recipe: {{recipe_name}} ({{cuisine}})
Baby Chef concept: {{baby_name}} — {{baby_personality}}
Hook: {{hook}}
Finished food: {{finished_food_description}}

Rules: strong but not misleading hook, natural language, no spammy clickbait, include useful search terms (recipe name + cuisine). Under 70 characters each. Mark your top 3.`,
  },
  {
    code: 'TPL-YT-DESC', name: 'YouTube Description', category: 'YOUTUBE',
    purpose: 'Description, ingredient summary, hashtags, pinned comment.', description: 'Used for: Description',
    text: `Write a YouTube description for this Baby Chef cooking video.

Recipe: {{recipe_name}} ({{cuisine}})
Baby Chef: {{baby_name}} — {{baby_personality}}
Hook: {{hook}}
Recipe highlights / techniques: {{short_keep_moments}}
Finished food: {{finished_food_description}}
Funny moments: {{short_keep_moments}}
Ingredients: {{ingredient_list}}
CTA preference: {{cta}}

Return:
1. A natural YouTube description
2. Ingredient summary if appropriate
3. Recipe overview
4. Hashtags
5. A pinned comment suggestion`,
  },
  {
    code: 'TPL-YT-CHAP', name: 'YouTube Chapters', category: 'YOUTUBE',
    purpose: 'Create chapters from transcript and scene list.', description: 'Used for: Chapters',
    text: `Create YouTube chapters (timestamps + short titles) for my video "{{project_title}}".

Scene list (approximate order):
{{scene_list}}

Transcript / script:
{{script_text}}

First chapter must start at 0:00. Use natural titles. Note that timings are approximate; I will correct them against the edit.`,
  },
  {
    code: 'TPL-YT-THUMB', name: 'Thumbnail Ideas', category: 'YOUTUBE',
    purpose: 'Thumbnail concepts and text.', description: 'Used for: Thumbnail Ideas / Thumbnail Text',
    text: `Give me 6 thumbnail ideas (visual concept + max 4 words of text) for a Baby Chef cooking video.

Recipe: {{recipe_name}}
Baby Chef: {{baby_name}} — {{baby_personality}}
Finished food: {{finished_food_description}}
Hook: {{hook}}

Each idea should combine a food beauty image and a baby reaction.`,
  },
  {
    code: 'TPL-YTS', name: 'YouTube Shorts', category: 'YOUTUBE SHORTS',
    purpose: 'Short title, description, caption, hashtags, on-screen hook.', description: '',
    text: `Write YouTube Shorts copy for a Baby Chef cooking short.

Recipe: {{recipe_name}}
Baby Chef: {{baby_name}} — {{baby_personality}}
Short hook: {{short_hook}}
Moments in the short:
{{short_keep_moments}}
CTA preference: {{cta}}

Return: title options, description, caption, hashtags, pinned comment, and on-screen hook text (max 6 words).`,
  },
  {
    code: 'TPL-FB', name: 'Facebook Page Copy', category: 'FACEBOOK',
    purpose: 'All Facebook captions.', description: '',
    text: `Write Facebook Page copy promoting my Baby Chef cooking video.

Recipe:
{{recipe_name}}

Cuisine:
{{cuisine}}

Character:
{{baby_name}}
{{baby_personality}}

Main hook:
{{hook}}

Best moments:
{{short_keep_moments}}

Finished food:
{{finished_food_description}}

The video teaches the recipe step by step.

Create:
1. Main Facebook Page caption
2. Short teaser caption
3. Caption for sharing the YouTube link
4. Caption for directly uploading the video
5. Facebook Reel caption

Keep the writing conversational and entertaining.
Do not make it sound like generic AI-generated advertising.`,
  },
  {
    code: 'TPL-IG', name: 'Instagram Copy', category: 'INSTAGRAM',
    purpose: 'Instagram Reel caption, hashtags, story text, cover text.', description: '',
    text: `Write Instagram copy for a Baby Chef cooking Reel.

Recipe: {{recipe_name}} ({{cuisine}})
Character: {{baby_name}} — {{baby_personality}}
Hook: {{short_hook}}
Finished food: {{finished_food_description}}
CTA preference: {{cta}}

Return: Reel caption, short caption, hashtags, Story text, Story CTA, and cover text (max 5 words).`,
  },
  {
    code: 'TPL-TT', name: 'TikTok Copy', category: 'TIKTOK',
    purpose: 'TikTok caption, hook text, hashtags, CTA idea.', description: '',
    text: `Write TikTok copy for a Baby Chef cooking video.

Recipe: {{recipe_name}}
Character: {{baby_name}} — {{baby_personality}}
Hook: {{short_hook}}
CTA preference: {{cta}}

Return: caption, on-screen hook text, hashtags, and a comment/CTA idea. Keep it short and punchy.`,
  },
  {
    code: 'TPL-GENERAL', name: 'General Project Prompt', category: 'GENERAL',
    purpose: 'Free-form prompt with project context.', description: '',
    text: `Project: {{project_title}}
Recipe: {{recipe_name}} ({{cuisine}})
${COMMON}

(write your request here)

Ingredients:
{{ingredient_list}}`,
  },
  ...TASK_TEMPLATES,
];
