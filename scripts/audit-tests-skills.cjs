/* Optional Playwright audit; provide PLAYWRIGHT_MODULE and CHROMIUM_PATH. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try {for(const width of [195,320,390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(process.env.AUDIT_BASE_URL||'http://127.0.0.1:8001/'); await page.waitForSelector('.hero');
  await page.locator('.hero a[href="#/tests"]').click();await page.waitForSelector('.test-groups');
  assert.equal(await page.locator('.test-group[open]').count(),1);
  await page.locator('[data-test-base="2"]').click();await page.waitForFunction(()=>localStorage.getItem('anatomy-colloquium-selected')==='2'&&location.hash==='#/train');await page.waitForSelector('[data-topic-picker]');
  assert.match(await page.locator('#contextBase').textContent(),/Миология/);
  const picker=page.locator('[data-topic-picker]');await picker.locator('summary').click();
  const topics=picker.locator('[data-topic]:not([data-topic="all"])');
  await topics.nth(0).click();assert.equal(await page.locator('[data-topic-picker]').evaluate(el=>el.open),true);
  await page.locator('[data-topic-picker] [data-topic]:not([data-topic="all"])').nth(1).click();
  assert.equal(await page.locator('[data-topic-picker] [aria-pressed="true"]').count(),2);
  await page.goto((process.env.AUDIT_BASE_URL||'http://127.0.0.1:8001/')+'#/tests');await page.waitForSelector('.test-groups');
  await page.locator('[data-test-base="1"]').click(); await page.waitForFunction(()=>localStorage.getItem('anatomy-colloquium-selected')==='1'&&location.hash==='#/train');await page.waitForSelector('[data-topic-picker]');
  await page.goto((process.env.AUDIT_BASE_URL||'http://127.0.0.1:8001/')+'#/anatomy-skills');await page.waitForSelector('.ps-builder');
  await page.locator('[data-picker="group"] [data-picker-trigger]').click();
  await page.locator('[data-ps-option="group"][data-value="spine"]').click();
  assert.equal(await page.locator('[data-picker="group"] [data-picker-trigger]').getAttribute('aria-expanded'),'true');
  await page.locator('[data-ps-option="group"][data-value="skull"]').click();
  assert.equal(await page.locator('[data-picker="group"] [aria-pressed="true"]').count(),2);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-picker="group"] [data-picker-trigger]').getAttribute('aria-expanded'),'false');
  await page.reload();await page.waitForSelector('.ps-builder');assert.match(await page.locator('[data-picker="group"] [data-picker-trigger]').innerText(),/Выбрано тем: 2/);
  await page.locator('[data-ps="start"]').click(); await page.waitForSelector('.ps-term');
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('anatomy-practical-skills-1-v1')));
  assert.deepEqual(state.group,['spine','skull']);assert.equal(state.session.order.length,10);
  const valid=await page.evaluate(ids=>ids.every(id=>['spine','skull'].includes(window.AnatomySkills.byId[id].group)),state.session.order);assert.equal(valid,true);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));
  assert.deepEqual(errors,[]);await page.close();console.log(width+'px: тесты и несколько тем навыков OK');
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
