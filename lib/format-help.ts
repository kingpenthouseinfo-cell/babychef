/** Plain-language format help for every importer: instructions to paste into ChatGPT, a blank template and a real example. */
export type HelpKind = 'recipe' | 'newVideo' | 'ingredients' | 'babyChef' | 'scenes' | 'pictures' | 'clips' | 'master';

const RULES_COMMON = `- Return only the formatted text. No explanations before or after it.
- Do not invent missing information. Use [MISSING: description] where something is not in the source.
- Do not duplicate information. If the source repeats a section, keep it once.
- Keep quantities, times and temperatures exactly as written.`;

const RECIPE_FORMAT = `RECIPE TITLE
[recipe title]

YIELD
[yield]

INGREDIENT GROUP
[group name]

- [quantity] [unit] [ingredient], [preparation if needed]
- [ingredient]

INGREDIENT GROUP
[next group name]

- [ingredient]

METHOD SECTION
[method section title]

1. [actual cooking instruction]
2. [actual cooking instruction]

METHOD SECTION
[next section title]

1. [instruction]`;

const RECIPE_BLANK = `RECIPE TITLE

YIELD

INGREDIENT GROUP
Pastry Ingredients

-

INGREDIENT GROUP
Beef Filling Ingredients

-

METHOD SECTION
Make the Dough

1.

METHOD SECTION
Prepare the Filling

1.
`;

const RECIPE_EXAMPLE = `RECIPE TITLE
Jamaican Beef Patties

YIELD
8 patties

INGREDIENT GROUP
Pastry Ingredients

- 3 1/2 cups all-purpose flour
- 2 teaspoons kosher salt
- 1 tablespoon granulated sugar
- 1 cup unsalted butter, cold and grated

INGREDIENT GROUP
Beef Filling Ingredients

- 1 lb ground beef
- 1 large yellow onion, finely chopped
- 1 tablespoon minced garlic
- 1 teaspoon grated ginger

METHOD SECTION
Make the Dough

1. Add the flour, salt and sugar to a large bowl.
2. Whisk until evenly combined.
3. Add the cold grated butter.
4. Work the butter into the flour until pea-sized pieces remain.

METHOD SECTION
Cook the Beef Filling

1. Heat the skillet over medium heat.
2. Add the olive oil.
3. Add the ground beef and cook until browned.
`;

type Help = { title: string; intro: string; format: string; blank: string; example: string; rules: string; source: string };

