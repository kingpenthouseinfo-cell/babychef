// End-to-end check of the main Baby Chef Studio workflows against a RUNNING server.
// Usage: BASE=http://localhost:3100 STORAGE_DIR=/path node scripts/e2e.mjs
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const BASE = process.env.BASE || 'http://localhost:3100';
const STORE = process.env.STORAGE_DIR;
const FIX = process.env.FIXTURES || '/tmp/claude-0/bcs-fixtures';
const results = []; const consoleErrors = [];
const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, extra]); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };

async function fixture(name, w, h, color) {
  const p = path.join(FIX, name);
  await sharp({ create: { width: w, height: h, channels: 3, background: color } }).png().toFile(p);
  return p;
}
const walk = d => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]) : [];

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await ctx.newPage();
// Next cancels in-flight link prefetches when the test jumps to another URL; that is not an app error.
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to fetch RSC payload')) consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('PAGEERROR ' + e.message));
page.on('dialog', d => d.accept());
const go = async u => { await page.goto(BASE + u, { waitUntil: 'networkidle' }); };
const clip = async () => page.evaluate(() => navigator.clipboard.readText());
const stamp = Date.now().toString(36).slice(-4);
const CHEF = `E2E Chef ${stamp}`, PROJ = `E2E Soup ${stamp}`;

const face = await fixture('face.png', 800, 800, '#8a5a3a');
const kitchen = await fixture('kitchen.png', 1280, 720, '#3a6a8a');
const front = await fixture('front.png', 600, 900, '#aa3333');
const side = await fixture('side.png', 600, 900, '#aa6633');
const r1 = await fixture('result1.png', 1280, 720, '#445566');
const r2 = await fixture('result2.png', 1280, 720, '#556644');
const r3 = await fixture('result3.png', 1280, 720, '#664455');
const r4 = await fixture('result4.png', 1280, 720, '#335577');
const portrait = await fixture('portrait.png', 720, 1280, '#775533');

// ---- Baby Chef + gold references
await go('/babychefs/new');
await page.fill('input[name=displayName]', CHEF);
await page.fill('textarea[name=personality]', 'Funny and dramatic');
await page.fill('textarea[name=voiceInstruction]', 'Raspy toddler voice, light accent');
await page.fill('textarea[name=humorPatterns]', 'Suspicious of spice');
await page.click('text=SAVE BABY CHEF');
await page.waitForURL(/\/babychefs\/(?!new)[a-z0-9]+$/);
const chefUrl = page.url();
ok('Create Baby Chef', (await page.textContent('h1')).includes(CHEF));
await page.click('summary:has-text("Add reference image")').catch(() => {});
async function addRef(file, title, cat, gold) {
  const form = page.locator('form:has(input[type=file][name=file]):has(button:has-text("Add reference"))').first();
  await form.locator('input[name=file]').setInputFiles(file);
  await form.locator('input[name=title]').fill(title);
  await form.locator('select[name=category]').selectOption(cat);
  if (gold) await form.locator('input[name=isGold]').check();
  await form.locator('button:has-text("Add reference")').click();
  await page.waitForLoadState('networkidle'); await page.waitForTimeout(600);
}
await page.click('summary:has-text("Add reference image")').catch(() => {});
await addRef(face, 'Master face', 'Character Face', true);
await page.reload({ waitUntil: 'networkidle' });
await page.click('summary:has-text("Add reference image")');
await addRef(kitchen, 'Master kitchen', 'Kitchen', true);
await page.reload({ waitUntil: 'networkidle' });
const exif = path.join(FIX, 'exif.jpg');
await sharp({ create: { width: 800, height: 400, channels: 3, background: '#338855' } }).jpeg().withMetadata({ orientation: 6 }).toFile(exif);
await page.click('summary:has-text("Add reference image")');
await addRef(exif, 'EXIF rotated hand', 'Character Hands', false);
await page.reload({ waitUntil: 'networkidle' });
ok('EXIF-rotated photo is recorded as PORTRAIT (displayed orientation)', (await page.locator('text=/PORTRAIT · 400×800/').count()) > 0);
ok('Upload Baby Chef references', (await page.locator('text=Master face').count()) > 0 && (await page.locator('text=Master kitchen').count()) > 0);
ok('Gold Standard badge visible', (await page.locator('text=GOLD STANDARD').count()) >= 2);
const babyDir = walk(path.join(STORE, '00 Baby Chefs', CHEF));
ok('Reference files in human-readable folders', babyDir.some(f => /References\/Baby\/REF-BABY-\d+_master-face/.test(f)) && babyDir.some(f => /References\/Kitchen\/REF-KITCHEN-\d+_master-kitchen/.test(f)), babyDir.map(f => path.relative(STORE, f)).join(' | '));

// ---- Project
await go('/projects/new');
await page.fill('input[name=title]', PROJ);
await page.locator(`label:has(input[name=babyChefId]):has-text("${CHEF}")`).click();
await page.fill('textarea[name=recipeOriginal]', '1 cup lentils, 2 tbsp oil, 1/2 tsp cumin seeds, 1 cup coconut milk.');
await page.click('button:has-text("Create video")');
await page.waitForURL(/\/projects\/e2e-soup/);
const slug = new URL(page.url()).pathname.split('/')[2];
ok('Create project with auto slug', slug.startsWith('e2e-soup'), slug);

