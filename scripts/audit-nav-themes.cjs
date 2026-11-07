/* Browser checks for the navigation, key reset and unfinished session across themes. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const assert=require('node:assert/strict');
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:8001/';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try {
  for(const width of [195,320,390,768,1024,1440]){
   const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base+'#/tests');await page.waitForSelector('.test-groups');
   assert.equal(await page.locator('.tests-view .banner--resume').count(),0);
   await page.locator('[data-test-base="1"]').click();await page.locator('[data-action="start-train"]').click();await page.waitForSelector('.runner');
   const id=await page.evaluate(()=>AT.currentSession().id);
   await page.goto(base+'#/tests');await page.waitForSelector('.tests-view .banner--resume');
   assert.match(await page.locator('.tests-view .banner--resume').innerText(),/Незаконченная тренировка/);
   await page.locator('.tests-view .banner--resume').click();await page.waitForSelector('.runner');
   assert.equal(await page.evaluate(()=>AT.currentSession().id),id);
   await page.goto(base+'#/key');await page.waitForSelector('.key-item');
   assert.equal(await page.locator('[data-action="clear-key"]').isHidden(),true);
   const before=await page.evaluate(()=>({q:AT.dataset.questions[0].num, answer:AT.keyApi.forQuestion(AT.dataset.questions[0]).answers}));
   await page.locator('.key-item [data-action="key-toggle"][aria-pressed="false"]').first().click();
   assert.match(await page.locator('[data-action="clear-key"]').innerText(),/Вернуть исходный ключ/);
   await page.locator('[data-action="clear-key"]').click();assert.match(await page.locator('.modal__card').innerText(),/Вернутся ответы из исходной базы/);
   await page.locator('[data-modal="ok"]').click();await page.waitForFunction(()=>Object.keys(AT.getState().key).length===0);
   assert.deepEqual(await page.evaluate(()=>AT.keyApi.forQuestion(AT.dataset.questions[0]).answers),before.answer);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),`${width} overflow`);
   await page.locator('#courseToggle').click();
   for(const link of await page.locator('#courseSidebar [data-nav-icon]:visible').all()) assert.equal(await link.locator('svg').count(),1);
   await page.locator('#courseToggle').click();
   assert.equal(await page.locator('#anatomySidebar [data-sidebar-route="key"].is-active').count(),1);
   assert.equal(await page.locator('#anatomySidebar [data-sidebar-route="key"] .course-nav-label').isVisible(),false);
   await page.locator('#anatomySidebar [data-sidebar-route="tests"]').click();await page.waitForSelector('.test-groups');
   assert.deepEqual(errors,[]);await page.close();console.log(`${width}px navigation and resume/reset OK`);
  }
  {
   const page=await browser.newPage();await page.addInitScript(()=>localStorage.setItem('anatomy-colloquium-selected','stom-2'));
   await page.goto(base+'#/key');await page.waitForSelector('.key-item');
   await page.locator('.key-item [data-action="key-toggle"]').first().click();
   assert.match(await page.locator('[data-action="clear-key"]').innerText(),/Удалить свои ответы/);
   await page.locator('[data-action="clear-key"]').click();assert.match(await page.locator('.modal__card').innerText(),/исходного ключа нет/);
   await page.locator('[data-modal="ok"]').click();await page.waitForFunction(()=>AT.keyApi.count()===0);
   await page.close();console.log('Keyless bank clears only user answers: OK');
  }
  for(const theme of ['light','dark']) for(const appearance of ['default','ocean','ruby','amber','autumn','winter','spring','anime','rickmorty','breakingbad']) {
   const page=await browser.newPage({viewport:{width:1440,height:900}});await page.addInitScript(({theme,appearance})=>{
    localStorage.setItem('anatomy-colloquium-theme',theme);
    localStorage.setItem('anatomy-colloquium-rewards-shared-v1',JSON.stringify({appearance,appearances:{[appearance]:true}}));
   },{theme,appearance});await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base+'#/tests');await page.waitForSelector('.test-groups');
   assert.equal(await page.locator('html').getAttribute('data-theme'),theme);assert.equal(await page.locator('html').getAttribute('data-accent'),appearance);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),`${theme}/${appearance} overflow`);
   const colors=await page.locator('#anatomySidebar [data-sidebar-route="tests"]').evaluate(el=>({color:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor}));
   const luminance = color => { const rgb=color.match(/\d+(?:\.\d+)?/g).slice(0,3).map(n=>{const c=Number(n)/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4}); return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]; };
   const lum=[luminance(colors.color),luminance(colors.bg)].sort((a,b)=>b-a);
   assert.ok((lum[0]+.05)/(lum[1]+.05)>=3,`${theme}/${appearance} active icon contrast`);
   await page.locator('#courseToggle').click();assert.equal(await page.locator('#anatomySidebar [data-sidebar-route="rewards"]').isVisible(),true);
   await page.close();
  }
  console.log('All appearances in light/dark themes: OK');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
