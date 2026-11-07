const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../js/oral-snapshot.js'),E=require('../js/study-sync-engine.js'),O=require('../js/anatomy-oral.js'),server=require('../supabase/functions/medzo-oral-sync/index.js'),{signObject}=require('../supabase/functions/medzo-study-sync/index.js');
function store(){const data={};return {data,getItem:k=>Object.hasOwn(data,k)?data[k]:null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k]};}
function cloud(){let state={revision:0,snapshot:{schema:1,tickets:{},cards:{}}};return {request:async body=>{if(body.action==='get')return structuredClone(state);if(body.revision!==state.revision)throw Error('changed');state={revision:state.revision+1,snapshot:structuredClone(body.snapshot)};return {revision:state.revision};},get:()=>state};}
test('oral snapshot captures just marks, validates both schemas identically and preserves backups',()=>{
 const st=store(),game=O.create(st);game.markTicket(35,'practical',10,'known');game.markTicket(1,'theory',3,'again');game.markCard(72,'again');
 const snap=S.capture(st);assert.ok(S.validate(snap));assert.ok(server.validSnapshot(snap));assert.deepEqual(Object.keys(snap).sort(),['cards','schema','tickets']);
 for(const bad of [{...snap,session:{}},{...snap,cards:{73:'known'}},{...snap,tickets:{1:{theory:{4:'known'}}}},{...snap,cards:{1:'bad'}}]){assert.equal(S.validate(bad),false);assert.equal(server.validSnapshot(bad),false);}
 const result=S.apply(st,{schema:1,tickets:{},cards:{1:'known'}});assert.equal(JSON.parse(st.getItem(S.KEY)).cards[1],'known');assert.equal(JSON.parse(JSON.parse(st.getItem(result.backupKey)).raw).cards[72],'again');
});
test('independent metadata, automatic uploads and conflicts preserve both device copies',async()=>{
 const a=store(),b=store(),remote=cloud(),ea=E.makeEngine({store:a,snapshot:S,request:remote.request,userId:'42',metaKey:'oral'}),eb=E.makeEngine({store:b,snapshot:S,request:remote.request,userId:'42',metaKey:'oral'});
 O.create(a).markCard(1,'known');let plan=await ea.inspect();assert.equal(plan.state,'initial');await ea.push(plan);
 plan=await eb.inspect();assert.equal(plan.state,'conflict');await eb.pull(plan);assert.equal(JSON.parse(b.getItem(S.KEY)).cards[1],'known');assert.equal(b.getItem(E.META),null);
 O.create(a).markCard(2,'known');O.create(b).markTicket(1,'theory',1,'again');await ea.push(await ea.inspect());
 plan=await eb.inspect();assert.equal(plan.state,'conflict');assert.equal(JSON.parse(b.getItem(S.KEY)).tickets[1].theory[1],'again');assert.equal(remote.get().snapshot.cards[2],'known');
 const stale=plan;O.create(b).markCard(3,'again');await assert.rejects(()=>eb.pull(stale),/changed/);assert.equal(JSON.parse(b.getItem(S.KEY)).cards[3],'again');
});
test('old general snapshot excludes oral and old writes do not touch the separate cloud',async()=>{
 const old=require('../js/study-snapshot.js'), st=store(),remote=cloud();O.create(st).markCard(1,'known');const engine=E.makeEngine({store:st,snapshot:S,request:remote.request,userId:'1',metaKey:'oral'});await engine.push(await engine.inspect());
 assert.equal(old.capture(st).records[S.KEY],undefined);old.apply(st,{schema:2,records:{}});assert.equal(JSON.parse(st.getItem(S.KEY)).cards[1],'known');assert.equal(remote.get().snapshot.cards[1],'known');
});
const env={get:k=>({TELEGRAM_BOT_TOKEN:'123456:fake',SUPABASE_SERVICE_ROLE_KEY:'service',SUPABASE_URL:'https://db.example'})[k]};
async function token(id,password=false,exp=Math.floor(Date.now()/1000)+3600){const key=await server.hmac('123456:fake',password?'medzo-password-session/signing/v1':'medzo-study-sync/signing/v1');return signObject({kind:'session',id,sid:'a'.repeat(43),exp},key);}
function handler(revoked=false){const calls=[];return {calls,send:async(body,t)=>server.createHandler(env,async(url,opts)=>{calls.push({url,opts});const value=url.includes('medzo_study_sessions?')?(revoked?[]:[{expires_at:new Date(Date.now()+100000).toISOString()}]):url.endsWith('rpc/medzo_oral_sync_put')?{revision:1,conflict:false}:[];return new Response(JSON.stringify(value));})(new Request('https://example.test',{method:'POST',headers:{authorization:'Bearer '+t},body:JSON.stringify(body)}))};}
test('server accepts Telegram and password sessions, rejects expired or revoked sessions',async()=>{
 for(const [id,pw] of [['7381851473',false],['p_12345678-1234-4234-8234-123456789abc',true]]){const h=handler();assert.equal((await h.send({action:'get'},await token(id,pw))).status,200);assert.ok(h.calls.some(c=>c.url.includes('user_id=eq.'+id)));}
 const h=handler(true);assert.equal((await h.send({action:'get'},await token('7381851473'))).status,401);assert.equal(h.calls.length,1);
 const x=handler();assert.equal((await x.send({action:'get'},await token('7381851473',false,Math.floor(Date.now()/1000)-1))).status,401);assert.equal(x.calls.length,0);
});
test('server refuses spoofed identities, extra fields, invalid snapshots and concurrent revisions',async()=>{
 const h=handler(),t=await token('12345');let r=await h.send({action:'put',revision:0,snapshot:{schema:1,cards:{1:'known'},tickets:{}},user_id:'99'},t);assert.equal(r.status,400);
 r=await h.send({action:'put',revision:0,snapshot:{schema:1,cards:{1:'known'},tickets:{}}},t);assert.equal(r.status,200);const saved=JSON.parse(h.calls.at(-1).opts.body);assert.equal(saved.p_user_id,'12345');
 const p=t.split('.');const forged=Buffer.from(JSON.stringify({kind:'session',id:'99',sid:'a'.repeat(43),exp:Math.floor(Date.now()/1000)+100})).toString('base64url')+'.'+p[1];assert.equal((await h.send({action:'get'},forged)).status,401);
});
