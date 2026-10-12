/* Demo data: one Baby Chef, one project, 3 scenes, 6 images, 2 Kling clips, short version, publishing items. */
import sharp from 'sharp';
import { db } from '../lib/db';
import { importFile, projectFolder, nextCode } from '../lib/files';
import { ensureDefaults, ensureChecklist } from '../lib/settings';
import { ensureBible } from '../lib/bible';
import { PUBLISHING_PLAN } from '../lib/constants';
import { getStorageRoot } from '../lib/storage';

async function placeholder(label: string, color: string, w = 1280, h = 720, sub = '') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${color}"/><text x="50%" y="48%" font-size="${Math.round(h / 9)}" font-family="Arial, Helvetica, sans-serif" font-weight="700" fill="#fff" text-anchor="middle">${label}</text><text x="50%" y="62%" font-size="${Math.round(h / 20)}" font-family="Arial, Helvetica, sans-serif" fill="#ffffffcc" text-anchor="middle">${sub || 'DEMO PLACEHOLDER'}</text></svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return new File([new Uint8Array(buf)], `${label.replace(/\W+/g, '_')}.png`, { type: 'image/png' });
}

async function main() {
  if ((await db.project.count()) > 0 && !process.argv.includes('--force')) { console.log('Projects already exist — not seeding. Use `npm run db:reset` for a clean demo database, or pass --force.'); return; }
  await ensureDefaults(); await ensureBible();
  console.log('Storage root:', await getStorageRoot());

  const chef = await db.babyChef.create({ data: {
    displayName: 'Demo Baby Chef (Jamaican)', slug: 'demo-baby-chef-jamaican', seriesName: 'Little Chef Kitchen', cuisine: 'Jamaican', age: 'Approximately one year old', gender: 'Boy',
    appearance: 'Dark skin, full chubby cheeks, realistic skin texture, toddler proportions.', skinTone: 'Deep brown, natural skin texture', facialFeatures: 'Big expressive dark eyes, round cheeks', hair: 'Short soft dark curls',
    bodyNotes: 'Toddler proportions, chubby hands', outfit: 'Small white chef jacket and red apron', accessories: 'Mini white chef hat',
    personality: 'Funny, confident, slightly dramatic, mischievous and extremely serious about delicious food.', dialogueStyle: 'Light Jamaican patois mixed with clear English.',
    voiceInstruction: 'Warm, raspy toddler voice with light Jamaican accent; clear enough for viewers to follow.', humorPatterns: 'Suspicious of spicy ingredients; protective of finished food.',
    recurringJokes: 'Loves butter. Offended by dry food.', recurringReacts: 'Gasps at butter; side-eyes the Scotch bonnet.', typicalExpressions: '"Look pon dat!"; "Eh eh!"', ingredientReactions: 'Delighted by butter, suspicious of Scotch bonnet pepper.', ctaBehavior: 'Short in-character sign-off, e.g. "Mi busy now. Bye!"', culturalNotes: 'Jamaican patois only for this chef.',
    kitchen: 'Bright modern kitchen, white cabinets, light wood countertop, stainless-steel stove.', lighting: 'Warm natural window light from camera left.', cinematography: 'Shallow depth of field, slow push-ins.',
    safetyRules: 'Adult hands for knives, hot pans and stove controls.', continuityRules: 'Same face, outfit and kitchen in every frame.' } });

  const mk = async (name: string, color: string, sub?: string, w?: number, h?: number) => placeholder(name, color, w, h, sub);
  const chefRoot = `00 Baby Chefs/${chef.displayName}`;
  const masters: Record<string, string> = {};
  for (const [title, cat, color, gold, prefix, sub] of [
    ['Master face', 'Character Face', '#7c4a2d', true, 'REF-BABY', 'Baby'], ['Master outfit', 'Character Outfit', '#8a2c2c', false, 'REF-BABY', 'Baby'],
    ['Master kitchen', 'Kitchen', '#3f6b7a', true, 'REF-KITCHEN', 'Kitchen'], ['Counter and stove', 'Counter / Stove', '#566b3f', false, 'REF-KITCHEN', 'Kitchen'],
  ] as [string, string, string, boolean, string, string][]) {
    const code = await nextCode('reference', prefix, 3);
    const a = await importFile(await mk(title, color), { rootFolder: chefRoot, folder: `References/${sub}`, fileBase: `${code}_${title.toLowerCase().replace(/\W+/g, '-')}_${cat.toLowerCase().replace(/\W+/g, '-')}`, kind: 'REFERENCE' });
    const r = await db.reference.create({ data: { code, kind: 'MASTER', babyChefId: chef.id, assetId: a.id, title, category: cat, isGold: gold, description: 'Placeholder — replace with your real reference image.' } });
    masters[title] = r.id;
  }

  const project = await db.project.create({ data: {
    title: 'Jamaican Beef Patties', slug: 'jamaican-beef-patties', recipeName: 'Jamaican Beef Patties', cuisine: 'Jamaican', babyChefId: chef.id, status: 'IMAGE PRODUCTION',
    description: 'Demo project — concise placeholder content to show how everything fits together.', longDuration: '8-10 minutes', shortDuration: '45-60 seconds', aspectRatio: '16:9', verticalCrop: true,
    recipeSource: 'Demo recipe (not a real recipe)', recipeOriginal: 'Demo recipe:\n1. Mix flour, turmeric and cold butter into a crumbly dough.\n2. Brown seasoned ground beef; add a little coconut milk.\n3. Fill, fold and bake the pastry until golden.', recipeYield: '8 patties', prepTime: '30 min', cookTime: '35 min',
    mainHook: 'Baby breaks open a finished patty, revealing steam and juicy filling, then says "LOOK PON DAT!"', shortHook: 'Finished patty breaks open', finishedFood: 'Golden-yellow flaky patties with crisp layered pastry, visible steam and juicy seasoned beef filling.', ctaPreference: 'Funny character-based' } });
  await ensureChecklist(project.id);
  const folder = await projectFolder(project.id);
  await db.projectDoc.create({ data: { projectId: project.id, key: 'continuity', data: JSON.stringify({ 'Baby identity': 'Demo Baby Chef (Jamaican)', Outfit: 'White chef jacket, red apron, mini chef hat', Kitchen: 'White cabinets, light wood counter', Cookware: 'Stainless-steel skillet with two short side handles', Lighting: 'Warm window light from camera left', 'General restrictions': 'No cartoon look' }) } });
  await db.projectDoc.create({ data: { projectId: project.id, key: 'overrides', data: JSON.stringify({ 'Pacing override': 'Keep ingredient introductions under 10 seconds.', 'Things that must be shown': 'Butter being grated into the flour.' }) } });

  const ing = async (name: string, quantity: string, unit: string, extra: any = {}) => db.ingredient.create({ data: { projectId: project.id, name, quantity, unit, order: extra.order ?? 0, ...extra } });
  const beef = await ing('Ground beef', '500', 'g', { order: 0, importance: 'TEXTURE_CRITICAL', stage: 'Filling', appearance: 'Raw pink, loose crumbles' });
  const butter = await ing('Butter', '200', 'g', { order: 1, prepNote: 'cold, grated', stage: 'Dough' });
  const coco = await ing('Coconut milk', '1/2', 'cup', { order: 2, brand: 'Example Brand', product: 'Premium Coconut Milk', packageSize: '400 ml can', importance: 'PACKAGE_CRITICAL', packageVisible: true, stage: 'Filling', appearance: 'Opaque white, slightly thick' });
  const prod: Record<string, string> = {};
  for (const [type, color] of [['Front Label', '#a33'], ['Side Label', '#a63']] as const) {
    const code = await nextCode('reference', 'REF-PRODUCT', 3);
    const a = await importFile(await mk('Coconut milk', color, type, 800, 1000), { rootFolder: folder, folder: '01 References/Products', fileBase: `${code}_coconut-milk_example-brand_${type.toLowerCase().replace(/\W+/g, '-')}`, kind: 'INGREDIENT_REF', projectSlug: project.slug });
    prod[type] = (await db.reference.create({ data: { code, kind: 'INGREDIENT', babyChefId: chef.id, projectId: project.id, ingredientId: coco.id, assetId: a.id, title: type, category: type } })).id;
  }
  void beef; void butter;

  await db.scriptVersion.create({ data: { projectId: project.id, version: 1, title: 'Initial recipe narration', content: '[HOOK] Baby breaks open a finished patty. "LOOK PON DAT!"\n[SHORT KEEP]\nToday we make patties. [IMPORTANT QUANTITY] Two hundred grams cold butter.\n[ASMR] Beef sizzles in the skillet.\n[ADULT ASSIST] Adult hand lifts the hot tray.', status: 'APPROVED' } });
  await db.scriptVersion.create({ data: { projectId: project.id, version: 2, title: 'Faster pacing', content: '[HOOK] "LOOK PON DAT!" — patty breaks open.\n[SHORT KEEP]\nButter — 200 grams, cold. [IMPORTANT QUANTITY]\n[ASMR] Sizzle.\n[REACTION] Baby protects the plate. [SHORT KEEP]', notes: 'Tighter, funnier', status: 'REVIEW', isCurrent: true } });

  const sc = async (order: number, title: string, d: any) => db.scene.create({ data: { projectId: project.id, order, title, ...d } });
  const s1 = await sc(1, 'Finished patty hook', { purpose: 'Open with the payoff', dialogue: '"Look pon dat!"', mainAction: 'Baby breaks a golden patty open; steam rises', foodBefore: 'Whole golden baked patty', foodDuring: 'Patty snapped in half, steam rising', foodAfter: 'Open patty showing juicy beef filling', shotPriority: 'BEAUTY SHOT', cropImportance: 'CRITICAL', shortKeep: true, hook: true, beauty: true, ingredients: 'Patty', status: 'COMPLETE' });
  const s2 = await sc(2, 'Make the dough', { purpose: 'Show the butter technique', dialogue: '"Butter! Mi love it."', mainAction: 'Baby watches adult hand grate cold butter into flour', foodBefore: 'Dry yellow flour with turmeric', foodDuring: 'Cold grated butter distributed through the flour', foodAfter: 'Crumbly flour-butter mixture', shotPriority: 'MAIN NARRATIVE SHOT', cropImportance: 'PREFERRED', shortKeep: true, ingredients: 'Butter, flour', adultAssist: 'OPTIONAL', status: 'IN PROGRESS', asmr: 'Butter grating' });
  const s3 = await sc(3, 'Brown the beef', { purpose: 'Show browning and sizzle', mainAction: 'Adult places beef in the hot skillet; baby stirs with a wooden spoon (staged)', foodBefore: 'Raw pink ground beef', foodDuring: 'Some portions browned, some still pink; moisture releasing', foodAfter: 'Mostly browned with small crumbles', shotPriority: 'MACRO ASMR', cropImportance: 'NOT IMPORTANT', ingredients: 'Ground beef', adultAssist: 'YES', adultNotes: 'Hot skillet — adult hands only', asmr: 'Beef sizzling', status: 'PLANNED' });

  let seq = 0;
  const mkImg = async (sceneId: string, title: string, status: string, d: any = {}) => {
    seq++;
    return db.plannedImage.create({ data: { projectId: project.id, sceneId, seq, title, status, ...d } });
  };
  const i1 = await mkImg(s1.id, 'Medium shot — baby holding the finished patty', 'APPROVED', { shotType: 'BEAUTY SHOT', priority: 'HIGH', startingComposition: 'Baby centered behind counter, holding golden patty with both hands.', mustBeVisible: '- golden patty\n- steam\n- toddler hands', mustNotChange: '- same chef outfit\n- same kitchen', mustNotAppear: '- no extra food', ingredientState: 'Whole golden baked patty', actionMoment: 'Before the patty breaks', cameraAngle: 'Eye level', fullPrompt: 'Cinematic ultra-photorealistic 16:9 frame of a one-year-old chef holding a golden Jamaican beef patty in a bright kitchen. (demo)', contPrompt: 'Same baby chef and kitchen. Baby holds the whole golden patty. 16:9.', promptStatus: 'LOCKED' });
  const i2 = await mkImg(s1.id, 'Close-up — patty breaks open with steam', 'APPROVED', { shotType: 'CINEMATIC INSERT', priority: 'HIGH', startingComposition: 'Close-up of two hands snapping the patty; steam in the air.', mustBeVisible: '- juicy beef filling\n- rising steam', ingredientState: 'Patty snapped open', actionMoment: 'The instant after the patty breaks', fullPrompt: 'Macro-leaning close-up of a baked patty breaking open, steam rising. (demo)', contPrompt: 'Same hands and patty — now broken open with steam. 16:9.', promptStatus: 'READY' });
  const i3 = await mkImg(s2.id, 'Medium shot — butter and flour on the counter', 'READY', { dependsOnId: i2.id, priority: 'NORMAL', startingComposition: 'Bottom: bowl of yellow flour. Middle: block of cold butter. Baby hands near the bowl.', mustBeVisible: '- bowl of flour\n- butter block\n- toddler hands', mustNotAppear: '- no beef yet', ingredients: 'Butter, flour', ingredientState: 'Dry yellow flour; butter not yet grated', actionMoment: 'Before grating begins', cameraAngle: 'Slightly elevated three-quarter', fullPrompt: 'Cinematic 16:9 frame: baby chef beside a bowl of turmeric flour and a block of cold butter. (demo)', contPrompt: 'Same baby chef and kitchen. Bowl of yellow flour; cold butter block beside it; nothing grated yet. 16:9.', promptStatus: 'READY', cropImportance: 'CRITICAL' });
  const i4 = await mkImg(s2.id, 'Macro — grated butter falling into flour', 'WAITING', { shotType: 'MACRO ASMR', waitingAt: new Date(), waitingReason: 'ChatGPT generation limit', waitingNote: 'Try again tomorrow', ingredients: 'Butter, flour', actionMoment: 'Butter curls mid-fall', promptStatus: 'DRAFT', fullPrompt: 'Extreme macro of cold butter shreds falling into yellow flour. (demo)' });
  const i5 = await mkImg(s3.id, 'Close-up — raw beef entering the skillet', 'REDO', { shotType: 'CINEMATIC INSERT', ingredients: 'Ground beef', ingredientState: 'Raw pink beef just hitting oil', actionMoment: 'First contact with the oil', mustBeVisible: '- raw pink beef\n- small pool of oil', mustNotAppear: '- no oil covering the whole pan', fullPrompt: 'Close-up of raw pink ground beef entering a stainless-steel skillet with a small pool of oil. (demo)', promptStatus: 'READY', attemptCount: 1 });
  const i6 = await mkImg(s3.id, 'Macro — partially browned beef', 'REVIEW', { shotType: 'MACRO ASMR', ingredients: 'Ground beef', ingredientState: 'Partially browned, some pink remaining', mustBeVisible: '- brown crumbles\n- pink pieces', fullPrompt: 'Macro of partially browned ground beef crumbles in a skillet. (demo)', promptStatus: 'READY', attemptCount: 1 });
  void i4;

  const orderOf: Record<string, number> = { [s1.id]: 1, [s2.id]: 2, [s3.id]: 3 };
  const attempt = async (img: any, n: number, status: string, color: string, extra: any = {}) => {
    const a = await importFile(await mk(`IMG-${String(img.seq).padStart(3, '0')} attempt ${n}`, color, status), { rootFolder: folder, folder: status === 'APPROVED' || status === 'REVIEW' ? '02 Images' : '03 Redos', fileBase: `${project.slug}_SC${String(orderOf[img.sceneId]).padStart(2, '0')}_IMG-${String(img.seq).padStart(3, '0')}_${img.title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40).replace(/-+$/, '')}_v${n}`, kind: 'GENERATED', version: n, projectSlug: project.slug });
    return db.attempt.create({ data: { imageId: img.id, number: n, assetId: a.id, status, sourceTool: 'ChatGPT', promptType: 'FULL', approvedAt: status === 'APPROVED' ? new Date() : null, ...extra } });
  };
  const a1 = await attempt(i1, 1, 'APPROVED', '#9a6b2f');
  await db.plannedImage.update({ where: { id: i1.id }, data: { approvedAttemptId: a1.id, attemptCount: 1 } });
  await attempt(i2, 1, 'REDO', '#6b3a2f', { wrong: 'Patty looked like a cake', change: 'Flaky layered pastry with visible beef filling', keep: 'Same hands, steam, framing', corrCategory: 'Wrong food texture', severity: 'MEDIUM' });
  const a2 = await attempt(i2, 2, 'APPROVED', '#b0803a');
  await db.plannedImage.update({ where: { id: i2.id }, data: { approvedAttemptId: a2.id, attemptCount: 2 } });
  await attempt(i5, 1, 'REDO', '#5a2f6b', { wrong: 'Too much oil — covers the whole pan base', change: 'Exactly 2 tablespoons of oil as a small shallow pool in the center', keep: 'Baby, skillet, camera angle, lighting', corrCategory: 'Wrong quantity', severity: 'HIGH' });
  await attempt(i6, 1, 'REVIEW', '#2f6b4a');

  // refs for IMG-003: master baby, kitchen, previous approved frame, product front label
  const link = (imageId: string, d: any, order: number) => db.imageRef.create({ data: { imageId, order, required: true, ...d } });
  await link(i3.id, { referenceId: masters['Master face'], role: 'MASTER BABY' }, 0);
  await link(i3.id, { referenceId: masters['Master kitchen'], role: 'MASTER KITCHEN' }, 1);
  await link(i3.id, { sourceImageId: i2.id, role: 'PREVIOUS APPROVED FRAME' }, 2);
  await link(i3.id, { referenceId: prod['Front Label'], role: 'INGREDIENT BRAND REFERENCE', required: false }, 3);
  await link(i2.id, { referenceId: masters['Master face'], role: 'MASTER BABY' }, 0);
  await link(i2.id, { sourceImageId: i1.id, role: 'PREVIOUS APPROVED FRAME' }, 1);
  await link(i5.id, { referenceId: masters['Counter and stove'], role: 'MASTER KITCHEN' }, 0);
  await link(i6.id, { referenceId: masters['Master face'], role: 'MASTER BABY' }, 0);
  await db.correction.create({ data: { code: 'COR-001', title: 'Too much oil in pan', category: 'Wrong quantity', wrong: 'Oil covered the entire pan base.', correct: 'Exactly 2 tablespoons of oil forming a small shallow pool near the center; the outer pan surface stays dry and visible.', babyChefId: chef.id, ingredient: 'oil', action: 'beef', severity: 'HIGH' } });
  await db.promptVersion.createMany({ data: [{ ownerId: i3.id, type: 'FULL', version: 1, text: 'Draft v1 (demo)', reason: 'Initial', active: false }, { ownerId: i3.id, type: 'FULL', version: 2, text: i3.fullPrompt, reason: 'Added exact composition', active: true }] });

  const k1 = await db.klingClip.create({ data: { projectId: project.id, order: 1, title: 'Hook — patty breaks open', status: 'DRAFT', durationTarget: 8, durationMin: 6, durationMax: 10, purpose: 'Open the video', startingComposition: 'Baby holds the whole patty', actionSequence: 'Baby lifts the patty, snaps it in half, steam rises, baby gasps.', majorActions: JSON.stringify(['Lifts patty', 'Snaps patty open', 'Reacts to steam']), foodPhysics: 'Flaky pastry layers separate; steam rises in soft wisps.', dialogue: '"Look pon dat!"', asmrLines: 'Pastry crackle\nSoft steam hiss', ambient: 'soft kitchen ambience', continuity: 'Same outfit and kitchen', foodState: 'Whole patty → broken open', endingComposition: 'Open patty held toward camera', finalPrompt: '@image1\nBaby lifts the golden patty.\n\nTransition to @image2\nThe patty snaps open and steam rises. Baby says: "Look pon dat!"\n\nTransition to @image3\nBaby reaches for butter and flour.' } });
  await db.klingScene.create({ data: { klingId: k1.id, sceneId: s1.id } });
  for (const [n, img] of [i1, i2, i3].entries()) await db.klingRef.create({ data: { klingId: k1.id, imageId: img.id, order: n } });
  await db.klingClip.create({ data: { projectId: project.id, order: 2, title: 'Dough — butter into flour', status: 'PLANNED' } });

  const sv = await db.shortVersion.create({ data: { projectId: project.id, targetSeconds: 55, hook: 'Finished patty breaks open', hookVisual: 'Finished patty breaks open.', hookDialogue: '"LOOK PON DAT!"', endVisual: 'Another hand reaches for the plate; baby pulls it away.', endDialogue: '"Eh eh! Make your own!"', cta: 'Mi busy now. Bye!', editNotes: 'Keep ASMR of the butter grating.', music: 'Light upbeat acoustic' } });
  await db.shortItem.createMany({ data: [{ shortId: sv.id, order: 0, sceneId: s1.id, visual: 'Patty breaks open', dialogue: 'Look pon dat!', seconds: 4, hookImp: true, foodImp: true, vertical: 'VERTICAL SAFE', reason: 'Strongest hook' }, { shortId: sv.id, order: 1, sceneId: s2.id, visual: 'Butter grating ASMR', seconds: 8, comedyImp: true, vertical: 'MAY REQUIRE REFRAMING' }] });

  let n = 0;
  for (const pl of PUBLISHING_PLAN) { n++; await db.publishingAsset.create({ data: { projectId: project.id, platform: pl.platform, assetType: pl.type, code: `PUB-${String(n).padStart(3, '0')}` } }); }
  const yt = await db.publishingAsset.findFirst({ where: { projectId: project.id, platform: 'YouTube Long Form', assetType: 'Title' } });
  if (yt) await db.publishingAsset.update({ where: { id: yt.id }, data: { status: 'SELECTED', returned: '1. Baby Chef Makes Jamaican Beef Patties\n2. LOOK PON DAT! Baby Chef Beef Patties', selected: 'Baby Chef Makes Jamaican Beef Patties (LOOK PON DAT!)' } });
  await db.activity.createMany({ data: [{ message: 'IMG-002 approved (attempt 2)', projectId: project.id, href: `/projects/${project.slug}/images/${i2.id}` }, { message: 'IMG-004 marked WAITING', projectId: project.id }, { message: 'Script v2 set current', projectId: project.id }] });
  console.log('Demo data created: open http://localhost:3000');
}
main().then(() => db.$disconnect()).catch(async e => { console.error(e); await db.$disconnect(); process.exit(1); });