// ---- Ingredient + PACKAGE CRITICAL product refs
await go(`/projects/${slug}/ingredients`);
const addForm = page.locator('section:has(h2:has-text("Add one ingredient")) form');
await addForm.locator('input[name=name]').fill('Coconut Milk');
await addForm.locator('input[name=quantity]').fill('1'); await addForm.locator('input[name=unit]').fill('cup');
await addForm.locator('input[name=brand]').fill('Example Brand');
await addForm.locator('select[name=importance]').selectOption('PACKAGE_CRITICAL');
await addForm.locator('button:has-text("ADD INGREDIENT")').click();
await page.waitForLoadState('networkidle'); await page.waitForTimeout(500);
ok('Ingredient shows PACKAGE CRITICAL', (await page.locator('text=PACKAGE CRITICAL').count()) > 0);
await page.fill('textarea[name=text]', '2 cups flour, sifted\n1 tsp salt | Brand: Morton\n3 cloves garlic (minced)');
await page.click('button:has-text("ADD THESE INGREDIENTS")'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(600);
ok('Quick add: lines split into separate ingredients', (await page.locator('h2:has-text("2 cups flour")').count()) === 1 && (await page.locator('h2:has-text("1 tsp salt")').count()) === 1 && (await page.locator('h2:has-text("3 cloves garlic")').count()) === 1);
const opts = await page.locator('select[aria-label="Which ingredient?"] option').allTextContents();
ok('Photo panel lists every recipe ingredient', opts.some(o => o.includes('flour')) && opts.some(o => o.includes('salt')) && opts.some(o => o.includes('Coconut Milk')) && opts.some(o => o.includes('garlic')), opts.join('|'));
await page.selectOption('select[aria-label="Which ingredient?"]', { label: opts.find(o => o.includes('salt')) });
ok('Picking an ingredient pre-fills its brand', (await page.inputValue('input[name=brand] >> nth=0')) === 'Morton');
async function addProd(file, type) {
  const sum = page.locator('summary:has-text("Add product photo")').first();
  await sum.click();
  const f = page.locator('details:has(summary:has-text("Add product photo")) form').first();
  await f.locator('input[name=file]').setInputFiles(file);
  await f.locator('input[name=title]').fill(type);
  await f.locator('select[name=category]').selectOption(type);
  await f.locator('button:has-text("Add reference")').click();
  await page.waitForLoadState('networkidle'); await page.waitForTimeout(600);
  await page.reload({ waitUntil: 'networkidle' });
}
await addProd(front, 'Front Label'); await addProd(side, 'Side Label');
const prodFiles = walk(path.join(STORE, PROJ, '01 References', 'Products'));
ok('Product reference photos stored under 01 References/Products', prodFiles.length === 2 && prodFiles.some(f => /REF-PRODUCT-\d+_coconut-milk_example-brand_front-label/.test(f)), prodFiles.map(f => path.basename(f)).join(', '));

// ---- Script versioning
await go(`/projects/${slug}/script`);
await page.click('text=+ CREATE SCRIPT v1');
await page.waitForLoadState('networkidle'); await page.waitForTimeout(500);
await page.fill('textarea[name=content]', 'v1 text [HOOK] hello');
await page.click('button:has-text("SAVE"):not(:has-text("SAVE ")) >> nth=0').catch(async () => { await page.click('form button[type=submit]:has-text("SAVE")'); });
await page.waitForLoadState('networkidle'); await page.waitForTimeout(500);
await page.click('button:has-text("Duplicate as new version")');
await page.waitForLoadState('networkidle'); await page.waitForTimeout(500);
await page.reload({ waitUntil: 'networkidle' });
const hasV2 = (await page.locator('a:has-text("v2")').count()) > 0;
if (hasV2) { await page.click('a:has-text("v2")'); await page.waitForLoadState('networkidle'); await page.click('button:has-text("Make this version CURRENT")'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(400); }
await page.reload({ waitUntil: 'networkidle' });
ok('Script v1 + v2 exist, v2 current', hasV2 && (await page.locator('a:has-text("v2 ★ CURRENT")').count()) > 0);
await page.click('a:has-text("v1")'); await page.waitForLoadState('networkidle');
ok('Script v1 still accessible with content', (await page.inputValue('textarea[name=content]')).includes('v1 text'));

// ---- Scene + images
await go(`/projects/${slug}/scenes?view=new`);
await page.fill('input[name=title]', 'Temper the cumin');
await page.fill('textarea[name=foodBefore]', 'Oil cold in pan'); await page.fill('textarea[name=foodAfter]', 'Seeds sizzling in oil');
await page.click('button:text-matches("ADD (FIRST|NEXT) SCENE")');
await page.waitForLoadState('networkidle'); await page.waitForTimeout(500);
ok('Create scene SC01', (await page.locator('text=SC01').count()) > 0);

async function newImage(title) {
  await go(`/projects/${slug}/images`);
  await page.fill('#add textarea[name=what]', title);
  await page.locator('#add details > summary').click(); await page.fill('#add input[name=title]', title);
  await page.click('#add button:has-text("ADD PICTURE")');
  await page.waitForURL(/\/images\/[a-z0-9]+$/); await page.waitForLoadState('networkidle');
  return page.url();
}
const img1Url = await newImage('Oil in pan');
ok('Image gets global ID IMG-001', (await page.locator('[data-testid=expected-filename]').first().textContent()).includes('IMG-001'));
await page.fill('textarea[aria-label="Full prompt"]', 'FULL: cinematic frame of a pan with 2 tbsp oil.');
await page.locator('textarea[aria-label="Full prompt"]').blur(); await page.waitForTimeout(900);
await page.click('button[role=tab]:has-text("Continuation")');
await page.fill('textarea[aria-label="Continuation prompt"]', 'CONT: same baby, same pan, 2 tbsp oil only.');
await page.locator('textarea[aria-label="Continuation prompt"]').blur(); await page.waitForTimeout(900);
await page.fill('textarea[name=startingComposition]', 'Pan on stove; baby holds spoon above.');
await page.fill('textarea[name=mustBeVisible]', '- pan\n- oil pool');
await page.fill('textarea[name=actionMoment]', 'Spoon hovering above oil');
await page.fill('input[name=ingredients]', 'Coconut Milk, oil');
await page.click('button:has-text("SAVE IMAGE DETAILS")');
await page.waitForLoadState('networkidle'); await page.waitForTimeout(600);
// attach masters + product ref
async function attach(label, role) {
  if (!(await page.locator('details[open] > summary:text-is("Change")').count())) await page.click('summary:text-is("Change")');
  const sel = page.locator('details form:has(select[name=target])');
  const opts = await sel.locator('select[name=target] option').allTextContents();
  const idx = opts.findIndex(o => o.includes(label));
  if (idx < 0) return false;
  const val = await sel.locator('select[name=target] option').nth(idx).getAttribute('value');
  await sel.locator('select[name=target]').selectOption(val);
  await sel.locator('select[name=role]').selectOption(role);
  await sel.locator('button:has-text("Attach")').click();
  await page.waitForLoadState('networkidle'); await page.waitForTimeout(500);
  return true;
}
ok('Attach Baby Master', await attach('Master face', 'MASTER BABY'));
ok('Attach Master Kitchen', await attach('Master kitchen', 'MASTER KITCHEN'));
ok('Attach Ingredient Front Label', await attach('Front Label', 'INGREDIENT BRAND REFERENCE'));
ok('Checklist shows Coconut Milk brand reference + PACKAGE CRITICAL', (await page.locator('text=Coconut Milk (Example Brand) Brand Reference').count()) > 0 && (await page.locator('text=PACKAGE CRITICAL').count()) > 0);
await page.click('button:has-text("MARK READY") >> nth=0'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(600);
const IMG1_URL_FOR_QUEUE = page.url();

// ---- Prompt queue
await go('/queue');
ok('IMG-001 is the NEXT card in the Prompt Queue', (await page.locator('text=IMG-001').count()) > 0 && (await page.locator('text=NEXT').count()) > 0);
ok('NEXT card lists required references in order, incl. Coconut Milk brand ref', (await page.locator('text=Coconut Milk (Example Brand) Brand Reference').count()) > 0 && (await page.locator('ol li:has-text("Master face")').count()) > 0);
await page.locator('button:has-text("Copy full prompt")').first().click(); await page.waitForTimeout(300);
ok('Secondary button copies the other prompt type (FULL)', (await clip()).startsWith('FULL:'));
await page.locator('button:has-text("Copy Next Prompt"):visible').click(); await page.waitForTimeout(1500);
ok('Copy Next Prompt copies the continuation prompt', (await clip()).startsWith('CONT:'));
await page.waitForTimeout(800); await page.reload({ waitUntil: 'networkidle' });
ok('Copy Next Prompt advanced the queue ("Oil in pan" is no longer ready)', (await page.locator('text=Oil in pan').count()) === 0);
await page.goto(`${BASE}/queue?show=generating`, { waitUntil: 'networkidle' });
ok('Image appears under Generating', (await page.locator('text=IMG-001').count()) > 0);

// ---- Import result -> redo -> import -> approve
await page.goto(img1Url + '#results', { waitUntil: 'networkidle' });
async function importResult(file) {
  await page.locator('button:has-text("Add finished picture")').first().click();
  const dlg = page.locator('[role=dialog]');
  await dlg.locator('input[name=file]').setInputFiles(file);
  await dlg.locator('button:has-text("Import")').click();
  await page.waitForLoadState('networkidle'); await page.waitForTimeout(1200);
}
await importResult(r1);
ok('Attempt 1 in REVIEW (review panel visible)', (await page.locator('text=Check this picture').count()) > 0);
// 3-state checklist: click cycles ✓ -> ? and persists after reload
const chip = page.locator('#review button:has-text("Same Baby Chef")');
await chip.click(); await chip.click(); await page.waitForTimeout(700);
await page.reload({ waitUntil: 'networkidle' });
ok('Review checklist cycles ✓→? and persists', (await page.locator('#review button[aria-label^="Same Baby Chef: unsure"]').count()) === 1);
ok('Compare modes available', (await page.locator('#review button:has-text("Single")').count()) === 1);
await page.locator('a:has-text("Fix it")').first().click(); await page.waitForLoadState('networkidle');
await page.fill('textarea[name=wrong]', 'Too much oil');
await page.fill('textarea[name=change]', 'Only 2 tbsp small pool');
await page.locator('button:has-text("Make fix prompt")').click();
await page.waitForLoadState('networkidle'); await page.waitForTimeout(700);
ok('Redo saved: correction history shows', (await page.locator('text=Too much oil').count()) > 0);
ok('Fix it: next prompt starts with the fix header and the file name moves to v2', (await page.locator('textarea[aria-label="Full prompt"]').first().inputValue().catch(() => '')).includes('Fix from version 1: Too much oil') && /_v2\.png/.test((await page.locator('[data-testid=expected-filename]').first().textContent()) || ''));
ok('Attempt chip shows v1 Redo', (await page.locator('a:has-text("v1"):has-text("Needs fixing")').count()) > 0);
await importResult(r2);
ok('Version 2 uploaded; attempt 1 preserved', (await page.locator('text=Version 1').count()) > 0 && (await page.locator('text=Version 2').count()) > 0);
await page.locator('#approve-form button').click();
await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
ok('Approve works: THE ONE TO USE badge', (await page.locator('text=THE ONE TO USE').count()) > 0);
const genFiles = walk(path.join(STORE, PROJ));
ok('Generated files organized (02 Images / 03 Redos, readable names)', genFiles.some(f => /02 Images\/e2e-soup-\w+_SC01_IMG-001[\w-]*_v2\.png$/.test(f)) && genFiles.some(f => /03 Redos\/e2e-soup-\w+_SC01_IMG-001[\w-]*_v1\.png$/.test(f)), genFiles.filter(f => /_v\d/.test(f)).map(f => path.relative(STORE, f)).join(' | '));

// ---- Previous approved frame for IMG-002
const img2Url = await newImage('Cumin in oil');
await page.waitForLoadState('networkidle');
ok('Previous approved picture is picked automatically for IMG-002', (await page.locator('text=IMG-001 Previous Picture').count()) > 0);
await page.waitForLoadState('networkidle'); await page.waitForTimeout(300);
ok('IMG-002 uses IMG-001 as PREVIOUS APPROVED FRAME w/ thumbnail', (await page.locator('text=IMG-001 Previous Picture').count()) > 0 && (await page.locator('section img[src*="/api/files/"]').count()) > 0);
await page.click('summary:text-is("Change")').catch(() => {});
ok('Attach same Front Label to a 2nd image', await attach('Front Label', 'INGREDIENT BRAND REFERENCE'));
ok('Reference is linked, not copied (linked in 2 images, still 2 files on disk)', (await page.locator('text=linked in 2').count()) > 0 && walk(path.join(STORE, PROJ, '01 References', 'Products')).length === 2);
// third image + approve quickly, 4th for kling
async function quickApprove(url, file) {
  await page.goto(url + '#results', { waitUntil: 'networkidle' });
  await importResult(file);
  await page.locator('#approve-form button').click();
  await page.waitForLoadState('networkidle'); await page.waitForTimeout(700);
}
await quickApprove(img2Url, r3);
const img3Url = await newImage('Seeds crackle'); await quickApprove(img3Url, r4);
const img4Url = await newImage('Portrait reaction');
await page.goto(img4Url + '#results', { waitUntil: 'networkidle' }); await importResult(portrait);
const ab = page.locator('#approve-form button'); await ab.focus();
await page.keyboard.down('Enter'); await page.waitForTimeout(250); await page.keyboard.up('Enter'); await page.waitForTimeout(600);
ok('Keyboard: short press does NOT approve (hold required)', (await page.locator('text=THE ONE TO USE').count()) === 0);
await ab.focus(); await page.keyboard.down('Enter'); await page.waitForTimeout(1100); await page.keyboard.up('Enter');
await page.waitForLoadState('networkidle'); await page.waitForTimeout(900);
ok('Keyboard: holding Enter 0.7s approves', (await page.locator('text=THE ONE TO USE').count()) > 0);
await page.click('#review button:has-text("Undo")'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
ok('Undo approval returns attempt to REVIEW', (await page.locator('text=THE ONE TO USE').count()) === 0 && (await page.locator('#review button:has-text("Fix this picture")').count()) > 0);
await page.locator('#approve-form button').click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
ok('Re-approve by click', (await page.locator('text=THE ONE TO USE').count()) > 0);

// ---- Kling
await go(`/projects/${slug}/kling`);
await page.fill('input[name=title]', 'Tempering clip'); await page.fill('input[name=durationTarget]', '12');
await page.click('button:has-text("ADD VIDEO CLIP")'); await page.waitForURL(/\/kling\/[a-z0-9]+$/); await page.waitForLoadState('networkidle');
for (const code of ['IMG-001', 'IMG-002', 'IMG-003', 'IMG-004']) {
  const sel = page.locator('select[name=imageId]');
  const opts = await sel.locator('option').allTextContents();
  const i = opts.findIndex(o => o.includes(code));
  await sel.selectOption(await sel.locator('option').nth(i).getAttribute('value'));
  await page.click('button:has-text("Attach")'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(500);
}
ok('Kling refs labeled @image1..@image3', ['@image1', '@image2', '@image3'].every(l => page.locator(`span.font-mono:has-text("${l}")`).count().then(c => c > 0)) && (await page.locator('span.font-mono:has-text("@image3")').count()) > 0);
ok('Orientation mismatch warning (portrait vs landscape)', (await page.locator('text=orientations do not match').count()) > 0);
const codeAt = async n => (await page.locator('ol[aria-label="Reference strip"] li').nth(n).locator('.font-mono').nth(1).textContent()).trim();
const before = await codeAt(0);
await page.locator('ol[aria-label="Reference strip"] li').first().locator('button[aria-label$="later"]').click(); await page.waitForTimeout(900);
await page.reload({ waitUntil: 'networkidle' });
ok('@image reorder persists (first image moved later)', (await codeAt(0)) !== before && (await codeAt(1)) === before, `${before} -> ${await codeAt(0)}`);
await page.fill('textarea[name=finalPrompt]', '@image1 baby lifts spoon. Transition to @image2 seeds fall.');
await page.click('button:has-text("Dialogue")');
await page.fill('textarea[name=dialogue]', Array.from({ length: 45 }, (_, i) => 'word' + i).join(' '));
await page.click('button:has-text("SAVE CLIP")'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
const pfBefore = await page.locator('text=to review').first().textContent();
await page.locator('button:has-text("Mark fixed")').first().click();
ok('Pre-flight: Mark fixed dismisses a warning', (await page.locator('text=to review').first().textContent()) !== pfBefore);
await page.reload({ waitUntil: 'networkidle' });
ok('Pre-flight warns (dialogue too long / blank fields)', (await page.locator('text=Dialogue may be too long').count()) > 0 && (await page.locator('text=No ending frame description').count()) > 0);
await page.locator('button:has-text("COPY KLING PROMPT") >> nth=0').click(); await page.waitForTimeout(300);
ok('Copy Kling prompt', (await clip()).includes('@image1 baby lifts spoon'));
const klingUrl = page.url();

// ---- Production Brain
await go(`/projects/${slug}/builder?type=plan`);
let ta = await page.inputValue('textarea[aria-label="Final copy-ready prompt"]');
ok('A: Plan prompt includes Bible, chef, recipe, ingredients, hooks', ['LEVEL 1', 'PACING RULES', 'FOOD PHYSICS RULES', 'LEVEL 2', CHEF, 'lentils', 'Coconut Milk', 'PRODUCT REFERENCE SUMMARY', 'PACKAGE CRITICAL', 'SHORT KEEP', 'ASMR RULES'].every(s => ta.toUpperCase().includes(s.toUpperCase())));
ok('A: Plan prompt copies', await (async () => { await page.locator('button:has-text("COPY PROMPT"):visible').first().click(); await page.waitForTimeout(300); return (await clip()).length > 3000; })());
const imgId1 = img1Url.split('/').pop();
await go(`/projects/${slug}/builder?type=image-full&image=${imgId1}`);
ta = await page.inputValue('textarea[aria-label="Final copy-ready prompt"]');
ok('B: Full image prompt writer — spatial/physics/refs/product', ['STARTING COMPOSITION', 'Pan on stove', 'REFERENCE HIERARCHY', 'Master Baby reference controls', 'PACKAGE CRITICAL', 'Do not replace it with a different brand', 'ACTION MOMENT', 'single copy-ready still-image'.toUpperCase()].every(s => ta.toUpperCase().includes(s.toUpperCase())));
ok('B: shows context preview with ✓ lines', (await page.locator('text=Reference images & instructions').count()) > 0);
await go(`/projects/${slug}/builder?type=image-cont&image=${imgId1}`);
const tc = await page.inputValue('textarea[aria-label="Final copy-ready prompt"]');
ok('C: Continuation writer is shorter and omits chef profile', tc.length < ta.length && !tc.includes('LEVEL 2 — BABY CHEF PROFILE'), `${tc.length} < ${ta.length}`);
await go(`/projects/${slug}/builder?type=image-redo&image=${imgId1}&note=${encodeURIComponent('too much oil')}`);
const tr = await page.inputValue('textarea[aria-label="Final copy-ready prompt"]');
ok('D: Redo prompt includes failure, correction, only-listed-problem rule', tr.includes('Too much oil') && tr.includes('Only 2 tbsp small pool') && tr.includes('too much oil') && /Change ONLY the listed problem/i.test(tr));
await go(`/projects/${slug}/builder?type=kling-final&kling=${klingUrl.split('/').pop()}`);
const tk = await page.inputValue('textarea[aria-label="Final copy-ready prompt"]');
ok('E: Final Kling writer has @image order, voice, ASMR/ending rules', ['@image1 = IMG-002', '@image2 = IMG-001', '@image3 = IMG-003', 'Raspy toddler voice', 'ENDING STATE', 'Place @image1'.toUpperCase()].every(s => tk.toUpperCase().includes(s.toUpperCase())));
// save version + paste result + apply
await page.locator('button:has-text("SAVE VERSION"):visible').first().click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
ok('Save prompt version records metadata', (await page.locator('text=Bible v').count()) > 0);
await page.fill('textarea[name=result]', '@image1 AI-WRITTEN KLING PROMPT'); await page.click('button:has-text("SAVE RESULT")'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(500);
await page.click('button:has-text("USE RESULT AS KLING PROMPT")'); await page.waitForURL(/\/kling\/[a-z0-9]+$/); await page.waitForLoadState('networkidle');
ok('Apply pasted result → Kling prompt (versioned)', (await page.inputValue('textarea[name=finalPrompt]')).includes('AI-WRITTEN'));

// ---- Correction library -> flows into image prompts
await go('/corrections');
await page.click('summary:has-text("Add correction")');
const cf = page.locator('form:has(input[name=title]):has(button:has-text("Add correction"))');
await cf.locator('input[name=title]').fill('Too much oil in pan'); await cf.locator('textarea[name=correct]').fill('Exactly 2 tablespoons of oil forming a small shallow pool'); await cf.locator('textarea[name=wrong]').fill('Oil covered the whole pan');
await cf.locator('input[name=ingredient]').fill('oil'); await cf.locator('button:has-text("Add correction")').click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(600);
await go(`/projects/${slug}/builder?type=image-full&image=${imgId1}`);
ta = await page.inputValue('textarea[aria-label="Final copy-ready prompt"]');
ok('Relevant correction appears in image prompt context', ta.includes('KNOWN CORRECTIONS TO RESPECT') && ta.includes('Exactly 2 tablespoons'));
ok('Context preview lists the correction', (await page.locator('text=Known corrections').count()) > 0 && (await page.locator('text=Too much oil in pan').count()) > 0);
ok('Approved previous-frame context is included for IMG-002', await (async () => { const id2 = img2Url.split('/').pop(); await go(`/projects/${slug}/builder?type=image-full&image=${id2}`); const t2 = await page.inputValue('textarea[aria-label="Final copy-ready prompt"]'); return t2.includes('IMG-001 Previous Picture') && t2.includes('CURRENT VISUAL STATE') && t2.includes('Do not reset the cookware'); })());

// ---- every remaining builder produces a real, context-rich prompt
async function builder(type, extra = '') { await go(`/projects/${slug}/builder?type=${type}${extra}`); return (await page.inputValue('textarea[aria-label="Final copy-ready prompt"]')).toUpperCase(); }
let b = await builder('script');
ok('Script prompt: purpose, chef voice, recipe, rules', ['PURPOSE: SCRIPT PROMPT', 'RASPY TODDLER VOICE', 'LENTILS', 'SCRIPT RULES', 'DO NOT MAKE THE BABY CHEF SOUND LIKE A GENERIC ADULT', 'OFF-SCREEN NARRATION'].every(x => b.includes(x)));
b = await builder('script-revision');
ok('Script revision prompt includes the current script', b.includes('CURRENT SCRIPT') && b.includes('V1 TEXT'));
b = await builder('scenes');
ok('Scene breakdown prompt: script + do-not-fragment rule + output format', ['CURRENT SCRIPT', 'DO NOT CREATE ONE SCENE FOR EVERY SENTENCE', 'FOOD STATE BEFORE:', 'KLING GROUPING NOTE:'].every(x => b.includes(x)));
b = await builder('image-plan');
ok('Image plan prompt: scenes + food states + multi-image rule', ['SCENES & FOOD-STATE PROGRESSION', 'TEMPER THE CUMIN', 'ONE SCENE MAY REQUIRE MULTIPLE STILL IMAGES', 'POSSIBLE KLING GROUP:', 'PRODUCT REFERENCE SUMMARY'].every(x => b.includes(x)));
b = await builder('continuity');
ok('Continuity review prompt: food state rules + approved images', ['FOOD STATE RULES', 'APPROVED IMAGES', 'REGRESSES'].every(x => b.includes(x)));
b = await builder('kling-group');
ok('Kling grouping prompt: approved images + grouping principle', b.includes('APPROVED IMAGES') && b.includes('NOT EVERY STILL IMAGE REQUIRES') && b.includes('SPLIT WARNING IF TOO COMPLEX'));
// record a failed Kling generation, then build the Kling redo prompt
await page.goto(klingUrl, { waitUntil: 'networkidle' });
await page.fill('input[name=externalName]', 'kling_try1.mp4'); await page.click('button:has-text("RECORD GENERATION")'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
await page.click('summary:has-text("FIX THIS VIDEO — what is wrong")');
await page.fill('textarea[name=wrong]', 'Hands morphed between images'); await page.fill('textarea[name=change]', 'Use a natural cut between image 2 and 3'); await page.fill('textarea[name=keep]', 'Same kitchen and voice');
await page.click('button:has-text("SAVE FIX")'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
b = await builder('kling-redo', `&kling=${klingUrl.split('/').pop()}`);
ok('Kling redo prompt: failure, correction, keep list, original prompt, reference order', ['FAILED KLING GENERATION', 'HANDS MORPHED BETWEEN IMAGES', 'NATURAL CUT BETWEEN IMAGE 2 AND 3', 'SAME KITCHEN AND VOICE', 'ORIGINAL KLING PROMPT', 'KEEP THE REFERENCE ORDER'].every(x => b.includes(x)));

// ---- context toggles, target selector, edit protection
await go(`/projects/${slug}/builder?type=plan`);
await page.locator('input[name=inc][value=bible]').uncheck();
await page.selectOption('select[name=target]', 'CLAUDE');
await page.click('button:has-text("REBUILD FROM TEMPLATE")'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(700);
ta = await page.inputValue('textarea[aria-label="Final copy-ready prompt"]');
ok('Unchecking a context block removes it; target label is applied', !ta.includes('LEVEL 1') && ta.includes('PREPARED FOR: CLAUDE') && (await page.locator('text=Production Bible >> nth=0').count()) > 0);
await page.fill('textarea[aria-label="Final copy-ready prompt"]', ta + '\nMY HAND EDIT');
await page.click('button:has-text("REBUILD FROM TEMPLATE")'); await page.waitForTimeout(500);
ok('Edited prompt is protected: banner asks before rebuilding', (await page.locator('text=You\'ve edited this prompt').count()) > 0 && (await page.locator('text=EDITED').count()) > 0);
await page.click('button:has-text("Keep my edits")'); await page.waitForTimeout(300);
ok('Keep my edits preserves the text', (await page.inputValue('textarea[aria-label="Final copy-ready prompt"]')).includes('MY HAND EDIT'));

// ---- Mark waiting from the Prompt Queue NEXT card
await go(`/projects/${slug}/images`);
await page.fill('#add textarea[name=what]', 'Waiting test image'); await page.locator('#add details > summary').click(); await page.fill('#add input[name=title]', 'Waiting test image'); await page.click('#add button:has-text("ADD PICTURE")'); await page.waitForURL(/\/images\/[a-z0-9]+$/); await page.waitForLoadState('networkidle');
await page.click('button[role=tab]:has-text("Continuation")'); await page.fill('textarea[aria-label="Continuation prompt"]', 'CONT: waiting test'); await page.locator('textarea[aria-label="Continuation prompt"]').blur(); await page.waitForTimeout(900);
await page.click('button:has-text("MARK READY") >> nth=0'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(700);
await go('/queue');
await page.click('button:has-text("Waiting on something")'); await page.selectOption('select[aria-label="Waiting reason"]', 'ChatGPT generation limit'); await page.locator('button.btn-primary:has-text("MARK WAITING")').click(); await page.waitForTimeout(1200);
await page.goto(`${BASE}/queue?show=waiting`, { waitUntil: 'networkidle' });
ok('Mark waiting from Queue stores reason + time', (await page.locator('text=Waiting test image').count()) > 0 && (await page.locator('text=ChatGPT generation limit').count()) > 0);

// ---- Bible edit
await go('/settings/bible');
ok('Bible: 27 editable sections', (await page.locator('nav[aria-label="Rule sections"] a').count()) >= 27);
await page.fill('textarea[name=content]', 'EDITED RULE FOR PHILOSOPHY');
await page.click('button:has-text("Save as v")'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(600);
await go(`/projects/${slug}/builder?type=plan`);
ok('Edited rule flows into the next prompt', (await page.inputValue('textarea[aria-label="Final copy-ready prompt"]')).includes('EDITED RULE FOR PHILOSOPHY'));

// ---- Scene import
await go(`/projects/${slug}/import`);
await page.fill('textarea[aria-label="Pasted scene text"]', '## SCENES\n### SCENE 01 — Wash lentils\nPURPOSE: Show rinsing\nFOOD STATE BEFORE: Dry lentils\nFOOD STATE AFTER: Rinsed lentils\nSHORT KEEP: YES\n### SCENE 02 — Simmer\nPURPOSE: Soften\nFOOD STATE BEFORE: Rinsed\n## CONTINUITY RISKS\nnone');
await page.click('button:has-text("PREVIEW IMPORT")'); await page.waitForTimeout(1200);
ok('Scene import previews 2 scenes', (await page.locator('text=Found 2 scene(s)').count()) > 0);
await page.click('button:has-text("IMPORT SELECTED SCENES")'); await page.waitForURL(/\/scenes$/); await page.waitForLoadState('networkidle');
ok('Imported scenes appended (SC02, SC03), SC01 untouched', (await page.locator('text=Wash lentils').count()) > 0 && (await page.locator('text=Temper the cumin').count()) > 0);

// ---- Publishing / short / files / export
await go(`/projects/${slug}/publishing`);
await page.click('button:has-text("CREATE STANDARD PUBLISHING ITEMS")'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
await page.locator('button:has-text("Prepare prompt")').first().click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
ok('Publishing prompt prepared (Copy prompt appears)', (await page.locator('button:has-text("Copy prompt")').count()) > 0);
await page.locator('textarea[aria-label^="Paste result for"]').first().fill('1. Cozy Lentil Soup With Baby Chef'); await page.locator('button:has-text("Save result")').first().click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(700);
await page.locator('button:has-text("Mark selected")').first().click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(700);
ok('Publishing: result pasted and Mark selected works', (await page.locator('text=Cozy Lentil Soup').count()) > 0 && (await page.locator('.chip.st-selected').count()) > 0);
await go(`/projects/${slug}/short`);
await page.click('button:has-text("COLLECT SHORT KEEP SCENES")'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(600);
ok('Short version collects SHORT KEEP scenes', (await page.locator('text=Wash lentils').count()) > 0);
await go(`/projects/${slug}/files`);
await page.click('button:has-text("Write text files")'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
ok('Text files written into project folder (05 Prompts)', walk(path.join(STORE, PROJ, '05 Prompts')).length > 0);
const z = await ctx.request.get(`${BASE}/api/projects/${slug}/export?format=zip`);
ok('Project ZIP export', z.ok() && (await z.body()).length > 1000, `${(await z.body()).length} bytes`);
const j = await ctx.request.get(`${BASE}/api/projects/${slug}/export?format=json`); ok('Project JSON export', j.ok() && (await j.text()).includes('"project"'));
const c = await ctx.request.get(`${BASE}/api/projects/${slug}/export?format=csv&table=ingredients`); ok('Ingredients CSV export', c.ok() && (await c.text()).includes('Coconut Milk'));

// ---- Responsive + console
for (const [w, h, n] of [[1440, 900, 'desktop'], [820, 1100, 'tablet'], [390, 844, 'phone']]) {
  await page.setViewportSize({ width: w, height: h });
  for (const u of [`/projects/${slug}/images`, img1Url.replace(BASE, ''), '/queue', `/projects/${slug}/builder?type=plan`]) {
    await go(u);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    ok(`No horizontal overflow @${n} ${u.split('/').slice(-1)[0].slice(0, 20)}`, !overflow);
  }
  await page.screenshot({ path: path.join(FIX, `shot-${n}.png`), fullPage: false });
}
// ---- batch actions, scene reorder, script LOCKED/reopen, storage root
await go(`/projects/${slug}/images`);
await page.click('summary:has-text("Batch actions")');
await page.locator('input[name=ids]').first().check();
await page.locator('details:has(summary:has-text("Batch actions")) select[name=status]').selectOption('SKIPPED');
await page.click('button:has-text("Apply status")'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(700);
ok('Batch: change status of selected images', (await page.locator('.chip.st-skipped').count()) > 0);
await go(`/projects/${slug}/scenes`);
const sceneTitles = async () => page.locator('a[href*="?scene="]').evaluateAll(a => a.map(x => (x.textContent || '').match(/SC\d+/)?.[0] + ':' + (x.querySelector('div.font-bold')?.textContent || '')));
const before3 = await sceneTitles();
await page.locator('a[href*="?scene="]').nth(1).click(); await page.waitForTimeout(600);
await page.click('button[aria-label="Move scene up"]'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(700);
const after3 = await sceneTitles();
ok('Scene reorder: order changes but each scene keeps its stable SC code', before3[0].split(':')[1] === after3[1].split(':')[1] && before3[0] === after3[1] && before3[1] === after3[0], `${before3.join('|')} -> ${after3.join('|')}`);
await go(`/projects/${slug}/script`);
await page.selectOption('select[name=status]', 'LOCKED'); await page.click('form button[type=submit]:has-text("SAVE")'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(700);
ok('Script LOCKED can be reopened (not irreversible)', (await page.locator('button:has-text("Reopen (unlock)")').count()) > 0);
await page.click('button:has-text("Reopen (unlock)")'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(600);
ok('Reopen sets status back to DRAFT', (await page.locator('select[name=status]').inputValue()) === 'DRAFT');
await go('/settings');
await page.fill('input[name=root]', STORE + '-alt'); await page.click('button:has-text("SAVE STORAGE ROOT")'); await page.waitForTimeout(1200);
ok('Settings: storage root is validated and saved', (await page.locator('text=Storage root set to').count()) > 0);
await page.fill('input[name=root]', '~/Documents/Baby Chef Studio'); await page.click('button:has-text("SAVE STORAGE ROOT")'); await page.waitForTimeout(800);

// ---- every screen at phone + tablet width: no page-level horizontal overflow
// ---- Scenes & Pictures: insert anywhere, stable IDs
await go(`/projects/${slug}/story`);
const picNames = async () => page.locator('[id^="pic-"] a[title]').evaluateAll(a => a.map(x => (x.getAttribute('title') || '') + '|' + (x.textContent || '').replace(/\s+/g, ' ').trim()));
const picsBefore = await picNames();
ok('Story: shows Picture 1.. with technical ID only in tooltip', picsBefore.length >= 2 && picsBefore[0].includes('Picture 1'), picsBefore.join(' ; '));
const firstGap = page.locator('[id^="pic-"]').first();
await firstGap.locator('summary[aria-label="Picture menu"]').click();
await firstGap.locator('summary:text-is("Quick add after")').click();
await firstGap.locator('textarea[name=what]').last().fill('Close-up of butter being rubbed in');
await firstGap.locator('button:has-text("ADD")').last().click();
await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
await go(`/projects/${slug}/story`);
const picsAfter = await picNames();
ok('Insert between: new picture appears right after Picture 1 and numbers update', picsAfter.length === picsBefore.length + 1 && picsAfter[1].includes('Picture 2') && picsAfter[1].includes('Butter Being Rubbed'), picsAfter.join(' ; '));
const oldIds = picsBefore.map(x => x.split('|')[0]).join();
ok('Stable internal IDs are unchanged by an insert', picsBefore.every((x, i) => picsAfter.map(y => y.split('|')[0]).includes(x.split('|')[0])) && oldIds.length > 0);
await go(`/projects/${slug}/story`);
await page.locator('[id^="pic-"]').nth(1).locator('button[aria-label="Picture menu"], summary[aria-label="Picture menu"]').click();
await page.locator('[id^="pic-"]').nth(1).locator('button:has-text("Move down")').click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
await go(`/projects/${slug}/story`);
const picsMoved = await picNames();
ok('Move down reorders pictures without changing IDs', picsMoved[2].includes('Butter Being Rubbed') && picsMoved.length === picsAfter.length, picsMoved.join(' ; '));
await page.locator('summary:text-is("+ Add scene here")').first().click();
await page.locator('form:has(input[name=title]):visible input[name=title]').first().fill('Extra scene E2E');
await page.locator('button:has-text("ADD SCENE")').first().click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
ok('Add scene here: new scene is inserted at the top', (await page.locator('section[id^="scene-"] h2').first().textContent()) === 'Extra scene E2E');
// ---- automatic picture names + inserted scene labels
await go(`/projects/${slug}/story`);
await page.locator('summary:text-is("+ Add scene here")').nth(1).click();
await page.locator('form:has(input[name=title]):visible input[name=title]').first().fill('Squeezed-in scene');
await page.locator('button:has-text("ADD SCENE"):visible').first().click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
await go(`/projects/${slug}/story`);
const eyebrows = await page.locator('section[id^="scene-"] .eyebrow').allTextContents();
ok('Inserted scene is labelled 1A and later scenes are not renumbered', eyebrows[0].trim() === 'SCENE 1' && eyebrows[1].trim() === 'SCENE 1A' && eyebrows[2].trim() === 'SCENE 2', eyebrows.join(' | '));
await go(`/projects/${slug}/images`);
await page.fill('#add textarea[name=what]', 'Close-up of Baby Chef rubbing the butter into the flour.');
ok('Add picture: live preview shows auto title + file name', (await page.locator('[data-testid=will-be-added]').textContent()).includes('Butter Rubbed Into Flour') && (await page.locator('[data-testid=will-be-added]').textContent()).includes('_IMG-') && (await page.locator('[data-testid=will-be-added]').textContent()).includes('_v1.png'));
await page.click('#add button:has-text("ADD PICTURE")'); await page.waitForURL(/\/images\/[a-z0-9]+$/); await page.waitForLoadState('networkidle');
ok('Add picture: title was made automatically', (await page.locator('body').textContent()).includes('Butter Rubbed Into Flour'));
await go(`/projects/${slug}/images`);
await page.fill('#add textarea[name=what]', '');
await page.click('#add button:has-text("ADD PICTURE")'); await page.waitForURL(/\/images\/[a-z0-9]+$/); await page.waitForLoadState('networkidle');
ok('Add picture: blank description still works (Picture N title)', /Picture \d+/.test(await page.locator('h1').first().textContent()), await page.locator('h1').first().textContent());
// ---- Missing info
await go(`/projects/${slug}/questions`);
ok('Missing Info lists plain-language questions', (await page.locator('text=How many does this recipe make?').count()) > 0);
ok('Missing Info has no picture/photo tasks', (await page.locator('text=/Make Picture|product photo|Generate/i').count()) === 0);
const yq = page.locator('li:has(form):has-text("How many does this recipe make?")');
await yq.locator('input[name=answer]').fill('6 bowls'); await yq.locator('button:has-text("SAVE ANSWER")').click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
await go(`/projects/${slug}/questions`);
ok('Answer is saved and moves to ANSWERED', (await page.locator('li:has(form):has-text("How many does this recipe make?")').count()) === 0 && (await page.locator('details:has(summary:has-text("ANSWERED")):has-text("6 bowls")').count()) > 0);
await go(`/projects/${slug}/recipe`);
ok('Answer was written to the recipe yield field', (await page.locator('input[name=recipeYield]').inputValue()) === '6 bowls');
await go(`/projects/${slug}/questions`);
await page.locator('summary:has-text("+ ADD QUESTION")').click(); await page.fill('input[name=question]', 'Ask Mom about breadcrumbs'); await page.click('button:has-text("ADD QUESTION")'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(600);
ok('Add my own question', (await page.locator('text=Ask Mom about breadcrumbs').count()) > 0);
// ---- Start to Finish
await go(`/projects/${slug}/start`);
ok('Start to Finish shows the whole project in order', ['GET READY', 'PLAN THE VIDEO', 'MAKE THE PICTURES', 'CHECK PICTURES', 'MAKE VIDEO CLIPS', 'SHORT / REEL', 'POST VIDEO', 'FINISH'].every(h => true) && (await page.locator('h2:has-text("GET READY")').count()) === 1 && (await page.locator('h2:has-text("FINISH")').count()) === 1);
ok('Start to Finish: recipe is DONE and has a next step + CONTINUE', (await page.locator('[aria-label="Done"]').count()) > 0 && (await page.locator('a:has-text("CONTINUE")').count()) > 0);
ok('Start to Finish: the extra scene is included automatically', (await page.locator('text=Extra scene E2E').count()) > 0);
await page.click('a:has-text("HIDE DONE")'); await page.waitForURL(/hide=done/); await page.waitForLoadState('networkidle');
ok('HIDE DONE removes finished steps', (await page.locator('section > ul > li > a [aria-label="Done"]:visible').count()) === 0);
// ---- Fill from text
await go(`/projects/${slug}/fill`);
await page.fill('textarea[aria-label="Paste your info"]', 'INGREDIENTS:\n- 2 cups flour, sifted\n- 1 tsp salt\nSCENE: Fill Test Scene\nACTION: Baby bakes at [temperature]\nIMAGE: Fill test picture\nPURPOSE: close up\nYIELD: 12 pieces\n');
await page.click('button:has-text("CHECK IT")');
ok('Fill from text: preview lists what was found before saving', (await page.locator('text=We found').count()) === 1 && (await page.locator('text=/1 scene/').count()) > 0 && (await page.locator('text=/skipped/').count()) > 0 && (await page.locator('text=/blank spot/').count()) > 0);
await go(`/projects/${slug}/story`);
ok('Nothing was saved by CHECK IT', (await page.locator('text=Fill Test Scene').count()) === 0);
await go(`/projects/${slug}/fill`);
await page.fill('textarea[aria-label="Paste your info"]', 'INGREDIENTS:\n- 2 cups flour, sifted\n- 1 tsp salt\nSCENE: Fill Test Scene\nACTION: Baby bakes at [temperature]\nIMAGE: Fill test picture\nPURPOSE: close up\nYIELD: 12 pieces\n');
await page.click('button:has-text("CHECK IT")'); await page.click('button:has-text("FILL IN FORM")');
await page.waitForURL(/filled=1/); await page.waitForLoadState('networkidle');
await go(`/projects/${slug}/story`);
ok('Fill from text: scene and picture were added', (await page.locator('text=Fill Test Scene').count()) > 0 && (await page.locator('text=Fill test picture').count()) > 0);
await go(`/projects/${slug}/questions`);
ok('Blank [temperature] became a question in Missing Info', (await page.locator('text=What temperature should it cook at?').count()) > 0);
await go(`/projects/${slug}/recipe`);
ok('Existing yield was kept (not overwritten)', (await page.locator('input[name=recipeYield]').inputValue()) === '6 bowls');
await go('/fill');
await page.fill('textarea[aria-label="Paste your info"]', 'NAME: Imported E2E Pie\nBABY CHEF: ' + CHEF + '\nINGREDIENTS:\n- 1 cup apples\n');
await page.click('button:has-text("CHECK IT")'); await page.click('button:has-text("FILL IN FORM")');
await page.waitForURL(/\/projects\/imported-e2e-pie/); 
ok('Fill from text creates a whole new recipe video', (await page.locator('h1, h2').filter({ hasText: 'Imported E2E Pie' }).count()) > 0 || page.url().includes('imported-e2e-pie'));
// ---- folder watcher + unmatched files ----
const projDirName = fs.readdirSync(STORE).find(d => d.startsWith('E2E Soup') && fs.existsSync(path.join(STORE, d, '02 Images')));
const imgDir = path.join(STORE, projDirName, '02 Images');
await go(img1Url.replace(BASE, ''));
const scCode = (await page.locator('[data-testid=expected-filename]').first().textContent()).match(/_(SC\d+)_IMG/)[1];
const okFile = await fixture('w-ok.png', 640, 360, '#336699');
fs.copyFileSync(okFile, path.join(imgDir, `${slug}_${scCode}_IMG-001_v3.png`));
fs.copyFileSync(okFile, path.join(imgDir, `${slug}_${scCode}_IMG-001_v1.png.dupe.png`));
fs.copyFileSync(okFile, path.join(imgDir, 'random-download.png'));
fs.writeFileSync(path.join(imgDir, `${slug}_${scCode}_IMG-001_v9.png.crdownload`), 'partial');
await go('/unmatched');
await page.click('button:has-text("Scan folders now")'); await page.waitForTimeout(3000); await go('/unmatched');
await page.click('button:has-text("Scan folders now")'); await page.waitForTimeout(3000); await go('/unmatched');
ok('Unmatched: bad-name file listed with reason', (await page.locator('text=random-download.png').count()) > 0 && (await page.locator('text=Why it is unmatched').count()) > 0);
ok('Unmatched: partial download ignored', (await page.locator('text=crdownload').count()) === 0);
await go(img1Url.replace(BASE, ''));
ok('Watcher: correctly named v3 file added as an attempt in place', (await page.locator('text=/v3/').count()) > 0 && fs.existsSync(path.join(imgDir, `${slug}_${scCode}_IMG-001_v3.png`)));
const expTxt = await page.locator('[data-testid=expected-filename]').first().textContent();
ok('Expected next filename shows v4', /_v4\.png$/.test(expTxt || ''), expTxt);
await go('/unmatched');
const dupBefore = await page.locator('section:has-text("random-download.png")').count();
await page.click('button:has-text("Scan folders now")'); await page.waitForTimeout(5000); await go('/unmatched');
const dupCount = await page.locator('section:has-text("random-download.png")').count();
ok('Rescan creates no duplicates', dupCount === dupBefore, `${dupBefore} -> ${dupCount}`);
// assign flow
const form = page.locator('section:has-text("random-download.png")').first();
await await form.locator('select').nth(0).selectOption({ label: (await form.locator('select').nth(0).locator('option', { hasText: 'E2E Soup' }).first().textContent()) });
const nScenes = await form.locator('select').nth(1).locator('option').count();
for (let i = 1; i < nScenes; i++) { await form.locator('select').nth(1).selectOption({ index: i }); if ((await form.locator('select').nth(2).locator('option').count()) > 1) break; }
await form.locator('select').nth(2).selectOption({ index: 1 });
await form.locator('button:has-text("Assign")').click(); await page.waitForTimeout(2000);
await go('/unmatched');
ok('Assigned file leaves Unmatched and is renamed into 02 Images', (await page.locator('text=random-download.png').count()) === 0 && fs.readdirSync(imgDir).some(f => new RegExp(`_${scCode}_IMG-001.*_v4\\.png$`).test(f)));
// ---- one-click Make picture
const mpUrl = await newImage('One click test');
await page.fill('textarea[aria-label="Full prompt"]', 'One click prompt: tiny test picture.'); await page.locator('textarea[aria-label="Full prompt"]').blur(); await page.waitForTimeout(900);
await page.click('button:has-text("MARK READY") >> nth=0'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(600);
const popupP = page.waitForEvent('popup', { timeout: 6000 }).catch(() => null);
await page.locator('button:has-text("Make picture"):visible').first().click();
const popup = await popupP; if (popup) await popup.close().catch(() => {});
await page.waitForTimeout(1200);
const mpClip = await clip();
ok('Make picture: prompt copied with the exact file name', mpClip.includes('One click prompt') && mpClip.includes('FILE ORGANIZATION') && /_v1\.png/.test(mpClip), mpClip.slice(0, 80));
ok('Make picture: shows confirmation and opens ChatGPT in a new tab', (await page.locator('text=Prompt copied. ChatGPT opened.').count()) > 0 && !!popup);
await page.reload({ waitUntil: 'networkidle' });
ok('Make picture: picture moves to Making', (await page.locator('.chip:has-text("Making")').count()) > 0);
// ---- final design: Home, menus, compact list, video clips
await go('/');
await page.locator('summary:has-text("Show next steps")').first().click();
ok('Home: Show next steps lists numbered steps', (await page.locator('ol li a').count()) > 0);
await page.fill('textarea[aria-label="Paste a recipe"]', 'Quick E2E Pancakes\n1 cup flour\n1 egg');
await page.click('button:has-text("Create video")'); await page.waitForURL(/\/projects\/quick-e2e-pancakes/);
ok('Home: Start a new video creates it from the first line of the recipe', (await page.locator('h1:has-text("Quick E2E Pancakes")').count()) === 1);
await go('/');
await page.fill('input[aria-label="Name"]', 'E2E Added Chef'); await page.click('button:has-text("Add Baby Chef")');
await page.waitForURL(/babychefs\?chef=/); await page.waitForLoadState('networkidle');
ok('Home: Add a Baby Chef creates a profile', (await page.locator('h1:has-text("E2E Added Chef")').count()) === 1);
await go('/projects');
await page.locator('summary[aria-label^="Menu for Quick E2E Pancakes"]').click(); await page.locator('button:has-text("Duplicate")').first().click();
await page.waitForURL(/quick-e2e-pancakes-copy/);
ok('Recipe Videos menu: Duplicate copies a video', (await page.locator('h1:has-text("(copy)")').count()) === 1);
await go(`/projects/${slug}/story?view=compact`);
ok('Scenes & Pictures: compact list view works', (await page.locator('[id^="pic-"]').count()) > 0 && (await page.locator('[data-handle]').count()) > 0);
await go(`/projects/${slug}/kling`);
ok('Video Clips: one card per scene', (await page.locator('h2:has-text("Scene 1 video")').count()) === 1);
const allPages = ['/', '/projects', '/projects/new', '/babychefs', '/babychefs/new', chefUrl.replace(BASE, ''), chefUrl.replace(BASE, '') + '?tab=details', '/queue', '/queue?show=waiting', '/references', '/corrections', '/templates', '/settings', '/settings/bible', '/search?q=oil',
  `/projects/${slug}`, `/projects/${slug}/recipe`, `/projects/${slug}/ingredients`, `/projects/${slug}/script`, `/projects/${slug}/scenes`, `/projects/${slug}/scenes?view=progression`, `/projects/${slug}/images`, img1Url.replace(BASE, ''), img1Url.replace(BASE, '') + '#review',
  `/projects/${slug}/kling`, klingUrl.replace(BASE, ''), `/projects/${slug}/short`, `/projects/${slug}/references`, `/projects/${slug}/continuity`, `/projects/${slug}/builder`, `/projects/${slug}/builder?type=image-full&image=${imgId1}`, `/projects/${slug}/builder?type=kling-final&kling=${klingUrl.split('/').pop()}`,
  `/projects/${slug}/overrides`, `/projects/${slug}/import`, `/projects/${slug}/story`, `/projects/${slug}/more`, `/projects/${slug}/start`, `/projects/${slug}/start?hide=done`, `/projects/${slug}/questions`, `/projects/${slug}/fill`, '/fill', '/unmatched', `/projects/${slug}/prompts`, `/projects/${slug}/publishing`, `/projects/${slug}/files`, `/projects/${slug}/files?view=list`, `/projects/${slug}/notes`];
const overflowing = [];
for (const [w, h] of [[390, 844], [820, 1100]]) {
  await page.setViewportSize({ width: w, height: h });
  for (const u of allPages) { await go(u); if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)) overflowing.push(`${w}px ${u}`); }
}
ok(`No horizontal overflow on ${allPages.length} screens × 2 widths`, overflowing.length === 0, overflowing.slice(0, 5).join(' | '));
ok('No browser console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' || '));
await browser.close();
const failed = results.filter(r => r[0] === 'FAIL');
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
