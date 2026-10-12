// Dev helper: renders the clickable design mock locally (React/Babel served from node_modules) and screenshots each screen.
import { chromium } from 'playwright-core';
const D = process.env.DESIGN || '/tmp/claude-0/d14/Simple Studio Desktop/Simple Studio Desktop.dc.html';
const OUT = process.env.OUT || '/tmp/claude-0/shots/n14';
import fs from 'fs'; fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W || 1320), height: 900 } });
const map = { 'react@18.3.1/umd/react.production.min.js': '/home/user/babychef/node_modules/react/umd/react.production.min.js', 'react-dom@18.3.1/umd/react-dom.production.min.js': '/home/user/babychef/node_modules/react-dom/umd/react-dom.production.min.js', '@babel/standalone@7.29.0/babel.min.js': '/tmp/claude-0/babel/node_modules/@babel/standalone/babel.min.js' };
await page.route('https://unpkg.com/**', r => { const k = Object.keys(map).find(k => r.request().url().includes(k)); if (k) r.fulfill({ path: map[k], contentType: 'application/javascript' }); else r.abort(); });
await page.route('https://fonts.**', r => r.abort());
await page.goto('file://' + D, { waitUntil: 'load' }); await page.waitForTimeout(2500);
export const shot = async n => { await page.waitForTimeout(450); await page.screenshot({ path: `${OUT}/${n}.png`, fullPage: true }); console.log('shot', n); };
export const t = async (txt, opts = {}) => { await page.getByText(txt, { exact: opts.exact ?? true }).first().click(); await page.waitForTimeout(400); };
export const btns = async () => console.log('BTNS', (await page.locator('button').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 70).join(' | '));
export { page, browser };
if (process.argv[1].endsWith('design-shots.mjs')) {
  await shot('home'); await btns();
  await t('Show next steps', { exact: false }); await shot('home-steps');
  await t('Other recipe videos', { exact: false }); await shot('home-others');
  await t('Recipe Videos'); await shot('videos'); await btns();
  await browser.close();
}
