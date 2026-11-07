const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
function load(storage={},rng=()=>.42){const c=vm.createContext({window:{}});for(const f of ['anatomy-skills-data.js','anatomy-skills.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',f),'utf8'),c);const H=c.window.AnatomySkills;const store={getItem:k=>storage[k]||null,setItem:(k,v)=>{storage[k]=v;}};return {H,game:H.create(store,rng),store,storage};}
test('полный список из PDF, последовательные номера и подсказки по анатомическим областям',()=>{
 const {H}=load();assert.equal(H.data.items.length,330);assert.deepEqual(Array.from(H.data.items.map(x=>x.id)),Array.from({length:330},(_,i)=>i+1));assert.equal(H.data.groups.length,12);
 for(const item of H.data.items){assert.ok(item.latin&&item.hint&&H.data.groups.some(x=>x.id===item.group));assert.ok(item.page>=1&&item.page<=9);}
 assert.equal(H.byId[1].latin,'Corpus vertebrae');assert.equal(H.byId[198].latin,'Fossa glandulae lacrimalis');assert.equal(H.byId[306].latin,'Conjugata anatomica');assert.equal(H.byId[325].latin,'Art. tarsi transversa');assert.match(H.byId[227].hint,/Нижняя челюсть/);assert.match(H.byId[74].hint,/Локтевая кость/);
});
test('случайная подборка по 10, без повторов и без привязки к фиксированным билетам',()=>{
 const {game,H}=load();assert.equal(game.start(),true);assert.equal(game.state.session.order.length,10);assert.equal(new Set(game.state.session.order).size,10);assert.ok(game.state.session.order.every(id=>H.byId[id]));
 game.setOptions('skull','all',0);assert.equal(game.start(),true);assert.ok(game.state.session.order.every(id=>H.byId[id].group==='skull'));assert.equal(game.state.session.order.length,game.pool().length);
});
test('самооценка, исправление оценки, фильтры, пропуск и сохранение не меняют анатомию',()=>{
 const data={'anatomy-colloquium-v1':'sentinel'}, {game,H}=load(data);game.start();const id=game.current().id;
 game.hint();game.favorite(id);game.note(id,'своя заметка');assert.ok(game.mark('again'));assert.equal(game.state.stats[id].attempts,1);assert.equal(game.mark('again'),true);assert.equal(game.state.stats[id].attempts,1);
 game.mark('known');assert.equal(game.state.stats[id].known,1);assert.equal(game.state.stats[id].last,'known');game.mark('again');assert.equal(game.state.stats[id].known,0);
 assert.equal(game.navigate(1),true);let restored=load(data).game;assert.notEqual(restored.current().id,id);assert.equal(restored.navigate(-1),true);assert.equal(restored.current().id,id);assert.equal(restored.state.session.hints[id],true);assert.equal(restored.state.notes[id],'своя заметка');assert.equal(restored.state.favorites[id],true);
 restored.setOptions('all','again',10);assert.deepEqual(Array.from(restored.pool().map(x=>x.id)),[id]);restored.setOptions('all','favorites',10);assert.deepEqual(Array.from(restored.pool().map(x=>x.id)),[id]);restored.setOptions('all','unseen',10);assert.equal(restored.pool().length,329);assert.equal(restored.finish(),true);assert.equal(restored.mark('known'),false);assert.equal(restored.resume(),true);restored.reset();assert.equal(restored.state.stats[id],undefined);assert.equal(restored.state.favorites[id],true);assert.equal(restored.state.notes[id],'своя заметка');assert.equal(data['anatomy-colloquium-v1'],'sentinel');assert.ok(data[H.KEY]);
});
test('пустой фильтр и повреждённые или недоступные данные безопасны',()=>{
 const {H,game}=load();game.setOptions('all','favorites',10);assert.equal(game.start(),false);assert.equal(game.state.session,null);assert.equal(game.startSection("unknown"),false);
 let bad=H.create({getItem:()=>'{',setItem(){throw Error('storage');}},()=>.5);assert.ok(bad.start());assert.equal(bad.storageFailed(),true);
 bad=H.create({getItem:()=>JSON.stringify({session:{order:[1,1],index:0}}),setItem(){}},()=>.5);assert.equal(bad.state.session,null);
});
test('навыки первого коллоквиума доступны через общую навигацию тренировки',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
 assert.doesNotMatch(html,/data-sidebar-route="anatomy-skills"/);
 assert.match(app,/function loadAnatomySkills/);assert.match(app,/\['anatomy-skills','Навыки · 1','#\/anatomy-skills'\]/);
});


