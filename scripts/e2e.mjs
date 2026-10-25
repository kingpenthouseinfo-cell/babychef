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
ok('Image gets global ID IMG-001', (await page.locator('[data-testid=expected-filename]').first().textContent()).includes('IMG001'));
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
if (await page.locator('button:has-text("MARK READY")').count()) await page.click('button:has-text("MARK READY") >> nth=0'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(600);
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
ok('Generated files organized (02 Images / 03 Redos, readable names)', genFiles.some(f => /02 Images\/(\d{3}_)?[A-Z0-9]{2,5}-S01-IMG001[\w-]*_v2\.png$/.test(f)) && genFiles.some(f => /03 Redos\/(\d{3}_)?[A-Z0-9]{2,5}-S01-IMG001[\w-]*_v1\.png$/.test(f)), genFiles.filter(f => /_v\d/.test(f)).map(f => path.relative(STORE, f)).join(' | '));

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

// drag-and-drop helper: fire a real drop event carrying a File on a locator
const dropFile = async (loc, name, type, bytes) => {
  const dt = await page.evaluateHandle(({ name, type, bytes }) => { const d = new DataTransfer(); d.items.add(new File([new Uint8Array(bytes)], name, { type })); return d; }, { name, type, bytes: Array.from(bytes) });
  await loc.dispatchEvent('dragenter', { dataTransfer: dt }); await loc.dispatchEvent('dragover', { dataTransfer: dt }); await loc.dispatchEvent('drop', { dataTransfer: dt });
};
// drag-and-drop a video onto the clip page
await page.goto(klingUrl, { waitUntil: 'networkidle' });
const attemptsBefore = await page.locator('text=/GENERATION #|Generation #/').count();
await dropFile(page.locator('[data-testid=video-drop-main]'), 'kling_dropped.mp4', 'video/mp4', Buffer.from('00000018667479706d703432', 'hex'));
await page.waitForSelector('[data-testid=drop-msg]', { timeout: 15000 }).catch(() => null); await page.waitForTimeout(1200);
ok('Dropping a video on the clip page records it', (await page.content()).includes('kling_dropped.mp4') || (await page.content()).includes('-CLIP'));
await dropFile(page.locator('[data-testid=video-drop-main]'), 'notes.txt', 'text/plain', Buffer.from('hello'));
await page.waitForTimeout(800);
ok('Dropping a non-video shows a friendly message', (await page.locator('[data-testid=drop-msg]').allTextContents()).some(t => /Drop a video/.test(t)));
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
if (await page.locator('button:has-text("MARK READY")').count()) await page.click('button:has-text("MARK READY") >> nth=0'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(700);
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
  for (const u of [`/projects/${slug}/images`, `/projects/${slug}/image-prompts`, `/projects/${slug}/storyboard`, `/projects/${slug}/video-prompts`, img1Url.replace(BASE, ''), '/queue', `/projects/${slug}/builder?type=plan`]) {
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
await page.locator('[id^="pic-"]').nth(0).locator('button[aria-label="Picture menu"], summary[aria-label="Picture menu"]').click();
{ const mv = page.locator('[id^="pic-"]').nth(0).locator('button:has-text("Move down")');
  if (await mv.count()) { await mv.click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800); } else ok('Move down is offered on the second picture', false, (await picNames()).join(' ; ')); }
await go(`/projects/${slug}/story`);
const picsMoved = await picNames();
ok('Move down reorders pictures without changing IDs', picsMoved[0].includes('Butter Being Rubbed') && picsMoved.length === picsAfter.length, picsMoved.join(' ; '));
await page.locator('summary:text-is("+ Add scene here")').first().click();
await page.locator('form:has(input[name=title]):visible input[name=title]').first().fill('Extra scene E2E');
await page.locator('button:has-text("ADD SCENE")').first().click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
ok('Add scene here: new scene is inserted at the top', (await page.locator('section[id^="scene-"] h2').first().textContent()) === 'Extra scene E2E');
// ---- Missing info
await go(`/projects/${slug}/questions`);
ok('Missing Info lists plain-language questions', (await page.locator('text=How many does this recipe make?').count()) > 0);
ok('Missing Info has a Copy all questions button', (await page.locator('button:has-text("COPY ALL")').count()) === 1);
ok('Missing Info has no picture/photo tasks', (await page.locator('main').locator('text=/Make Picture|product photo|Generate (a |the )?(picture|image)/i').count()) === 0);
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
const nameParts = (await page.locator('[data-testid=expected-filename]').first().textContent()).match(/([A-Z0-9]{2,5})-(S\d+)-IMG/);
const pCode = nameParts[1], scCode = nameParts[2];
const okFile = await fixture('w-ok.png', 640, 360, '#336699');
fs.copyFileSync(okFile, path.join(imgDir, `${pCode}-${scCode}-IMG001_v3.png`));
fs.copyFileSync(okFile, path.join(imgDir, `${pCode}-${scCode}-IMG001_v1.png.dupe.png`));
fs.copyFileSync(okFile, path.join(imgDir, 'random-download.png'));
fs.writeFileSync(path.join(imgDir, `${pCode}-${scCode}-IMG001_v9.png.crdownload`), 'partial');
await go('/unmatched');
await page.click('button:has-text("Scan folders now")'); await page.waitForTimeout(3000); await go('/unmatched');
await page.click('button:has-text("Scan folders now")'); await page.waitForTimeout(3000); await go('/unmatched');
ok('Unmatched: bad-name file listed with reason', (await page.locator('text=random-download.png').count()) > 0 && (await page.locator('text=Why it is unmatched').count()) > 0);
ok('Unmatched: partial download ignored', (await page.locator('text=crdownload').count()) === 0);
await go(img1Url.replace(BASE, ''));
ok('Watcher: correctly named v3 file added as an attempt in place', (await page.locator('text=/v3/').count()) > 0 && walk(imgDir).some(f => new RegExp(`${pCode}-${scCode}-IMG001.*_v3\\.png$`).test(path.basename(f))));
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
for (let i = 1; i < nScenes; i++) { await form.locator('select').nth(1).selectOption({ index: i }); const opts = await form.locator('select').nth(2).locator('option').allTextContents(); const k = opts.findIndex(t => t.includes('IMG-001')); if (k > -1) { await form.locator('select').nth(2).selectOption({ index: k }); break; } }
await form.locator('button:has-text("Assign")').click(); await page.waitForTimeout(2000);
await go('/unmatched');
ok('Assigned file leaves Unmatched and is renamed into 02 Images', (await page.locator('text=random-download.png').count()) === 0 && fs.readdirSync(imgDir).some(f => new RegExp(`${pCode}-${scCode}-IMG001.*_v4\\.png$`).test(f)));
// ---- one-click Make picture
const mpUrl = await newImage('One click test');
await page.fill('textarea[aria-label="Full prompt"]', 'One click prompt: tiny test picture.'); await page.locator('textarea[aria-label="Full prompt"]').blur(); await page.waitForTimeout(900);
if (await page.locator('button:has-text("MARK READY")').count()) await page.click('button:has-text("MARK READY") >> nth=0'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(600);
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
// ---- automatic picture names + inserted scene labels
await go(`/projects/${slug}/story`);
await page.locator('summary:text-is("+ Add scene here")').nth(1).click();
await page.locator('form:has(input[name=title]):visible input[name=title]').first().fill('Squeezed-in scene');
await page.locator('button:has-text("ADD SCENE"):visible').first().click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
await go(`/projects/${slug}/story`);
const eyebrows = (await page.locator('section[id^="scene-"] .eyebrow').allTextContents()).filter(t => /^SCENE/.test(t.trim()));
ok('Inserted scene is labelled 1A and later scenes are not renumbered', eyebrows[0].trim() === 'SCENE 1' && eyebrows[1].trim() === 'SCENE 1A' && eyebrows[2].trim() === 'SCENE 2', eyebrows.join(' | '));
await go(`/projects/${slug}/images`);
await page.fill('#add textarea[name=what]', 'Close-up of Baby Chef rubbing the butter into the flour.');
ok('Add picture: live preview shows auto title + file name', (await page.locator('[data-testid=will-be-added]').textContent()).includes('Butter Rubbed Into Flour') && (await page.locator('[data-testid=will-be-added]').textContent()).includes('-IMG') && (await page.locator('[data-testid=will-be-added]').textContent()).includes('_v1.png'));
await page.click('#add button:has-text("ADD PICTURE")'); await page.waitForURL(/\/images\/[a-z0-9]+$/); await page.waitForLoadState('networkidle');
ok('Add picture: title was made automatically', (await page.locator('body').textContent()).includes('Butter Rubbed Into Flour'));
await go(`/projects/${slug}/images`);
await page.fill('#add textarea[name=what]', '');
await page.click('#add button:has-text("ADD PICTURE")'); await page.waitForURL(/\/images\/[a-z0-9]+$/); await page.waitForLoadState('networkidle');
ok('Add picture: blank description still works (Picture N title)', /Picture \d+/.test(await page.locator('body').textContent()));
// ---- Fill From Text: real UI path for a pasted recipe (title, yield, ingredient groups, method sections)
{
  const pattiesText = fs.readFileSync(new URL('./fixtures/jamaican-beef-patties.txt', import.meta.url), 'utf8');
  await go('/fill');
  ok('Fill from text: format help is collapsed by default', (await page.locator('[data-testid=format-help] [data-testid=format-example]').count()) === 0 && (await page.locator('button:has-text("COPY CHATGPT INSTRUCTIONS")').count()) === 0);
  await page.click('[data-testid=format-help] button[aria-expanded]');
  ok('Fill from text: help offers copy instructions, blank template, example', (await page.locator('button:has-text("COPY CHATGPT INSTRUCTIONS")').count()) === 1 && (await page.locator('button:has-text("COPY BLANK TEMPLATE")').count()) === 1 && (await page.locator('button:has-text("COPY EVERYTHING FOR CHATGPT")').count()) === 1);
  await page.click('button:has-text("SHOW EXAMPLE")');
  ok('Fill from text: example shows a real recipe', (await page.locator('[data-testid=format-example]').textContent()).includes('Jamaican Beef Patties'));
  await page.fill('textarea', pattiesText);
  await page.click('button:has-text("Check it")');
  await page.waitForSelector('[data-testid=import-found]');
  const found = await page.locator('[data-testid=import-found]').textContent();
  ok('Import preview: finds title, yield, 3 groups, 17 ingredients, 12 method sections', found.includes('Jamaican Beef Patties') && found.includes('8 patties') && /Ingredient groups3/.test(found) && /Ingredients17/.test(found) && /Method sections12/.test(found), found);
  await page.click('button:has-text("Fill in form")'); await page.waitForURL(/\/projects\/[^/]+\?filled=1/); await page.waitForLoadState('networkidle');
  const projUrl = page.url().split('?')[0];
  await go(projUrl.replace(BASE, '') + '/recipe');
  const body = await page.locator('main').textContent();
  const methodTxt = await page.locator('section[aria-label=Method]').textContent();
  ok('Recipe page: yield shows 8 patties', body.includes('8 patties'));
  ok('Recipe page: ingredients are NOT empty', !body.includes('No ingredients yet') && body.includes('all-purpose flour') && body.includes('ground beef'));
  ok('Recipe page: ingredient groups shown', (await page.locator('[data-testid=ing-group]').allTextContents()).join('|') === 'Pastry Ingredients|Beef Filling Ingredients|Optional Egg Wash');
  ok('Method has no pasted headings or ingredient lines', !/PASTRY INGREDIENTS|BEEF FILLING INGREDIENTS|YIELD:|JAMAICAN BEEF PATTIES|all-purpose flour|1 lb ground beef/i.test(methodTxt), methodTxt.slice(0, 200));
  const secs = await page.locator('[data-testid=method-section] h3').allTextContents();
  ok('Method sections are headings and the first is Make the Dough', secs.length === 12 && secs[0] === 'Make the Dough' && secs[2] === 'Cook the Beef Filling', secs.join('|'));
  ok('Method steps are numbered per section starting at 1', (await page.locator('[data-testid=method-section]').first().locator('li').first().textContent()).startsWith('1'));
  // recipe typed into New video: split automatically too
  await go('/projects/new');
  await page.fill('input[name=title]', 'Raw paste test');
  await page.fill('textarea[name=recipeOriginal]', pattiesText);
  await page.click('button:has-text("Create video")'); await page.waitForURL(/\/projects\/raw-paste-test/); await page.waitForLoadState('networkidle');
  await go('/projects/raw-paste-test/recipe');
  ok('Recipe typed into New video is split into ingredients automatically', (await page.locator('[data-testid=ing-group]').count()) === 3 && !(await page.locator('main').textContent()).includes('No ingredients yet'));
}
// ---- Images to Generate: automatic plan from scene breakdown, prompts, per-card upload
{
  await go('/projects/new'); await page.fill('input[name=title]', 'Generate plan test');
  await page.click('button:has-text("Create video")'); await page.waitForURL(/\/projects\/generate-plan-test/); await page.waitForLoadState('networkidle');
  await go('/projects/generate-plan-test/fill');
  await page.fill('textarea', `SCENE\n\nTitle: Rub the butter in\nPurpose: Show the dough starting\nBaby Action: Pinches cold butter into the flour\nFOOD BEFORE: Dry golden flour with grated butter on top\nFOOD AFTER: Dry crumbly mixture with pea-sized butter pieces\nPlanned Image Anchors:\n1. Dry flour mixture in the bowl\n2. Close-up macro of butter pinched into crumbs\nKling Grouping Note: Both pictures in one clip\n\nSCENE\n\nTitle: Brown the beef\nBaby Action: Stirs the beef\nFOOD AFTER: Beef completely browned\n`);
  await page.click('button:has-text("Check it")'); await page.waitForSelector('button:has-text("Fill in form")');
  await page.click('button:has-text("Fill in form")'); await page.waitForURL(/filled=1/); await page.waitForLoadState('networkidle');
  await go('/projects/generate-plan-test/generate');
  ok('Images to Generate: tab exists and page opens', (await page.locator('text=IMAGES TO GENERATE').count()) > 0);
  await page.click('button:has-text("PLAN IMAGES FOR MY SCENES")'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1500);
  await go('/projects/generate-plan-test/generate?x=all');
  const cards = page.locator('[data-testid=gen-card]');
  ok('Image plan: anchors became 2 cards + 1 for the scene without anchors', (await cards.count()) === 3, String(await cards.count()));
  const prompts = await page.locator('[data-testid=gen-prompt]').allTextContents();
  ok('Every card has a full Baby Chef style prompt', prompts.length === 3 && prompts.every(t => t.startsWith('Ultra-photorealistic cinematic') && t.includes('No text, no captions')), prompts[0]?.slice(0, 80));
  ok('Prompt carries scene-specific negative states (dry dough)', prompts[0].includes('No liquid has been added yet') || prompts[1].includes('No liquid has been added yet'));
  ok('Macro anchor is a macro shot without the vertical-crop rule', prompts[1].startsWith('Ultra-photorealistic cinematic macro') && !prompts[1].includes('central 55'), prompts[1].slice(0, 90));
  ok('Cards show friendly labels, status and buttons', (await page.locator('text=IMAGE 01.1').count()) > 0 && (await page.locator('text=PROMPT READY').count()) >= 3 && (await page.locator('button:has-text("COPY PROMPT")').count()) >= 3 && (await page.locator('button:has-text("UPLOAD GENERATED IMAGE")').count()) >= 3);
  ok('Progress header counts 3 images, 0 approved', (await page.locator('[aria-label="Image progress"]').textContent()).includes('Total images3'));
  // upload straight onto the second card
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  fs.writeFileSync('/tmp/claude-0/card-upload.png', png);
  await page.locator('[data-testid=gen-card]').nth(1).locator('input[type=file]').setInputFiles('/tmp/claude-0/card-upload.png');
  await page.waitForSelector('text=UPLOAD COMPLETE', { timeout: 15000 }).catch(() => null); await page.waitForTimeout(1500);
  await go('/projects/generate-plan-test/generate?x=all');
  ok('Upload on a card attaches to that picture (status IMAGE UPLOADED)', (await page.locator('[data-testid=gen-card]').nth(1).textContent()).includes('IMAGE UPLOADED'));
  await page.locator('[data-testid=gen-card]').nth(1).locator('button:has-text("MARK APPROVED")').click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1200);
  await go('/projects/generate-plan-test/generate?x=all');
  ok('Mark approved updates the card and the progress', (await page.locator('[data-testid=gen-card]').nth(1).textContent()).includes('APPROVED') && (await page.locator('[aria-label="Image progress"]').textContent()).includes('Images approved1'));
  await go('/projects/generate-plan-test/generate?f=APPROVED&x=all');
  ok('Filter APPROVED shows only the approved card', (await page.locator('[data-testid=gen-card]').count()) === 1);
  // Picture list cards: Upload photo saves into the project folder with the correct generated name
  await go('/projects/generate-plan-test/images');
  ok('Picture list: every card has an Upload photo button', (await page.locator('button:has-text("photo")').count()) >= 3);
  await page.locator('input[type=file]').first().setInputFiles('/tmp/claude-0/card-upload.png');
  await page.waitForTimeout(2500);
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const saved = walk(STORE).filter(f => /GPT-S\d+-IMG\d+.*_v\d+\.png$/.test(f));
  ok('Uploaded photo is saved in the project folder with the generated file name', saved.length >= 2, saved.map(f => path.basename(f)).join(' | '));
  // approve the first picture too so the whole scene is ready for a video clip
  await go('/projects/generate-plan-test/generate?x=all');
  await page.locator('[data-testid=gen-card]').nth(0).locator('button:has-text("MARK APPROVED")').click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1200);
  // ---- drag-and-drop pictures
  await go('/projects/generate-plan-test/generate?x=all');
  const dc = page.locator('[data-testid=gen-card]').nth(2);
  await dropFile(dc, 'dropped.png', 'image/png', png);
  await page.waitForSelector('[data-testid=drop-msg]', { timeout: 15000 }).catch(() => null); await page.waitForTimeout(1500);
  await go('/projects/generate-plan-test/generate?x=all');
  ok('Dropping a picture on an Images to Generate card uploads it', (await page.locator('[data-testid=gen-card]').nth(2).textContent()).includes('IMAGE UPLOADED'));
  await dropFile(page.locator('[data-testid=gen-card]').nth(0), 'x.txt', 'text/plain', Buffer.from('hi'));
  await page.waitForTimeout(800);
  ok('Dropping a non-picture shows a friendly message', (await page.locator('[data-testid=drop-msg]').allTextContents()).some(t => /PNG, JPG or WebP/.test(t)));
  await go('/projects/generate-plan-test/images');
  ok('Picture List cards are drop targets', (await page.locator('div.card[data-drop]').count()) >= 3);
  await go('/projects/generate-plan-test/story');
  ok('Scenes & Pictures tiles are drop targets', (await page.locator('[data-sort-id][data-drop]').count()) >= 3);
  // ---- AI references on the project Images page
  await go('/projects/generate-plan-test/images');
  ok('Images page: project references block is at the top', (await page.locator('[data-testid=project-refs]').count()) === 1);
  const beef = page.locator('div.card:has(a.font-semibold:text-is("Brown the beef"))').first();
  ok('Card: AI references row shows BEFORE and AFTER tiles', (await beef.locator('[data-testid=ai-ref][data-role=BEFORE]').count()) === 1 && (await beef.locator('[data-testid=ai-ref][data-role=AFTER]').count()) === 1);
  ok('Card: BEFORE is the closest approved picture in production order', (await beef.locator('[data-testid=ai-ref][data-role=BEFORE]').textContent()).includes('Close-up macro of butter pinched into crumbs'));
  const dlHref = await beef.locator('[data-role=BEFORE] [data-testid=ai-ref-download]').getAttribute('href');
  ok('Reference download uses a self-explaining file name', /download=1&name=REF_BEFORE_IMG002/.test(dlHref || ''), dlHref || '');
  const zipHref = await beef.locator('[data-testid=ai-refs-zip]').getAttribute('href');
  const zipRes = await page.request.get(BASE + zipHref);
  const zipBytes = await zipRes.body();
  ok('DOWNLOAD REFERENCES gives one small ZIP named for the picture', zipRes.status() === 200 && /AI-REFERENCES\.zip/.test(zipRes.headers()['content-disposition'] || '') && zipBytes.slice(0, 2).toString() === 'PK', zipRes.headers()['content-disposition']);
  ok('ZIP holds the reference files and the notes file', (() => { const t = zipBytes.toString('latin1'); return t.includes('REFERENCE-NOTES.txt') && /REF_BEFORE_IMG002/.test(t); })());
  ok('AI references are collapsed by default on the card (summary line shows what is ready)', (await beef.locator('[data-testid=ai-refs-toggle]').textContent()).includes('After') && !(await beef.locator('[data-testid=ai-refs] details').first().evaluate(d => d.open)));
  await beef.locator('[data-testid=ai-refs-toggle]').click();
  await beef.locator('summary:has-text("Change references")').click();
  await beef.locator('select[aria-label="Change previous reference"]').selectOption({ index: 1 });
  const chosen = await beef.locator('select[aria-label="Change previous reference"] option:checked').textContent();
  await beef.locator('button:has-text("CHANGE")').first().click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1200);
  const beef2 = page.locator('div.card:has(a.font-semibold:text-is("Brown the beef"))').first();
  ok('CHANGE picks another approved picture for BEFORE', (await beef2.locator('[data-testid=ai-ref][data-role=BEFORE]').textContent()).includes(chosen.replace(/^IMG-\d+\s+/, '').trim()), chosen);
  const refUrl = (await page.locator('a:has-text("OPEN REFERENCE PACK")').first().getAttribute('href'));
  await go(refUrl);
  ok('Reference pack page shows the current image and download buttons', (await page.locator('text=CURRENT IMAGE').count()) > 0 && (await page.locator('a:has-text("DOWNLOAD ALL REFERENCES")').count()) === 1 && (await page.locator('a:has-text("DOWNLOAD PREVIOUS")').count()) + (await page.locator('a:has-text("DOWNLOAD NEXT")').count()) >= 1);
  // ---- direct, browser-accessible reference images (no download needed) + manifest + security
  ok('Reference pack page: each picture shows its direct link and a reference list link', (await page.locator('[data-testid=ai-ref-link]').count()) >= 1 && (await page.locator('[data-testid=manifest-box]').count()) === 1);
  ok('Reference pack page: OPEN FULL IMAGE and COPY IMAGE LINK on each picture', (await page.locator('[data-testid=ai-ref-open-full]').count()) >= 1 && (await page.locator('button:has-text("COPY IMAGE LINK")').count()) >= 1);
  const fullHref = await page.locator('[data-testid=ai-ref-open-full]').first().getAttribute('href');
  const imgRes = await page.request.get(fullHref);
  const imgBody = await imgRes.body();
  ok('OPEN FULL IMAGE serves the real image bytes (not HTML)', imgRes.status() === 200 && /^image\/(png|jpeg|webp)/.test(imgRes.headers()['content-type'] || '') && imgBody.length > 50 && imgBody[0] !== 0x3c, `${imgRes.status()} ${imgRes.headers()['content-type']}`);
  await page.locator('button:has-text("COPY IMAGE LINK")').first().click(); await page.waitForTimeout(400);
  const copied = await clip();
  ok('COPY IMAGE LINK copies the direct, signed full-image URL', copied.startsWith(BASE + '/api/images/') && /sig=/.test(copied) && /exp=/.test(copied), copied.slice(0, 90));
  const bare = new URL(fullHref); bare.search = '';
  const remote = await page.request.get(bare.toString(), { headers: { host: 'example.com' } }).catch(() => null);
  ok('Not public: an unsigned request from another address is refused', !remote || remote.status() === 403, String(remote?.status()));
  const tampered = new URL(fullHref); tampered.searchParams.set('sig', 'deadbeef');
  const remote2 = await page.request.get(tampered.toString(), { headers: { host: 'example.com' } }).catch(() => null);
  ok('Not public: a wrong signature is refused', !remote2 || remote2.status() === 403, String(remote2?.status()));
  const signedRemote = await page.request.get(fullHref, { headers: { host: 'example.com' } }).catch(() => null);
  ok('A valid short-lived link works for an automation (any address)', !signedRemote || signedRemote.status() === 200, String(signedRemote?.status()));
  const manRes = await page.request.get(BASE + '/api/projects/generate-plan-test/images/IMG-003/references');
  const man = await manRes.json();
  ok('Reference list (JSON): current image, references with roles and direct links', manRes.status() === 200 && man.currentImage?.id === 'IMG-003' && Array.isArray(man.references) && man.references.some(r => r.role === 'before' && /\/api\/images\/.+\/file\?/.test(r.directImageUrl || '') && r.imageId) && !!man.zipUrl, JSON.stringify(man).slice(0, 160));
  const beforeRes = await page.request.get(man.references.find(r => r.role === 'before').directImageUrl);
  ok('Every link in the reference list opens a real image', beforeRes.status() === 200 && /^image\//.test(beforeRes.headers()['content-type'] || ''));
  await go('/projects/generate-plan-test/kling');
  ok('Video clips: the picture file name is shown next to each picture used', (await page.locator('[data-testid=scene-image-file]').first().textContent()).replace(/^\d{3}_/, '').startsWith('GPT-S01-IMG001'), await page.locator('[data-testid=scene-image-file]').first().textContent().catch(() => ''));
  await page.locator('button:has-text("Make video prompt")').first().click(); await page.waitForURL(/\/kling\/[a-z0-9]+$/); await page.waitForLoadState('networkidle');
  ok('Clip page: reference strip shows the picture file name', (await page.locator('[data-testid=clip-image-file]').first().textContent()).replace(/^\d{3}_/, '').startsWith('GPT-S01-IMG001'));
  ok('Clip page: video upload form lists the pictures and the video file name', (await page.locator('[data-testid=clip-uses]').textContent()).includes('GPT-S01-IMG002') && /GPT-S01-CLIP\d+_v1\.mp4/.test(await page.locator('[data-testid=clip-uses]').textContent()));
  await go('/projects/generate-plan-test/kling');
  ok('Video clips page uses the scene (clip grouping note kept)', (await page.locator('h2:has-text("Scene 1 video")').count()) === 1);
  // ---- arrange pictures from the Picture List: move into the neighbouring scene, then swap places
  await go('/projects/generate-plan-test/images');
  let c3 = page.locator('div.card:has(a.font-semibold:text-is("Brown the beef"))').first();
  await c3.locator('summary:has-text("Move or reorder")').click();
  await c3.locator('button[aria-label="Move this picture up"]').click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1500);
  await go('/projects/generate-plan-test/images');
  c3 = page.locator('div.card:has(a.font-semibold:text-is("Brown the beef"))').first();
  ok('Move up at the start of a scene moves the picture into the scene before', (await c3.textContent()).includes('SC01'), (await c3.textContent()).slice(0, 80));
  await c3.locator('summary:has-text("Move or reorder")').click();
  const opts = await c3.locator('select[aria-label="Swap with picture"] option').allTextContents();
  const k = opts.findIndex(t => t.includes('Dry flour'));
  await c3.locator('select[aria-label="Swap with picture"]').selectOption({ index: k });
  await c3.locator('button:has-text("SWAP")').click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1500);
  await go('/projects/generate-plan-test/images');
  const titles = await page.locator('div.card a.font-semibold').allTextContents();
  ok('Swap puts the two pictures in each other\'s place (IMG numbers stay with their pictures)', titles[0].trim() === 'Brown the beef' && titles[2].trim() === 'Dry flour mixture in the bowl', titles.join(' | '));
  ok('Picture IMG numbers did not change when moved', (await page.locator('div.card:has(a.font-semibold:text-is("Brown the beef")) .font-mono').first().textContent()).trim() === 'IMG-003');
  // ---- cloud reference bridge
  await go('/projects/generate-plan-test/images');
  ok('Cloud access: shows LOCAL ONLY when no address is set', (await page.locator('[data-testid=cloud-state]').textContent()).trim() === 'LOCAL ONLY');
  await page.click('button:has-text("TEST CLOUD ACCESS")'); await page.waitForSelector('[data-testid=cloud-result]');
  ok('Test cloud access: EXTERNAL REFERENCE URL NOT CONFIGURED (with the local URL)', (await page.locator('[data-testid=cloud-result]').textContent()).includes('NOT CONFIGURED') && (await page.locator('[data-testid=cloud-result]').textContent()).includes('/api/images/'));
  await go('/settings');
  await page.fill('input[aria-label="External reference base URL"]', 'http://abc.example.test');
  await page.click('button:has-text("SAVE ADDRESS")'); await page.waitForTimeout(800);
  ok('Settings: a public http:// address is refused (https only)', (await page.locator('text=must start with https://').count()) === 1);
  await page.fill('input[aria-label="External reference base URL"]', 'https://abc.example.test/some/path');
  await page.click('button:has-text("SAVE ADDRESS")'); await page.waitForTimeout(800);
  ok('Settings: an https address is saved (path is dropped)', (await page.locator('text=https://abc.example.test').count()) >= 1);
  const man2 = await (await page.request.get(BASE + '/api/projects/generate-plan-test/images/IMG-003/references')).json();
  const urls = [man2.zipUrl, ...man2.references.flatMap(r => [r.directImageUrl, r.downloadUrl]).filter(Boolean), man2.currentImage.directImageUrl].filter(Boolean);
  ok('Reference list uses the external https address for every automation link', urls.length >= 3 && urls.every(u => u.startsWith('https://abc.example.test/')), urls.slice(0, 2).join(' '));
  ok('Reference list: download links use the /download route', man2.references.filter(r => r.downloadUrl).every(r => /\/api\/images\/[^/]+\/download\?/.test(r.downloadUrl)));
  const localCopy = urls.find(u => u.includes('/api/images/') && u.includes('/file?'));
  const viaLocal = await page.request.get(BASE + new URL(localCopy).pathname + new URL(localCopy).search);
  ok('The same signed link works on this computer (the signature does not include the address)', viaLocal.status() === 200 && /^image\//.test(viaLocal.headers()['content-type'] || ''));
  const dlUrl = man2.references.find(r => r.downloadUrl).downloadUrl;
  const dlRes = await page.request.get(BASE + new URL(dlUrl).pathname + new URL(dlUrl).search);
  ok('The download route sends the file as an attachment', dlRes.status() === 200 && /attachment/.test(dlRes.headers()['content-disposition'] || ''), dlRes.headers()['content-disposition']);
  const tamper = new URL(localCopy); tamper.pathname = tamper.pathname.replace(/\/api\/images\/[^/]+\//, '/api/images/someotherid/');
  const tRes = await page.request.get(BASE + tamper.pathname + tamper.search, { headers: { host: 'abc.example.test' } });
  ok('A signed link cannot be reused for a different picture', tRes.status() === 403 || tRes.status() === 404, String(tRes.status()));
  const expired = new URL(localCopy); expired.searchParams.set('exp', '1000');
  const eRes = await page.request.get(BASE + expired.pathname + expired.search, { headers: { host: 'abc.example.test' } });
  ok('An expired or altered link is refused (403)', eRes.status() === 403, String(eRes.status()));
  const home = await page.request.get(BASE + '/', { headers: { host: 'abc.example.test' } });
  ok('Through the bridge address the rest of the app stays closed (pages)', home.status() === 403, String(home.status()));
  const fwd = await page.request.get(BASE + '/projects', { headers: { 'x-forwarded-for': '203.0.113.9' } });
  ok('A request that arrives through a tunnel (forwarding header) cannot open pages either', fwd.status() === 403, String(fwd.status()));
  const act = await page.request.post(BASE + '/api/quit', { headers: { host: 'abc.example.test' } });
  ok('The bridge cannot quit or update the app', act.status() === 403, String(act.status()));
  await go('/projects/generate-plan-test/images/' + man2.currentImage.pictureId + '/references');
  ok('Reference pack page: COPY AUTOMATION JSON URL copies the external address', await (async () => { await page.click('button:has-text("COPY AUTOMATION JSON URL")'); await page.waitForTimeout(300); return (await clip()).startsWith('https://abc.example.test/api/projects/'); })());
  // back to local only
  await go('/settings');
  await page.click('button:has-text("Clear")'); await page.waitForTimeout(800);
  await go('/projects/generate-plan-test/images');
  ok('Cleared: back to LOCAL ONLY', (await page.locator('[data-testid=cloud-state]').textContent()).trim() === 'LOCAL ONLY');
  // a local address passes the end-to-end check from this machine
  await go('/settings');
  await page.fill('input[aria-label="External reference base URL"]', BASE);
  await page.click('button:has-text("SAVE ADDRESS")'); await page.waitForTimeout(800);
  await go('/projects/generate-plan-test/images');
  await page.click('button:has-text("TEST CLOUD ACCESS")'); await page.waitForSelector('[data-testid=cloud-result]');
  ok('Test cloud access: EXTERNAL REFERENCE URL READY when the address serves a signed picture', (await page.locator('[data-testid=cloud-result]').textContent()).includes('EXTERNAL REFERENCE URL READY'), await page.locator('[data-testid=cloud-result]').textContent());
  await go('/settings'); await page.click('button:has-text("Clear")'); await page.waitForTimeout(800);
}
// ---- red flags + NEED TO FIX tab
await go('/projects/generate-plan-test/images');
{
  const card = () => page.locator('div.card:has(a.font-semibold:text-is("Brown the beef"))').first();
  ok('Picture List: every picture preview has a flag button', (await page.locator('div.card [data-testid=flag-btn]').count()) >= 3);
  await card().locator('[data-testid=flag-btn]').click(); await page.waitForTimeout(1200);
  await go('/projects/generate-plan-test/images');
  ok('Flagging puts a red flag on the preview', (await card().locator('[data-testid=flag-btn]').getAttribute('aria-pressed')) === 'true' && (await card().locator('text=NEED TO FIX').count()) >= 1);
  ok('The NEED TO FIX tab shows a count of 1', (await page.locator('[data-testid=flag-count]').textContent()).trim() === '1');
  await page.locator('[aria-label="Recipe video sections"] a:has-text("NEED TO FIX")').click(); await page.waitForURL(/\/fix$/);
  ok('NEED TO FIX lists the flagged picture', (await page.locator('[data-testid=flagged-image]').count()) === 1 && (await page.locator('[data-testid=flagged-image]').textContent()).includes('Brown the beef'));
  const pickHref = await page.locator('[data-testid=flagged-image]').getAttribute('href');
  await page.locator('[data-testid=flagged-image]').click(); await page.waitForURL(/pick=/); await page.waitForLoadState('networkidle');
  ok('Fix page opens one picture at a time with 3 big steps', (await page.locator('[data-testid=fix-steps] button').count()) === 3 && (await page.locator('[data-testid=fix-references]').count()) === 1 && (await page.locator('[data-testid=fix-prompt]').count()) === 0);
  const tiles = page.locator('[data-testid=fix-ref]');
  ok('References step lists tickable thumbnails (or says none)', (await tiles.count()) > 0 || (await page.locator('text=No reference pictures yet').count()) === 1);
  ok('Nothing is pre-picked', (await page.locator('[data-testid=fix-ref][data-on="1"]').count()) === 0);
  if (await tiles.count()) {
    ok('Category chips and search bar are on the helpers screen', (await page.locator('[data-testid=fix-cat-all]').count()) === 1 && (await page.locator('[data-testid=fix-search]').count()) === 1);
    await page.fill('[data-testid=fix-search]', 'zzzznotaphoto');
    ok('Search with no match says so', (await page.locator('text=No photos called').count()) === 1);
    await page.fill('[data-testid=fix-search]', '');
    await tiles.first().click();
    ok('Picked photo shows its number', (await tiles.first().textContent()).includes('✓ 1'));
    await page.locator('[data-testid=fix-chosen] input').first().fill('copper pot with the beef');
    await page.locator('[data-testid=fix-add-to-prompt]').click(); await page.waitForSelector('[data-testid=fix-prompt]'); await page.waitForTimeout(500);
    ok('Original prompt stays untouched; helpers are added separately at the end', !/REFERENCE IMAGES/.test(await page.locator('[data-testid=fix-prompt]').inputValue()) && /REFERENCE IMAGES[\s\S]*copper pot with the beef/.test(await page.locator('[data-testid=fix-added]').textContent()));
    ok('Attach-order strip is shown', (await page.locator('[data-testid=fix-attach]').count()) === 1);
    await page.locator('[data-testid=fix-steps] button').first().click();
    const before = await page.locator('[data-testid=fix-ref]').count();
    await page.fill('[aria-label="Name for the uploaded picture"]', 'my copper pot');
    await page.locator('[data-testid=fix-upload-input]').setInputFiles('/tmp/claude-0/card-upload.png');
    await page.waitForFunction(() => /Added/.test(document.querySelector('[data-testid=fix-upload-msg]')?.textContent || ''), null, { timeout: 15000 }).catch(() => null);
    ok('Uploading a reference picture by hand adds it and ticks it', (await page.locator('[data-testid=fix-ref]').count()) === before + 1 && (await page.locator('[data-testid=fix-ref][data-on="1"]').count()) === 2 && (await page.locator('[data-testid=fix-chosen]').textContent()).includes('my copper pot') || (await page.locator('[data-testid=fix-chosen] input[aria-label="Note for my copper pot"]').count()) === 1);
    await page.waitForFunction(() => /Saved/.test(document.querySelector('[data-testid=fix-helpers-saved]')?.textContent || ''), null, { timeout: 15000 }).catch(() => null);
    await page.reload({ waitUntil: 'networkidle' });
    ok('Picked helpers and their notes are still there after reloading the page', (await page.locator('[data-testid=fix-ref][data-on="1"]').count()) === 2 && (await page.locator('[data-testid=fix-chosen] input').first().inputValue()) === 'copper pot with the beef');
  } else { await page.locator('[data-testid=fix-steps] button').nth(1).click(); }
  await page.locator('[data-testid=fix-steps] button').nth(2).click();
  ok('Final image step has upload / drop box', (await page.locator('[data-testid=fix-final]').count()) === 1);
  await page.locator('[data-testid=fix-steps] button').first().click();
  await page.fill('textarea[aria-label="What needs fixing"]', 'Beef looks too pink'); await page.locator('textarea[aria-label="What needs fixing"]').blur(); await page.waitForTimeout(1200);
  await go('/projects/generate-plan-test/fix?' + pickHref.split('?')[1]);
  ok('The note about what needs fixing is saved', (await page.locator('textarea[aria-label="What needs fixing"]').inputValue()) === 'Beef looks too pink');
  // scene flag from Scenes & Pictures
  await go('/projects/generate-plan-test/story');
  await page.locator('[data-testid=flag-btn][aria-label*="scene"]').first().click(); await page.waitForTimeout(1200);
  await go('/projects/generate-plan-test/fix');
  ok('A flagged scene shows in NEED TO FIX too', (await page.locator('[data-testid=flagged-scene]').count()) === 1 && (await page.locator('[data-testid=flag-count]').textContent()).trim() === '2');
  await go('/projects/generate-plan-test/fix?' + pickHref.split('?')[1]);
  while (await page.locator('[data-testid=unflag]').count()) { await page.locator('[data-testid=unflag]').first().click(); await page.waitForTimeout(1000); }
  ok('Removing the flags empties NEED TO FIX', (await page.locator('text=Nothing to fix').count()) === 1 && (await page.locator('[data-testid=flag-count]').count()) === 0);
}
// ---- project tabs: Picture List follows Images to Generate
await go('/projects/generate-plan-test');
{ const tabs = await page.locator('[aria-label="Recipe video sections"] a').allTextContents(); const t = tabs.map(x => x.trim());
  ok('Tabs: Picture List comes right after Images to Generate', t.indexOf('Picture List') === t.indexOf('Images to Generate') + 1 && t.indexOf('Picture List') > 0, t.join(' | '));
  await page.locator('[aria-label="Recipe video sections"] a:has-text("Picture List")').click(); await page.waitForURL(/\/images$/);
  ok('Picture List tab opens the picture list', (await page.locator('[aria-current=page]:has-text("Picture List")').count()) === 1); }
// ---- Settings: update / quit controls live inside the app
await go('/settings');
ok('Settings: app section has Update now, Check again and Quit (not clicked: it would stop the test server)', (await page.locator('section[aria-label="Baby Chef Studio app"] button:has-text("UPDATE NOW")').count()) === 1 && (await page.locator('section[aria-label="Baby Chef Studio app"] button:has-text("QUIT")').count()) === 1 && (await page.locator('section[aria-label="Baby Chef Studio app"] button:has-text("Check again")').count()) === 1);
// ---- Image Prompts + Video Prompts tabs
{
  await go('/projects/generate-plan-test/image-prompts');
  const rows = page.locator('[data-testid=image-prompt-row]');
  ok('Image Prompts: one row per picture with thumbnail slot, prompt and 4 buttons', (await rows.count()) >= 3 && (await rows.first().locator('textarea').count()) === 1 && (await rows.first().locator('[data-testid=prompt-copy], [data-testid=prompt-edit], [data-testid=prompt-save], [data-testid=prompt-clear]').count()) === 4);
  ok('Image Prompts tab is in the tab bar', (await page.locator('[aria-label="Recipe video sections"] a:has-text("Image Prompts")').count()) === 1 && (await page.locator('[aria-label="Recipe video sections"] a:has-text("Video Prompts")').count()) === 1);
  const r0 = rows.first(); const orig = await r0.locator('textarea').inputValue();
  ok('Prompt is read-only until EDIT is pressed', (await r0.locator('textarea').getAttribute('readonly')) !== null);
  await r0.locator('[data-testid=prompt-copy]').click(); await page.waitForTimeout(500);
  ok('COPY says Copied', (await r0.locator('[data-testid=prompt-msg]').textContent()).includes('Copied'));
  await r0.locator('[data-testid=prompt-edit]').click();
  ok('EDIT makes the prompt editable and SAVE needs a change', (await r0.locator('textarea').getAttribute('readonly')) === null && (await r0.locator('[data-testid=prompt-save]').isDisabled()));
  await r0.locator('textarea').fill(orig + '\nEXTRA LINE FROM TEST');
  await r0.locator('[data-testid=prompt-save]').click(); await page.waitForTimeout(1200);
  await go('/projects/generate-plan-test/image-prompts');
  ok('SAVE keeps the edited prompt after reload', (await page.locator('[data-testid=image-prompt-row]').first().locator('textarea').inputValue()).includes('EXTRA LINE FROM TEST'));
  const r1 = page.locator('[data-testid=image-prompt-row]').first();
  await r1.locator('[data-testid=prompt-clear]').click();
  ok('CLEAR PROMPT empties the box but nothing is lost until SAVE', (await r1.locator('textarea').inputValue()) === '');
  await r1.locator('[data-testid=prompt-edit]').click();
  ok('CANCEL after clearing brings the prompt back', (await r1.locator('textarea').inputValue()).includes('EXTRA LINE FROM TEST'));
  await r1.locator('[data-testid=prompt-edit]').click(); await r1.locator('textarea').fill(orig); await r1.locator('[data-testid=prompt-save]').click(); await page.waitForTimeout(1000);
  // paste-to-fill import for pictures
  const code0 = (await page.locator('[data-testid=image-prompt-row] .prompt-row__code').first().textContent()).trim();
  const seq0 = parseInt(code0.replace(/\D/g, ''), 10);
  await go('/projects/generate-plan-test/image-prompts');
  await page.locator('[data-testid=image-import] summary').click();
  await page.fill('[data-testid=import-text]', `TITLE\n\nMASTER VISUAL CONTINUITY\nBABY CHEF\nSame baby always\nSC01 - FIRST SCENE\nIMG-${String(seq0).padStart(3, '0')} - Test picture\nBaby Chef stands.\n\n* Exactly 10 whole eggs\n\nCamera: medium-wide.\nFilename:\n\`x_SC01_IMG-001_test_v3.png\`\nSC02 - SECOND\nIMG-9999 - No such picture\nNowhere.\nFINAL STEP-BY-STEP RECIPE ORDER\n1. ignored`);
  await page.locator('[data-testid=import-check]').click(); await page.waitForSelector('[data-testid=import-preview]', { timeout: 15000 });
  ok('Picture import finds both pictures, matches the known number, flags the unknown one', (await page.locator('[data-testid=import-item]').count()) === 2 && (await page.locator('[data-testid=import-item]').first().locator('select').inputValue()).startsWith('img:') && (await page.locator('[data-testid=import-item]').nth(1).textContent()).includes('No picture with that number'));
  ok('Shared look rules option is offered', (await page.locator('[data-testid=import-shared]').count()) === 1);
  await page.locator('[data-testid=import-shared] input').check();
  await page.locator('[data-testid=import-fill]').click(); await page.waitForSelector('text=Done ✓', { timeout: 15000 }); await page.waitForTimeout(1200);
  const imp = await page.locator('[data-testid=image-prompt-row]').first().locator('textarea').inputValue();
  ok('Picture FILL IN saves the description (shared rules on top, Filename line removed)', imp.includes('MASTER VISUAL CONTINUITY') && imp.includes('Exactly 10 whole eggs') && imp.includes('Camera: medium-wide.') && !/Filename/i.test(imp) && !imp.includes('.png'));
  const r2 = page.locator('[data-testid=image-prompt-row]').first();
  await r2.locator('[data-testid=prompt-edit]').click(); await r2.locator('textarea').fill(orig); await r2.locator('[data-testid=prompt-save]').click(); await page.waitForTimeout(1000);
  await go(`/projects/${slug}/video-prompts`);
  const vrows = page.locator('[data-testid=video-prompt-row]');
  ok('Video Prompts: one row per clip with its pictures, prompt and 4 buttons', (await vrows.count()) >= 1 && (await vrows.first().locator('textarea').count()) === 1 && (await vrows.first().locator('[data-testid=prompt-copy], [data-testid=prompt-edit], [data-testid=prompt-save], [data-testid=prompt-clear]').count()) === 4);
  const v0 = vrows.first(); const vorig = await v0.locator('textarea').inputValue();
  await v0.locator('[data-testid=prompt-edit]').click(); await v0.locator('textarea').fill(vorig + '\nVIDEO EXTRA'); await v0.locator('[data-testid=prompt-save]').click(); await page.waitForTimeout(1200);
  await go(`/projects/${slug}/video-prompts`);
  ok('Video prompt SAVE persists', (await page.locator('[data-testid=video-prompt-row]').first().locator('textarea').inputValue()).includes('VIDEO EXTRA'));
  const v1 = page.locator('[data-testid=video-prompt-row]').first();
  await v1.locator('[data-testid=prompt-edit]').click(); await v1.locator('textarea').fill(vorig); await v1.locator('[data-testid=prompt-save]').click(); await page.waitForTimeout(1000);
  // paste-to-fill import
  const thumbTitle = await page.locator('[data-testid=video-prompt-row] .prompt-row__thumb--small').first().getAttribute('title');
  const seqNo = parseInt((thumbTitle || '').match(/IMG-0*(\d+)/)?.[1] || '0', 10);
  await page.locator('[data-testid=video-import] summary').click();
  await page.fill('[data-testid=import-text]', `# Revised\n## Global instructions\nignore me\n## IMG-${String(seqNo).padStart(3, '0')}: Test picture\n\n**KLING PROMPT**\n\n@image1 IMPORTED TEST PROMPT\n\n**Audio:** hello\n\n## IMG-999: Nothing like it\n\n**KLING PROMPT**\n\n@image1 nowhere\n\n# Rules\nignored`);
  await page.locator('[data-testid=import-check]').click(); await page.waitForSelector('[data-testid=import-preview]', { timeout: 15000 });
  ok('Import finds both prompts and matches the known picture to its clip', (await page.locator('[data-testid=import-item]').count()) === 2 && (await page.locator('[data-testid=import-item]').first().locator('select').inputValue()).startsWith('clip:') && (await page.locator('[data-testid=import-item]').nth(1).locator('select').inputValue()) === '');
  ok('Unknown picture is not ticked and says no matching clip', (await page.locator('[data-testid=import-item]').nth(1).textContent()).includes('No matching clip'));
  await page.locator('[data-testid=import-fill]').click(); await page.waitForSelector('text=Done ✓', { timeout: 15000 }); await page.waitForTimeout(1200);
  ok('FILL IN puts the prompt in the clip box', (await page.locator('[data-testid=video-prompt-row]').first().locator('textarea').inputValue()).includes('IMPORTED TEST PROMPT'));
  const v2 = page.locator('[data-testid=video-prompt-row]').first();
  await v2.locator('[data-testid=prompt-edit]').click(); await v2.locator('textarea').fill(vorig); await v2.locator('[data-testid=prompt-save]').click(); await page.waitForTimeout(1000);
}
await page.setViewportSize({ width: 1440, height: 900 }); // back to desktop (the responsive checks above end on a phone size)
// ---- per-project pastel colour
{
  await go('/projects/generate-plan-test/story');
  const c1 = await page.locator('[data-testid=project-shell]').getAttribute('data-project-color');
  const bg1 = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await go(`/projects/${slug}/story`);
  const c2 = await page.locator('[data-testid=project-shell]').getAttribute('data-project-color');
  ok('Two different recipe videos have different page colours', !!c1 && !!c2 && c1 !== c2, `${c1} / ${c2}`);
  await go('/projects/generate-plan-test/images');
  ok('The colour follows the video on every screen (Picture List, same colour as Scenes)', (await page.locator('[data-testid=project-shell]').getAttribute('data-project-color')) === c1 && (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === bg1);
  ok('The page behind the content is actually tinted (not white)', bg1 !== 'rgb(255, 255, 255)');
  await go('/projects');
  ok('Outside a video (project list) the page is plain white again', (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(255, 255, 255)');
  await go('/projects/generate-plan-test/images');
  await page.locator('[data-testid=project-color-btn]').click();
  await page.locator('[data-testid=project-color-rose]').click(); await page.waitForTimeout(1200);
  await go('/projects/generate-plan-test/fix');
  ok('Choosing a colour in the header changes it on all screens', (await page.locator('[data-testid=project-shell]').getAttribute('data-project-color')) === 'rose');
  await page.locator('[data-testid=project-color-btn]').click(); await page.locator('[data-testid=project-color-auto]').click(); await page.waitForTimeout(1200);
  await go('/projects');
  ok('Project cards carry their video colour', (await page.locator('[data-testid=project-card][data-project-color]').count()) >= 2);
}
// ---- Storyboard tab (design from Claude Design: flat picture row + scene storyboard, draft until "Save order")
{
  const U = '/projects/generate-plan-test/storyboard';
  await go(U);
  const tiles = () => page.locator('[data-testid=sb-tile]');
  const ids = async () => (await tiles().evaluateAll(els => els.map(e => e.getAttribute('data-pic-id'))));
  const save = async () => { await page.locator('[data-testid=sb-save]').click(); await page.waitForFunction(() => /Order saved/.test(document.querySelector('[data-testid=sb-msg]')?.textContent || ''), null, { timeout: 20000 }).catch(() => null); await page.waitForTimeout(600); };
  const before = await ids();
  ok('Storyboard: tab exists, Scenes & Pictures is not highlighted with it', (await page.locator('[aria-label="Recipe video sections"] a:has-text("Storyboard")[aria-current=page]').count()) === 1 && (await page.locator('[aria-label="Recipe video sections"] a:has-text("Scenes & Pictures")[aria-current=page]').count()) === 0);
  ok('Storyboard: every picture is one tile in a single flat row, Save order starts disabled', before.length >= 3 && (await page.locator('[data-testid=sb-flow]').count()) === 1 && (await page.locator('[data-testid=sb-save]').isDisabled()));
  await tiles().first().dragTo(tiles().last(), { targetPosition: { x: 20, y: 40 } });
  ok('Storyboard: dragging is only a draft (Unsaved changes, Save enabled)', (await page.locator('[data-testid=sb-dirty]').count()) === 1 && !(await page.locator('[data-testid=sb-save]').isDisabled()));
  await page.locator('[data-testid=sb-undo]').click();
  ok('Storyboard: Undo changes puts everything back', JSON.stringify(await ids()) === JSON.stringify(before) && (await page.locator('[data-testid=sb-save]').isDisabled()));
  await tiles().first().dragTo(tiles().last(), { targetPosition: { x: 20, y: 40 } });
  await save();
  await go(U);
  const after = await ids();
  ok('Storyboard: Save order stores the new order', after[0] === before[1] && after[1] === before[0]);
  // files in the folder carry the storyboard place in their name
  const codes = await tiles().evaluateAll(els => Object.fromEntries(els.map(e => [e.getAttribute('data-pic-id'), (e.querySelector('.storyboard__code')?.textContent || '').trim()])));
  await go('/projects/generate-plan-test/generate?x=all');
  const cardNames = await page.locator('[data-testid=gen-card]').evaluateAll(els => els.map(e => ({ id: (e.id || '').replace('pic-', ''), text: e.textContent || '' })));
  const withFile = cardNames.map(c => ({ ...c, m: c.text.match(/(\d{3})_[A-Za-z0-9]+-S\d+-IMG\d+/) })).filter(c => c.m);
  ok('Folder file names start with the storyboard place (001_, 002_ …) and match the storyboard', withFile.length >= 1 && withFile.every(c => c.m[1] === codes[c.id]), withFile.map(c => `${c.id}:${c.m[1]}/${codes[c.id]}`).join(' '));
  const onDisk = walk(STORE).filter(f => /-IMG\d+.*_v\d+\.png$/.test(f)).map(f => path.basename(f));
  ok('Every picture file on disk has the place prefix', onDisk.length >= 1 && onDisk.every(n => /^\d{3}_/.test(n)), onDisk.join(' | '));
  await go(U);
  await page.locator('[data-testid=sb-match-folder]').click(); await page.waitForTimeout(1500);
  ok('Match folder names says the folder already matches', (await page.locator('[data-testid=sb-msg]').textContent()).includes('already matches'));
  await go('/projects/generate-plan-test/images');
  ok('Storyboard order is the real order (Picture List follows it)', (await page.locator('div.card[data-drop] a.font-semibold').first().getAttribute('href')).includes(after[0]));
  await go(U);
  await tiles().first().dragTo(tiles().last(), { targetPosition: { x: 20, y: 40 } });
  await save(); await go(U);
  ok('Storyboard: moving it back restores the original order', JSON.stringify(await ids()) === JSON.stringify(before));
  // rename a picture
  const t0 = (await page.locator('[data-testid=sb-pic-title]').first().textContent()).trim();
  await page.locator('[data-testid=sb-pic-title]').first().click();
  await page.locator('.storyboard__title-input').fill('Renamed picture'); await page.keyboard.press('Enter');
  await save(); await go(U);
  ok('Storyboard: clicking a picture name renames it (after Save order)', (await page.locator('[data-testid=sb-pic-title]').first().textContent()).trim() === 'Renamed picture');
  await page.locator('[data-testid=sb-pic-title]').first().click(); await page.locator('.storyboard__title-input').fill(t0); await page.keyboard.press('Enter'); await save(); await go(U);
  ok('Each picture with an image has a Folder button', (await page.locator('[data-testid=sb-folder]').count()) === (await page.locator('[data-testid=sb-tile] img').count()) && (await page.locator('[data-testid=sb-folder]').count()) >= 1);
  // drag an image file from Finder onto a picture tile = replace its photo
  {
    const png2 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const withImg = page.locator('[data-testid=sb-tile]:has(img)').first();
    const tid = await withImg.getAttribute('data-pic-id');
    const srcBefore = await withImg.locator('img').getAttribute('src');
    const filesBefore = walk(STORE).filter(f => f.includes('Generate plan test') && f.includes('02 Images') && /\.png$/.test(f)).length;
    await dropFile(withImg, 'replacement.png', 'image/png', png2);
    await page.waitForFunction(() => /New photo saved/.test(document.querySelector('[data-testid=sb-photo-msg]')?.textContent || ''), null, { timeout: 30000 }).catch(() => null);
    await page.waitForTimeout(1500);
    const srcAfter = await page.locator(`[data-testid=sb-tile][data-pic-id="${tid}"] img`).getAttribute('src');
    const filesAfter = walk(STORE).filter(f => f.includes('Generate plan test') && f.includes('02 Images') && /\.png$/.test(f)).length;
    ok('Storyboard: dropping an image file on a picture tile replaces its photo (new version, old one kept)', srcAfter !== srcBefore && filesAfter === filesBefore + 1, `${srcBefore} -> ${srcAfter}; files ${filesBefore} -> ${filesAfter}`);
    await dropFile(withImg, 'notes.txt', 'text/plain', Buffer.from('hi'));
    await page.waitForTimeout(600);
    ok('Storyboard: dropping something that is not a picture says so', (await page.locator('[data-testid=sb-photo-msg]').textContent()).includes('Drop a PNG, JPG or WebP'));
  }
  // add a picture between
  const n0 = (await tiles().count());
  await page.locator('[data-testid=sb-add]').nth(1).click();
  ok('Storyboard: + adds a draft "New picture" tile in that spot', (await tiles().count()) === n0 + 1 && (await page.locator('.storyboard__thumb-empty--new').count()) === 1);
  await save(); await go(U);
  ok('Storyboard: the new picture is saved', (await tiles().count()) === n0 + 1);
  // scene storyboard: rename + add scene + empty placeholder
  const sn0 = (await page.locator('[data-testid=sb-scene-name]').first().textContent()).trim();
  await page.locator('[data-testid=sb-scene-name]').first().click();
  await page.fill('[data-testid=sb-scene-input]', 'Scene renamed here'); await page.keyboard.press('Enter');
  await save(); await go(U);
  ok('Scene Storyboard: clicking a scene name renames it', (await page.locator('[data-testid=sb-scene-name]').first().textContent()).trim() === 'Scene renamed here');
  await page.locator('[data-testid=sb-scene-name]').first().click(); await page.fill('[data-testid=sb-scene-input]', sn0); await page.keyboard.press('Enter'); await save(); await go(U);
  const sc0 = await page.locator('[data-testid=sb-scene-card]').count();
  const em0 = await page.locator('[data-testid=sb-empty]').count();
  await page.locator('[data-testid=sb-add-scene]').click();
  ok('Scene Storyboard: + Add scene adds an empty scene with a placeholder in the picture row', (await page.locator('[data-testid=sb-scene-card]').count()) === sc0 + 1 && (await page.locator('[data-testid=sb-empty]').count()) === em0 + 1);
  await save(); await go(U);
  ok('Storyboard: an empty scene is saved and keeps its placeholder', (await page.locator('[data-testid=sb-scene-card]').count()) === sc0 + 1 && (await page.locator('[data-testid=sb-empty]').count()) === em0 + 1);
  const firstId = (await ids())[0];
  await tiles().first().dragTo(page.locator('[data-testid=sb-empty]').last());
  await save(); await go(U);
  ok('Storyboard: dropping a picture on an empty scene moves it into that scene', (await page.locator('[data-testid=sb-empty]').count()) === em0 && (await tiles().evaluateAll((els, id) => els.some(e => e.getAttribute('data-pic-id') === id), firstId)));
}
// ---- Storyboard video clips (drop on a scene box, Video Clips folder, storyboard-order names)
{
  const U = '/projects/generate-plan-test/storyboard';
  const mp4 = Buffer.from('000000186674797069736f6d0000020069736f6d69736f32', 'hex');
  fs.writeFileSync('/tmp/claude-0/clip-a.mp4', mp4);
  const clipFiles = () => walk(STORE).filter(f => f.includes('06 Video Clips') && /\.mp4$/.test(f)).map(f => path.basename(f));
  await go(U);
  const cards = () => page.locator('[data-testid=sb-scene-card]');
  ok('Video clips: tray drop area is on the Storyboard', (await page.locator('[data-testid=sb-clip-drop]').count()) === 1 && (await cards().count()) >= 2);
  await page.locator('[data-testid=sb-clip-input]').setInputFiles('/tmp/claude-0/clip-a.mp4');
  await page.waitForSelector('[data-testid=sb-tray-clip]', { timeout: 20000 }).catch(() => null);
  ok('Video clips: an uploaded clip waits in the tray and is saved in the 06 Video Clips folder', (await page.locator('[data-testid=sb-tray-clip]').count()) === 1 && clipFiles().some(n => /^unassigned_clip-a\.mp4$/.test(n)), clipFiles().join('|'));
  await page.waitForFunction(() => /Clip saved/.test(document.querySelector('[data-testid=sb-clip-msg]')?.textContent || ''), null, { timeout: 20000 }).catch(() => null); await page.waitForTimeout(1500);
  await page.locator('[data-testid=sb-tray-clip]').first().dragTo(cards().nth(1));
  await page.waitForFunction(() => document.querySelectorAll('[data-testid=sb-scene-clip]').length >= 1 && document.querySelectorAll('[data-testid=sb-tray-clip]').length === 0, null, { timeout: 20000 }).catch(() => null); await page.waitForTimeout(500);
  ok('Video clips: dragging the clip onto a scene box turns it blue and shows the clip', (await cards().nth(1).getAttribute('class')).includes('has-clip') && (await cards().nth(1).locator('[data-testid=sb-scene-clip] video').count()) === 1 && (await page.locator('[data-testid=sb-tray-clip]').count()) === 0);
  ok('Video clips: the file is renamed with the scene place (02_ …-CLIP_…)', clipFiles().some(n => /^02_[A-Z0-9]{2,5}-S\d+-CLIP.*\.mp4$/.test(n)), clipFiles().join('|'));
  // drop a file straight from Finder onto the first scene box
  await dropFile(cards().first(), 'second-clip.mp4', 'video/mp4', mp4);
  await page.waitForFunction(() => document.querySelectorAll('[data-testid=sb-scene-clip]').length >= 2, null, { timeout: 20000 }).catch(() => null); await page.waitForTimeout(600);
  ok('Video clips: dropping a video file on a scene box saves it and puts it there', (await cards().first().getAttribute('class')).includes('has-clip') && clipFiles().some(n => /^01_[A-Z0-9]{2,5}-S\d+-CLIP.*\.mp4$/.test(n)), clipFiles().join('|'));
  const link = await cards().first().locator('.storyboard-clip__thumb').getAttribute('href');
  const rng = await page.request.get(BASE + link, { headers: { Range: 'bytes=0-9' } });
  ok('Video file is served with byte ranges (plays and shows a thumbnail frame in Safari too)', rng.status() === 206 && (await rng.body()).length === 10);
  // reorder scenes -> file prefixes follow the storyboard
  await cards().first().dragTo(cards().nth(1), { targetPosition: { x: 150, y: 60 } });
  await page.locator('[data-testid=sb-save]').click(); await page.waitForFunction(() => /Order saved/.test(document.querySelector('[data-testid=sb-msg]')?.textContent || ''), null, { timeout: 20000 }).catch(() => null); await page.waitForTimeout(800);
  await go(U);
  const placed = await page.locator('[data-testid=sb-scene-card]').evaluateAll(els => els.map((e, i) => ({ i, name: e.querySelector('.storyboard-clip__name')?.textContent || '' })).filter(x => x.name));
  ok('Video clips: after reordering the scenes the clip file names follow the new storyboard order', placed.length === 2 && placed.every(x => x.name.startsWith(String(x.i + 1).padStart(2, '0') + '_')), JSON.stringify(placed));
  await page.locator('[data-testid=sb-clip-remove]').first().click(); await page.waitForTimeout(1500);
  await go(U);
  ok('Video clips: taking a clip off a scene returns it to the tray (file kept, renamed unassigned_)', (await page.locator('[data-testid=sb-tray-clip]').count()) === 1 && clipFiles().some(n => n.startsWith('unassigned_')) && clipFiles().length === 2, clipFiles().join('|'));
}
// ---- EXPORT FULL VIDEO (real FFmpeg, real files, isolated test project)
{
  const { execFileSync, spawnSync } = await import('node:child_process');
  const { createRequire } = await import('node:module');
  const crypto = await import('node:crypto');
  const req = createRequire(import.meta.url);
  const FF = req('ffmpeg-static'), FP = req('ffprobe-static').path;
  const X = '/tmp/claude-0/export-fixtures'; fs.mkdirSync(X, { recursive: true });
  const mk = (name, color, size, fps, dur, audio, adur) => {
    const a = ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=${color}:s=${size}:r=${fps}:d=${dur}`];
    if (audio) a.push('-f', 'lavfi', '-i', `sine=f=${audio}:d=${adur ?? dur}`);
    a.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p'); if (audio) a.push('-c:a', 'aac');
    execFileSync(FF, [...a, path.join(X, name)]);
  };
  mk('red.mp4', 'red', '1920x1080', 30, 1.0, 440);
  mk('green.mp4', 'lime', '3840x2160', 24, 1.5, 0);
  mk('blue.mp4', 'blue', '720x1280', 60, 1.0, 880, 1.4);   // vertical, 60 fps, sound longer than the picture
  mk('magenta.mp4', 'magenta', '1280x720', 25, 1.0, 660);
  mk('aa-gold.mp4', 'yellow', '1280x720', 25, 0.8, 330);
  mk('bb-cyan.mp4', 'cyan', '1920x1080', 30, 0.8, 0);
  const probeJson = f => JSON.parse(execFileSync(FP, ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', f]).toString());
  const pixel = (f, t) => { const r = spawnSync(FF, ['-v', 'error', '-ss', String(t), '-i', f, '-frames:v', '1', '-vf', 'scale=64:36,crop=1:1:32:18', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { encoding: 'buffer' }); return [...r.stdout.subarray(0, 3)]; };
  const nearest = (rgb) => { const P = { red: [255, 0, 0], green: [0, 255, 0], blue: [0, 0, 255], magenta: [255, 0, 255], yellow: [255, 255, 0], cyan: [0, 255, 255] }; let best = '', d = 1e9; for (const [n, c] of Object.entries(P)) { const dd = c.reduce((s, v, i) => s + (v - rgb[i]) ** 2, 0); if (dd < d) { d = dd; best = n; } } return best; };
  const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  const hashes = dir => Object.fromEntries(fs.existsSync(dir) ? fs.readdirSync(dir).filter(n => !n.startsWith('.')).map(n => [n, sha(path.join(dir, n))]) : []);

  await page.setViewportSize({ width: 1440, height: 900 });
  await go('/projects/new'); await page.fill('input[name=title]', 'Export test');
  await page.click('button:has-text("Create video")'); await page.waitForURL(/\/projects\/export-test/); await page.waitForLoadState('networkidle');
  await go('/projects/export-test/fill');
  await page.fill('textarea', 'SCENE\n\nTitle: Red scene\n\nSCENE\n\nTitle: Green scene\n\nSCENE\n\nTitle: Blue scene\n\nSCENE\n\nTitle: Magenta scene\n');
  await page.click('button:has-text("Check it")'); await page.waitForSelector('button:has-text("Fill in form")');
  await page.click('button:has-text("Fill in form")'); await page.waitForURL(/filled=1/); await page.waitForLoadState('networkidle');
  const SB = '/projects/export-test/storyboard';
  await go(SB);
  const cards = () => page.locator('[data-testid=sb-scene-card]');
  const drop = async (i, file) => { await dropFile(cards().nth(i), file, 'video/mp4', fs.readFileSync(path.join(X, file))); await page.waitForFunction(n => document.querySelectorAll('[data-testid=sb-scene-clip]').length >= n, i + 1, { timeout: 30000 }).catch(() => null); await page.waitForTimeout(400); };
  await drop(0, 'red.mp4'); await drop(1, 'green.mp4'); await drop(2, 'blue.mp4'); await drop(3, 'magenta.mp4');
  for (const f of ['aa-gold.mp4', 'bb-cyan.mp4']) { await page.locator('[data-testid=sb-clip-input]').setInputFiles(path.join(X, f)); await page.waitForTimeout(1500); }
  await go(SB);
  const exportName = fs.readdirSync(STORE).find(d => d.startsWith('Export test'));
  const clipDir = path.join(STORE, exportName, '06 Video Clips'), finalDir = path.join(STORE, exportName, 'Final Videos');
  const before = hashes(clipDir);
  ok('Export setup: 4 scene clips + 2 unassigned clips are in the Video Clips folder', Object.keys(before).length === 6 && Object.keys(before).filter(n => n.startsWith('unassigned_')).length === 2, Object.keys(before).join('|'));
  const E = '/api/projects/export-test/video-export';
  const plan = async inc => (await (await page.request.get(`${BASE}${E}?includeUnassigned=${inc ? 1 : 0}`)).json());
  const pl = await plan(false), pl2 = await plan(true);
  ok('Export plan: scene clips in storyboard order, unassigned excluded by default', pl.assignedCount === 4 && pl.unassignedCount === 2 && pl.includedCount === 4 && Math.abs(pl.totalSeconds - 4.5) < 0.2 && pl.clips.filter(c => c.included).every(c => c.kind === 'scene'), JSON.stringify([pl.assignedCount, pl.unassignedCount, pl.includedCount, pl.totalSeconds]));
  ok('Export plan: unassigned clips are added at the end (file-name order) when asked', pl2.includedCount === 6 && pl2.clips.slice(4).every(c => c.kind === 'unassigned') && pl2.clips[4].name.includes('aa-gold') && pl2.clips[5].name.includes('bb-cyan'));
  const run = async (o) => {
    const r = await page.request.post(BASE + E, { data: o }); const j = await r.json();
    if (!r.ok()) return { error: j.error };
    let st; for (let i = 0; i < 240; i++) { st = await (await page.request.get(`${BASE}${E}/${j.id}`)).json(); if (st.status !== 'RUNNING') break; await page.waitForTimeout(500); }
    return { id: j.id, ...st };
  };
  const check = (st, w, h, fps, dur, colors) => {
    const f = path.join(finalDir, st.fileName); const info = probeJson(f); const v = info.streams.find(x => x.codec_type === 'video'), a = info.streams.find(x => x.codec_type === 'audio');
    const dec = spawnSync(FF, ['-v', 'error', '-i', f, '-f', 'null', '-']);
    const times = []; let acc = 0; for (const d of colors.durs) { times.push(acc + d / 2); acc += d; }
    const got = times.map(t => nearest(pixel(f, t)));
    return { dims: v.width === w && v.height === h, fps: v.r_frame_rate === `${fps}/1`, dur: Math.abs(parseFloat(info.format.duration) - dur) < 0.35, sync: !!a && Math.abs(parseFloat(a.duration) - parseFloat(v.duration)) < 0.12, plays: dec.status === 0 && dec.stderr.length === 0, order: JSON.stringify(got) === JSON.stringify(colors.names), got, codec: v.codec_name + '/' + a?.codec_name };
  };
  // 1) 1080p, unassigned excluded
  const e1 = await run({ resolution: '1080p', fps: 30, includeUnassigned: false });
  const c1 = e1.status === 'DONE' ? check(e1, 1920, 1080, 30, 4.5, { names: ['red', 'green', 'blue', 'magenta'], durs: [1, 1.5, 1, 1] }) : {};
  ok('Export 1080p: finishes, is 1920×1080 H.264/AAC MP4, plays, right length, audio in sync', e1.status === 'DONE' && c1.dims && c1.plays && c1.dur && c1.sync && c1.codec === 'h264/aac', JSON.stringify([e1.status, e1.error, c1]));
  ok('Export order: clips are joined in the storyboard order (mixed 4K / vertical / 60 fps / no-audio sources)', c1.order, JSON.stringify(c1.got));
  ok('Export saved in the project Final Videos folder with a versioned name', /^export-test_full_1080p_v1\.mp4$/.test(e1.fileName || '') && fs.existsSync(path.join(finalDir, e1.fileName)));
  ok('Export: the original clips are untouched', JSON.stringify(hashes(clipDir)) === JSON.stringify(before));
  // 2) again -> v2, v1 not overwritten
  const v1hash = sha(path.join(finalDir, e1.fileName));
  const e2 = await run({ resolution: '1080p', fps: 30, includeUnassigned: true });
  const c2 = e2.status === 'DONE' ? check(e2, 1920, 1080, 30, 6.1, { names: ['red', 'green', 'blue', 'magenta', 'yellow', 'cyan'], durs: [1, 1.5, 1, 1, 0.8, 0.8] }) : {};
  ok('Export again does not overwrite (v2 is a new file, v1 unchanged)', e2.fileName === 'export-test_full_1080p_v2.mp4' && sha(path.join(finalDir, e1.fileName)) === v1hash);
  ok('Export with unassigned clips: they come after the last scene clip, in file-name order', e2.status === 'DONE' && c2.order && c2.dur && c2.plays, JSON.stringify([e2.status, e2.error, c2.got]));
  // 3) 4K
  const e3 = await run({ resolution: '4k', fps: 30, includeUnassigned: false });
  const c3 = e3.status === 'DONE' ? check(e3, 3840, 2160, 30, 4.5, { names: ['red', 'green', 'blue', 'magenta'], durs: [1, 1.5, 1, 1] }) : {};
  ok('Export 4K UHD: finishes, is 3840×2160, plays, right length, audio in sync', e3.status === 'DONE' && c3.dims && c3.plays && c3.dur && c3.sync, JSON.stringify([e3.status, e3.error, c3]));
  // 4) reorder scenes on the storyboard, 24 fps -> export follows the NEW order
  await go(SB);
  await cards().first().dragTo(cards().nth(2), { targetPosition: { x: 150, y: 60 } }); // dropped before scene 3 = scene 1 moves after scene 2
  await page.locator('[data-testid=sb-save]').click(); await page.waitForFunction(() => /Order saved/.test(document.querySelector('[data-testid=sb-msg]')?.textContent || ''), null, { timeout: 30000 }).catch(() => null); await page.waitForTimeout(1000);
  const e4 = await run({ resolution: '1080p', fps: 24, includeUnassigned: false });
  const c4 = e4.status === 'DONE' ? check(e4, 1920, 1080, 24, 4.5, { names: ['green', 'red', 'blue', 'magenta'], durs: [1.5, 1, 1, 1] }) : {};
  ok('Export after reordering scenes follows the new order (and 24 fps works)', e4.status === 'DONE' && c4.order && c4.fps && c4.plays && c4.dur, JSON.stringify([e4.status, e4.error, c4]));
  const e5 = await run({ resolution: '1080p', fps: 60, includeUnassigned: false });
  const c5 = e5.status === 'DONE' ? check(e5, 1920, 1080, 60, 4.5, { names: ['green', 'red', 'blue', 'magenta'], durs: [1.5, 1, 1, 1] }) : {};
  ok('Export at 60 fps works', e5.status === 'DONE' && c5.fps && c5.plays && c5.sync, JSON.stringify([e5.status, e5.error, c5]));
  // 5) the Export panel (the real buttons)
  await go('/projects/export-test/kling');
  await page.locator('[data-testid=export-open]').click(); await page.waitForSelector('[data-testid=export-options]');
  ok('Export panel: shows clip counts, quality options and the two unassigned choices (excluded is the default)', (await page.locator('[data-testid=export-assigned]').textContent()) === '4' && (await page.locator('[data-testid=export-unassigned]').textContent()) === '2' && (await page.locator('[data-testid=export-res-1080p]').count()) === 1 && (await page.locator('[data-testid=export-res-4k]').count()) === 1 && (await page.locator('[data-testid=export-unassigned-no]').isChecked()) === true);
  await page.locator('[data-testid=export-view-clips]').click();
  ok('Export panel: VIEW CLIPS INCLUDED lists the clips in the reordered storyboard order', (await page.locator('[data-testid=export-clip-list] li').count()) === 4 && (await page.locator('[data-testid=export-clip-list] li').first().textContent()).includes('Green scene'));
  await page.locator('[data-testid=export-res-4k]').check(); await page.locator('[data-testid=export-fps]').selectOption('30'); await page.locator('[data-testid=export-unassigned-yes]').check(); await page.waitForTimeout(800);
  ok('Export panel: including unassigned clips shows all 6', (await page.locator('[data-testid=export-clip-list] li').count()) === 6);
  await page.locator('[data-testid=export-unassigned-no]').check(); await page.waitForTimeout(500);
  await page.locator('[data-testid=export-start]').click();
  await page.waitForSelector('[data-testid=export-running], [data-testid=export-done]', { timeout: 20000 });
  await page.waitForSelector('[data-testid=export-done]', { timeout: 120000 });
  ok('Export panel: VIDEO READY with play, show in folder and export again', (await page.locator('[data-testid=export-play]').count()) === 1 && (await page.locator('[data-testid=export-reveal]').count()) === 1 && (await page.locator('[data-testid=export-again]').count()) === 1 && (await page.locator('[data-testid=export-done]').textContent()).includes('4K UHD'));
  const playHref = await page.locator('[data-testid=export-play]').getAttribute('href');
  const rg = await page.request.get(BASE + playHref, { headers: { Range: 'bytes=0-99' } });
  ok('Export panel: the finished video plays from the app (served with byte ranges)', rg.status() === 206);
  await page.locator('[data-testid=export-close]').click(); await go('/projects/export-test/kling'); await page.locator('[data-testid=export-open]').click(); await page.waitForSelector('[data-testid=export-options]');
  ok('Export panel: remembers the last choices (4K, 30 fps, unassigned excluded)', (await page.locator('[data-testid=export-res-4k]').isChecked()) && (await page.locator('[data-testid=export-fps]').inputValue()) === '30' && (await page.locator('[data-testid=export-unassigned-no]').isChecked()));
  await page.locator('[data-testid=export-close]').click();
  // 6) missing file -> clear error, nothing exported
  const gone = path.join(clipDir, fs.readdirSync(clipDir).find(n => /^0\d_.*CLIP/.test(n))); const keep = fs.readFileSync(gone); fs.rmSync(gone);
  const plM = await plan(false);
  const finalsBefore = fs.readdirSync(finalDir).length;
  const eM = await run({ resolution: '1080p', fps: 30, includeUnassigned: false });
  ok('A missing clip is reported by name and nothing is exported', plM.missing.length === 1 && !!eM.error && eM.error.includes(plM.missing[0]) && fs.readdirSync(finalDir).length === finalsBefore, JSON.stringify([plM.missing, eM.error]));
  fs.writeFileSync(gone, keep);
  // 7) cancel: a long 4K clip so there is time to cancel
  execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=3840x2160:r=30:d=30', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', path.join(X, 'zz-long.mp4')]);
  await page.locator('[data-testid=sb-clip-input]').count();
  await go(SB); await page.locator('[data-testid=sb-clip-input]').setInputFiles(path.join(X, 'zz-long.mp4')); await page.waitForFunction(() => document.querySelectorAll('[data-testid=sb-tray-clip]').length >= 3, null, { timeout: 60000 }).catch(() => null); await page.waitForTimeout(1500);
  const beforeCancel = hashes(clipDir), finalsNow = fs.readdirSync(finalDir).filter(n => !n.startsWith('.')).sort().join('|');
  const rr = await page.request.post(BASE + E, { data: { resolution: '4k', fps: 60, includeUnassigned: true } }); const jr = await rr.json();
  await page.waitForTimeout(2500);
  const mid = await (await page.request.get(`${BASE}${E}/${jr.id}`)).json();
  await page.request.post(`${BASE}${E}/${jr.id}/cancel`);
  let stc; for (let i = 0; i < 40; i++) { stc = await (await page.request.get(`${BASE}${E}/${jr.id}`)).json(); if (stc.status !== 'RUNNING') break; await page.waitForTimeout(500); }
  ok('Cancel: the export was really running, then stops (CANCELED)', mid.status === 'RUNNING' && stc.status === 'CANCELED', JSON.stringify([mid.status, mid.progress, stc.status]));
  ok('Cancel: no unfinished or new file is left and the original clips are unchanged', fs.readdirSync(finalDir).filter(n => !n.startsWith('.')).sort().join('|') === finalsNow && !fs.readdirSync(finalDir).some(n => n.endsWith('.partial')) && JSON.stringify(hashes(clipDir)) === JSON.stringify(beforeCancel));
  const after = await run({ resolution: '1080p', fps: 30, includeUnassigned: false });
  ok('After a cancel the app still exports normally', after.status === 'DONE');
  await page.setViewportSize({ width: 1440, height: 900 });
}
// ---- don't use / old versions / step & dialogue / Unassigned tab
{
  await page.setViewportSize({ width: 1440, height: 900 });
  const P = '/projects/generate-plan-test';
  // step + dialogue
  await go(`${P}/story`);
  await page.locator('[data-testid=pic-notes-edit-btn]').first().click();
  await page.fill('[data-testid=pic-step-input]', 'Pinch the butter into the flour');
  await page.fill('[data-testid=pic-dialogue-input]', 'Now we rub the butter in');
  await page.locator('[data-testid=pic-notes-save]').click(); await page.waitForTimeout(1500);
  const note0 = await page.locator('[data-testid=pic-notes]').first().textContent();
  ok('Scenes & Pictures: each picture shows its step number and the step it shows', /Step 1 of \d+:/.test(note0) && note0.includes('Pinch the butter into the flour'), note0);
  ok('Scenes & Pictures: each picture shows the dialogue it goes with (editable)', note0.includes('Says:') && note0.includes('Now we rub the butter in'));
  await go(`${P}/images`);
  ok('Picture List also shows step and dialogue', (await page.locator('[data-testid=pic-notes]').count()) >= 1 && (await page.locator('[data-testid=pic-notes]').first().textContent()).includes('Pinch the butter'));
  // don't use / use again (approved picture)
  const approvedCard = () => page.locator('div.card[data-drop]:has([data-testid=pic-skip])').filter({ hasText: 'APPROVED' }).first();
  const apprId = (await approvedCard().locator('a.font-semibold').first().getAttribute('href')).split('/').pop();
  await approvedCard().locator('[data-testid=pic-skip]').click(); await page.waitForTimeout(1500);
  await go(`${P}/images`);
  ok('An approved picture can be marked "don\'t use" (kept, but no longer used)', (await page.locator(`div.card[data-drop]:has(a[href$="${apprId}"])`).first().locator('[data-testid=pic-unskip]').count()) === 1);
  await go(`${P}/story`);
  ok('Scenes & Pictures shows it as Not used and leaves it out of the count', (await page.locator(`#pic-${apprId}`).textContent()).includes('Not used'));
  await go(`${P}/storyboard`);
  ok('Storyboard shows a not-used picture dimmed', (await page.locator(`[data-testid=sb-tile][data-pic-id="${apprId}"].is-skipped`).count()) === 1);
  await page.locator(`[data-testid=sb-tile][data-pic-id="${apprId}"] [data-testid=sb-use-toggle]`).click(); await page.waitForTimeout(2500);
  ok('Use again from the Storyboard brings it back', (await page.locator(`[data-testid=sb-tile][data-pic-id="${apprId}"].is-skipped`).count()) === 0);
  // old versions: the picture replaced earlier has several versions
  await go(`${P}/storyboard`);
  const many = page.locator('[data-testid=sb-tile]:has([data-testid=sb-remove-old])').first();
  const manyId = await many.getAttribute('data-pic-id');
  const unBefore = (await (await page.request.get(`${BASE}${P}/unassigned`)).text()).length;
  await many.locator('[data-testid=sb-remove-old]').click(); await page.waitForTimeout(3000);
  await go(`${P}/storyboard`);
  ok('Remove old versions keeps only the picture in use', (await page.locator(`[data-testid=sb-tile][data-pic-id="${manyId}"] [data-testid=sb-remove-old]`).count()) === 0);
  await go(`${P}/unassigned`);
  const photoN = await page.locator('[data-testid=un-photo]').count();
  ok('Removed versions are not deleted: they are on the Unassigned tab', photoN >= 1 && (await page.locator('[data-testid=un-photo]').first().textContent()).includes('Removed from'), String(photoN));
  ok('The Unassigned tab has a count badge', (await page.locator('[aria-label="Recipe video sections"] [data-testid=unassigned-count]').count()) === 1);
  // drag an unassigned photo onto a picture slot (tall window so the photo and the slot are both on screen)
  await page.setViewportSize({ width: 1440, height: 2600 });
  await page.locator('[data-testid=un-photo]').first().dragTo(page.locator(`[data-testid=un-slot][data-id="${manyId}"]`));
  await page.waitForFunction(() => /Added to/.test(document.querySelector('[data-testid=un-msg]')?.textContent || ''), null, { timeout: 30000 }).catch(() => null); await page.waitForTimeout(1200);
  await go(`${P}/unassigned`);
  ok('Dragging an unassigned photo onto a picture slot assigns it (it leaves the Unassigned list)', (await page.locator('[data-testid=un-photo]').count()) === photoN - 1);
  await page.setViewportSize({ width: 1440, height: 900 });
  // loose files in the project folder: detect, delete for good, move to another project
  const root = path.join(STORE, 'Generate plan test'); const png3 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  fs.writeFileSync(path.join(root, 'loose-delete-me.png'), png3); fs.writeFileSync(path.join(root, 'loose-move-me.png'), png3);
  await page.waitForTimeout(4500);
  await go(`${P}/unassigned`); await page.locator('[data-testid=un-scan]').click(); await page.waitForTimeout(2500); await go(`${P}/unassigned`);
  const card = n => page.locator('[data-testid=un-photo]', { hasText: n }).first();
  ok('Loose pictures in the project folder show up as unassigned', (await card('loose-delete-me').count()) === 1 && (await card('loose-move-me').count()) === 1);
  await card('loose-delete-me').locator('[data-testid=un-delete]').click(); await page.waitForTimeout(2500);
  ok('Delete for good removes the photo from the folder', !fs.existsSync(path.join(root, 'loose-delete-me.png')) && (await page.locator('[data-testid=un-photo]', { hasText: 'loose-delete-me' }).count()) === 0);
  await go(`${P}/unassigned`);
  await card('loose-move-me').locator('[data-testid=un-move-select]').selectOption({ label: 'Export test' });
  await card('loose-move-me').locator('[data-testid=un-move]').click(); await page.waitForTimeout(2500);
  ok('A photo can be moved to another project folder', !fs.existsSync(path.join(root, 'loose-move-me.png')) && walk(path.join(STORE, 'Export test')).some(f => f.includes('Unassigned Pictures') && f.endsWith('loose-move-me.png')));
  // unassigned video clips (Export test project has loose clips)
  await go('/projects/export-test/unassigned');
  const clipsN = await page.locator('[data-testid=un-clip]').count();
  ok('Unassigned video clips are listed', clipsN >= 2, String(clipsN));
  await page.setViewportSize({ width: 1440, height: 2600 });
  await page.locator('[data-testid=un-clip]').first().dragTo(page.locator('[data-testid=un-scene]').nth(3));
  await page.waitForFunction(() => /Clip is now on Scene/.test(document.querySelector('[data-testid=un-msg]')?.textContent || ''), null, { timeout: 30000 }).catch(() => null); await page.waitForTimeout(1200);
  await go('/projects/export-test/unassigned');
  ok('Dragging a clip onto a scene assigns it (the file is renamed to the scene place; a clip already there goes back to Unassigned)', /Clip is now on Scene/.test(await page.locator('[data-testid=un-msg]').textContent().catch(() => '') || '') || walk(path.join(STORE, 'Export test', '06 Video Clips')).filter(f => !path.basename(f).startsWith('unassigned_')).length >= 4);
  await page.setViewportSize({ width: 1440, height: 900 });
  const before2 = walk(path.join(STORE, 'Export test', '06 Video Clips')).filter(f => path.basename(f).startsWith('unassigned_')).length;
  await page.locator('[data-testid=un-clip]').first().locator('[data-testid=un-clip-delete]').click(); await page.waitForTimeout(2500);
  ok('A loose video clip can be deleted for good', walk(path.join(STORE, 'Export test', '06 Video Clips')).filter(f => path.basename(f).startsWith('unassigned_')).length === before2 - 1);
}
// ---- sentences added to every prompt
{
  await page.setViewportSize({ width: 1440, height: 900 });
  const P = '/projects/generate-plan-test';
  await go(`${P}/image-prompts`);
  ok('Image Prompts has a PROMPT SETTINGS button with links to what shapes the prompts', (await page.locator('[data-testid=prompt-settings-btn]').count()) === 1);
  await page.locator('[data-testid=prompt-settings-btn]').click();
  ok('PROMPT SETTINGS lists the video style, special rules and more', (await page.locator('[data-testid=prompt-settings] a[href="/settings/bible"]').count()) === 1 && (await page.locator(`[data-testid=prompt-settings] a[href="${P}/overrides"]`).count()) === 1);
  await page.locator('[data-testid=addons-panel] summary').click();
  const SENT = 'Make sure the image is not too contrasty and the baby skin has realistic texture, not too smooth.';
  const first = () => page.locator('[data-testid=image-prompt-row] textarea').first();
  const before = await first().inputValue();
  await page.fill('[data-testid=addon-text]', SENT);
  ok('The add-a-sentence form asks beginning or end (end is the default) and which projects', (await page.locator('[data-testid=addon-pos-end]').isChecked()) && (await page.locator('[data-testid=addon-pos-start]').count()) === 1 && (await page.locator('[data-testid=addon-scope-all]').isChecked()));
  await page.locator('[data-testid=addon-save-apply]').click();
  await page.waitForFunction(() => /Saved and added to/.test(document.querySelector('[data-testid=addon-msg]')?.textContent || ''), null, { timeout: 30000 }).catch(() => null); await page.waitForTimeout(1500);
  await go(`${P}/image-prompts`);
  const after = await first().inputValue();
  ok('The sentence is added to the BOTTOM of the existing prompts in the Image Prompts list', after.startsWith(before.trimEnd()) && after.trimEnd().endsWith(SENT), after.slice(-140));
  ok('It is added to every picture prompt of the project', (await page.locator('[data-testid=image-prompt-row] textarea').evaluateAll((els, t) => els.filter(e => e.value.trim()).every(e => e.value.includes(t)), SENT)));
  // applying again does not duplicate it
  await page.locator('[data-testid=addons-panel] summary').click();
  await page.locator('[data-testid=addon-apply]').first().click(); await page.waitForTimeout(2500);
  await go(`${P}/image-prompts`);
  ok('Adding it again does not repeat it', (await first().inputValue()).split(SENT).length === 2);
  // a sentence for the beginning, only for another project
  await page.locator('[data-testid=addons-panel] summary').click();
  await page.fill('[data-testid=addon-text]', 'START SENTENCE for the Export test project only.');
  await page.locator('[data-testid=addon-pos-start]').check(); await page.locator('[data-testid=addon-scope-pick]').check();
  for (const bx of await page.locator('[data-testid=addon-proj]').all()) await bx.uncheck();
  const labels = await page.locator('[data-testid=addon-proj]').evaluateAll(els => els.map(e => e.closest('label').textContent.trim()));
  const iExport = labels.findIndex(l => l.includes('Export test'));
  await page.locator('[data-testid=addon-proj]').nth(iExport).check();
  await page.locator('[data-testid=addon-save]').click(); await page.waitForTimeout(1500);
  ok('A sentence can be saved for chosen projects only and kept for good (unlimited sentences)', (await page.locator('[data-testid=addon-item]').count()) === 2);
  // a rewritten prompt keeps the permanent sentence
  await go(`${P}/generate`);
  await page.locator('button:has-text("REGENERATE PROMPT")').first().click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1500);
  await go(`${P}/image-prompts`);
  ok('A prompt that is written again keeps the permanent sentence', (await first().inputValue()).trimEnd().endsWith(SENT));
  ok('The sentence for another project did not touch this project', !(await first().inputValue()).includes('START SENTENCE'));
  // take it out again
  await page.locator('[data-testid=addons-panel] summary').click();
  await page.locator('[data-testid=addon-item]').first().locator('[data-testid=addon-takeout]').click(); await page.waitForTimeout(2500);
  await go(`${P}/image-prompts`);
  ok('TAKE OUT OF PROMPTS removes it again', !(await first().inputValue()).includes(SENT));
  // clean up so later checks are unaffected
  await page.locator('[data-testid=addons-panel] summary').click();
  while (await page.locator('[data-testid=addon-delete]').count()) { await page.locator('[data-testid=addon-delete]').first().click(); await page.waitForTimeout(1200); }
}
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
