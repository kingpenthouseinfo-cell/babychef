export const PROJECT_STATUSES = ['PLANNING','SCRIPTING','IMAGE PRODUCTION','VIDEO PRODUCTION','EDITING','PUBLISHING','COMPLETE','ARCHIVED'];
export const REF_CATEGORIES = ['Character Face','Character Full Body','Character Hands','Character Outfit','Kitchen','Counter / Stove','Cookware','Lighting','Cinematography','Approved Example','Food Realism','Other'];
export const PROJECT_REF_CATEGORIES = ['Baby Chef','Kitchen','Ingredient Products','Food Texture','Cooking Action','Cookware','Cinematography','Previous Approved Frames','Corrections','Custom'];
export const INGREDIENT_REF_TYPES = ['Front Label','Back Label','Side Label','Opened Package','Ingredient Texture','Poured Appearance','Ingredient In Bowl','Other'];
export const INGREDIENT_IMPORTANCE: Record<string,string> = { PACKAGE_CRITICAL: 'PACKAGE CRITICAL', TEXTURE_CRITICAL: 'TEXTURE / APPEARANCE CRITICAL', OPTIONAL: 'OPTIONAL' };
export const SCRIPT_STATUSES = ['DRAFT','REVIEW','APPROVED','LOCKED'];
export const SCRIPT_MARKERS = ['[SHORT KEEP]','[ASMR]','[REACTION]','[OFF-SCREEN]','[ADULT ASSIST]','[HOOK]','[BEAUTY SHOT]','[VOICEOVER]','[CAMERA INSERT]','[IMPORTANT QUANTITY]'];
export const SCENE_STATUSES = ['PLANNED','IN PROGRESS','READY','COMPLETE','SKIPPED'];
export const SHOT_TYPES = ['MAIN NARRATIVE SHOT','CINEMATIC INSERT','MACRO ASMR','REACTION SHOT','OVERHEAD','TRANSITION','BEAUTY SHOT'];
export const CROP_LEVELS = ['CRITICAL','PREFERRED','NOT IMPORTANT'];
export const CROP_GUIDANCE = 'Keep the Baby Chef, hands, primary bowl/pan, ingredient and essential utensil within approximately the central 55 to 60 percent of the horizontal frame when possible. Do not force macro inserts to follow this rule if it damages the composition.';
export const ADULT_OPTIONS = ['NO','YES','OPTIONAL'];
export const IMAGE_STATUSES = ['PLANNED','PROMPT DRAFT','READY','GENERATING','WAITING','REVIEW','APPROVED','REDO','REJECTED','SKIPPED'];
export const PROMPT_STATUSES = ['NOT STARTED','DRAFT','READY','LOCKED'];
export const PRIORITIES = ['HIGH','NORMAL','LOW'];
export const IMAGE_REF_ROLES = ['MASTER BABY','MASTER KITCHEN','MASTER OUTFIT','PREVIOUS APPROVED FRAME','ACTION REFERENCE','FOOD REFERENCE','INGREDIENT BRAND REFERENCE','COOKWARE REFERENCE','CINEMATOGRAPHY REFERENCE','CORRECTION REFERENCE','CUSTOM REFERENCE'];
export const WAITING_REASONS = ['ChatGPT generation limit','Need reference image','Need prompt revision','Need recipe clarification','Other'];
export const SOURCE_TOOLS = ['ChatGPT','Claude','Other'];
export const ATTEMPT_STATUSES = ['REVIEW','APPROVED','REDO','REJECTED','SUPERSEDED'];
export const CORRECTION_CATEGORIES = ['Character mismatch','Wrong age','Wrong skin tone','Wrong outfit','Wrong kitchen','Wrong camera angle','Wrong crop','Wrong ingredient','Wrong quantity','Wrong food texture','Wrong food state','Wrong utensil','Wrong cookware','Bad hands','Bad anatomy','Wrong label/brand','Wrong physics','Continuity failure','Other'];
export const SEVERITIES = ['LOW','MEDIUM','HIGH'];
export const REVIEW_CHECKS = ['Same Baby Chef','Correct age/proportions','Correct outfit','Correct kitchen','Correct cookware','Correct ingredient','Correct ingredient quantity','Correct food state','Correct texture','Correct camera','Correct label/brand','Hands acceptable','No extra objects','No missing objects','Crop usable','Continuity acceptable'];
export const KLING_STATUSES = ['PLANNED','DRAFT','READY','GENERATING EXTERNALLY','REVIEW','APPROVED','REDO','SKIPPED'];
export const KLING_ATTEMPT_STATUSES = ['REVIEW','APPROVED','REDO'];
export const VERTICAL_OPTIONS = ['VERTICAL SAFE','MAY REQUIRE REFRAMING','NOT IDEAL FOR VERTICAL'];
export const CTA_OPTIONS = ['Minimal','Funny character-based','No CTA','Custom'];
export const NOTE_CATEGORIES = ['General Notes','Recipe Notes','Production Notes','Editing Notes','Publishing Notes'];
export const PUB_STATUSES = ['NEEDS PROMPT','PROMPT READY','GENERATED','REVIEW','SELECTED','PUBLISHED','SKIPPED'];
export const TEMPLATE_CATEGORIES = ['SCRIPT','SCRIPT REVISION','SCENE BREAKDOWN','IMAGE PLANNING','IMAGE GENERATION','CONTINUATION IMAGE','CONTINUITY REVIEW','KLING','KLING REVISION','CAPCUT','SHORT FORM','YOUTUBE','YOUTUBE SHORTS','FACEBOOK','INSTAGRAM','TIKTOK','GENERAL'];

