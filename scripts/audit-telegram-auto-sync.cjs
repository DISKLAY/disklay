const {chromium}=require('./audit-browser.cjs'),assert=require('node:assert/strict');
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:8001/',key='anatomy-colloquium-v1';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){const end=Date.now()+15000;while(Date.now()<end){if(fn())return;await delay(50);}throw Error('sync timeout');}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});let cloud={revision:0,snapshot:{schema:1,records:{}}};
 async function device(name){
  const ctx=await browser.newContext({viewport:{width:390,height:850}}),errors=[];
  await ctx.addInitScript(({name,key})=>{window.TelegramWebviewProxy={};if(!localStorage.getItem('seed')){localStorage.setItem('seed','1');localStorage.setItem(key,JSON.stringify({progress:{[name]:{attempts:1}},game:{coins:name==='A'?77:2},session:{id:name}}));}}, {name,key});
  await ctx.route('https://telegram.org/js/telegram-web-app.js',r=>r.fulfill({contentType:'application/javascript',body:'window.Telegram={WebApp:{initData:"signed",ready(){},expand(){}}};'}));
  await ctx.route('**/functions/v1/medzo-study-sync',async r=>{
   const b=r.request().postDataJSON();let result={ok:true},status=200;
   if(b.action==='login')result={session:'tg-token',userId:'12345',expiresAt:Math.floor(Date.now()/1000)+3600};
   else if(b.action==='get')result=JSON.parse(JSON.stringify(cloud));
   else if(b.action==='put'){if(b.revision!==cloud.revision){status=409;result={error:'changed'};}else{cloud={revision:cloud.revision+1,snapshot:JSON.parse(JSON.stringify(b.snapshot))};result={revision:cloud.revision};}}
   else if(b.action==='photo-get')result={photo:null};else if(b.action==='leaderboard-get')result={leaders:[],member:null};
   await r.fulfill({status,headers:{'Access-Control-Allow-Origin':'*'},json:result});
  });
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'#/profile');await page.waitForSelector('#studySync');await page.waitForFunction(()=>!!window.Telegram?.WebApp?.initData);const reload=name==='B'?page.waitForEvent('load'):null;await page.locator('[data-sync="login"]').click();if(reload)await reload;await page.locator('[data-sync="logout"]').waitFor();return {ctx,page,errors};
 }
 try{const a=await device('A');await until(()=>cloud.revision===1);assert.ok(cloud.snapshot.records[key].progress.A);assert.equal(cloud.snapshot.records[key].game.coins,77);
 const b=await device('B');await b.page.waitForFunction(key=>!!JSON.parse(localStorage.getItem(key)||'{}').progress?.A,key);
 const record=await b.page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert.equal(record.game.coins,77);assert.equal(record.session.id,'B');assert.deepEqual(a.errors,[]);assert.deepEqual(b.errors,[]);
 await a.ctx.close();await b.ctx.close();console.log('Telegram first sign-in seeds cloud and next device restores: OK');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
