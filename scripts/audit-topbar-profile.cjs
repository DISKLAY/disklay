/* Uses mocked sessions and server responses; no real account is accessed. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core'),assert=require('node:assert/strict');
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:8001/';
const jpeg='/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try{for(const width of [195,240,320,390,768,1440]){
 const ctx=await browser.newContext({viewport:{width,height:850}}),errors=[];
 await ctx.addInitScript(()=>localStorage.setItem('medzo-study-sync-session-v1',JSON.stringify({session:'mock',userId:'123',expiresAt:Math.floor(Date.now()/1000)+3600})));
 await ctx.route('**/functions/v1/medzo-study-sync',async r=>{
   const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'};
   if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers});
   const body=r.request().postDataJSON(),res=body.action==='photo-get'?{photo:jpeg}:body.action==='get'?{revision:0,snapshot:{schema:1,records:{}}}:body.action==='leaderboard-get'?{leaders:[],member:null}:{ok:true};
   return r.fulfill({headers,contentType:'application/json',body:JSON.stringify(res)});
 });
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.waitForSelector('.hero');
 const avatar=page.locator('#topbarProfile');await page.locator('#topbarProfilePhoto').waitFor({state:'visible'});
 const profileRect=await avatar.boundingBox(),brandRect=await page.locator('#subjectBrand').boundingBox();assert.ok(profileRect.x>brandRect.x,'profile should be right of the brand');assert.ok(profileRect.y<brandRect.y+brandRect.height,'profile should stay on the top row');
 const imageRect=await page.locator('#topbarProfilePhoto').boundingBox();assert.ok(Math.abs(imageRect.y-(profileRect.y+1))<1,'entire image must fit in the avatar');assert.ok(Math.abs(imageRect.height-(profileRect.height-2))<1);assert.equal(await page.locator('#topbarProfilePlaceholder').isHidden(),true);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),width+' overflow');
 await avatar.click();await page.waitForSelector('#studySync');assert.equal(await page.locator('#contextPage').textContent(),'Профиль');
 await page.locator('[data-sync="logout"]').click();await page.waitForSelector('[data-sync="login"]');assert.equal(await page.locator('#topbarProfilePhoto').isHidden(),true);assert.equal(await page.locator('#topbarProfilePlaceholder').isVisible(),true);
 assert.deepEqual(errors,[]);await ctx.close();console.log(width+'px: photo, profile link and logout OK');
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