// platform -> [assetType, template category]
export const PUBLISHING_PLAN: { platform: string; type: string; cat: string }[] = [
  ...['Title','Description','SEO Keywords','Tags','Chapters','Thumbnail Text','Pinned Comment','Community Post'].map(t => ({ platform: 'YouTube Long Form', type: t, cat: 'YOUTUBE' })),
  ...['Thumbnail Ideas'].map(t => ({ platform: 'YouTube Long Form', type: t, cat: 'YOUTUBE' })),
  ...['Short Title','Short Description','Short Caption','Hashtags','Pinned Comment','On-screen Hook Text'].map(t => ({ platform: 'YouTube Shorts', type: t, cat: 'YOUTUBE SHORTS' })),
  ...['Page Main Caption','Short Teaser','YouTube Link Caption','Direct Video Upload Caption','Reel Caption'].map(t => ({ platform: 'Facebook', type: t, cat: 'FACEBOOK' })),
  ...['Reel Caption','Short Caption','Hashtags','Story Text','Story CTA','Cover Text'].map(t => ({ platform: 'Instagram', type: t, cat: 'INSTAGRAM' })),
  ...['Caption','Hook Text','Hashtags','Comment / CTA Idea'].map(t => ({ platform: 'TikTok', type: t, cat: 'TIKTOK' })),
];

export const DEFAULT_CHECKLIST: [string, string][] = [
  ['Long form','Final long-form video exported'],['Long form','Thumbnail prepared'],['Long form','YouTube title selected'],['Long form','YouTube description selected'],['Long form','YouTube chapters completed'],['Long form','YouTube thumbnail selected'],['Long form','YouTube uploaded'],['Long form','Pinned comment prepared'],['Long form','Community post prepared'],
  ['Short','Short version exported'],['Short','YouTube Short caption selected'],['Short','YouTube Short uploaded'],
  ['Facebook','Facebook caption selected'],['Facebook','Facebook posted'],
  ['Instagram','Instagram Reel caption selected'],['Instagram','Instagram Reel posted'],
  ['TikTok','TikTok caption selected'],['TikTok','TikTok posted'],
];

export const CONTINUITY_FIELDS = ['Baby identity','Baby age/proportions','Face','Hair','Skin','Hands','Outfit','Accessories','Kitchen','Counter','Stove','Cookware','Glassware','Main utensils','Lighting','Color temperature','Camera style','Depth of field','Primary lens look','Crop-safe framing','Voice','Accent','Personality','Ingredient appearance','Food progression','Safety','Adult-assistance rules','General restrictions','Other continuity notes'];
export const LONGFORM_FIELDS = ['Pacing instructions','Scenes to shorten','Scenes to montage','Reaction shots','ASMR inserts','B-roll / beauty shots','Music notes','Dialogue cleanup','Subtitle notes','Crop/reframe notes','Other editing notes'];
export const PUB_CONTEXT_FIELDS = ['Project title','Recipe','Cuisine','Baby Chef','Personality','Dialogue style','Hook','Finished food description','Funny moments','SHORT KEEP moments','Recipe highlights','Cooking techniques','Video duration','Short duration','CTA preference','Notes'];

export const DEFAULT_PRINCIPLES = [
  'Ultra-photorealistic visuals.',
  'Professional cinematic cooking-show appearance.',
  'Realistic food textures.',
  'Realistic cooking physics.',
  'Consistent Baby Chef identity.',
  'Consistent kitchen.',
  'Consistent cookware.',
  'No random ingredient changes.',
  'No ingredients disappearing.',
  'No ingredients appearing without explanation.',
  'No magically transformed food.',
  'Correct ingredient quantities.',
  'Food must progress logically through cooking stages.',
  'Main narrative shots should remain crop-safe for vertical conversion when possible.',
  'Use varied camera angles.',
  'Use macro food shots as cinematic inserts.',
  'ASMR should match the visible cooking action.',
  'Actual approved reference images take priority over older text descriptions.',
  'Dangerous cooking actions involving an infant/toddler require appropriate adult assistance or safe staging.',
].join('\n');

export const DEFAULT_SETTINGS: Record<string,string> = {
  appName: 'Baby Chef Studio',
  defaultAspect: '16:9',
  defaultShortDuration: '45-60 seconds',
  defaultLongDuration: '8-12 minutes',
  defaultVerticalCrop: 'true',
  defaultProjectStatus: 'PLANNING',
  principles: DEFAULT_PRINCIPLES,
  url_ChatGPT: 'https://chatgpt.com/',
  url_Claude: 'https://claude.ai/',
  url_Kling: 'https://klingai.com/',
  url_CapCut: 'https://www.capcut.com/',
  'url_YouTube Studio': 'https://studio.youtube.com/',
  url_Facebook: 'https://www.facebook.com/',
  url_Instagram: 'https://www.instagram.com/',
  url_TikTok: 'https://www.tiktok.com/',
};
export const TOOL_NAMES = ['ChatGPT','Claude','Kling','CapCut','YouTube Studio','Facebook','Instagram','TikTok'];
