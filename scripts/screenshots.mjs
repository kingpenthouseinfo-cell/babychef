// Takes screenshots of your REAL project's main screens (Chrome must be installed; the app must be running).
// Usage: node scripts/screenshots.mjs [project-slug]   → saves PNGs to ~/Desktop/BabyChef-Screens
import { chromium } from 'playwright-core';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const BASE = process.env.BASE || 'http://localhost:3000';
const out = path.join(os.homedir(), 'Desktop', 'BabyChef-Screens'); fs.mkdirSync(out, { recursive: true });
let slug = process.argv[2];
if (!slug) { const html = await (await fetch(BASE + '/projects')).text(); slug = (html.match(/href="\/projects\/([a-z0-9-]+)"/) || [])[1]; }
if (!slug) { console.error('No project found. Pass the project name from its web address: node scripts/screenshots.mjs your-project'); process.exit(1); }
const exe = process.env.CHROME || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'].find(p => fs.existsSync(p));
if (!exe) { console.error('Could not find Chrome. Take the screenshots by hand instead (Shift-Command-4).'); process.exit(1); }
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const pages = [['01-projects', '/projects'], ['02-overview', ''], ['03-start-to-finish', '/start'], ['04-recipe', '/recipe'], ['05-scenes-and-pictures', '/story'], ['06-images-to-generate', '/generate'], ['07-picture-list', '/images'], ['08-need-to-fix', '/fix'], ['09-video-clips', '/kling'], ['10-more', '/more']];
for (const [n, u] of pages) { await p.goto(BASE + (n === '01-projects' ? u : `/projects/${slug}${u}`), { waitUntil: 'networkidle' }); await p.screenshot({ path: path.join(out, n + '.png'), fullPage: false }); console.log('saved', n); }
await b.close(); console.log('\nDone. Look in the folder BabyChef-Screens on your Desktop.');
