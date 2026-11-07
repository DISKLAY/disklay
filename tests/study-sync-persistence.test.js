const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const code=fs.readFileSync(require.resolve('../js/study-sync.js'),'utf8'),key='medzo-study-sync-session-v1';
function storage(){const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};}
function token(id='123'){return {session:'token-'+id,userId:id,expiresAt:Math.floor(Date.now()/1000)+3600};}
function open(local,session,{mini=false}={}){
  const events={},calls=[],handlers={};
  const actions={innerHTML:'',querySelectorAll:()=>[]},status={textContent:''},account={hidden:true,textContent:''},checkbox={checked:true};
  const view={isConnected:true,querySelectorAll:()=>[]};
  const node={isConnected:true,querySelector:s=>s.includes('status')?status:s.includes('account')?account:s.includes('remember')?checkbox:actions,closest:()=>view,addEventListener:(name,fn)=>handlers[name]=fn};
  const win={MedzoTelegramLaunch:mini,Telegram:mini?{WebApp:{initData:'signed',ready(){},expand(){}}}:undefined,MedzoStudySnapshot:{},MedzoSyncEngine:{makeEngine:()=>({inspect:async()=>({state:'equal'})})},AT:{onCleanup:()=>{}},addEventListener:(name,fn)=>events[name]=fn};
  const doc={hidden:false,documentElement:{classList:{add(){}}},head:{appendChild:el=>{if(el.onload)el.onload();}},createElement:()=>({})};
  const ctx={window:win,document:doc,localStorage:local,sessionStorage:session,Date,JSON,Promise,setInterval:()=>{},setTimeout:()=>1,clearTimeout:()=>{},fetch:async(url,options)=>{let body=JSON.parse(options.body);calls.push(body.action);return {ok:true,json:async()=>body.action==='login'?token():{ok:true}};}};
  vm.runInNewContext(code,ctx);win.MedzoStudySync.mount(node);
  return {calls,status,account,checkbox,events,click:action=>handlers.click({target:{closest:()=>({dataset:{sync:action}})}}),remember:value=>{checkbox.checked=value;handlers.change({target:{checked:value,matches:s=>s==='[data-sync-remember]'}});},api:win.MedzoStudySync};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('remembered session survives a new browser session and logout revokes it',async()=>{
  const local=storage(), session=storage();local.setItem(key,JSON.stringify(token()));
  open(local,session);const reopened=open(local,storage());assert.equal(reopened.account.hidden,false);
  await tick();reopened.click('logout');await tick();
  assert.ok(reopened.calls.includes('logout'));assert.equal(local.getItem(key),null);assert.match(reopened.status.textContent,/Вы вышли/);
});
test('tab-only session survives reload but is not migrated or restored in a new tab',()=>{
  const local=storage(),session=storage();session.setItem(key,JSON.stringify(token()));
  const reload=open(local,session);assert.equal(reload.account.hidden,false);assert.equal(local.getItem(key),null);assert.ok(session.getItem(key));
  const freshTab=open(local,storage());assert.equal(freshTab.account.hidden,true);
});
test('Telegram Mini App login respects the remember choice',async()=>{
  for(const remembered of [true,false]){
    const local=storage(),session=storage(),page=open(local,session,{mini:true});await tick();page.remember(remembered);page.click('login');await tick();await tick();
    assert.ok(page.calls.includes('login'));assert.equal(page.account.hidden,false);
    assert.equal(!!local.getItem(key),remembered);assert.equal(!!session.getItem(key),!remembered);
    const reload=open(local,session);assert.equal(reload.account.hidden,false);
    const fresh=open(local,storage());assert.equal(fresh.account.hidden,!remembered);
    await tick();reload.click('logout');await tick();assert.equal(local.getItem(key),null);assert.equal(session.getItem(key),null);
  }
});
test('tab-only auth is not replaced or cleared by another tab changing remembered login',()=>{
  const local=storage(),session=storage();session.setItem(key,JSON.stringify(token('123')));
  const page=open(local,session);page.events.storage({key,storageArea:local,newValue:JSON.stringify(token('456'))});assert.equal(page.account.hidden,false);assert.match(session.getItem(key),/token-123/);
  page.events.storage({key,storageArea:local,newValue:null});assert.equal(page.account.hidden,false);assert.ok(session.getItem(key));
});
test('remembered cross-tab logout clears only the matching remembered session',()=>{
  const local=storage(),session=storage();local.setItem(key,JSON.stringify(token()));const page=open(local,session);
  page.events.storage({key,storageArea:local,newValue:null});assert.equal(page.account.hidden,true);assert.match(page.status.textContent,/другой вкладке/);
});
