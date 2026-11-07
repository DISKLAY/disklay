/* End-to-end browser audit with a shared mock cloud and separate browser profiles. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const assert=require('node:assert/strict');
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:8001/';
const key='anatomy-colloquium-v1',uid='p_12345678-1234-4234-8234-123456789abc';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,msg,timeout=15000){const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await delay(60);}throw Error('Timed out: '+msg);}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 let cloud={revision:0,snapshot:{schema:1,records:{}}},offlineB=false,offlineC=false,errors=[],holdC=false,releaseC=null,cStarted=false;
 async function makeDevice(name){
  const ctx=await browser.newContext({viewport:{width:390,height:850}});
  await ctx.addInitScript(({name,key})=>{if(!localStorage.getItem('test-seeded')){localStorage.setItem('test-seeded','1');localStorage.setItem(key,JSON.stringify({progress:{[name]:{attempts:2}},session:{id:name+'-session'},settings:{theme:'dark'},game:{coins:name==='A'?100:7}}));localStorage.setItem('anatomy-dungeon-v1',name+'-dungeon');}}, {name,key});
  await ctx.route('https://telegram.org/js/telegram-login.js',r=>r.fulfill({contentType:'application/javascript',body:'window.Telegram={Login:{auth(){}}};'}));
  await ctx.route('**/functions/v1/medzo-study-sync',r=>{let body=r.request().postDataJSON();r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:body.action==='config'?{botId:'12345'}:{nonce:'nonce'}});});
  await ctx.route('**/functions/v1/medzo-credentials',async r=>{
   const b=r.request().postDataJSON(),cors={'Access-Control-Allow-Origin':'*'};
   if(((offlineB&&name==='B')||(offlineC&&name==='C'))&&['get','put'].includes(b.action))return r.abort();
   if(holdC&&name==='C'&&b.action==='get'){holdC=false;cStarted=true;await new Promise(resolve=>releaseC=resolve);}
   let result={ok:true},status=200;
   if(b.action==='login')result={userId:uid,session:'token',expiresAt:Math.floor(Date.now()/1000)+3600};
   else if(b.action==='account-get')result={displayName:'Тест'};
   else if(b.action==='get')result=JSON.parse(JSON.stringify(cloud));
   else if(b.action==='put'){
    if(b.revision!==cloud.revision){status=409;result={error:'changed'};}
    else{cloud={revision:cloud.revision+1,snapshot:JSON.parse(JSON.stringify(b.snapshot))};result={revision:cloud.revision};}
   }
   else if(b.action==='photo-get')result={photo:null};
   else if(b.action==='leaderboard-get')result={leaders:[],member:null};
   return r.fulfill({status,headers:cors,json:result});
  });
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(name+': '+e.message));await page.goto(base+'#/profile');await page.waitForSelector('#studySync');
  await page.locator('summary').filter({hasText:'Войти по логину'}).click();let form=page.locator('[data-password-login]');await form.locator('[name="username"]').fill('student');await form.locator('[name="password"]').fill('Password12345');const firstRestore=name==='B'?page.waitForEvent('load'):null;await form.locator('button').click();if(firstRestore)await firstRestore;await page.waitForSelector('[data-sync="logout"]');
  return {ctx,page};
 }
 try{
  const a=await makeDevice('A');await until(()=>cloud.revision===1,'first account login automatically seeds cloud');
  assert.ok(cloud.snapshot.records[key].progress.A);assert.equal(cloud.snapshot.records[key].game.coins,100);
  const b=await makeDevice('B');await b.page.waitForFunction(key=>!!JSON.parse(localStorage.getItem(key)||'{}').progress?.A,key);
  const bState=await b.page.evaluate(key=>({state:JSON.parse(localStorage.getItem(key)),dungeon:localStorage.getItem('anatomy-dungeon-v1'),backups:Object.keys(localStorage).filter(k=>k.startsWith('medzo-study-sync-local-backup-'))}),key);
  assert.equal(bState.state.game.coins,100);assert.equal(bState.state.session.id,'B-session');assert.equal(bState.dungeon,'B-dungeon');assert.ok(bState.backups.length);
  let qid=await a.page.evaluate(()=>window.AT.dataset.questions[0].id);assert.equal(await a.page.evaluate(id=>window.AT.annotations.setComment(id,'from A'),qid),true);
  await until(()=>cloud.snapshot.records[key]?.comments?.[qid]==='from A','automatic upload after local change');
  await Promise.all([b.page.waitForEvent('load'), b.page.evaluate(()=>window.dispatchEvent(new Event('focus')))]);
  await b.page.waitForFunction(({key,qid})=>JSON.parse(localStorage.getItem(key)||'{}').comments?.[qid]==='from A' && !!window.AT,{key,qid});
  // Offline work on B and a concurrent edit on A must never silently overwrite either.
  offlineB=true;assert.equal(await b.page.evaluate(id=>window.AT.annotations.setComment(id,'offline B'),qid),true);
  assert.equal(await a.page.evaluate(id=>window.AT.annotations.setComment(id,'new A'),qid),true);
  await until(()=>cloud.snapshot.records[key]?.comments?.[qid]==='new A','second A upload');offlineB=false;
  await b.page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await b.page.waitForFunction(()=>!document.querySelector('#syncAlert').hidden && document.querySelector('#syncAlert').textContent.includes('разные изменения'));
  assert.equal(await b.page.evaluate(({key,qid})=>JSON.parse(localStorage.getItem(key)).comments[qid],{key,qid}),'offline B');
  assert.equal(cloud.snapshot.records[key].comments[qid],'new A');
  // Changes from the lazy-loaded histology and practical-skills stores trigger uploads too.
  await a.page.goto(base+'#/histology?section=theory');await a.page.waitForSelector('[data-histo="theory-start"]');await a.page.locator('[data-histo="theory-start"]').click();
  await a.page.locator('[data-histo="theory-select"]').first().click();await a.page.evaluate(()=>document.activeElement.blur());await a.page.keyboard.press('Enter');await a.page.waitForSelector('.histo-feedback');
  await until(()=>Object.keys(cloud.snapshot.records['histology-theory-v1']?.stats||{}).length>0,'automatic histology upload');
  assert.equal(cloud.snapshot.records['histology-theory-v1'].session,undefined);
  await a.page.goto(base+'#/anatomy-skills');await a.page.waitForSelector('[data-ps="start"]');await a.page.locator('[data-ps="start"]').click();await a.page.locator('[data-ps="mark"][data-value="known"]').click();
  await until(()=>Object.keys(cloud.snapshot.records['anatomy-practical-skills-1-v1']?.stats||{}).length>0,'automatic practical skills upload');
  assert.equal(cloud.snapshot.records['anatomy-practical-skills-1-v1'].session,undefined);
  // An additional tab holds a shared lock: don't replace its stale in-memory state.
  const extra=await a.ctx.newPage();await extra.goto(base+'#/profile');await extra.waitForSelector('#studySync');
  await until(()=>a.page.evaluate(async()=>{const x=await navigator.locks.query();return x.held.filter(v=>v.name==='medzo-open-tab').length===2;}),'both tab locks');
  cloud.snapshot.records[key].comments[qid]='new remote';cloud.revision++;
  await a.page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await a.page.waitForFunction(()=>!document.querySelector('#syncAlert').hidden && document.querySelector('#syncAlert').textContent.includes('Закройте другие вкладки'));
  assert.equal(await a.page.evaluate(({key,qid})=>JSON.parse(localStorage.getItem(key)).comments[qid],{key,qid}),'new A');
  await extra.close();await Promise.all([a.page.waitForEvent('load'),a.page.evaluate(()=>window.dispatchEvent(new Event('focus')))]);
  await a.page.waitForFunction(({key,qid})=>JSON.parse(localStorage.getItem(key)).comments?.[qid]==='new remote',{key,qid});
  // New work created during the first network request is a conflict, not discarded.
  holdC=true;const c=await makeDevice('C');await until(()=>cStarted,'delayed initial request');
  await c.page.waitForFunction(uid=>{try{return !!JSON.parse(localStorage.getItem('medzo-sync-bootstrap-v1-'+uid)||'{}').hash}catch(_){return false}},uid);
  assert.equal(await c.page.evaluate(id=>window.AT.annotations.setComment(id,'during first login'),qid),true);
  offlineC=true;releaseC();await c.page.reload();await c.page.waitForSelector('#studySync');offlineC=false;
  await c.page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await c.page.waitForFunction(()=>!document.querySelector('#syncAlert').hidden && document.querySelector('#syncAlert').textContent.includes('разные изменения'));
  assert.equal(await c.page.evaluate(({key,qid})=>JSON.parse(localStorage.getItem(key)).comments[qid],{key,qid}),'during first login');
  assert.equal(cloud.snapshot.records[key].comments[qid],'new remote');
  assert.deepEqual(errors,[]);await a.ctx.close();await b.ctx.close();await c.ctx.close();console.log('Automatic seed, cloud restore, backup, background upload/download, concurrent edits and multi-tab protection: OK');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
