const test=require('node:test'), assert=require('node:assert/strict');
global.crypto=require('node:crypto').webcrypto;
const S=require('../js/study-snapshot'),E=require('../js/study-sync-engine');
const key='anatomy-colloquium-v1';
function storage(seed={}){const data={...seed};return {data,getItem:k=>Object.hasOwn(data,k)?data[k]:null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k]};}
function cloud(){let revision=0,snapshot={schema:1,records:{}};return {request:async body=>{if(body.action==='get')return JSON.parse(JSON.stringify({revision,snapshot}));if(body.revision!==revision)throw Error('conflict');snapshot=JSON.parse(JSON.stringify(body.snapshot));return {revision:++revision};}};}
function save(store,value){store.setItem(key,JSON.stringify({progress:value,game:{coins:100},session:{id:'local'}}));}
test('first contact and independent conflicting changes never overwrite either side',async()=>{const c=cloud(),a=storage(),b=storage();save(a,{a:1});save(b,{b:2});const x=E.makeEngine({store:a,snapshot:S,request:c.request,userId:'1'}), y=E.makeEngine({store:b,snapshot:S,request:c.request,userId:'1'});let plan=await x.inspect();assert.equal(plan.state,'initial');await x.push(plan);plan=await y.inspect();assert.equal(plan.state,'conflict');assert.deepEqual(JSON.parse(b.data[key]).progress,{b:2});assert.deepEqual((await c.request({action:'get'})).snapshot.records[key].progress,{a:1});});
test('known local changes can upload and other device detects remote changes',async()=>{const c=cloud(),a=storage(),b=storage();save(a,{a:1});const x=E.makeEngine({store:a,snapshot:S,request:c.request,userId:'1'}),y=E.makeEngine({store:b,snapshot:S,request:c.request,userId:'1'});await x.push(await x.inspect());await y.pull(await y.inspect());save(a,{a:2});assert.equal((await x.inspect()).state,'local-changed');await x.push(await x.inspect());assert.equal((await y.inspect()).state,'remote-changed');save(b,{b:3});assert.equal((await y.inspect()).state,'conflict');});
test('stale choices are refused and cloud download retains a backup and local game',async()=>{const c=cloud(),a=storage(),b=storage();save(a,{cloud:true});save(b,{local:true});const x=E.makeEngine({store:a,snapshot:S,request:c.request,userId:'1'}),y=E.makeEngine({store:b,snapshot:S,request:c.request,userId:'1'});await x.push(await x.inspect());const old=await y.inspect();save(b,{local:'changed'});await assert.rejects(y.pull(old),/changed/);const result=await y.pull(await y.inspect());assert.ok(b.data[result.backup.backupKey]);assert.deepEqual(JSON.parse(b.data[key]).progress,{cloud:true});assert.equal(JSON.parse(b.data[key]).game.coins,100);assert.equal(JSON.parse(b.data[key]).session.id,'local');});
test('baseline belongs to one user and metadata alone does not authorize a write',async()=>{const c=cloud(),s=storage();save(s,{a:1});const x=E.makeEngine({store:s,snapshot:S,request:c.request,userId:'1'});await x.push(await x.inspect());save(s,{changed:true});const y=E.makeEngine({store:s,snapshot:S,request:c.request,userId:'2'});assert.equal((await y.inspect()).state,'conflict');});
test('wallet and cosmetics conflict on two devices until the user selects a version',async()=>{
 const c=cloud(),a=storage(),b=storage(),r='anatomy-colloquium-rewards-shared-v1';
 a.setItem(key,JSON.stringify({progress:{a:1},game:{coins:800,rating:10}}));a.setItem(r,JSON.stringify({walletSpent:500,appearances:{ocean:true}}));
 b.setItem(key,JSON.stringify({progress:{b:2},game:{coins:1000,rating:5}}));b.setItem(r,JSON.stringify({walletSpent:800,appearances:{ruby:true}}));
 const x=E.makeEngine({store:a,snapshot:S,request:c.request,userId:'1'}),y=E.makeEngine({store:b,snapshot:S,request:c.request,userId:'1'});
 await x.push(await x.inspect());let plan=await y.inspect();assert.equal(plan.state,'conflict');assert.equal(JSON.parse(b.data[r]).appearances.ruby,true);
 const {backup}=await y.pull(plan);assert.equal(JSON.parse(b.data[r]).appearances.ocean,true);assert.equal(JSON.parse(b.data[backup.backupKey]).records[r],'{"walletSpent":800,"appearances":{"ruby":true}}');
});
test('pending local edits flushed immediately before pull prevent overwrite',async()=>{
 const c=cloud(),a=storage(),b=storage();save(a,{cloud:true});save(b,{local:true});
 const x=E.makeEngine({store:a,snapshot:S,request:c.request,userId:'1'}),y=E.makeEngine({store:b,snapshot:S,request:c.request,userId:'1'});
 await x.push(await x.inspect());const plan=await y.inspect();
 await assert.rejects(y.pull(plan,()=>{save(b,{pending:'new'});return true;}),/changed/);
 assert.deepEqual(JSON.parse(b.data[key]).progress,{pending:'new'});
 assert.equal(Object.keys(b.data).filter(x=>x.startsWith('medzo-study-sync-local-backup-')).length,0);
});
test('pending local edits flushed just before push do not send an obsolete snapshot',async()=>{
 const c=cloud(),s=storage();save(s,{initial:true});const engine=E.makeEngine({store:s,snapshot:S,request:c.request,userId:'1'});
 const plan=await engine.inspect();await assert.rejects(engine.push(plan,()=>{save(s,{new:true});return true;}),/changed/);
 assert.equal((await c.request({action:'get'})).revision,0);assert.deepEqual(JSON.parse(s.data[key]).progress,{new:true});
});
test('account switch while a cloud request is in flight cannot alter metadata or local data',async()=>{
 let active=true,release;const s=storage(),block=new Promise(r=>release=r);save(s,{x:1});
 const request=async()=>{await block;return {revision:1,snapshot:S.capture(s)}};
 const engine=E.makeEngine({store:s,snapshot:S,request,userId:'1',isActive:()=>active});
 const inflight=engine.inspect();active=false;release();await assert.rejects(inflight,/changed/);
 assert.equal(s.getItem(E.META),null);assert.deepEqual(JSON.parse(s.data[key]).progress,{x:1});
});
test('automatic cloud loads retain the local backup and do not touch local session or dungeon',async()=>{
 const c=cloud(),a=storage(),b=storage({'anatomy-dungeon-v1':'keep'});save(a,{cloud:true});save(b,{local:true});
 const x=E.makeEngine({store:a,snapshot:S,request:c.request,userId:'1'}),y=E.makeEngine({store:b,snapshot:S,request:c.request,userId:'1'});
 await x.push(await x.inspect());const p=await y.inspect();assert.equal(p.hasBaseline,false);
 const result=await y.pull(p,async()=>true);assert.ok(b.data[result.backup.backupKey]);assert.equal(b.data['anatomy-dungeon-v1'],'keep');assert.equal(JSON.parse(b.data[key]).session.id,'local');
});
test('background restore removes temporary backup only after metadata is saved',async()=>{
 const c=cloud(),a=storage(),b=storage();save(a,{cloud:true});save(b,{local:true});
 const x=E.makeEngine({store:a,snapshot:S,request:c.request,userId:'1'}),y=E.makeEngine({store:b,snapshot:S,request:c.request,userId:'1'});
 await x.push(await x.inspect());const result=await y.pull(await y.inspect(),()=>true,{ephemeralBackup:true});
 assert.equal(result.metaSaved,true);assert.equal(b.getItem(result.backup.backupKey),null);
});
test('background restore keeps its backup if the metadata write fails',async()=>{
 const c=cloud(),a=storage(),b=storage();save(a,{cloud:true});save(b,{local:true});
 const x=E.makeEngine({store:a,snapshot:S,request:c.request,userId:'1'}),y=E.makeEngine({store:b,snapshot:S,request:c.request,userId:'1'});
 await x.push(await x.inspect());const p=await y.inspect(),write=b.setItem;
 b.setItem=(k,v)=>{if(k===E.META)throw Error('quota');write(k,v);};
 const result=await y.pull(p,()=>true,{ephemeralBackup:true});assert.equal(result.metaSaved,false);assert.ok(b.getItem(result.backup.backupKey));
});
