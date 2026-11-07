const test=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../supabase/functions/medzo-credentials/gotrue.js');
test('provider creates a random internal identifier and never returns credentials',async()=>{
 let request;const p=create({base:'https://project.test',serviceKey:'private',randomUUID:()=> '42-opaque',fetchFn:async(url,options)=>{request={url,options};return new Response(JSON.stringify({id:'id-1'}),{status:200});}});
 const user=await p.create({password:'very-secure-password',nickname:'Аня'});
 assert.deepEqual(user,{id:'id-1',email:'42-opaque@accounts.medzo.invalid'});assert.equal(request.options.headers.Authorization,'Bearer private');
 assert.deepEqual(JSON.parse(request.options.body),{email:user.email,password:'very-secure-password',email_confirm:true,user_metadata:{display_name:'Аня'}});assert.ok(!JSON.stringify(user).includes('password'));
});
test('provider checks identity and keeps provider access and refresh tokens server-side',async()=>{
 let calls=[];const p=create({base:'https://project.test',serviceKey:'private',fetchFn:async(url,options)=>{calls.push(JSON.parse(options.body));return new Response(JSON.stringify({user:{id:'id-1'},access_token:'secret-access',refresh_token:'secret-refresh'}));}});
 assert.deepEqual(await p.authenticate({id:'id-1',email:'x@accounts.medzo.invalid'},'pass'),{ok:true,identity:{id:'id-1'}});
 assert.deepEqual(await p.authenticate({id:'id-2',email:'x@accounts.medzo.invalid'},'pass'),{ok:false});
 assert.deepEqual(await p.authenticate(null,'pass'),{ok:false});assert.equal(calls[2].email,'unknown-account@accounts.medzo.invalid');
});
test('provider distinguishes bad credentials from unavailable or rate-limited auth',async()=>{
 for(const [status,expected] of [[400,'bad'],[429,'unavailable'],[500,'unavailable']]){
  const p=create({base:'https://project.test',serviceKey:'private',fetchFn:async()=>new Response('{}',{status})});
  if(expected==='bad')assert.deepEqual(await p.authenticate(null,'wrong'),{ok:false});else await assert.rejects(()=>p.authenticate(null,'wrong'),/provider_unavailable/);
 }
});
