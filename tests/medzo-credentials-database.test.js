const test=require('node:test'),assert=require('node:assert/strict');
const Core=require('../supabase/functions/medzo-credentials/core'),Database=require('../supabase/functions/medzo-credentials/database'),GoTrue=require('../supabase/functions/medzo-credentials/gotrue');
test('real adapters carry the reserved identifier through provider creation without storing the password in the database',async()=>{
 const calls=[],email='12345678-1234-1234-1234-123456789abc@accounts.medzo.invalid';
 const fetchFn=async(url,options)=>{calls.push({url,options});const path=url.split('/').at(-1);let result;
  if(path==='medzo_password_allow')result=true;
  else if(path==='medzo_password_reserve')result={reservation:'reservation',email};
  else if(path==='users')result={id:'provider'};
  else if(path==='medzo_password_complete')result=true;
  else throw Error('unexpected '+url);
  return new Response(JSON.stringify(result));
 };
 const {accounts,limiter}=Database.create({base:'https://project.test',serviceKey:'service-secret',fetchFn});
 const provider=GoTrue.create({base:'https://project.test',serviceKey:'service-secret',fetchFn});
 const service=Core.create({accounts,limiter,provider});
 assert.deepEqual(await service.register({username:'Student',nickname:'Аня',password:'Strong Password 42'},{}),{ok:true});
 const dbBodies=calls.filter(c=>c.url.includes('/rest/v1/')).map(c=>c.options.body||'').join('');
 assert.ok(!dbBodies.includes('Strong Password'));assert.ok(!dbBodies.includes('provider-secret'));assert.equal(JSON.parse(calls.find(c=>c.url.includes('/auth/v1/admin/users')).options.body).email,email);
});
test('database adapter fails closed and rejects provider identity mismatch',async()=>{
 const db=Database.create({base:'https://project.test',serviceKey:'private',fetchFn:async()=>new Response('{}',{status:500})});
 await assert.rejects(()=>db.accounts.reserve('student','A'),/database_unavailable/);await assert.rejects(()=>db.limiter.allow('login','student'),/database_unavailable/);
 await assert.rejects(()=>db.accounts.complete({reservation:'r',email:'a'}, {id:'u',email:'b'}),/identity_mismatch/);
});
test('account lookup uses only active normalized name and returns no password',async()=>{
 let seen='';const db=Database.create({base:'https://project.test',serviceKey:'private',fetchFn:async(url)=>{seen=url;return new Response(JSON.stringify([{provider_id:'auth-id',account_id:'account-id',internal_email:'random@accounts.medzo.invalid'}]));}});
 assert.deepEqual(await db.accounts.find('student'),{id:'auth-id',accountId:'account-id',email:'random@accounts.medzo.invalid'});assert.match(seen,/state=eq.active/);
});
