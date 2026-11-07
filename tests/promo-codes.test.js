const test=require('node:test'),assert=require('node:assert/strict'),promo=require('../js/promo-codes');
function game(){const state={appearances:{},coins:123};return {appearances:{default:{},ocean:{title:'Океан'}},profile:()=>state,importAppearances(file){Object.assign(state.appearances,file.sharedRewards.appearances);return {ok:true,message:'Добавлено'};},state};}
const entries=[{code:'MEDZO',appearance:'ocean'}];
test('shared code opens an existing local appearance without touching the wallet',()=>{const g=game();assert.equal(promo.redeem(' medzo ',g,entries).ok,true);assert.equal(g.state.appearances.ocean,true);assert.equal(g.state.coins,123);assert.match(promo.redeem('MEDZO',g,entries).message,/уже открыто/);});
test('unknown, invalid, hidden or unavailable codes cannot unlock arbitrary appearances',()=>{const g=game();assert.equal(promo.redeem('MEDZO',g).ok,false);assert.equal(promo.redeem('bad code!',g,entries).ok,false);assert.equal(promo.redeem('XXX',g,[{code:'XXX',appearance:'meme'}]).ok,false);assert.equal(promo.redeem('XXX',g,[{code:'XXX',appearance:'default'}]).ok,false);assert.deepEqual(g.state.appearances,{});});
test('private promo unlocks all available local appearances only, without modifying the wallet',async()=>{
 const g=game();g.appearances.ruby={title:'Рубин'};g.appearances.meme={title:'hidden'};
 const valid=async()=>Response.json({reward:'all-appearances'});const result=await promo.redeemWithServer('abcd-1234',g,valid);
 assert.equal(result.ok,true);assert.equal(g.state.appearances.ocean,true);assert.equal(g.state.appearances.ruby,true);assert.equal(g.state.appearances.meme,undefined);assert.equal(g.state.coins,123);
 assert.match((await promo.redeemWithServer('abcd-1234',g,valid)).message,/уже открыты/);
});
test('private promo failures never unlock and public codes still work offline',async()=>{
 const g=game();let calls=0;const bad=async()=>{calls++;return Response.json({error:'not_found'},{status:404});};
 assert.equal((await promo.redeemWithServer('wrong',g,bad)).ok,false);assert.equal(calls,1);assert.deepEqual(g.state.appearances,{});
 assert.equal((await promo.redeemWithServer('MEDZO',g,async()=>{throw Error('network');},entries)).ok,true);
 assert.match((await promo.redeemWithServer('wrong',game(),async()=>{throw Error('network');})).message,/интернет/);
});
test('server-verified future code grants durable entitlement even if all current styles are already owned',async()=>{
 const g=game();g.state.appearances.ocean=true;let calls=0;
 g.grantAllFutureAppearances=()=>{calls++;return {ok:true,message:'all future'};};
 assert.equal((await promo.redeemWithServer('ABC12-DEF34',g,async()=>Response.json({reward:'all-appearances-future'}))).ok,true);
 assert.equal(calls,1);assert.equal(g.state.coins,123);
 assert.equal((await promo.redeemWithServer('bad',g,async()=>Response.json({reward:'something-else'}))).ok,false);
 assert.equal(calls,1);
});
