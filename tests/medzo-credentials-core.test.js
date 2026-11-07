const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../supabase/functions/medzo-credentials/core.js');
function harness(){
 const rows=new Map(), identities=new Map(),events=[];let n=0;
 const accounts={reserve:async name=>{events.push('reserve');if(rows.has(name))return null;rows.set(name,{pending:true});return name;},complete:async(name,identity,nickname)=>{events.push('complete');rows.set(name,{id:identity.id,nickname});},release:async name=>{events.push('release');rows.delete(name);},find:async name=>rows.get(name)?.id?rows.get(name):null};
 const provider={create:async ({password,nickname})=>{events.push('create');let id=String(++n);identities.set(id,{password,nickname});return {id};},remove:async id=>{events.push('remove');identities.delete(id);},authenticate:async(account,secret)=>{events.push(account?'auth':'dummy');return account&&identities.get(account.id)?.password===secret?{ok:true,identity:{id:account.id}}:{ok:false};}};
 const limiter={allow:async()=>true};return {accounts,provider,limiter,rows,identities,events,service:C.create({accounts,provider,limiter})};
}
test('validates login, display name, and password without transforming the password',()=>{
 assert.equal(C.username('  Student_42 '),'student_42');for(const s of ['abc','a@b.com','hello world','кириллица','x'.repeat(33)])assert.equal(C.username(s),null);
 assert.equal(C.nickname('  Давид  '),'Давид');assert.equal(C.nickname(''),null);assert.equal(C.nickname('bad\nname'),null);
 assert.equal(C.password('123456789'),false);assert.equal(C.password('1234567890'),true);assert.equal(C.password('я'.repeat(37)),false);assert.equal(C.password('я'.repeat(36)),true);
});
test('requires explicit adapters and limiter; creates unique normalized account',async()=>{
 assert.throws(()=>C.create({}),/missing_adapters/);const h=harness(),input={username:'User_Name',nickname:'Пользователь',password:'password1234'};
 assert.deepEqual(await h.service.register(input,{ip:'test'}),{ok:true});
 assert.deepEqual(await h.service.register({...input,username:'USER_NAME'},{ip:'test'}),{ok:false,error:'username_taken'});
 assert.equal(h.rows.get('user_name').nickname,'Пользователь');assert.equal(h.identities.size,1);
});
test('login authenticates via provider and invokes dummy verification for unknown user',async()=>{
 const h=harness();await h.service.register({username:'student',nickname:'Аня',password:'password1234'},{});
 assert.equal((await h.service.login({username:'STUDENT',password:'password1234'},{})).ok,true);
 const wrong=await h.service.login({username:'student',password:'wrong'},{}),unknown=await h.service.login({username:'nobody',password:'wrong'},{});
 assert.deepEqual(wrong,{ok:false,error:'invalid_credentials'});assert.deepEqual(unknown,wrong);assert.ok(h.events.includes('dummy'));
});
test('limiter blocks before account lookup or password provider',async()=>{
 const h=harness();h.limiter.allow=async()=>false;assert.deepEqual(await h.service.login({username:'student',password:'x'},{}),{ok:false,error:'rate_limited'});assert.deepEqual(await h.service.register({username:'student',nickname:'Test',password:'password1234'},{}),{ok:false,error:'rate_limited'});assert.equal(h.events.length,0);
});
test('failed binding retains reservation and identity for reconciliation',async()=>{
 const h=harness();h.accounts.complete=async()=>{throw Error('database')};
 assert.deepEqual(await h.service.register({username:'student',nickname:'Test',password:'password1234'},{}),{ok:false,error:'unavailable'});
 assert.equal(h.rows.has('student'),true);assert.equal(h.identities.size,1);assert.equal(h.events.includes('release'),false);assert.equal(h.events.includes('remove'),false);
});
test('limiter and database outages fail closed',async()=>{
 const h=harness();h.limiter.allow=async()=>{throw Error('offline')};assert.deepEqual(await h.service.login({username:'student',password:'password1234'},{}),{ok:false,error:'unavailable'});
 h.limiter.allow=async()=>true;h.accounts.reserve=async()=>{throw Error('offline')};assert.deepEqual(await h.service.register({username:'student',nickname:'Test',password:'password1234'},{}),{ok:false,error:'unavailable'});
});
test('identity from provider must match the account being authenticated',async()=>{
 const h=harness();await h.service.register({username:'student',nickname:'Test',password:'password1234'},{});h.provider.authenticate=async()=>({ok:true,identity:{id:'another'}});
 assert.deepEqual(await h.service.login({username:'student',password:'password1234'},{}),{ok:false,error:'invalid_credentials'});
});
