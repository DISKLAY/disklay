const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const code=fs.readFileSync(require.resolve('../js/study-sync.js'),'utf8');
function storage(){const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};}
function open(local,session){
  let click;const events={},calls=[];
  const actions={innerHTML:'',querySelectorAll:()=>[]},status={textContent:''};
  const node={isConnected:true,querySelector:s=>s.includes('status')?status:actions,closest:()=>null,addEventListener:(event,fn)=>{if(event==='click')click=fn;}};
  const win={MedzoStudySnapshot:{},MedzoSyncEngine:{makeEngine:()=>({inspect:async()=>({state:'equal'})})},AT:{onCleanup:()=>{}},addEventListener:(name,fn)=>events[name]=fn};
  const ctx={window:win,document:{hidden:false,head:{appendChild:()=>{}},createElement:()=>({})},localStorage:local,sessionStorage:session,Date,JSON,Promise,setInterval:()=>{},fetch:async(url,options)=>{calls.push(JSON.parse(options.body).action);return {ok:true,json:async()=>({ok:true})};}};
  vm.runInNewContext(code,ctx);win.MedzoStudySync.mount(node);
  return {calls,status,click:action=>click({target:{closest:()=>({dataset:{sync:action}})}}),events};
}
test('session survives browser reopening and logout clears persistent sign-in',async()=>{
  const local=storage(), session=storage(),key='medzo-study-sync-session-v1';
  local.setItem(key,JSON.stringify({session:'token',userId:'123',expiresAt:Math.floor(Date.now()/1000)+3600}));
  open(local,session);const reopened=open(local,storage());
  assert.match(reopened.status.textContent,/Проверяем|Проверить|совпадают/);
  await new Promise(resolve=>setImmediate(resolve));
  reopened.click('logout');await new Promise(resolve=>setImmediate(resolve));
  assert.ok(reopened.calls.includes('logout'));assert.equal(local.getItem(key),null);assert.match(reopened.status.textContent,/Вы вышли/);
});
test('existing tab session is migrated to persistent storage',()=>{
  const local=storage(),session=storage(),key='medzo-study-sync-session-v1';
  session.setItem(key,JSON.stringify({session:'old',userId:'123',expiresAt:Math.floor(Date.now()/1000)+3600}));
  open(local,session);assert.ok(local.getItem(key));assert.equal(session.getItem(key),null);
});
