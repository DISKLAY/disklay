/* Browser audit with a mocked Telegram login and sync service; no real account is used. */
const {chromium}=require('./audit-browser.cjs');
const assert=require('node:assert/strict');
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:8001/';
const key='medzo-study-sync-session-v1';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try {for(const width of [195,390,1440]) for(const remember of [true,false]){
  const context=await browser.newContext({viewport:{width,height:900}}),errors=[];let cloud={revision:0,snapshot:{schema:1,records:{}}};
  await context.route('https://telegram.org/js/telegram-login.js',r=>r.fulfill({contentType:'application/javascript',body:'window.Telegram={Login:{auth:(options,cb)=>cb({id_token:"mock-token"})}};'}));
  await context.route('**/functions/v1/medzo-study-sync',async r=>{
   const request=r.request(),headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'};
   if(request.method()==='OPTIONS')return r.fulfill({status:204,headers});
   const body=request.postDataJSON();let res=body.action==='config'?{botId:'12345'}:body.action==='challenge'?{nonce:'mock-nonce'}:body.action==='login'?{session:'mock-session',userId:'12345',expiresAt:Math.floor(Date.now()/1000)+3600}:body.action==='get'?cloud:{ok:true};if(body.action==='put'){cloud={revision:body.revision+1,snapshot:body.snapshot};res={revision:cloud.revision};}
   return r.fulfill({headers,contentType:'application/json',body:JSON.stringify(res)});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.waitForSelector('.hero');await page.locator('#courseToggle').click();await page.locator('#courseSidebar [data-sidebar-route="profile"]').click();
  await page.waitForSelector('#studySync');assert.equal(await page.locator('#contextPage').textContent(),'Профиль');
  assert.equal(await page.locator('[data-sync-remember]').isChecked(),true);
  if(!remember)await page.locator('[data-sync-remember]').uncheck();
  await page.waitForFunction(()=>!!(window.Telegram&&Telegram.Login));
  // challenge config is prepared asynchronously; allow its network responses to settle.
  await page.waitForTimeout(100);await page.locator('[data-sync="login"]').click();await page.waitForSelector('[data-sync="logout"]');
  assert.equal(await page.locator('[data-sync-account]').isVisible(),true);assert.equal(await page.locator('[data-sync-remember]').isVisible(),false);
  assert.equal(await page.evaluate(key=>!!localStorage.getItem(key),key),remember);assert.equal(await page.evaluate(key=>!!sessionStorage.getItem(key),key),!remember);
  await page.reload();await page.waitForSelector('[data-sync="logout"]');
  await page.goto(base+'#/settings');await page.waitForSelector('#promoForm');assert.equal(await page.locator('[data-action="export-progress"]').isHidden(),true);assert.equal(await page.locator('#studySync').count(),0);
  const another=await context.newPage();await another.goto(base+'#/profile');await another.waitForSelector('#studySync');
  assert.equal(await another.locator('[data-sync="logout"]').count(),remember?1:0);await another.close();
  await page.goto(base+'#/profile');await page.waitForSelector('[data-sync="logout"]');await page.waitForTimeout(200);await page.locator('[data-sync="logout"]').click();await page.waitForSelector('[data-sync="login"]');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),null);assert.equal(await page.evaluate(key=>sessionStorage.getItem(key),key),null);
  assert.equal(await page.locator('[data-sync-remember]').isChecked(),true);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));assert.deepEqual(errors,[]);
  await context.close();console.log(`${width}px: ${remember?'remembered':'tab-only'} profile OK`);
 }} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
