/* Real browser checks; account services and rating writes are not used. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const assert=require('node:assert/strict');
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:8001/';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try {
  for(const width of [195,320,390,768,1440])for(const theme of ['light','dark']){
   const ctx=await browser.newContext({viewport:{width,height:width===195?500:850},reducedMotion:'reduce'}),errors=[];
   await ctx.addInitScript(theme=>localStorage.setItem('anatomy-colloquium-theme',theme),theme);
   const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'#/');
   const tour=page.locator('dialog.tour');await tour.waitFor({state:'visible'});
   assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
   assert.equal(await tour.getAttribute('aria-modal'),'true');
   assert.equal(await tour.locator('[data-tour-count]').innerText(),'1 / 5');
   if(width===195) await tour.locator('[data-tour-scroll-note]').waitFor({state:'visible'});
   assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-tour-next')),true);
   await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-tour-skip')),true,'tab wraps');
   await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-tour-next')),true,'shift-tab wraps');
   for(let i=1;i<5;i++){
    await tour.locator('[data-tour-next]').click();assert.equal(await tour.locator('[data-tour-count]').innerText(),`${i+1} / 5`);
    const bounds=await tour.evaluate(el=>({w:el.getBoundingClientRect().width,sw:el.scrollWidth,cw:el.clientWidth}));
    assert.ok(bounds.w<=width && bounds.sw<=bounds.cw+1,`dialog overflow ${width}/${theme}`);
    const buttonBounds=await tour.locator('[data-tour-next]').boundingBox();assert.ok(buttonBounds.y>=0 && buttonBounds.y+buttonBounds.height<= (width===195?500:850), 'controls must remain visible');
   }
   await tour.locator('[data-tour-back]').click();assert.equal(await tour.locator('[data-tour-count]').innerText(),'4 / 5');
   await tour.locator('[data-tour-next]').click();await tour.getByRole('button',{name:'Начать'}).click();
   assert.equal(await tour.isVisible(),false);assert.equal(await page.evaluate(()=>localStorage.getItem('medzo-tour-seen-v1')),'1');
   await page.reload();assert.equal(await page.locator('dialog.tour[open]').count(),0);
   await page.goto(base+'#/histology');await page.locator('.histo-hero').waitFor();assert.equal(await page.locator('dialog.tour[open]').count(),0);
   await page.goto(base+'#/settings');const replay=page.getByRole('button',{name:'Посмотреть экскурсию'});await replay.click();await tour.waitFor({state:'visible'});
   assert.equal(await tour.locator('[data-tour-count]').innerText(),'1 / 5');await page.keyboard.press('Escape');assert.equal(await tour.isVisible(),false);assert.equal(await replay.evaluate(el=>document.activeElement===el),true,'focus restored');
   const another=await ctx.newPage();await another.goto(base+'#/');assert.equal(await another.locator('dialog.tour[open]').count(),0);await another.close();
   assert.deepEqual(errors,[]);await ctx.close();console.log(`${width}/${theme}: tour, replay and persistence OK`);
  }
  for(const theme of ['light','dark'])for(const appearance of ['default','ocean','ruby','amber','autumn','winter','spring','anime','rickmorty','breakingbad','patriotic']) {
   const p=await browser.newPage({viewport:{width:390,height:800},reducedMotion:'reduce'});
   await p.addInitScript(({theme,appearance})=>{localStorage.setItem('anatomy-colloquium-theme',theme);localStorage.setItem('anatomy-colloquium-rewards-shared-v1',JSON.stringify({appearance,appearances:{[appearance]:true}}));},{theme,appearance});
   await p.goto(base+'#/');const tour=p.locator('dialog.tour');await tour.waitFor({state:'visible'});
   assert.equal(await p.locator('html').getAttribute('data-accent'),appearance);
   const colors=await tour.evaluate(el=>({fg:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor}));
   const luminance=c=>{const rgb=c.match(/\d+(?:\.\d+)?/g).slice(0,3).map(x=>{const n=Number(x)/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]};
   const l=[luminance(colors.fg),luminance(colors.bg)].sort((a,b)=>b-a);assert.ok((l[0]+.05)/(l[1]+.05)>=4.5,`${theme}/${appearance} tour contrast`);await p.close();
  }
  console.log('All appearances in light/dark: OK');
  // No modal on a direct link to a potentially timed session, but show on return home.
  const ctx=await browser.newContext(), page=await ctx.newPage();await page.goto(base+'#/exam');await page.locator('.view').waitFor();assert.equal(await page.locator('dialog.tour[open]').count(),0);
  await page.evaluate(()=>{location.hash='#/';});await page.locator('dialog.tour[open]').waitFor();await page.getByRole('button',{name:'Пропустить'}).click();await page.reload();assert.equal(await page.locator('dialog.tour[open]').count(),0);await ctx.close();
  const histo=await browser.newContext(),hp=await histo.newPage();await hp.goto(base+'#/histology');await hp.locator('dialog.tour[open]').waitFor();await hp.getByRole('button',{name:'Пропустить'}).click();assert.equal(await hp.evaluate(()=>localStorage.getItem('medzo-tour-seen-v1')),'1');await histo.close();
  // A previously expanded desktop drawer must not intercept Escape or Tab.
  const expanded=await browser.newContext({viewport:{width:1440,height:900}}),ep=await expanded.newPage();
  await ep.goto(base+'#/');await ep.getByRole('button',{name:'Пропустить'}).click();
  await ep.goto(base+'#/settings');await ep.locator('#courseToggle').click();assert.equal(await ep.locator('#courseToggle').getAttribute('aria-expanded'),'true');
  const opener=ep.getByRole('button',{name:'Посмотреть экскурсию'});await opener.click();await ep.keyboard.press('Tab');await ep.keyboard.press('Escape');
  assert.equal(await ep.locator('dialog.tour[open]').count(),0);assert.equal(await ep.locator('#courseToggle').getAttribute('aria-expanded'),'true');assert.equal(await opener.evaluate(el=>document.activeElement===el),true);await expanded.close();
  // Storage rejection must not prevent closing or using the app.
  const blocked=await browser.newContext(),bp=await blocked.newPage();await bp.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}});});await bp.goto(base+'#/');await bp.locator('dialog.tour[open]').waitFor();await bp.getByRole('button',{name:'Пропустить'}).click();assert.equal(await bp.locator('dialog.tour[open]').count(),0);await blocked.close();
  const old=await browser.newContext(),op=await old.newPage();await op.addInitScript(()=>{HTMLDialogElement.prototype.showModal=undefined;});await op.goto(base+'#/');await op.locator('dialog.tour[open]').waitFor();assert.equal(await op.locator('.tour-backdrop').isVisible(),true);await op.keyboard.press('Escape');assert.equal(await op.locator('.tour-backdrop').isVisible(),false);await old.close();
  console.log('Deep links, histology first visit, skip, fallback and unavailable storage: OK');
 } finally {await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
