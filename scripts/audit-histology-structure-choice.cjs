/* Browser regression: configure PLAYWRIGHT_MODULE, CHROMIUM_PATH and AUDIT_BASE_URL. */
const {chromium}=require('./audit-browser.cjs'),assert=require('node:assert/strict');
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:8000/';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox'],headless:true});try{
 for(const width of [195,390,1280]){
  const page=await browser.newPage({viewport:{width,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'#/histology?section=structures');await page.waitForSelector('[data-histo="structure-start"]');
  const before=await page.evaluate(()=>{const H=window.HistologyPrototype,g=H.createStructures(localStorage,()=>.42),id='bloodfield009.neutro.name';g.state.session={mode:'name',order:[id],index:0,entries:{[id]:{status:'unanswered',selected:null,text:''}}};localStorage.setItem(H.STRUCTURE_KEY,JSON.stringify(g.state));return id;});
  await page.reload();await page.locator('[data-histo="structure-resume"]').click();
  assert.equal(await page.locator('[data-histo="structure-option"]').count(),5);assert.equal(await page.locator('#structureAnswer').count(),0);assert.equal(await page.locator('.histo-feedback').count(),0);assert.equal(await page.locator('[data-histo="structure-check"]').isDisabled(),true);
  const info=await page.evaluate(()=>{const g=window.HistologyPrototype.createStructures(localStorage),e=g.entry();return {options:e.options,correct:g.target().name};});
  const index=info.options.findIndex(x=>x!==info.correct);await page.locator(`[data-histo="structure-option"][data-value="${index}"]`).click();
  await page.reload();await page.locator('[data-histo="structure-resume"]').click();assert.equal(await page.locator(`[data-histo="structure-option"][data-value="${index}"]`).getAttribute('aria-pressed'),'true');
  const reloaded=await page.evaluate(()=>window.HistologyPrototype.createStructures(localStorage).entry().options);assert.deepEqual(reloaded,info.options);
  await page.locator('[data-histo="structure-check"]').click();assert.match(await page.locator('.histo-feedback').innerText(),/Разберём структуру/);assert.match(await page.locator('.histo-feedback').innerText(),new RegExp(info.correct));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),true);
  await page.locator('[data-histo="structure-atlas"]').click();await page.waitForSelector('[data-histo="atlas-return"]');await page.locator('[data-histo="atlas-return"]').click();await page.waitForSelector('.histo-feedback');assert.match(await page.locator('.histo-feedback').innerText(),/Разберём структуру/);
  assert.equal(await page.evaluate(id=>{const H=window.HistologyPrototype,g=H.createStructures(localStorage);return g.current().id===id&&g.entry().status==='wrong'&&g.state.stats[id].last===false;},before),true);
  // A previous free-text answer waiting for self-assessment remains answerable.
  await page.evaluate(id=>{const H=window.HistologyPrototype,g=H.createStructures(localStorage);g.state.session.entries[id]={status:'review',selected:null,text:'прежняя формулировка'};localStorage.setItem(H.STRUCTURE_KEY,JSON.stringify(g.state));},before);
  await page.reload();await page.locator('[data-histo="structure-resume"]').click();assert.match(await page.locator('.histo-feedback').innerText(),/прежняя формулировка/);await page.locator('[data-histo="structure-self"][data-value="yes"]').click();assert.match(await page.locator('.histo-feedback').innerText(),/Верно/);
  assert.deepEqual(errors,[]);console.log(width,'structure choice passed');await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
