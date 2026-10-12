process.argv[1] = 'x';
const m = await import('/home/user/babychef/scripts/dev/design-shots.mjs');
const { shot, t, btns, page, browser } = m;
await t('Recipe Videos'); await page.locator('button:text-is("Continue")').first().click(); await page.waitForTimeout(500);
await t('Video Clips'); await shot('clips');
await t('Post Video'); await shot('post');
await t('Missing Info', {exact:false}); await shot('missing');
await t('Recipe'); await shot('recipe');
await page.locator('button:has-text("More ▾")').first().click(); await page.waitForTimeout(300);
for (const [lab, n] of [['My Video Style','style'],['Keep It Consistent','consistent'],['Pictures to Make','queue'],['Files','files']]) {
  await page.getByText(lab, { exact: true }).first().click(); await page.waitForTimeout(500); await shot(n);
  await page.locator('button:has-text("More ▾")').first().click().catch(()=>{}); await page.waitForTimeout(300);
}
await t('Settings'); await shot('settings');
await t('Baby Chefs'); await shot('chefs');
await browser.close();
