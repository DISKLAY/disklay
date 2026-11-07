/* Browser test with isolated mock backend, never touches real user data. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const assert=require('node:assert/strict');
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:8001/';
const session={session:'test-token',userId:'12345',expiresAt:Math.floor(Date.now()/1000)+3600};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/ZV8AAAAASUVORK5CYII=','base64');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});let serverPhoto=null;
 try{for(const width of [195,390,1440]){
  const context=await browser.newContext({viewport:{width,height:900}}),errors=[];let cloud={revision:0,snapshot:{schema:1,records:{}}};
  await context.addInitScript(session=>localStorage.setItem('medzo-study-sync-session-v1',JSON.stringify(session)),session);
  await context.route('**/functions/v1/medzo-study-sync',async r=>{
   const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'};
   if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers});
   const body=r.request().postDataJSON(),{action,photo}=body;let result={ok:true};
   if(action==='get')result=cloud;
   if(action==='put'){cloud={revision:body.revision+1,snapshot:body.snapshot};result={revision:cloud.revision};}
   if(action==='photo-get')result={photo:serverPhoto};
   if(action==='photo-put'){assert.ok(photo.startsWith('/9j/'));serverPhoto=photo;}
   if(action==='photo-delete')serverPhoto=null;
   return r.fulfill({headers,contentType:'application/json',body:JSON.stringify(result)});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'#/profile');await page.waitForSelector('[data-sync="logout"]');
  await page.locator('[data-profile-file]').setInputFiles({name:'sample.png',mimeType:'image/png',buffer:png});
  await page.getByText('Фото сохранено в аккаунте.').waitFor();assert.ok(serverPhoto);
  assert.equal(await page.locator('[data-profile-photo]').isVisible(),true);
  await page.reload();await page.locator('[data-profile-photo]').waitFor({state:'visible'});
  await page.locator('[data-sync="photo-delete"]').click();await page.getByText('Фото удалено.').waitFor();assert.equal(serverPhoto,null);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));assert.deepEqual(errors,[]);
  await context.close();console.log(`${width}px: upload, reload and delete OK`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
