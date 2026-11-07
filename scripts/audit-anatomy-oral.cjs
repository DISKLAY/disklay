/* Start static server; set PLAYWRIGHT_MODULE and CHROMIUM_PATH. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core'),assert=require('node:assert/strict');
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:8001/';
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});try{
 for(const width of [195,320,390,768,1440])for(const theme of ['light','dark']){
  const p=await b.newPage({viewport:{width,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(theme=>{localStorage.setItem('anatomy-colloquium-theme',theme);if(!localStorage.getItem('anatomy-oral-1-v1'))localStorage.setItem('anatomy-oral-1-v1',JSON.stringify({tickets:{1:{practical:{1:'known'},theory:{2:'again'}}},cards:{}}));},theme);await p.goto(base+'#/anatomy-oral');await p.waitForSelector('.oral-list');
  assert.equal(await p.locator('[data-oral-note]').count(),72);await p.locator('[data-oral-search]').fill('крестец');assert.ok(await p.locator('[data-oral-note]:visible').count()>0);await p.locator('[data-oral-search]').fill('xxzzzz');assert.equal(await p.locator('[data-oral-empty]').isVisible(),true);
  await p.locator('a[href="#/anatomy-oral?section=cards"]').click();await p.waitForSelector('[data-oral="reveal"]');await p.locator('[data-oral="reveal"]').click();assert.equal(await p.locator('.oral-answer').isVisible(),true);await p.locator('[data-card-rate="again"]').click();assert.equal(await p.locator('[data-card-rate="again"]').getAttribute('aria-pressed'),'true');
  await p.locator('.anatomy-training-nav a[href="#/anatomy-oral?section=tickets"]').click();await p.waitForSelector('.oral-ticket-image',{state:'attached'});assert.equal(await p.locator('[data-ticket-rate="practical"]').count(),20);assert.equal(await p.locator('[data-ticket-rate="theory"]').count(),6);
  assert.match(await p.locator('.oral-rating').first().innerText(),/Arcus anterior atlantis/);
  assert.equal(await p.locator('[data-ticket-rate="practical"][data-index="1"][data-value="known"]').getAttribute('aria-pressed'),'true');
  assert.equal(await p.locator('[data-ticket-rate="theory"][data-index="2"][data-value="again"]').getAttribute('aria-pressed'),'true');
  const hint=p.locator('[data-ticket-hint]').first();await hint.click();assert.equal(await hint.getAttribute('aria-expanded'),'true');assert.equal(await p.locator('.oral-skill-hint').first().isVisible(),true);await hint.click();assert.equal(await p.locator('.oral-skill-hint').first().isVisible(),false);
  assert.match(await p.locator('.oral-rating').nth(5).innerText(),/Foramen jugulare/);assert.match(await p.locator('.oral-rating').nth(5).innerText(),/Нет точного соответствия/);
  await p.locator('#oral-ticket').selectOption('19');assert.match(await p.locator('.oral-rating').first().innerText(),/Incisura vertebralis inferior/);assert.match(await p.locator('.oral-rating').first().innerText(),/Нет точного соответствия/);
  await p.locator('#oral-ticket').selectOption('35');await p.waitForSelector('[data-ticket-rate="theory"]');assert.match(await p.locator('.oral-ticket-image').getAttribute('src'),/35.webp$/);
  const response=await p.request.get(base+'assets/anatomy/tickets/35.webp');assert.equal(response.status(),200);
  await p.locator('[data-ticket-rate="practical"][data-index="10"][data-value="known"]').click();await p.locator('[data-ticket-rate="theory"][data-index="3"][data-value="again"]').click();assert.equal(await p.locator('[data-ticket-count]').innerText(),'Оценено: 2 / 13');
  await p.reload();await p.waitForSelector('#oral-ticket');await p.locator('#oral-ticket').selectOption('35');await p.waitForSelector('[data-ticket-rate="theory"]');assert.equal(await p.locator('[data-ticket-rate="theory"][data-index="3"][data-value="again"]').getAttribute('aria-pressed'),'true');assert.equal(await p.locator('[data-ticket-count]').innerText(),'Оценено: 2 / 13');
  await p.locator('[data-ticket-rate="theory"][data-index="3"][data-value="again"]').click();assert.equal(await p.locator('[data-ticket-count]').innerText(),'Оценено: 1 / 13');
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));assert.deepEqual(errors,[]);await p.close();console.log(width,theme,'OK');
 }
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
