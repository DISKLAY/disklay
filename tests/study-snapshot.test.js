const test=require('node:test'),assert=require('node:assert/strict'),S=require('../js/study-snapshot.js'),server=require('../supabase/functions/medzo-study-sync/index.js');
function storage(seed={}){const data={...seed};return {data,getItem:k=>Object.hasOwn(data,k)?data[k]:null,setItem:(k,v)=>{data[k]=String(v);},removeItem:k=>{delete data[k];}};}
const k='anatomy-colloquium-v1',shared='anatomy-colloquium-rewards-shared-v1';
test('snapshot includes study, account rewards and wallet, but not dungeon, settings or in-progress game',()=>{
 const data={};for(const id of S.modules){const key=id==='1'?k:k+'-'+id;data[key]=JSON.stringify({game:{coins:100,rating:20,verified:3,achievements:{award:42},cosmeticSpentApplied:1,appearanceReceipts:{ocean:true},inventory:{'hint-train':1,other:'private'},dungeon:'private'},settings:{theme:'dark'},session:{id:'local'},progress:{x:{attempts:1}}});}
 data['histology-prototype-v1']=JSON.stringify({stats:{h01:{attempts:1}},favorites:{h01:true},session:{private:'draft'}});data['histology-structures-v1']=JSON.stringify({stats:{x:{attempts:2}}});data['histology-theory-v1']=JSON.stringify({stats:{x:{attempts:2}}});data['anatomy-practical-skills-1-v1']=JSON.stringify({stats:{1:{known:1}},notes:{1:'note'},session:{id:'local'}});
 data['anatomy-dungeon-v1']='secret game';data[shared]=JSON.stringify({achievements:{award:42},appearances:{ocean:true},cosmeticSpent:{'1':1},walletSpent:30,appearance:'ocean',extra:'private'});
 const snap=S.capture(storage(data));assert.equal(snap.schema,2);assert.equal(Object.keys(snap.records).length,16);assert.equal(snap.records[k].game.coins,100);assert.deepEqual(snap.records[k].game.inventory,{'hint-train':1});assert.equal(snap.records[shared].appearances.ocean,true);
 const text=JSON.stringify(snap);assert.ok(!text.includes('draft'));assert.ok(!text.includes('secret game'));assert.ok(!text.includes('private'));assert.ok(!text.includes('local'));assert.ok(S.validate(snap));assert.ok(server.validSnapshot(snap));
});
test('schema 2 restores wallet and rewards without touching dungeon, local fields or ongoing session',()=>{
 const s=storage({[k]:JSON.stringify({game:{coins:123,rating:99,inventory:{'hint-train':4,other:2},unrelated:'kept'},settings:{theme:'dark'},session:{id:'old'},progress:{a:1},comments:{a:'local'}}),[shared]:JSON.stringify({appearances:{ruby:true},walletSpent:33,unknown:'kept'}),'anatomy-dungeon-v1':'unmodified'});
 const incoming={schema:2,records:{[k]:{progress:{b:2},game:{coins:44,rating:8,inventory:{'double-exam':1}}},[shared]:{appearances:{ocean:true},walletSpent:20,appearance:'ocean'}}};
 const result=S.apply(s,incoming),v=JSON.parse(s.data[k]),rewards=JSON.parse(s.data[shared]),backup=JSON.parse(s.data[result.backupKey]);
 assert.deepEqual(v.game,{coins:44,rating:8,inventory:{other:2,'double-exam':1},unrelated:'kept'});assert.deepEqual(v.settings,{theme:'dark'});assert.deepEqual(v.session,{id:'old'});assert.deepEqual(v.progress,{b:2});assert.equal(v.comments,undefined);
 assert.deepEqual(rewards,{unknown:'kept',appearances:{ocean:true},walletSpent:20,appearance:'ocean'});assert.equal(s.data['anatomy-dungeon-v1'],'unmodified');assert.equal(JSON.parse(backup.records[shared]).walletSpent,33);
});
test('old schema 1 cloud and backups restore study but never erase local wallet or rewards',()=>{
 const s=storage({[k]:JSON.stringify({game:{coins:123,rating:5},session:{id:'old'},progress:{old:true}}),[shared]:JSON.stringify({appearances:{ruby:true},walletSpent:33})});
 const incoming={schema:1,records:{[k]:{progress:{old:false}}}};assert.ok(S.validate(incoming));S.apply(s,incoming);
 assert.deepEqual(JSON.parse(s.data[k]).game,{coins:123,rating:5});assert.deepEqual(JSON.parse(s.data[shared]),{appearances:{ruby:true},walletSpent:33});
});
test('schema 2 missing wallet fields replaces them while keeping unrelated local data and backups',()=>{
 const s=storage({[k]:JSON.stringify({game:{coins:50,verified:2,foo:'keep'}}),[shared]:JSON.stringify({appearances:{ruby:true},foo:'keep'})});
 S.apply(s,{schema:2,records:{}});assert.deepEqual(JSON.parse(s.data[k]).game,{foo:'keep'});assert.deepEqual(JSON.parse(s.data[shared]),{foo:'keep'});
});
test('client and server reject invalid formats, foreign reward fields, dungeon data and schema 1 game',()=>{
 for(const bad of [{schema:2,records:{[k]:{game:{dungeon:{level:2}}}}},{schema:2,records:{[k]:{game:{inventory:{dungeon:'x'}}}}},{schema:2,records:{[shared]:{dungeon:{}}}},{schema:1,records:{[k]:{game:{coins:1}}}},{schema:2,records:{'anatomy-dungeon-v1':{level:1}}}]){assert.equal(S.validate(bad),false);assert.equal(server.validSnapshot(bad),false);}
});
test('invalid storage and quota errors do not change existing data',()=>{
 const s=storage({[k]:'{"progress":{"x":1}}'}),before={...s.data};assert.throws(()=>S.apply(s,{schema:1,records:{[k]:{game:{coins:999}}}}));assert.deepEqual(s.data,before);s.setItem=()=>{throw Error('quota')};assert.throws(()=>S.apply(s,{schema:2,records:{[k]:{progress:{x:2}}}}));assert.deepEqual(s.data,before);assert.throws(()=>S.capture(storage({[k]:'bad json'})));
});
test('partial writes roll back, including shared rewards, with a separate recovery backup',()=>{
 const b='histology-theory-v1',s=storage({[k]:'{"progress":{"old":true}}',[b]:'{"stats":{"old":true}}',[shared]:'{"walletSpent":40}'}),base=s.setItem;let failed=false;s.setItem=(key,v)=>{if(key===shared&&!failed){failed=true;throw Error('quota');}base(key,v);};assert.throws(()=>S.apply(s,{schema:2,records:{[k]:{progress:{new:true}},[b]:{stats:{new:true}},[shared]:{walletSpent:50}}}));
 assert.deepEqual(JSON.parse(s.data[k]),{progress:{old:true}});assert.deepEqual(JSON.parse(s.data[b]),{stats:{old:true}});assert.deepEqual(JSON.parse(s.data[shared]),{walletSpent:40});assert.ok(Object.keys(s.data).some(key=>key.startsWith('medzo-study-sync-local-backup-')));
});
test('future-appearance entitlement survives schema-2 capture and restore on another device',()=>{
 const source=storage({[shared]:JSON.stringify({appearances:{__medzo_all_future_v1:true,ocean:true},walletSpent:17,appearance:'ocean'})});
 const snap=S.capture(source);assert.ok(S.validate(snap));assert.ok(server.validSnapshot(snap));
 const destination=storage();S.apply(destination,snap);
 assert.equal(JSON.parse(destination.data[shared]).appearances.__medzo_all_future_v1,true);
 assert.equal(JSON.parse(destination.data[shared]).walletSpent,17);
});

test('экскурсия привязана к браузеру и не входит в облачную копию',()=>{
 const s=storage({'medzo-tour-seen-v1':'1',[k]:JSON.stringify({progress:{a:1}})});
 const snap=S.capture(s);assert.equal(Object.hasOwn(snap.records,'medzo-tour-seen-v1'),false);
 S.apply(s,{schema:2,records:{}});assert.equal(s.getItem('medzo-tour-seen-v1'),'1');
});
