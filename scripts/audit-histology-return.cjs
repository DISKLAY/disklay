/* Optional browser audit: start the static server and provide playwright-core / Chromium. */
const {chromium}=require('./audit-browser.cjs');
const assert=require('node:assert/strict');
const base=process.env.AUDIT_BASE_URL || 'http://127.0.0.1:8000/';
(async()=>{
  const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox'],headless:true});
  try {
    for(const width of [195,390,1280]) for(const kind of ['run','theory','structures']) {
      const page=await browser.newPage({viewport:{width,height:850}}), errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+'#/histology');await page.waitForSelector('[data-histo="start"]');
      const prefix=kind==='run'?'':kind==='theory'?'theory-':'structure-';
      if(kind!=='run'){await page.locator(`[data-histo="section"][data-value="${kind}"]`).click();await page.waitForSelector(`[data-histo="${prefix}start"]`);}
      await page.locator(`[data-histo="${prefix}start"]`).click();
      await page.locator(`[data-histo="${prefix}dont-know"]`).click();await page.waitForSelector('.histo-feedback');
      const title=await page.locator('.histo-feedback h3').innerText();
      const key=kind==='run'?'histology-prototype-v1':kind==='theory'?'histology-theory-v1':'histology-structures-v1';
      const before=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).session,key);
      const link=kind==='run'?'review-atlas':kind==='theory'?'theory-atlas':'structure-atlas';
      await page.locator(`[data-histo="${link}"]`).click();await page.waitForSelector('[data-histo="atlas-return"]');
      await page.waitForSelector('[data-atlas-item][open]');await page.waitForTimeout(500);
      // The jump must leave both the sticky button and the card heading visible.
      const bounds=await page.evaluate(()=>{const btn=document.querySelector('.histo-atlas-return').getBoundingClientRect(),header=document.querySelector('.topbar').getBoundingClientRect(),card=document.querySelector('[data-atlas-item][open]').getBoundingClientRect();return {buttonTop:btn.top,buttonBottom:btn.bottom,headerBottom:header.bottom,cardTop:card.top};});
      assert.ok(bounds.buttonTop>=bounds.headerBottom-1,JSON.stringify(bounds));
      assert.ok(bounds.cardTop>=bounds.buttonBottom-2,JSON.stringify(bounds));
      await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
      assert.equal(await page.locator('[data-histo="atlas-return"]').isVisible(),true);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),true);
      if(width===390 && kind==='run'){await page.reload();await page.waitForSelector('[data-histo="atlas-return"]');await page.waitForSelector('[data-atlas-item][open]');}
      await page.locator('[data-histo="atlas-return"]').click();await page.waitForSelector('.histo-feedback');
      assert.equal(await page.locator('.histo-feedback h3').innerText(),title);
      const after=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).session,key);
      assert.equal(after.index,before.index);assert.equal(after.order[after.index],before.order[before.index]);
      assert.equal(after.entries[after.order[after.index]].status,before.entries[before.order[before.index]].status);
      await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>document.activeElement?.dataset.histo),prefix+'next');
      assert.deepEqual(errors,[]);await page.close();console.log(width,kind,'passed');
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
