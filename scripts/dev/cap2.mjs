process.argv[1] = 'x';
const m = await import('/home/user/babychef/scripts/dev/design-shots.mjs');
const { shot, t, btns, page, browser } = m;
await t('Recipe Videos'); await page.locator('button:text-is("Continue")').first().click(); await page.waitForTimeout(500);
await shot('overview');
await t('Scenes & Pictures'); await shot('scenes'); await btns();
await page.locator('button:has-text("Compact")').first().click().catch(()=>console.log('no compact')); await shot('scenes-compact');
await page.locator('button:has-text("Large")').first().click().catch(()=>{});
await t('Make picture', {exact:false}); await shot('pic-make'); await btns();
for (const label of ['Preview: picture arrives', 'Fix it', 'Make fix prompt']) { try { await page.getByText(label, {exact:false}).first().click({timeout:3000}); await page.waitForTimeout(500); await shot('pic-' + label.replace(/\W+/g,'_')); await btns(); } catch(e) { console.log('fail', label); } }
await browser.close();
