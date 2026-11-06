/* Optional browser navigation audit: serve the repository and set PLAYWRIGHT_MODULE / CHROMIUM_PATH. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assert = require('node:assert/strict');
const BASE_URL = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:8001/';
(async () => {
  const browser = await chromium.launch({...(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {}), args:['--no-sandbox']});
  try {
    for (const width of [390, 768, 1440, 1920]) {
      const page=await browser.newPage({viewport:{width,height:900}}), errors=[];
      page.on('pageerror',err=>errors.push(err.message));
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.goto(BASE_URL); await page.waitForSelector('.hero');
      assert.equal(await page.locator('#contextPage').textContent(),'Главная');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1), `${width}px overflow`);
      if(width>=1440) assert.ok(await page.locator('.hero').evaluate(el=>el.getBoundingClientRect().width)>width*.85,'desktop content should use screen width');
      await page.locator('#contextBase').click();
      assert.equal(await page.locator('#coursePicker').evaluate(el=>el.open),true);
      assert.equal(await page.locator('#courseSidebar').isVisible(),true);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#courseSidebar').isHidden(),true);
      assert.equal(await page.evaluate(()=>document.activeElement.id),'contextBase');
      await page.locator('#courseToggle').click();
      assert.equal(await page.locator('#coursePicker').evaluate(el=>el.open),true);
      await page.locator('#courseSidebarNav button[data-value="2"]').click();
      await page.waitForFunction(()=>localStorage.getItem('anatomy-colloquium-selected')==='2');
      await page.waitForSelector('.hero');
      assert.match(await page.locator('#contextBase').textContent(),/Миология/);
      await page.locator('#courseToggle').click();
      assert.equal(await page.locator('#sidebarSkills').isHidden(),true);
      await page.locator('[data-subject-link="histology"]').click();
      await page.waitForSelector('.histo-setup');
      assert.equal(await page.locator('#contextSubject').textContent(),'Гистология');
      assert.equal(await page.locator('#contextBase').isHidden(),true);
      await page.locator('#courseToggle').click();
      await page.locator('[data-histo-sidebar="atlas"]').click();
      await page.waitForSelector('#atlasSearch');
      assert.equal(await page.locator('#contextPage').textContent(),'Атлас');
      await page.goBack(); await page.waitForSelector('.histo-setup');
      assert.equal(await page.locator('#contextPage').textContent(),'Препараты');
      await page.goForward(); await page.waitForSelector('#atlasSearch');
      await page.locator('#courseToggle').click();
      await page.locator('#histologySidebar a[href="#/settings"]').click();
      await page.waitForSelector('#studySync');
      assert.equal(await page.locator('#courseSidebar').isHidden(),true);
      assert.equal(await page.locator('#contextPage').textContent(),'Настройки');
      await page.locator('#courseToggle').click();
      assert.equal(await page.locator('.course-more').evaluate(el=>el.open),true);
      assert.deepEqual(errors,[]);
      await page.close();
      console.log(`${width}px: navigation OK`);
    }
  } finally { await browser.close(); }
})().catch(err=>{console.error(err);process.exitCode=1;});
