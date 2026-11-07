const test=require('node:test'),assert=require('node:assert/strict');global.crypto=require('node:crypto').webcrypto;
const Session=require('../supabase/functions/medzo-credentials/session'),sync=require('../supabase/functions/medzo-study-sync/index');
test('password sessions are signed, hashed at rest, revocable and scoped to server-selected account',async()=>{
 let saved;const key='test-key',clock=()=>1700000000;
 const issue=Session.create({clock,persist:async row=>{saved=row;},sign:data=>sync.signObject(data,key)});
 const id='p_01020304-0506-4708-9000-010203040506',response=await issue(id);
 const payload=await sync.verifyObject(response.session,key,'session',clock());
 assert.equal(payload.id,id);assert.equal(response.expiresAt,clock()+90*86400);assert.equal(saved.user_id,id);assert.match(saved.session_hash,/^[0-9a-f]{64}$/);assert.notEqual(saved.session_hash,payload.sid);
});
test('invalid IDs and database failures never return a session',async()=>{
 let signed=0;const issue=Session.create({persist:async()=>{throw Error('database')},sign:async()=>{signed++;return 'token';}});
 await assert.rejects(()=>issue('123'),/invalid_identity/);await assert.rejects(()=>issue('p_01020304-0506-4708-9000-010203040506'),/database/);assert.equal(signed,0);
});
