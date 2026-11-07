const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core'),assert=require('node:assert/strict');
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:8001/',key='anatomy-oral-1-v1',uid='p_12345678-1234-4234-8234-123456789abc';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,msg){for(let i=0;i<250;i++){if(await fn())return;await delay(80);}throw Error('Timeout: '+msg);}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});let oral={revision:0,snapshot:{schema:1,tickets:{},cards:{}}},offlineB=false,errors=[];
 async function device(name,seed,owner){
  const ctx=await browser.newContext({viewport:{width:390,height:850}});
  await ctx.addInitScript(({seed,key,uid,owner})=>{if(!localStorage.getItem('__oral_test_seeded')){localStorage.setItem('__oral_test_seeded','1');if(owner)localStorage.setItem('medzo-oral-sync-owner-v1',owner);localStorage.setItem('medzo-study-sync-session-v1',JSON.stringify({session:'test',userId:uid,expiresAt:Math.floor(Date.now()/1000)+86400}));if(seed)localStorage.setItem(key,JSON.stringify(seed));}}, {seed,key,uid,owner});
  await ctx.route('**/functions/v1/medzo-credentials',async route=>{const b=route.request().postDataJSON();let out={};if(b.action==='get')out={revision:1,snapshot:{schema:2,records:{}}};else if(b.action==='photo-get')out={photo:null};else if(b.action==='leaderboard-get')out={leaders:[],member:null};else if(b.action==='account-get')out={displayName:'Тест'};return route.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:out});});
  await ctx.route('**/functions/v1/medzo-oral-sync',async route=>{if(name==='B'&&offlineB)return route.abort();const b=route.request().postDataJSON();let out,status=200;if(b.action==='get')out=oral;else if(b.revision!==oral.revision){status=409;out={error:'changed'};}else{oral={revision:oral.revision+1,snapshot:structuredClone(b.snapshot)};out={revision:oral.revision};}return route.fulfill({status,headers:{'Access-Control-Allow-Origin':'*'},json:out});});
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(name+': '+e.message));await page.goto(base+'#/anatomy-oral?section=cards');await page.waitForSelector('[data-oral="reveal"]');return {ctx,page};
 }
 try{
  const a=await device('A',{tickets:{'1':{practical:{'1':'known'}}},cards:{'1':'known'}});
  await until(()=>oral.snapshot.cards['1']==='known','first oral upload');assert.equal(oral.snapshot.tickets['1'].practical['1'],'known');
  const b=await device('B');await until(async()=>{const x=await b.page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),key);return x?.cards['1']==='known';},'second device download');
  await a.page.locator('[data-oral="reveal"]').click();await a.page.locator('[data-card-rate="again"]').click();await until(()=>oral.snapshot.cards['1']==='again','card mark uploaded');
  await b.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await until(async()=>{const x=await b.page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),key);return x?.cards['1']==='again';},'other device updates');
  offlineB=true;await b.page.locator('[data-oral="reveal"]').click();await b.page.locator('[data-card-rate="known"]').click();
  await a.page.locator('[data-card-rate="again"]').click();await until(()=>!oral.snapshot.cards['1'],'removal uploaded');
  offlineB=false;await b.page.evaluate(()=>window.dispatchEvent(new Event('online')));await b.page.goto(base+'#/profile');await b.page.waitForSelector('[data-sync="oral-push"]');
  assert.equal((await b.page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key)).cards['1'],'known');assert.equal(oral.snapshot.cards['1'],undefined);
  await b.page.evaluate(()=>{window.AT.ui.confirmDialog=async()=>true;});await b.page.locator('[data-sync="oral-push"]').click();await until(()=>oral.snapshot.cards['1']==='known','conflict resolved explicitly');
  const c=await device('C',{tickets:{},cards:{'72':'again'}});await c.page.goto(base+'#/profile');await c.page.waitForSelector('[data-sync="oral-push"]');
  assert.equal((await c.page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key)).cards['72'],'again');assert.equal(oral.snapshot.cards['1'],'known');
  oral={revision:0,snapshot:{schema:1,tickets:{},cards:{}}};
  const d=await device('D',{tickets:{},cards:{'4':'known'}},'987654321');await d.page.setViewportSize({width:195,height:850});await d.page.goto(base+'#/profile');await d.page.waitForSelector('[data-sync="oral-push"]');assert.equal(await d.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'conflict controls do not overflow narrow screens');assert.equal(oral.revision,0);assert.equal((await d.page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key)).cards['4'],'known');
  assert.deepEqual(errors,[]);await Promise.all([a.ctx.close(),b.ctx.close(),c.ctx.close(),d.ctx.close()]);console.log('Oral sync browser audit passed: first upload, cross-device download, removal, offline conflict and explicit choice.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
