/* Browser audit uses mocked services and fictitious accounts only. */
const {chromium}=require('./audit-browser.cjs'),assert=require('node:assert/strict');
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:8001/';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try{for(const width of [195,320,390,768,1440]){
 let member=null,cloud={revision:0,snapshot:{schema:1,records:{}}};const context=await browser.newContext({viewport:{width,height:900}}),errors=[];
 await context.addInitScript(()=>localStorage.setItem('medzo-study-sync-session-v1',JSON.stringify({session:'mock',userId:'123',expiresAt:Math.floor(Date.now()/1000)+3600})));
 await context.route('**/functions/v1/medzo-study-sync',async r=>{const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'};
  if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers});const data=r.request().postDataJSON();let result={ok:true};
  if(data.action==='get')result=cloud;
  if(data.action==='put'){cloud={revision:data.revision+1,snapshot:data.snapshot};result={revision:cloud.revision};}
  if(data.action==='leaderboard-get'){await new Promise(resolve=>setTimeout(resolve,250));result={leaders:[{display_name:'<img src=x onerror=alert(1)>',score:123}],member};}
  if(data.action==='leaderboard-join')member={name:data.name,showPhoto:data.showPhoto};
  if(data.action==='leaderboard-leave')member=null;
  return r.fulfill({headers,contentType:'application/json',body:JSON.stringify(result)});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'#/stats');
 await page.locator('[name="leaderboard-name"]').fill('Аня');await page.locator('[name="leaderboard-photo"]').check();
 await page.locator('[data-leaderboard-list] li').waitFor();assert.match(await page.locator('[data-leaderboard-list] li').textContent(),/<img src=x/);assert.equal(await page.locator('[data-leaderboard-list] li img').count(),0);
 assert.equal(await page.locator('[name="leaderboard-name"]').inputValue(),'Аня');assert.equal(await page.locator('[name="leaderboard-photo"]').isChecked(),true);await page.locator('[data-leaderboard-save]').click();await page.getByText('Настройки рейтинга сохранены.').waitFor();assert.deepEqual(member,{name:'Аня',showPhoto:true});
 await page.locator('[data-leaderboard-leave]').click();await page.getByText('Вы больше не участвуете в рейтинге.').waitFor();assert.equal(member,null);
 await page.goto(base+'#/histology?section=stats');await page.locator('[data-leaderboard-list] li').waitFor();
 await page.locator('[name="leaderboard-name"]').fill('Борис');await page.locator('[data-leaderboard-save]').click();await page.getByText('Настройки рейтинга сохранены.').waitFor();assert.deepEqual(member,{name:'Борис',showPhoto:false});
 await page.goto(base+'#/stats');await page.locator('[data-leaderboard-list] li').waitFor();assert.equal(await page.locator('[name="leaderboard-name"]').inputValue(),'Борис');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),true);assert.deepEqual(errors,[]);await context.close();console.log(width+'px: leaderboard OK');
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
