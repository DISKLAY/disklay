/* Ensure the decorative histology-slide icon follows the theme and doesn't affect navigation. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const assert=require('node:assert/strict');
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:8001/';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try {
  for(const width of [195,390,768,1024,1440])for(const theme of ['light','dark'])for(const appearance of ['default','patriotic']){
   const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(({theme,appearance})=>{
    localStorage.setItem('anatomy-colloquium-theme',theme);
    localStorage.setItem('anatomy-colloquium-rewards-shared-v1',JSON.stringify({appearance,appearances:{[appearance]:true}}));
   },{theme,appearance});
   await page.goto(base+'#/histology');await page.waitForSelector('.histo-hero__slide',{state:'attached'});
   const mark=page.locator('.histo-hero__mark'),svg=page.locator('.histo-hero__slide');
   assert.equal(await mark.getAttribute('aria-hidden'),'true');
   assert.equal(await svg.isVisible(),width>620);
   if(width>620){
    const style=await svg.evaluate(el=>({stroke:getComputedStyle(el).stroke,color:getComputedStyle(el).color,rect:el.getBoundingClientRect().toJSON()}));
    assert.equal(style.stroke,style.color);assert.ok(style.rect.width>=60 && style.rect.height>=50);
   }
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),`${width}/${theme}/${appearance} overflow`);
   await page.locator('[data-histo="section"][data-value="atlas"]').click();await page.waitForSelector('[data-atlas-item]',{state:'attached'});
   assert.deepEqual(errors,[]);await page.close();
   console.log(`${width}/${theme}/${appearance}: OK`);
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
