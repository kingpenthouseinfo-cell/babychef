import { chromium } from 'playwright-core';
const BASE = 'http://localhost:3001';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', args: ['--no-sandbox'] });
const w = Number(process.env.W || 1320);
const page = await browser.newPage({ viewport: { width: w, height: 900 } });
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
const routes = (process.env.ROUTES || '/').split(',');
const slug = await (async () => { await page.goto(BASE + '/projects'); const hs = await page.locator('a[href^="/projects/"]').evaluateAll(a => a.map(x => x.getAttribute('href'))); return hs.find(h => !h.includes('new')).split('/')[2]; })();
for (const r of routes) {
  const url = BASE + r.replace('{slug}', slug);
  await page.goto(url, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(400);
  const name = r.replace(/[^a-z0-9]+/gi, '_').replace('{slug}', 'p');
  await page.screenshot({ path: `/tmp/claude-0/shots/app-${w}-${name}.png`, fullPage: true });
  console.log('shot', r);
}
await browser.close();
