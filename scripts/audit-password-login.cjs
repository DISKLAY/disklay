/* UI audit using a simulated credential endpoint. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const assert=require('node:assert/strict');
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:8001/';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try{for(const width of [195,390,1440])for(const remember of [false,true]){
  const ctx=await browser.newContext({viewport:{width,height:900}}),errors=[];let user=null,saved=null,registrations=0;
  await ctx.route('**/functions/v1/medzo-study-sync',r=>{const body=r.request().postDataJSON();r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:body.action==='config'?{botId:'12345'}:{nonce:'dummy'}})});
  await ctx.route('**/functions/v1/medzo-credentials',async r=>{
   let b=r.request().postDataJSON(),result={ok:true},status=200;
   if(b.action==='register'){registrations++;if(user){status=409;result={error:'username_taken'};}else user={username:b.username,password:b.password,nickname:b.nickname};}
   else if(b.action==='login'){if(!user||b.username!==user.username||b.password!==user.password){status=401;result={error:'invalid_credentials'};}else result={userId:'p_12345678-1234-4234-8234-123456789abc',session:'mock',expiresAt:Math.floor(Date.now()/1000)+3600};}
   else if(b.action==='account-get')result={username:user.username,displayName:user.nickname};
   else if(b.action==='get')result=saved||{revision:0,snapshot:{schema:1,records:{}}};
   else if(b.action==='put'){saved={revision:b.revision+1,snapshot:b.snapshot};result={revision:saved.revision};}
   else if(b.action==='photo-get')result={photo:null};
   else if(b.action==='leaderboard-get')result={leaders:[],member:null};
   await r.fulfill({status,headers:{'Access-Control-Allow-Origin':'*'},json:result});
  });
  await ctx.route('https://telegram.org/js/telegram-login.js',r=>r.fulfill({contentType:'application/javascript',body:'window.Telegram={Login:{auth(){}}};'}));
  let page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'#/profile');await page.waitForSelector('#studySync');
  if(!remember)await page.locator('[data-sync-remember]').uncheck();
  await page.locator('summary').filter({hasText:'Создать аккаунт'}).click();const form=page.locator('[data-password-register]');
  await form.locator('[name="username"]').fill('student');await form.locator('[name="nickname"]').fill('Студент');await form.locator('[name="password"]').fill('Password12345');await form.locator('[name="confirmation"]').fill('Password12346');
  await form.locator('button').click();await page.getByText('Пароли не совпадают.').waitFor();assert.equal(registrations,0);
  await form.locator('[name="confirmation"]').fill('Password12345');await form.locator('button').click();await page.locator('[data-sync="logout"]').waitFor();await page.getByText('Аккаунт: Студент').waitFor();
  const key='medzo-study-sync-session-v1';assert.equal(await page.evaluate(key=>!!localStorage.getItem(key),key),remember);assert.equal(await page.evaluate(key=>!!sessionStorage.getItem(key),key),!remember);
  await page.getByText('В облаке пока нет данных.',{exact:false}).waitFor();await page.evaluate(()=>{window.AT.ui.confirmDialog=async()=>true});await page.locator('[data-sync="push"]').click();await page.getByText('Данные сохранены в облаке.').waitFor();assert.equal(saved.revision,1);
  await page.reload();await page.locator('[data-sync="logout"]').waitFor();await page.locator('[data-sync="logout"]').click();await page.locator('[data-sync="login"]').waitFor();
  await page.locator('summary').filter({hasText:'Войти по логину'}).click();let login=page.locator('[data-password-login]');await login.locator('[name="username"]').fill('student');await login.locator('[name="password"]').fill('not right');await login.locator('button').click();await page.getByText('Неверный логин или пароль.').waitFor();
  await login.locator('[name="password"]').fill('Password12345');await login.locator('button').click();await page.locator('[data-sync="logout"]').waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));assert.deepEqual(errors,[]);await ctx.close();console.log(`${width}px ${remember?'remembered':'tab-only'} registration, login, sync and logout OK`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
