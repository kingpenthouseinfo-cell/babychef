import { chromium } from 'playwright-core';
const BASE = process.env.BASE || 'http://localhost:3000';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 200))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
for (const u of process.argv.slice(2)) {
  await page.goto(BASE + u, { waitUntil: 'networkidle' });
  const r = await page.evaluate(() => { const W = window.innerWidth; const bad = []; document.querySelectorAll('body *').forEach(el => { if (el.closest('[aria-label="Recipe video sections"]')) return; const b = el.getBoundingClientRect(); if (b.width > 0 && b.right > W + 1) bad.push(el.tagName + '.' + String(el.className).slice(0, 60) + ' right=' + Math.round(b.right)); }); return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 8) }; });
  console.log(u, JSON.stringify(r)); console.log('errors', errs.splice(0));
}
await browser.close();
