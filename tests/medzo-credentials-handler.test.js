const test=require('node:test'),assert=require('node:assert/strict');
const Core=require('../supabase/functions/medzo-credentials/core'),Handler=require('../supabase/functions/medzo-credentials/handler');
function harness(){
 const rows=new Map(),creds=new Map(),uuid='01020304-0506-4708-9000-010203040506';
 const accounts={reserve:async(name,nick)=>{if(rows.has(name))return null;let r={name,email:'reserved'};rows.set(name,{pending:true});return r;},complete:async(r,id,nick)=>rows.set(r.name,{id:id.id,accountId:uuid,email:r.email,nickname:nick}),find:async name=>rows.get(name)?.id?rows.get(name):null};
 const provider={create:async({password,email})=>{creds.set('provider-id',password);return {id:'provider-id',email};},authenticate:async(a,pass)=>a&&creds.get(a.id)===pass?{ok:true,identity:{id:a.id}}:{ok:false}};
 const limiter={allow:async()=>true};let issued=[];
 const service=Core.create({accounts,provider,limiter});const handler=Handler.create({service,issueSession:async id=>{issued.push(id);return {session:'signed-test-token',userId:id,expiresAt:2000000000};}});
 async function call(body,origin='https://disklay.github.io'){return handler(new Request('https://edge.test',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)}));}
 return {call,rows,issued,limiter};
}
test('end-to-end registration and login never issue a session without password proof',async()=>{
 const h=harness(),credentials={username:'Test_User',nickname:'Аня',password:'Long Password 42'};
 let r=await h.call({action:'register',...credentials});assert.equal(r.status,200);assert.deepEqual(h.issued,[]);
 r=await h.call({action:'login',username:'test_user',password:'wrong'});assert.equal(r.status,401);assert.deepEqual(h.issued,[]);
 r=await h.call({action:'login',username:'TEST_USER',password:credentials.password});assert.equal(r.status,200);const result=await r.json();assert.equal(result.userId,'p_01020304-0506-4708-9000-010203040506');assert.deepEqual(h.issued,[result.userId]);assert.ok(!JSON.stringify(result).includes(credentials.password));
});
test('duplicate name, rate limits, input validation and untrusted origins fail closed',async()=>{
 const h=harness(),credentials={action:'register',username:'test_user',nickname:'Аня',password:'Long Password 42'};
 assert.equal((await h.call(credentials)).status,200);assert.equal((await h.call(credentials)).status,409);
 assert.equal((await h.call({...credentials,username:'test2',password:'short'})).status,400);
 assert.equal((await h.call(credentials,'https://evil.example')).status,403);
 h.limiter.allow=async()=>false;assert.equal((await h.call({action:'login',username:'test_user',password:'Long Password 42'})).status,429);assert.deepEqual(h.issued,[]);
});
test('client-supplied identity or malformed provider identity cannot select a session user',async()=>{
 const h=harness();await h.call({action:'register',username:'test_user',nickname:'A',password:'Long Password 42'});
 const result=await h.call({action:'login',username:'test_user',password:'Long Password 42',userId:'999'});assert.equal(result.status,200);assert.notEqual(h.issued[0],'999');
 h.rows.get('test_user').accountId='999';assert.equal((await h.call({action:'login',username:'test_user',password:'Long Password 42'})).status,503);assert.equal(h.issued.length,1);
});

test('oversized streaming requests are rejected before authentication',async()=>{
 const h=harness();const response=await h.call({action:'login',username:'student',password:'x'.repeat(5000)});assert.equal(response.status,413);assert.deepEqual(h.issued,[]);
});
