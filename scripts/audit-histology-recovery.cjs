const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox'],headless:true});try{
 for(const [width,zoom] of [[390,1],[390,2],[1280,1]]){
  const page=await browser.newPage({viewport:{width,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.AUDIT_BASE_URL||'http://127.0.0.1:8000/')+'#/histology');await page.waitForSelector('[data-histo="start"]');
  const data=await page.evaluate(()=>{const H=window.HistologyPrototype,g=H.create(localStorage,()=>0.5);g.setSampling('slides');g.start();const key=g.state.session.order.find(k=>k==='m71');g.state.session.index=g.state.session.order.indexOf(key);g.state.session.entries[key].variant=0;localStorage.setItem(H.STORAGE_KEY,JSON.stringify(g.state));return {image:H.byId.m71.image,review:H.byId.m71.review};});
  await page.reload();await page.waitForSelector('.histo-image img');await page.evaluate(z=>document.documentElement.style.zoom=z,zoom);
  assert.equal(await page.locator('.histo-image img').getAttribute('src'),data.image);assert.equal(await page.locator('.histo-review').count(),0);
  await page.locator('[data-histo="dont-know"]').click();await page.locator('.histo-review summary').click();await page.locator('.histo-review__open').click();await page.waitForSelector('dialog[open]');assert.equal(await page.locator('dialog img').getAttribute('src'),data.review);await page.locator('[data-zoom-close]').click();
  await page.locator('[data-histo="review-atlas"]').click();await page.waitForSelector('[data-atlas-item][data-slide-id="m71"][open]');assert.match(await page.locator('[data-atlas-item][data-slide-id="m71"]').innerText(),/3-й коллоквиум/);
  await page.goto((process.env.AUDIT_BASE_URL||'http://127.0.0.1:8000/')+'#/histology?section=structures');await page.waitForSelector('[data-histo="structure-start"]');
  for(const [id,mode,answer] of [['m71.cell.name','name','кардиомиоцит'],['n79.node.point','point',null]]){
   await page.evaluate(({id,mode})=>{const H=window.HistologyPrototype,g=H.createStructures(localStorage);g.state.session={mode,order:[id],index:0,entries:{[id]:{status:'unanswered',selected:null,text:''}}};localStorage.setItem(H.STRUCTURE_KEY,JSON.stringify(g.state));},{id,mode});await page.reload();await page.waitForSelector('[data-histo="structure-resume"]');await page.locator('[data-histo="structure-resume"]').click();
   if(mode==='name'){assert.equal(await page.locator('.histo-extent').count(),1);const option=await page.evaluate(()=>{const H=window.HistologyPrototype,g=H.createStructures(localStorage);return g.entry().options.indexOf(g.target().name)});await page.locator(`[data-histo="structure-option"][data-value="${option}"]`).click();await page.locator('[data-histo="structure-check"]').click();}
   else {const i=await page.evaluate(()=>window.HistologyPrototype.structureSlides.find(g=>g.slideId==='n79').points.findIndex(p=>p.id==='node'));await page.locator(`.histo-marker-choice[data-value="${i}"]`).click();await page.locator('[data-histo="structure-check"]').click();}
   assert.match(await page.locator('.histo-feedback').innerText(),/Верно/);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),true);
  }
  assert.deepEqual(errors,[]);console.log(width,zoom,'passed');await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