test('разделы покрывают список без пропусков и запускают весь выбранный раздел независимо от фильтров',()=>{
 const data={}, {game,H}=load(data);assert.equal(H.data.sections.length,23);
 const covered=H.data.sections.flatMap(s=>H.data.items.filter(x=>x.id>=s.from&&x.id<=s.to).map(x=>x.id));
 assert.equal(covered.length,330);assert.equal(new Set(covered).size,330);
 const occipital=H.data.sections.find(s=>s.id==='occipital');assert.equal(occipital.from,148);assert.equal(occipital.to,158);
 game.setOptions('pelvis','favorites',10);assert.equal(game.pool().length,0);assert.equal(game.startSection('occipital'),true);
 assert.equal(game.state.session.order.length,11);assert.ok(game.state.session.order.every(id=>id>=148&&id<=158));
 assert.equal(game.state.scope,'favorites');assert.equal(game.state.group,'pelvis');
 const restored=load(data).game;assert.equal(restored.state.session.order.length,11);assert.equal(restored.state.group,'pelvis');
});

test('порядок сохраняется и применяется к общей подборке, фильтрам и тренировке раздела',()=>{
 const data={}, {game,H}=load(data,()=>0);assert.equal(game.state.sequence,'random');
 game.setOptions('all','all',10,'ordered');assert.ok(game.start());assert.deepEqual(Array.from(game.state.session.order),[1,2,3,4,5,6,7,8,9,10]);
 game.navigate(2);game.mark('again');const id=game.current().id;game.favorite(id);game.setOptions('all','favorites',10,'ordered');
 const restored=load(data,()=>0).game;assert.equal(restored.state.sequence,'ordered');assert.equal(restored.current().id,id);assert.equal(restored.state.session.answers[id],'again');
 assert.ok(restored.start());assert.deepEqual(Array.from(restored.state.session.order),[id]);
 restored.setOptions('all','all',0,'ordered');assert.ok(restored.startSection('occipital'));assert.deepEqual(Array.from(restored.state.session.order),[148,149,150,151,152,153,154,155,156,157,158]);
 restored.setOptions('all','all',0,'random');assert.ok(restored.startSection('occipital'));const mixed=Array.from(restored.state.session.order);assert.notDeepEqual(mixed,[148,149,150,151,152,153,154,155,156,157,158]);assert.deepEqual([...mixed].sort((a,b)=>a-b),[148,149,150,151,152,153,154,155,156,157,158]);
 restored.setOptions('all','all',10,'ordered');assert.deepEqual(Array.from(restored.state.session.order),mixed); // existing session never reorders
 assert.ok(restored.start());assert.deepEqual(Array.from(restored.state.session.order),[1,2,3,4,5,6,7,8,9,10]);
 const legacy={};legacy[H.KEY]=JSON.stringify({session:{order:[23,1],index:1,answers:{},hints:{},finished:false}});const old=load(legacy).game;assert.equal(old.state.sequence,'random');assert.deepEqual(Array.from(old.state.session.order),[23,1]);
});

test('несколько тем сохраняются, сочетаются с фильтрами и доступны после перезагрузки',()=>{
 const storage={}, {game,H}=load(storage,()=>0);
 game.setOptions(['spine','skull'],'all',0,'ordered');
 const expected=H.data.items.filter(item=>['spine','skull'].includes(item.group)).map(item=>item.id);
 assert.deepEqual(Array.from(game.pool().map(x=>x.id)),Array.from(expected));
 assert.ok(game.start()); assert.deepEqual(Array.from(game.state.session.order),Array.from(expected));
 game.favorite(expected[0]); game.favorite(expected.at(-1));
 const restored=load(storage).game; assert.deepEqual(Array.from(restored.state.group),['spine','skull']);
 restored.setOptions(restored.state.group,'favorites',0,'ordered');
 assert.deepEqual(Array.from(restored.pool().map(x=>x.id)),[expected[0],expected.at(-1)]);
 restored.setOptions([], 'all', 0, 'random');assert.equal(restored.state.group,'all');assert.equal(restored.pool().length,330);
 restored.setOptions(['skull','invalid','skull'],'all',0,'random');assert.equal(restored.state.group,'skull');
});

test('старый формат одной темы и сохранённый прогресс навыков совместимы',()=>{
 const storage={}; const {H}=load(); storage[H.KEY]=JSON.stringify({group:'pelvis',favorites:{1:true},notes:{1:'заметка'},stats:{1:{attempts:1,known:0,last:'again'}}});
 const game=load(storage).game;assert.equal(game.state.group,'pelvis');assert.equal(game.state.notes[1],'заметка');assert.equal(game.state.favorites[1],true);assert.equal(game.state.stats[1].last,'again');
});
