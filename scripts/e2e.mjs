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
ok('Upload Baby Chef references', (await page.locator('text=Master face').count()) > 0 && (await page.locator('text=Master kitchen').count()) > 0);
ok('Gold Standard badge visible', (await page.locator('text=GOLD STANDARD').count()) >= 2);
const babyDir = walk(path.join(STORE, '00 Baby Chefs', CHEF));
ok('Reference files in human-readable folders', babyDir.some(f => /References\/Baby\/REF-BABY-\d+_master-face/.test(f)) && babyDir.some(f => /References\/Kitchen\/REF-KITCHEN-\d+_master-kitchen/.test(f)), babyDir.map(f => path.relative(STORE, f)).join(' | '));

// ---- Project
await go('/projects/new');
await page.fill('input[name=title]', PROJ);
await page.selectOption('select[name=babyChefId]', { label: CHEF });
await page.fill('input[name=recipeName]', 'Lentil Soup');
await page.fill('textarea[name=recipeOriginal]', '1 cup lentils, 2 tbsp oil, 1/2 tsp cumin seeds, 1 cup coconut milk.');
await page.click('text=CREATE PROJECT');
await page.waitForURL(/\/projects\/e2e-soup/);
const slug = new URL(page.url()).pathname.split('/')[2];
ok('Create project with auto slug', slug.startsWith('e2e-soup'), slug);

