/* Optional browser audit: menu, compact course selector, mobile bar, and PDFs. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const assert=require('node:assert/strict');
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:8001/';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try{for(const width of [195,320,390,700,768,1440])for(const theme of ['light','dark']){
  const p=await browser.newPage({viewport:{width,height:850}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(theme=>localStorage.setItem('anatomy-colloquium-theme',theme),theme);
  await p.goto(base);await p.waitForSelector('.hero');
  assert.equal(await p.locator('.mobile-nav').isVisible(),width<=700);
  if(width<=700){
   assert.equal(await p.locator('#courseSidebarContents').isVisible(),false);
   assert.equal(await p.locator('#courseToggle').isVisible(),true);
   assert.equal(await p.locator('.mobile-nav a').count(),4);
   await p.locator('#courseToggle').click();assert.equal(await p.locator('#courseSidebarContents').isVisible(),true);
   await p.keyboard.press('Escape');assert.equal(await p.locator('#courseSidebarContents').isVisible(),false);
   await p.locator('[data-mobile-nav="tests"]').click();await p.waitForSelector('.test-groups');
  }else{await p.goto(base+'#/tests');await p.waitForSelector('.test-groups');}
  for(const link of ['colloquium-1-tickets.pdf','colloquium-1-oral-theory.pdf']){
   const el=p.locator('.oral-materials a[href$="'+link+'"]');assert.equal(await el.count(),1);
   const response=await p.request.get(new URL(await el.getAttribute('href'),base).href);assert.equal(response.status(),200);assert.match(response.headers()['content-type'],/pdf/);
  }
  await p.locator('#contextBase').selectOption('2');await p.waitForFunction(()=>localStorage.getItem('anatomy-colloquium-selected')==='2');await p.waitForSelector('.hero');assert.equal(await p.locator('#contextBase').inputValue(),'2');
  if(width<=700){await p.locator('#courseToggle').click();await p.locator('[data-subject-link="histology"]').click();await p.waitForSelector('.histo-setup');assert.equal(await p.locator('[data-mobile-nav="tests"] span').innerText(),'Атлас');await p.locator('[data-mobile-nav="tests"]').click();await p.waitForSelector('#atlasSearch');await p.locator('[data-mobile-nav="mistakes"]').click();await p.waitForSelector('[data-histo="section"][data-value="errors"]');}
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),`${width}/${theme} overflow`);
  assert.deepEqual(errors,[]);await p.close();console.log(`${width}/${theme}: OK`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
