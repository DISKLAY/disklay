const test=require('node:test'),assert=require('node:assert/strict');global.crypto=require('node:crypto').webcrypto;
const Sync=require('../supabase/functions/medzo-study-sync/index'),Core=require('../supabase/functions/medzo-credentials/core'),Database=require('../supabase/functions/medzo-credentials/database'),GoTrue=require('../supabase/functions/medzo-credentials/gotrue'),PasswordSession=require('../supabase/functions/medzo-credentials/session'),CredentialHandler=require('../supabase/functions/medzo-credentials/handler'),Endpoint=require('../supabase/functions/medzo-credentials/index');
function harness(){
 const records=new Map(),credentials=new Map(),sessions=new Map(),snapshots=new Map(),id='12345678-1234-4234-8234-123456789abc';let n=0;
 const env={get:k=>({TELEGRAM_BOT_TOKEN:'12345:secret',SUPABASE_SERVICE_ROLE_KEY:'server-key',SUPABASE_URL:'https://internal.test'})[k]};
 const ok=x=>new Response(JSON.stringify(x),{status:200});
 const fetchFn=async(url,opts={})=>{
  let u=new URL(url),p=u.pathname,body=opts.body&&JSON.parse(opts.body),q=u.searchParams;
  if(p.endsWith('/medzo_password_allow'))return ok(true);
  if(p.endsWith('/medzo_password_reserve')){if(records.has(body.p_username))return ok(null);let row={username:body.p_username,account_id:id,internal_email:id+'@accounts.medzo.invalid',display_name:body.p_name,state:'pending'};records.set(row.username,row);return ok({reservation:'res',email:row.internal_email});}
  if(p.endsWith('/medzo_password_complete')){let row=[...records.values()][0];row.provider_id=body.p_provider_id;row.state='active';return ok(true);}
  if(p.endsWith('/medzo_password_accounts')){let r=q.has('username')?records.get(q.get('username').slice(3)):[...records.values()].find(x=>x.account_id===q.get('account_id')?.slice(3));return ok(r&&r.state==='active'?[r]:[]);}
  if(p.endsWith('/auth/v1/admin/users')){let pid='provider-'+(++n);credentials.set(body.email,{id:pid,password:body.password});return ok({id:pid});}
  if(p.endsWith('/auth/v1/token')){const c=credentials.get(body.email);return c&&c.password===body.password?ok({user:{id:c.id}}):new Response('{}',{status:400});}
  if(p.endsWith('/medzo_study_sessions')){
   if(opts.method==='POST'){sessions.set(body.session_hash,body);return ok([body]);}
   const hash=q.get('session_hash')?.slice(3),r=sessions.get(hash);if(opts.method==='DELETE'){sessions.delete(hash);return ok(r?[r]:[]);}return ok(r&&r.user_id===q.get('user_id')?.slice(3)?[r]:[]);
  }
  if(p.endsWith('/medzo_study_sync_put')){let old=snapshots.get(body.p_user_id)||{revision:0};if(old.revision!==body.p_expected)return ok({conflict:true,revision:old.revision});let row={revision:old.revision+1,snapshot:body.p_snapshot,updated_at:'today'};snapshots.set(body.p_user_id,row);return ok({conflict:false,revision:row.revision,updatedAt:row.updated_at});}
  if(p.endsWith('/medzo_study_sync')){let r=snapshots.get(q.get('user_id')?.slice(3));return ok(r?[r]:[]);}
  throw Error('Unexpected endpoint '+url);
 };
 const handle=Endpoint.create({Core,Database,GoTrue,PasswordSession,CredentialHandler,Sync},env,fetchFn);
 const call=(data,token,origin='https://disklay.github.io')=>handle(new Request('https://edge.test',{method:'POST',headers:{'Content-Type':'application/json',origin,...token?{Authorization:'Bearer '+token}:{}},body:JSON.stringify(data)}));
 return {call,sessions,records,snapshots};
}
test('full password endpoint: register, authenticate, identify, sync, conflicts and revoke',async()=>{
 const h=harness(),creds={username:'student',nickname:'Студент',password:'Password12345'};
 assert.equal((await h.call({action:'register',...creds})).status,200);
 assert.equal((await h.call({action:'login',username:creds.username,password:'wrong'})).status,401);
 let r=await h.call({action:'login',...creds});assert.equal(r.status,200);let result=await r.json(),token=result.session;
 assert.equal(result.userId,'p_12345678-1234-4234-8234-123456789abc');assert.equal(h.sessions.size,1);
 r=await h.call({action:'account-get'},token);assert.deepEqual(await r.json(),{username:'student',displayName:'Студент'});
 r=await h.call({action:'get'},token);assert.equal((await r.json()).revision,0);
 r=await h.call({action:'put',revision:0,snapshot:{schema:2,records:{}}},token);assert.equal((await r.json()).revision,1);
 assert.equal((await h.call({action:'put',revision:0,snapshot:{schema:2,records:{}}},token)).status,409);
 assert.equal((await h.call({action:'put',revision:1,snapshot:{schema:2,records:{'dungeon':{}}}},token)).status,400);
 assert.equal((await h.call({action:'logout'},token)).status,200);assert.equal((await h.call({action:'get'},token)).status,401);
});
test('does not trust client user IDs, unsigned requests or unrelated origins',async()=>{
 const h=harness();assert.equal((await h.call({action:'get',userId:'123'})).status,401);assert.equal((await h.call({action:'register',username:'student',nickname:'A',password:'Password12345'},null,'https://evil.test')).status,403);assert.equal(h.records.size,0);
});
test('CORS preflight allows the authorization header for sync requests',async()=>{
 const h=harness();const request=new Request('https://edge.test',{method:'OPTIONS',headers:{origin:'https://disklay.github.io','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}});
 const env={get:k=>({TELEGRAM_BOT_TOKEN:'12345:secret',SUPABASE_SERVICE_ROLE_KEY:'server-key',SUPABASE_URL:'https://internal.test'})[k]};
 const response=await Endpoint.create({Core,Database,GoTrue,PasswordSession,CredentialHandler,Sync},env,()=>{throw Error('unexpected')})(request);
 assert.equal(response.status,204);assert.match(response.headers.get('Access-Control-Allow-Headers'),/authorization/);
});