// ---- Ingredient + PACKAGE CRITICAL product refs
await go(`/projects/${slug}/ingredients`);
const addForm = page.locator('section:has(h2:has-text("Add ingredient")) form');
await addForm.locator('input[name=name]').fill('Coconut Milk');
await addForm.locator('input[name=quantity]').fill('1'); await addForm.locator('input[name=unit]').fill('cup');
await addForm.locator('input[name=brand]').fill('Example Brand');
await addForm.locator('select[name=importance]').selectOption('PACKAGE_CRITICAL');
await addForm.locator('button:has-text("ADD INGREDIENT")').click();
await page.waitForLoadState('networkidle'); await page.waitForTimeout(500);
ok('Ingredient shows PACKAGE CRITICAL', (await page.locator('text=PACKAGE CRITICAL').count()) > 0);
async function addProd(file, type) {
  const sum = page.locator('summary:has-text("Add product reference photo")').first();
  await sum.click();
  const f = page.locator('details:has(summary:has-text("Add product reference photo")) form').first();
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
await page.click('button:has-text("ADD SCENE")');
await page.waitForLoadState('networkidle'); await page.waitForTimeout(500);
ok('Create scene SC01', (await page.locator('text=SC01').count()) > 0);

async function newImage(title) {
  await go(`/projects/${slug}/images`);
  await page.fill('#add input[name=title]', title);
  await page.click('#add button:has-text("ADD IMAGE")');
  await page.waitForURL(/\/images\/[a-z0-9]+$/); await page.waitForLoadState('networkidle');
  return page.url();
}
const img1Url = await newImage('Oil in pan');
ok('Image gets global ID IMG-001', (await page.locator('aside.zone-pink .font-mono').first().textContent()).includes('IMG-001'));
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
  if (!(await page.locator('aside details[open] summary:has-text("Edit & attach references")').count())) await page.click('summary:has-text("Edit & attach references")');
  const sel = page.locator('aside details form:has(select[name=target])');
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
await page.locator('button:has-text("Copy Next Prompt")').click(); await page.waitForTimeout(1500);
ok('Copy Next Prompt copies the continuation prompt', (await clip()).startsWith('CONT:'));
await page.waitForTimeout(800); await page.reload({ waitUntil: 'networkidle' });
ok('Copy Next Prompt advanced the queue ("Oil in pan" is no longer ready)', (await page.locator('text=Oil in pan').count()) === 0);
await page.goto(`${BASE}/queue?show=generating`, { waitUntil: 'networkidle' });
ok('Image appears under Generating', (await page.locator('text=IMG-001').count()) > 0);

// ---- Import result -> redo -> import -> approve
await page.goto(img1Url + '#results', { waitUntil: 'networkidle' });
async function importResult(file) {
  await page.locator('button:has-text("Add result")').first().click();
  const dlg = page.locator('[role=dialog]');
  await dlg.locator('input[name=file]').setInputFiles(file);
  await dlg.locator('button:has-text("Import")').click();
  await page.waitForLoadState('networkidle'); await page.waitForTimeout(1200);
}
await importResult(r1);
ok('Attempt 1 in REVIEW (review panel visible)', (await page.locator('text=Image review').count()) > 0);
// 3-state checklist: click cycles ✓ -> ? and persists after reload
const chip = page.locator('#review button:has-text("Same Baby Chef")');
await chip.click(); await chip.click(); await page.waitForTimeout(700);
await page.reload({ waitUntil: 'networkidle' });
ok('Review checklist cycles ✓→? and persists', (await page.locator('#review button[aria-label^="Same Baby Chef: unsure"]').count()) === 1);
ok('Compare modes available', (await page.locator('#review button:has-text("Single")').count()) === 1);
await page.locator('aside details:has(> summary:text-is("Redo")) > summary').click();
await page.fill('aside details:has(> summary:text-is("Redo")) textarea[name=wrong]', 'Too much oil');
await page.fill('aside details:has(> summary:text-is("Redo")) textarea[name=change]', 'Only 2 tbsp small pool');
await page.locator('aside details:has(> summary:text-is("Redo")) button:has-text("REDO — save correction")').click();
await page.waitForLoadState('networkidle'); await page.waitForTimeout(700);
ok('Redo saved: correction history shows', (await page.locator('text=Too much oil').count()) > 0);
ok('Attempt chip shows v1 Redo', (await page.locator('a:has-text("v1"):has-text("Redo")').count()) > 0);
await importResult(r2);
ok('Attempt 2 uploaded; attempt 1 preserved', (await page.locator('text=Attempt 1').count()) > 0 && (await page.locator('text=Attempt 2').count()) > 0);
await page.locator('#approve-form button').click();
await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
ok('Approve works: APPROVED RESULT badge', (await page.locator('text=APPROVED RESULT').count()) > 0);
const genFiles = walk(path.join(STORE, PROJ));
ok('Generated files organized (02 Images / 03 Redos, readable names)', genFiles.some(f => /02 Images\/e2e-soup-\w+_SC01_IMG-001_attempt-v2\.png$/.test(f)) && genFiles.some(f => /03 Redos\/e2e-soup-\w+_SC01_IMG-001_attempt-v1\.png$/.test(f)), genFiles.filter(f => /attempt/.test(f)).map(f => path.relative(STORE, f)).join(' | '));

// ---- Previous approved frame for IMG-002
const img2Url = await newImage('Cumin in oil');
await page.waitForLoadState('networkidle');
ok('Suggests previous approved IMG-001', (await page.locator('text=Suggested previous:').count()) > 0);
await page.click('button:has-text("USE PREVIOUS APPROVED IMAGE")');
await page.waitForLoadState('networkidle'); await page.waitForTimeout(600);
ok('IMG-002 uses IMG-001 as PREVIOUS APPROVED FRAME w/ thumbnail', (await page.locator('text=IMG-001 Previous Approved Frame').count()) > 0 && (await page.locator('aside img[src*="/api/files/"]').count()) > 0);
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
ok('Keyboard: short press does NOT approve (hold required)', (await page.locator('text=APPROVED RESULT').count()) === 0);
await ab.focus(); await page.keyboard.down('Enter'); await page.waitForTimeout(1100); await page.keyboard.up('Enter');
await page.waitForLoadState('networkidle'); await page.waitForTimeout(900);
ok('Keyboard: holding Enter 0.7s approves', (await page.locator('text=APPROVED RESULT').count()) > 0);
await page.click('#review button:has-text("Undo")'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
ok('Undo approval returns attempt to REVIEW', (await page.locator('text=APPROVED RESULT').count()) === 0 && (await page.locator('#review button:has-text("Redo")').count()) > 0);
await page.locator('#approve-form button').click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
ok('Re-approve by click', (await page.locator('text=APPROVED RESULT').count()) > 0);

// ---- Kling
await go(`/projects/${slug}/kling`);
await page.fill('input[name=title]', 'Tempering clip'); await page.fill('input[name=durationTarget]', '12');
await page.click('button:has-text("CREATE CLIP")'); await page.waitForURL(/\/kling\/[a-z0-9]+$/); await page.waitForLoadState('networkidle');
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
ok('A: Plan prompt copies', await (async () => { await page.click('button:has-text("COPY PROMPT")'); await page.waitForTimeout(300); return (await clip()).length > 3000; })());
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
await page.click('button:has-text("SAVE VERSION")'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
ok('Save prompt version records metadata', (await page.locator('text=Bible v').count()) > 0);
await page.fill('textarea[name=result]', '@image1 AI-WRITTEN KLING PROMPT'); await page.click('button:has-text("SAVE RESULT")'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(500);
await page.click('button:has-text("USE RESULT AS KLING PROMPT")'); await page.waitForURL(/\/kling\/[a-z0-9]+$/); await page.waitForLoadState('networkidle');
ok('Apply pasted result → Kling prompt (versioned)', (await page.inputValue('textarea[name=finalPrompt]')).includes('AI-WRITTEN'));

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
ok('No browser console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' || '));
await browser.close();
const failed = results.filter(r => r[0] === 'FAIL');
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
