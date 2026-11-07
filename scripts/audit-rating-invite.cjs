/* Browser audit with mocked services; no real accounts or rating writes. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const assert=require('node:assert/strict');
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:8001/';
const uid='p_12345678-1234-4234-8234-123456789abc';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try{
  for(const width of [195,320,390,768,1440])for(const theme of ['light','dark'])for(const signedIn of [false,true]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});let joins=0, member=null,errors=[],cloud={revision:0,snapshot:{schema:1,records:{}}},oral={revision:0,snapshot:{schema:1,tickets:{},cards:{}}};
   await context.addInitScript(({theme,signedIn,uid})=>{
    localStorage.setItem('anatomy-colloquium-theme',theme);
    if(signedIn)localStorage.setItem('medzo-study-sync-session-v1',JSON.stringify({session:'mock',userId:uid,expiresAt:Math.floor(Date.now()/1000)+3600}));
   },{theme,signedIn,uid});
   await context.route('https://telegram.org/js/telegram-login.js',r=>r.fulfill({contentType:'application/javascript',body:'window.Telegram={Login:{auth(){}}}'}));
   await context.route('**/functions/v1/*',async r=>{
    const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'};
    if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:cors});
    const b=r.request().postDataJSON(),url=r.request().url();let result={ok:true};
    if(url.includes('medzo-oral-sync')){if(b.action==='get')result=oral;else {oral={revision:b.revision+1,snapshot:b.snapshot};result={revision:oral.revision};}}
    else if(b.action==='config')result={botId:'12345'};
    else if(b.action==='challenge')result={nonce:'mock'};
    else if(b.action==='get')result=cloud;
    else if(b.action==='put'){cloud={revision:b.revision+1,snapshot:b.snapshot};result={revision:cloud.revision};}
    else if(b.action==='photo-get')result={photo:null};
    else if(b.action==='account-get')result={displayName:'Тест'};
    else if(b.action==='leaderboard-get')result={leaders:[],member};
    else if(b.action==='leaderboard-join'){joins++;member={name:b.name,showPhoto:b.showPhoto};}
    else if(b.action==='leaderboard-leave')member=null;
    return r.fulfill({headers:cors,contentType:'application/json',body:JSON.stringify(result)});
   });
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   for(const subject of ['anatomy','histology']){
    await page.goto(base+(subject==='anatomy'?'#/':'#/histology?section=setup'));
    const invite=page.locator('[data-rating-invite]');await invite.waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
    assert.equal(await invite.locator('[data-if-signed-out]').isVisible(),!signedIn);
    assert.equal(await invite.locator('[data-if-signed-in]').isVisible(),signedIn);
    assert.match(await invite.innerText(),signedIn?/Участие добровольное/:/Войдите или создайте аккаунт/);
    assert.equal(joins,0,'home screen must not join automatically');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),true,`overflow ${width}/${theme}/${subject}`);
    if(!signedIn){assert.equal(await invite.getByRole('link',{name:'Войти или зарегистрироваться'}).getAttribute('href'),'#/profile');await invite.getByRole('link',{name:'О рейтинге'}).click();}
    else await invite.getByRole('link',{name:'Открыть рейтинг'}).click();
    await page.locator('[data-leaderboard]').waitFor();
    await page.waitForFunction(()=>document.activeElement?.hasAttribute('data-leaderboard')); 
    assert.equal(await page.locator('[data-leaderboard-signed-in]').isVisible(),signedIn);
    assert.equal(await page.locator('[data-leaderboard-signed-out]').isVisible(),!signedIn);
    assert.equal(joins,0,'visiting leaderboard must not join automatically');
   }
   // Only an explicit form submission opts the user in; photo is off by default.
   if(signedIn){await page.locator('[name="leaderboard-name"]').fill('Тестовый участник');assert.equal(await page.locator('[name="leaderboard-photo"]').isChecked(),false);await page.locator('[data-leaderboard-save]').click();await page.getByText('Настройки рейтинга сохранены.').waitFor();assert.equal(joins,1);assert.deepEqual(member,{name:'Тестовый участник',showPhoto:false});
    await page.goto(base+'#/');await page.getByRole('link',{name:'Открыть рейтинг'}).click();
    await page.waitForFunction(()=>document.querySelector('[name="leaderboard-name"]')?.value==='Тестовый участник');
    assert.equal(await page.locator('[data-leaderboard-leave]').isVisible(),true);assert.equal(joins,1);
   }
   else{await page.goto(base+'#/');await page.locator('[data-rating-invite] a[href="#/profile"]').click();await page.waitForSelector('[data-password-register]',{state:'attached'});assert.ok(await page.getByText('Создать аккаунт без почты').count());assert.equal(joins,0);
    if(width===390&&theme==='light'){
      await page.goto(base+'#/');const other=await context.newPage();await other.goto(base+'#/');
      await other.evaluate(uid=>localStorage.setItem('medzo-study-sync-session-v1',JSON.stringify({session:'new-session',userId:uid,expiresAt:Math.floor(Date.now()/1000)+3600})),uid);
      await page.locator('[data-rating-invite] [data-if-signed-in]').waitFor({state:'visible'});
      await other.evaluate(()=>localStorage.removeItem('medzo-study-sync-session-v1'));
      await page.locator('[data-rating-invite] [data-if-signed-out]').waitFor({state:'visible'});
      assert.equal(joins,0);await other.close();
    }
   }
   assert.deepEqual(errors,[]);await context.close();console.log(`${width}/${theme}/${signedIn?'signed-in':'guest'}: OK`);
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
