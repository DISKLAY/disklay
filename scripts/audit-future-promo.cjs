/* Browser flow using a mock verifier: activation, reload, a newly added style, and sync restore. */
const {chromium}=require('./audit-browser.cjs');
const assert=require('node:assert/strict');
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:8001/';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try {
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/functions/v1/medzo-promo',r=>r.fulfill({status:200,headers:{'Access-Control-Allow-Origin':'*'},json:{reward:'all-appearances-future'}}));
  await page.goto(base+'#/settings');await page.locator('#promoCode').fill('TEST-CODE');await page.locator('#promoForm button').click();
  await page.waitForFunction(()=>document.querySelector('#promoStatus')?.textContent.includes('будущие'));
  assert.equal(await page.evaluate(()=>AT.game.profile().appearances.__medzo_all_future_v1),true);
  await page.reload();await page.waitForSelector('#promoForm');
  const result=await page.evaluate(()=>{
   AT.game.appearances.future_test={title:'Тест будущего',price:5000};
   const balance=AT.game.walletBalance(),owned=AT.game.profile().appearances.future_test;
   const selected=AT.game.selectAppearance('future_test').ok;
   return {balance,owned,selected,after:AT.game.walletBalance()};
  });
  assert.equal(result.owned,true);assert.equal(result.selected,true);assert.equal(result.balance,result.after);
  const snapshot=await page.evaluate(()=>window.MedzoStudySnapshot.capture(localStorage));
  assert.equal(snapshot.records['anatomy-colloquium-rewards-shared-v1'].appearances.__medzo_all_future_v1,true);
  const other=await browser.newPage();await other.goto(base);await other.evaluate(snapshot=>window.MedzoStudySnapshot.apply(localStorage,snapshot),snapshot);await other.reload();
  await other.waitForFunction(()=>window.AT && AT.game.profile().appearances.__medzo_all_future_v1===true);
  assert.equal(await other.evaluate(()=>{AT.game.appearances.future_test={title:'Тест',price:5000};return AT.game.profile().appearances.future_test}),true);
  assert.deepEqual(errors,[]);await other.close();await page.close();console.log('Activation, future style, reload and snapshot restore: OK');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
