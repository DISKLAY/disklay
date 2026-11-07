/* Check the provided photographic theme on desktop and mobile. */
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assert = require('node:assert/strict');
const base = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:8001/';
(async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox']});
  try {
    for (const width of [195, 320, 390, 768, 1024, 1440]) for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({viewport: {width, height: 900}}), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(theme => {
        localStorage.setItem('anatomy-colloquium-theme', theme);
        localStorage.setItem('anatomy-colloquium-rewards-shared-v1', JSON.stringify({appearance: 'patriotic', appearances: {patriotic: true}}));
      }, theme);
      // Poster is shown immediately when motion is reduced; the intro has its own audit.
      await page.emulateMedia({reducedMotion: 'reduce'});
      await page.goto(base); await page.waitForSelector('.hero');
      assert.equal(await page.locator('html').getAttribute('data-accent'), 'patriotic');
      assert.match(await page.locator('.hero').evaluate(el => getComputedStyle(el).backgroundImage), /patriotic-shaman/);
      assert.match(await page.locator('body').evaluate(el => getComputedStyle(el, '::before').backgroundImage), /patriotic-background-v2/);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `${width}/${theme} home overflow`);
      await page.goto(base + '#/rewards'); await page.waitForSelector('.appearance-preview--patriotic');
      assert.match(await page.locator('.appearance-preview--patriotic').evaluate(el => getComputedStyle(el).backgroundImage), /patriotic-shaman/);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `${width}/${theme} rewards overflow`);
      assert.deepEqual(errors, []); await page.close(); console.log(`${width}/${theme}: OK`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
