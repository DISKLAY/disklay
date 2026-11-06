const test=require('node:test'),assert=require('node:assert/strict');
const {createHandler}=require('../supabase/functions/medzo-promo/index.js');
const secret='ABCDE-FGHIJ-KLMNO-PQRST';
const handler=createHandler({get:k=>k==='MEDZO_PRIVATE_PROMO'?secret:''});
const req=(body,origin='https://disklay.github.io')=>new Request('https://example.test',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
test('server keeps secret out of response and grants only the correct code',async()=>{
  const invalid=await handler(req({code:'ABCDE-FGHIJ-KLMNO-PQRSU'}));assert.equal(invalid.status,404);assert.doesNotMatch(await invalid.text(),new RegExp(secret));
  const valid=await handler(req({code:' abcde-fghij-klmno-pqrst '}));assert.equal(valid.status,200);assert.deepEqual(await valid.json(),{reward:'all-appearances'});
  assert.equal((await handler(req({code:secret},'https://evil.example'))).status,403);
});
test('verification is unavailable when secret missing; does not grant by default',async()=>{const noSecret=createHandler({get:()=>''});assert.equal((await noSecret(req({code:secret}))).status,503);assert.equal((await handler(new Request('https://example.test',{method:'OPTIONS',headers:{origin:'https://disklay.github.io'}}))).status,204);});