const H: Record<HelpKind, Help> = {
  recipe: {
    title: 'Recipe', intro: 'Paste a recipe formatted for Baby Chef Studio.', format: RECIPE_FORMAT, blank: RECIPE_BLANK, example: RECIPE_EXAMPLE, source: 'recipe information',
    rules: `- Do not repeat the recipe title.
- Do not put ingredients inside METHOD.
- Do not number ingredient lines.
- Do not number section headings.
- Method steps must contain only actual cooking actions.
- Preserve exact quantities, temperatures, times and ingredient names.
- If information is missing, use [MISSING: description].
- Do not guess missing recipe facts.
- Remove duplicate sections if the source repeats them.`,
  },
  newVideo: {
    title: 'New recipe video', intro: 'Paste the video details and the recipe.', source: 'video idea and recipe',
    format: `RECIPE VIDEO

Title: [video title]
Recipe Name: [recipe name]
Cuisine: [cuisine]
Baby Chef: [baby chef name]
Kitchen: [kitchen]
Long Video: [length]
Short Video: [length]
Aspect Ratio: [16:9]
Vertical Crop: [yes/no]

DESCRIPTION
[description]

HOOK
[hook]

FINISHED FOOD
[what the finished food looks like]

RECIPE

${RECIPE_FORMAT}`,
    blank: `RECIPE VIDEO

Title:
Recipe Name:
Cuisine:
Baby Chef:
Kitchen:
Long Video:
Short Video:
Aspect Ratio:
Vertical Crop:

DESCRIPTION

HOOK

FINISHED FOOD

RECIPE

${RECIPE_BLANK}`,
    example: `RECIPE VIDEO

Title: Jamaican Beef Patties
Recipe Name: Jamaican Beef Patties
Cuisine: Jamaican
Baby Chef: Jamaican Baby Chef
Long Video: 8 minutes
Short Video: 45 seconds

HOOK
Baby breaks open a finished patty, steam rises, then says "Look pon dat!"

FINISHED FOOD
Golden flaky patty with spiced beef filling

RECIPE

${RECIPE_EXAMPLE}`,
    rules: `${RULES_COMMON}
- Missing optional fields may be left out.`,
  },
  ingredients: {
    title: 'Ingredients', intro: 'Paste the ingredient list.', source: 'ingredient list',
    format: `INGREDIENTS

- [quantity] [unit] [ingredient], [preparation]
- [quantity] [unit] [ingredient] | Brand: [brand] | Product Photo Important: yes

Optional extras after a | on any line:
Brand:
Package:
Preparation:
Group:
Product Photo Important: yes/no
Texture Important: yes/no`,
    blank: `INGREDIENTS

-
-
`,
    example: `INGREDIENTS

- 3 1/2 cups all-purpose flour
- 1 lb ground beef
- 1 large onion, finely chopped
- 1 cup coconut milk | Brand: Grace | Product Photo Important: yes
`,
    rules: `- Do not invent brands.
- Do not change quantities.
- Do not remove preparation notes.
- One ingredient per line.
${RULES_COMMON}`,
  },
  babyChef: {
    title: 'Baby Chef', intro: 'Describe the Baby Chef.', source: 'Baby Chef description',
    format: `BABY CHEF

Name:
Series:
Cuisine:
Age:
Gender:

APPEARANCE

Skin:
Face:
Eyes:
Hair:
Body:

OUTFIT

PERSONALITY

VOICE

Accent:
Voice Style:

HOW BABY TALKS

FUNNY HABITS

KITCHEN

SAFETY RULES

IMPORTANT RULES`,
    blank: `BABY CHEF

Name:
Series:
Cuisine:
Age:
Gender:

APPEARANCE

Skin:
Face:
Eyes:
Hair:
Body:

OUTFIT

PERSONALITY

VOICE

Accent:
Voice Style:

HOW BABY TALKS

FUNNY HABITS

KITCHEN

SAFETY RULES

IMPORTANT RULES
`,
    example: `BABY CHEF

Name: Jamaican Baby Chef
Series: Baby Chef Kitchen
Cuisine: Jamaican
Age: about 1 year old
Gender: boy

APPEARANCE

Skin: warm brown
Hair: short dark curls

OUTFIT
Small white chef hat, white chef jacket, red apron

PERSONALITY
Sweet, playful, confident and a little mischievous

VOICE

Accent: slight natural Jamaican accent
Voice Style: very cute baby boy voice

SAFETY RULES
Adult hands handle knives, hot pans, hot oil and the oven.
`,
    rules: `- Leave unknown fields blank instead of guessing.
${RULES_COMMON}`,
  },
  scenes: {
    title: 'Scenes', intro: 'Paste the scenes. You can put many in one go.', source: 'scene plan',
    format: `SCENE

Title: [scene title]
Purpose:
Dialogue:
Baby Action:
Adult Action:

FOOD BEFORE:
FOOD DURING:
FOOD AFTER:

CAMERA:
ASMR:
Short Keep: yes/no

SCENE

Title: [next scene title]
...`,
    blank: `SCENE

Title:
Purpose:
Dialogue:
Baby Action:
Adult Action:

FOOD BEFORE:

FOOD DURING:

FOOD AFTER:

CAMERA:

ASMR:

Short Keep: no
`,
    example: `SCENE

Title: Rub the butter into the flour
Purpose: Show the dough starting
Dialogue: Mi only one year old. Relax!
Baby Action: Pinches the cold butter into the flour
Adult Action: Guides the small hands

FOOD BEFORE: Dry golden flour with grated butter on top
FOOD DURING: Butter pinched into pea-sized pieces
FOOD AFTER: Dry crumbly mixture, no liquid yet

CAMERA: Three-quarter medium shot
ASMR: Butter crumbling into flour
Short Keep: yes
`,
    rules: `- Start every scene with the word SCENE on its own line.
${RULES_COMMON}`,
  },
  pictures: {
    title: 'Pictures', intro: 'Paste the pictures you want planned.', source: 'picture plan',
    format: `PICTURE

Scene: [scene title]
Title: [picture title]
Purpose:
Shot Type:
Description:
Action Moment:

FOOD STATE:

CAMERA:

MUST SHOW:
- 

MUST NOT SHOW:
- 

REFERENCES:
- 

Short Keep: yes/no

FULL IMAGE PROMPT:

NEXT IMAGE PROMPT:`,
    blank: `PICTURE

Scene:
Title:
Purpose:
Shot Type:
Description:
Action Moment:

FOOD STATE:

CAMERA:

MUST SHOW:
-

MUST NOT SHOW:
-

REFERENCES:
-

Short Keep: no

FULL IMAGE PROMPT:

NEXT IMAGE PROMPT:
`,
    example: `PICTURE

Scene: Rub the butter into the flour
Title: Butter pinched into flour
Purpose: Show the butter still in pieces
Shot Type: MACRO ASMR
Description: Close-up of small fingers pinching cold butter into the flour

FOOD STATE: Dry, crumbly mixture with pea-sized butter pieces. No water yet.

MUST SHOW:
- pea-sized butter pieces

MUST NOT SHOW:
- liquid
- smooth dough
`,
    rules: `- Do not make up picture numbers or file names. Baby Chef Studio does that.
${RULES_COMMON}`,
  },
  clips: {
    title: 'Video clips', intro: 'Paste the video clips.', source: 'video clip plan',
    format: `VIDEO CLIP

Scene: [scene title]
Title: [clip title]
Duration: [seconds]

PICTURES:
- [picture title]

ACTION:
DIALOGUE:
VOICE:
CAMERA:
ASMR:
FOOD MOVEMENT:
END STATE:

VIDEO PROMPT:`,
    blank: `VIDEO CLIP

Scene:
Title:
Duration:

PICTURES:
-

ACTION:

DIALOGUE:

VOICE:

CAMERA:

ASMR:

FOOD MOVEMENT:

END STATE:

VIDEO PROMPT:
`,
    example: `VIDEO CLIP

Scene: Rub the butter into the flour
Title: Butter into flour
Duration: 10

PICTURES:
- Dry flour mixture
- Butter pinched into flour

ACTION: Small hands pinch the butter into the flour.
DIALOGUE: Mi only one year old. Relax!
END STATE: Dry crumbly mixture, no liquid yet.
`,
    rules: `- List pictures by their titles; Baby Chef Studio finds the approved pictures.
${RULES_COMMON}`,
  },
  master: {
    title: 'Everything at once', intro: 'Paste a whole project: video details, Baby Chef, recipe, scenes and pictures.', source: 'project information',
    format: `RECIPE VIDEO
Title:
Recipe Name:
Cuisine:
Baby Chef:
Long Video:
Short Video:

RECIPE
${RECIPE_FORMAT}

INGREDIENTS
- [quantity] [unit] [ingredient], [preparation]

SCENES
SCENE
Title:
Purpose:
Dialogue:
FOOD BEFORE:
FOOD AFTER:

PICTURES
PICTURE
Scene:
Title:
Purpose:

POSTING NOTES
[title, description, hashtags ideas]`,
    blank: `RECIPE VIDEO
Title:
Recipe Name:
Cuisine:
Baby Chef:

RECIPE

${RECIPE_BLANK}
SCENES

SCENE

Title:
Purpose:
Dialogue:

FOOD BEFORE:

FOOD AFTER:

PICTURES

PICTURE

Scene:
Title:
Purpose:

POSTING NOTES
`,
    example: `RECIPE VIDEO
Title: Jamaican Beef Patties
Cuisine: Jamaican
Baby Chef: Jamaican Baby Chef

RECIPE

${RECIPE_EXAMPLE}
SCENE

Title: Finished patty hook
Purpose: Show the finished food first
Dialogue: Look pon dat!
FOOD AFTER: Golden patty split open, steam rising

PICTURE

Scene: Finished patty hook
Title: Patty pulled open
Purpose: Steam rising from the juicy beef filling

POSTING NOTES
Hook line: Baby breaks open a hot patty.
`,
    rules: `- Return only supported Baby Chef Studio text.
${RULES_COMMON}`,
  },
};

export const helpFor = (k: HelpKind) => H[k];

export function chatgptInstructions(k: HelpKind): string {
  const h = H[k];
  return `FORMAT THIS FOR BABY CHEF STUDIO

I am going to give you ${h.source}.

Return ONLY the formatted text for Baby Chef Studio.

Do not explain anything before or after it.

Use this exact structure:

${h.format}

RULES:

${h.rules}

I will paste the source information after this instruction.`;
}

export function everythingForChatgpt(k: HelpKind): string {
  const h = H[k];
  return `Paste these instructions into ChatGPT, then paste your ${h.source} underneath.

${chatgptInstructions(k)}

BLANK TEMPLATE (for reference):

${h.blank}`;
}
