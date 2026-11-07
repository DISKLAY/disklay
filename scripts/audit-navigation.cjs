/* Optional browser navigation audit: serve the repository and set PLAYWRIGHT_MODULE / CHROMIUM_PATH. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const assert=require('node:assert/strict');
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:8001/';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});try{
 for(const width of [195,390,768,1440,1920]){
  const page=await browser.newPage({viewport:{width,height:900}}), errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base);await page.waitForSelector('.hero');
  const sidebar=page.locator('#courseSidebar'),toggle=page.locator('#courseToggle');
  assert.equal(await page.locator('.topbar #courseToggle').count(),0);
  assert.equal(await sidebar.isVisible(),true);assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  assert.equal(await page.locator('#anatomySidebar [data-sidebar-route="tests"] svg').isVisible(),width>700);
  assert.equal(await page.locator('#anatomySidebar [data-sidebar-route="tests"] .course-nav-label').isVisible(),false);
  const compact=await sidebar.evaluate(el=>el.getBoundingClientRect().width);await toggle.click();
  assert.equal(await toggle.getAttribute('aria-expanded'),'true');if(width>260) assert.ok(await sidebar.evaluate((el,old)=>el.getBoundingClientRect().width>old,compact));
  assert.equal(await page.locator('#anatomySidebar [data-sidebar-route="tests"] .course-nav-label').isVisible(),true);
  assert.equal(await page.locator('#courseBackdrop').isVisible(),width<=1100);
  await page.locator('#courseSidebar [data-subject-link="histology"]').click();await page.waitForSelector('.histo-setup');
  assert.equal(await toggle.getAttribute('aria-expanded'),width<=1100?'false':'true');
  if(width<=700) await toggle.click();
  await page.locator('#courseSidebar [data-histo-sidebar="atlas"]').click();await page.waitForSelector('#atlasSearch');
  await page.goBack();await page.waitForSelector('.histo-setup');await page.goForward();await page.waitForSelector('#atlasSearch');
  if(width<=700) await toggle.click();
  await page.locator('#courseSidebar [data-histo-sidebar="stats"]').click();await page.waitForSelector('[data-leaderboard]');
  assert.equal(await page.locator('[data-leaderboard-signed-out]').isVisible(),true);
  if(width<=700) await toggle.click();
  await page.locator('#courseSidebar [data-sidebar-route="profile"]').click();await page.waitForSelector('#studySync');
  assert.equal(await page.locator('[data-leaderboard]').count(),0);
  await page.locator('.topbar-settings').click();await page.waitForSelector('#promoForm');
  if(await toggle.getAttribute('aria-expanded')==='true') await toggle.click();
  if(width<=700) await toggle.click();
  await page.locator('#anatomySidebar [data-sidebar-route="stats"]').click();await page.waitForSelector('[data-leaderboard]');
  assert.equal(await page.locator('[data-leaderboard-signed-out]').isVisible(),true);
  await toggle.click();await page.keyboard.press('Escape');assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert.equal(await page.evaluate(()=>document.activeElement.id),'courseToggle');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));assert.deepEqual(errors,[]);await page.close();console.log(width+'px sidebar and statistics navigation OK');
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
