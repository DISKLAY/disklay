const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ROOT=path.join(__dirname,'..');
function load(storage={}) {
  const context=vm.createContext({window:{},console});
  vm.runInContext(fs.readFileSync(path.join(ROOT,'js/histology.js'),'utf8'),context);
  const H=context.window.HistologyPrototype;
  const store={getItem:k=>storage[k]||null,setItem:(k,v)=>{storage[k]=v;}};
  return {H,g:H.create(store,()=>0.42),store,storage,context};
}

test('подборка включает подписанные источники и существующие изображения',()=>{
  const {H}=load(); assert.equal(H.slides.length,67);
  assert.equal(new Set(H.slides.map(s=>s.id)).size,H.slides.length);
  for(const s of H.slides) {
    assert.ok(s.name && s.number && s.stain && s.source && s.aliases.length);
    assert.ok(fs.existsSync(path.join(ROOT,s.image)),s.image);
    if(s.review) assert.ok(fs.existsSync(path.join(ROOT,s.review)),s.review);
    assert.doesNotMatch(s.image,/мазок|хрящ|мозжечок|пищевод/i);
  }
});

test('сравнение ввода учитывает пробелы, регистр, ё и известные синонимы без нечётких догадок',()=>{
  const {H}=load(); let s=H.byId.h02;
  assert.equal(H.matches(s,'  ГИАЛИНОВЫЙ   ХРЯЩ! '),true);
  assert.equal(H.matches(s,'гиалиновый'),false);
  assert.equal(H.matches(s,'эластический хрящ'),false);
  assert.equal(H.normalize(' ЁЖ,  МОЗГ '),'еж мозг');
});

test('варианты перемешаны, ответ записывается один раз, анатомия не изменяется',()=>{
  const storage={'anatomy-colloquium-v1':'{"sentinel":123}', 'anatomy-colloquium-rewards-shared-v1':'{"appearance":"ocean"}'};
  const {H,g}=load(storage); assert.ok(g.start());
  const q=g.current(), e=g.entry(); assert.equal(e.options.length,5);assert.equal(new Set(e.options).size,5);assert.ok(e.options.includes(q.id));
  assert.equal(g.check(),false);g.select(q.id);assert.equal(g.check(),true);
  assert.equal(g.entry().status,'correct');assert.equal(g.state.stats[q.id].attempts,1);
  assert.equal(g.check(),false);assert.equal(g.dontKnow(),false);assert.equal(g.state.stats[q.id].attempts,1);
  assert.equal(storage['anatomy-colloquium-v1'],'{"sentinel":123}');
  assert.equal(storage['anatomy-colloquium-rewards-shared-v1'],'{"appearance":"ocean"}');
  assert.ok(storage[H.STORAGE_KEY]);
});

test('неизвестный письменный ответ ожидает самооценку и не становится ошибкой автоматически',()=>{
  const {g}=load(); g.setMode('text');g.start(); const q=g.current();
  assert.equal(g.check(''),false);assert.equal(g.check('что-то неоднозначное'),true);
  assert.equal(g.entry().status,'review');assert.equal(g.state.stats[q.id],undefined);
  assert.equal(g.self(true),true);assert.equal(g.entry().status,'correct');assert.equal(g.state.stats[q.id].attempts,1);
  assert.equal(g.self(false),false);assert.equal(g.state.stats[q.id].last,true);
});

test('ошибки, избранное, черновик, возврат и возобновление сохраняются в отдельном хранилище',()=>{
  const data={}, {g}=load(data);g.setMode('text');g.start();const first=g.current();
  g.toggleFavorite();g.setText('незаконченный ответ');
  let restored=load(data).g;assert.equal(restored.entry().text,'незаконченный ответ');assert.equal(restored.state.favorites[first.id],true);
  restored.dontKnow();restored.navigate(1);assert.notEqual(restored.current().id,first.id);restored.navigate(-1);assert.equal(restored.current().id,first.id);
  restored.setScope('mistakes');assert.deepEqual(Array.from(restored.pool().map(x=>x.id)),[first.id]);
  restored.setScope('favorites');assert.deepEqual(Array.from(restored.pool().map(x=>x.id)),[first.id]);
  restored.setScope('all');assert.equal(restored.pool().length,67);
  restored=load(data).g;assert.equal(restored.current().id,first.id);assert.equal(restored.state.stats[first.id].last,false);
});

test('повреждённое и недоступное хранилище не ломает приложение',()=>{
  const {H}=load();let g=H.create({getItem(){return '{';},setItem(){throw Error('disabled');}},()=>0.5);
  assert.ok(g.start());assert.equal(g.storageFailed(),true);assert.ok(g.current());
  const bad=JSON.stringify({session:{order:['h01'],index:0,mode:'choice',entries:{h01:{options:['h01'],status:'unanswered'}}}});
  g=H.create({getItem(){return bad;},setItem(){}},()=>0.5);assert.equal(g.state.session,null);
});

test('ввод без подсказок не раскрывает название или размеченный вариант до проверки',()=>{
  const {H,g,context}=load();g.setMode('text');g.start();
  // Подключаем представление с тем же движком и заранее подготовленной сессией.
  const stored={}; const store={getItem:k=>stored[k]||null,setItem:(k,v)=>{stored[k]=v;}};
  const prepared=H.create(store,()=>0.42);prepared.setMode('text');prepared.start();const q=prepared.current();
  context.window.localStorage=store;
  context.window.AT={views:{},utils:{esc:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')},ui:{}};
  vm.runInContext(fs.readFileSync(path.join(ROOT,'js/views-histology.js'),'utf8'),context);
  const html=context.window.AT.views.histology().html;
  assert.match(html,/Что изображено/);assert.doesNotMatch(html,new RegExp(q.name,'i'));
  assert.ok(!q.review || !html.includes(q.review));assert.doesNotMatch(html,/Препарат №/);
});

test('гистология подключается лениво и не добавляет новые пункты в верхнюю навигацию',()=>{
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),app=fs.readFileSync(path.join(ROOT,'js/app.js'),'utf8');
  const nav=html.match(/<nav class="nav" id="mainNav"[\s\S]*?<\/nav>/)[0];
  assert.doesNotMatch(nav,/Гистология|histology/);assert.match(html,/data-subject-link="histology"/);
  assert.doesNotMatch(html,/<script src="js\/histology/);assert.match(app,/function loadHistology\(/);
});


test('увеличение изображений не зависит от новой вкладки и есть повтор загрузки',()=>{
  const view=fs.readFileSync(path.join(ROOT,'js/views-histology.js'),'utf8');
  const app=fs.readFileSync(path.join(ROOT,'js/app.js'),'utf8');
  assert.doesNotMatch(view,/<a[^>]+(?:review|\.webp)[^>]+target="_blank"/);
  assert.match(view,/dialog\.showModal\(\)/);
  assert.match(view,/data-zoom-close/);
  assert.match(view,/data-histo="retry-image"/);
  assert.match(app,/js\/views-histology\.js\?v=28/);
});


test('похожие варианты заданы для каждого снимка и не зависят от выбранной подборки',()=>{
  const {H,g}=load();
  for (const slide of H.slides) {
    const choices=H.distractors[slide.id];
    assert.ok(choices.length>=3,slide.id);
    assert.equal(new Set(choices).size,choices.length);
    assert.ok(!choices.includes(slide.id));
    assert.ok(choices.every(id=>H.byId[id]));
    for (const id of choices) for (const alias of slide.aliases) assert.equal(H.matches(H.byId[id],alias),false,`${slide.id}/${id}: ${alias}`);
    assert.ok(!(slide.id==='h04' && choices.includes('h01')), 'мазок крови не подходит к костной ткани');
    assert.ok(!(slide.id==='p110' && choices.includes('p111')));
    assert.ok(!(slide.id==='p111' && choices.includes('p110')));
    for (const variant of slide.variants.filter(Boolean)) {
      assert.ok(fs.existsSync(path.join(ROOT,variant.image)));
      if (variant.review) assert.ok(fs.existsSync(path.join(ROOT,variant.review)));
    }
  }
  g.start(); const id=g.current().id; g.toggleFavorite(); g.setScope('favorites');g.start();
  assert.equal(g.state.session.order.length,1);assert.equal(g.current().id,id);
  assert.ok(g.entry().options.filter(x=>x!==id).every(x=>H.distractors[id].includes(x)));
});

test('старые подборки и варианты разных окрасок восстанавливаются без потери данных',()=>{
  const storage={};const {H,g,store}=load(storage);
  const old={mode:'choice',scope:'all',stats:{h05:{attempts:2,correct:1,last:false}},favorites:{h05:true},session:{order:['h05'],index:0,mode:'choice',entries:{h05:{options:['h05','h01','h02','h03'],selected:null,text:'',status:'unanswered'}}}};
  store.setItem(H.STORAGE_KEY,JSON.stringify(old));let restored=H.create(store,()=>0);
  assert.equal(restored.current().image,H.byId.h05.image);assert.equal(restored.state.favorites.h05,true);assert.equal(restored.state.stats.h05.attempts,2);
  old.session.entries.h05.variant=1;store.setItem(H.STORAGE_KEY,JSON.stringify(old));
  restored=H.create(store,()=>0);assert.equal(restored.current().number,'91');
  restored.toggleFavorite();restored=H.create(store,()=>0);assert.equal(restored.current().number,'91');
  old.session.entries.h05.variant=99;store.setItem(H.STORAGE_KEY,JSON.stringify(old));
  assert.equal(H.create(store,()=>0).state.session,null);
});

test('все 73 позиции указателя представлены, одноимённые окраски объединены',()=>{
  const {H}=load();
  const expected='40 53 62 62а 63 64 65 67 68 69 85 86 86а 89 90 91 92 93 95 96 101 102 103а 107 107а 109 110 111 112 115 117 118 119 125 120 121 126 128 129 130 131 132 133 135 136 137 138 139 141 142 143 144 146 146в 147 149 149а 150 151 152 153 154 157 158 159 113 122 123 127 129а 140 148 155'.split(' ');
  const numbers=[];
  for(const slide of H.slides) for(const variant of slide.variants) {
    const number=(variant||slide).number.split(' ')[0];numbers.push(number==='92а'?'92':number);
  }
  assert.equal(numbers.length,73);assert.equal(new Set(numbers).size,73);
  assert.deepEqual(numbers.slice().sort(),expected.slice().sort());
  const {g}=load();g.start();assert.equal(g.state.session.order.length,67);
});

test('вариант восстанавливает правильное название, метаданные и изображение',()=>{
  const {H,store}=load();
  for(const slide of H.slides.filter(s=>s.variants.length>1)) {
    for(let variant=0;variant<slide.variants.length;variant++) {
      const record={session:{order:[slide.id],index:0,mode:'choice',entries:{[slide.id]:{options:[slide.id,...H.distractors[slide.id].slice(0,3)],selected:null,text:'',status:'unanswered',variant}}}};
      store.setItem(H.STORAGE_KEY,JSON.stringify(record));const game=H.create(store,()=>0);
      const expected=slide.variants[variant]||slide;
      assert.equal(game.current().number,expected.number);assert.equal(game.current().image,expected.image);
      game.dontKnow();assert.equal(game.current().number,expected.number);
      const restored=H.create(store,()=>0);assert.equal(restored.current().image,expected.image);
    }
  }
});

test('атлас содержит тексты с источниками и структуры с привязкой к существующим снимкам',()=>{
  const {H}=load();assert.equal(Object.keys(H.atlasTheory).length,61);assert.equal(H.structureSlides.length,14);assert.equal(Object.keys(H.structureTasks).length,172);
  for(const [id,theory] of Object.entries(H.atlasTheory)){assert.ok(H.byId[id]);assert.ok(theory.text.length>30);assert.match(theory.source,/часть [1-4], страница \d+/);}
  for(const g of H.structureSlides){assert.ok(H.byId[g.slideId].review);assert.ok(g.points.length>=2);assert.equal(new Set(g.points.map(p=>p.id)).size,g.points.length);
    for(const p of g.points){assert.ok(p.x>0&&p.x<100&&p.y>0&&p.y<100);assert.ok(p.name && p.aliases.length && p.aliases.every(x=>H.normalize(x)));for(const mode of ['point','name'])assert.ok(H.structureTasks[`${g.slideId}.${p.id}.${mode}`]);}}
});

test('тренировка структур сохраняется отдельно и повторяет ошибки в нужном направлении',()=>{
  const data={'histology-prototype-v1':'{"favorites":{"h01":true}}','anatomy-colloquium-v1':'sentinel'}, {H,store}=load(data);
  let g=H.createStructures(store,()=>0.42);assert.equal(g.start('all'),true);let task=g.current();const wrong=g.group().points.find(p=>p.id!==task.pointId);g.select(wrong.id);assert.equal(g.check(),true);assert.equal(g.entry().status,'wrong');assert.equal(g.check(),false);
  assert.equal(g.state.stats[task.id].attempts,1);g=H.createStructures(store,()=>0.42);assert.equal(g.current().id,task.id);assert.equal(g.entry().status,'wrong');g.setMode('name');assert.equal(g.start('mistakes'),false);g.setMode('point');assert.equal(g.start('mistakes'),true);assert.equal(g.state.session.order.length,1);g.select(task.pointId);g.check();assert.equal(g.state.stats[task.id].last,true);assert.equal(g.state.stats[task.id].attempts,2);assert.equal(g.state.stats[task.id].correct,1);assert.equal(g.start('mistakes'),false);
  assert.equal(data['histology-prototype-v1'],'{"favorites":{"h01":true}}');assert.equal(data['anatomy-colloquium-v1'],'sentinel');
});

test('выбор названия структуры сохраняется и проверяется автоматически',()=>{
  const data={}, {H,store}=load(data);let g=H.createStructures(store,()=>0.42);g.setMode('name');g.start();const id=g.current().id;
  assert.equal(g.entry().options.length,5);assert.equal(g.check(),false);assert.equal(g.select('несуществующий вариант'),false);
  const wrong=g.entry().options.find(x=>x!==g.target().name);assert.ok(g.select(wrong));g=H.createStructures(store,()=>0.42);assert.equal(g.entry().selected,wrong);assert.ok(g.check());assert.equal(g.entry().status,'wrong');assert.equal(g.state.stats[id].attempts,1);
  g.navigate(1);const answer=g.target().name;assert.ok(g.select(answer));assert.ok(g.check());assert.equal(g.entry().status,'correct');
});

test('старое незавершённое задание с ручной самопроверкой сохраняется',()=>{
  const {H,store}=load();let g=H.createStructures(store,()=>0.42);g.setMode('name');g.start();const id=g.current().id;
  const saved=JSON.parse(store.getItem(H.STRUCTURE_KEY));saved.session.entries[id]={status:'review',selected:null,text:'старый ответ'};store.setItem(H.STRUCTURE_KEY,JSON.stringify(saved));
  g=H.createStructures(store,()=>0.42);assert.equal(g.current().id,id);assert.equal(g.entry().status,'review');assert.equal(g.entry().text,'старый ответ');assert.ok(g.self(true));assert.equal(g.state.stats[id].last,true);
});

test('повреждённая или недоступная запись структур безопасна',()=>{
  const {H}=load();const g=H.createStructures({getItem:()=>'{',setItem(){throw Error('off');}},()=>0.42);assert.ok(g.start());assert.equal(g.storageFailed(),true);assert.ok(g.current());
  const bad=JSON.stringify({session:{order:['unknown'],index:0,mode:'name',entries:{}}});assert.equal(H.createStructures({getItem:()=>bad,setItem(){}},()=>0.42).state.session,null);
});

test('все препараты распределены по разделам атласа ровно один раз',()=>{
  const {H}=load();const ids=H.atlasGroups.flatMap(g=>g.ids);assert.equal(H.atlasGroups.length,12);assert.equal(ids.length,H.slides.length);assert.equal(new Set(ids).size,ids.length);assert.ok(H.atlasGroups.every(g=>g.id&&g.name&&g.ids.length));assert.ok(ids.every(id=>H.byId[id]));
});

test('вопросы теории ссылаются на существующий препарат и страницу сборника',()=>{
  const {H}=load();assert.equal(H.theoryQuestions.length,18);assert.equal(new Set(H.theoryQuestions.map(q=>q.id)).size,H.theoryQuestions.length);
  for(const q of H.theoryQuestions){assert.ok(H.byId[q.slideId]&&H.atlasTheory[q.slideId],q.id);assert.match(H.atlasTheory[q.slideId].source,/часть [1-4], страница \d+/);assert.equal(q.answers.length,4);assert.equal(new Set(q.answers.map(H.normalize)).size,4);assert.ok(q.question&&q.explanation);}
  assert.match(H.atlasTheory.p130.text,/подслизистой основе дуоденальных/);assert.match(H.atlasTheory.p117.text,/Мозговое вещество[\s\S]*Тельца Гассаля/);assert.match(H.atlasTheory.p141.text,/Многорядный столбчатый реснитчатый/);assert.match(H.atlasTheory.p132.text,/не образует ворсинок/);
});

test('тест по теории сохраняет ответы отдельно и повторяет только ошибки',()=>{
  const data={'histology-prototype-v1':'old-progress','histology-structures-v1':'structures','anatomy-colloquium-v1':'anatomy'}, {H,store}=load(data);let g=H.createTheory(store,()=>0.42);
  assert.ok(g.start('all'));const q=g.current(),e=g.entry();assert.equal(e.options.length,4);assert.equal(g.check(),false);assert.ok(g.select(e.options.find(x=>x!==0)));assert.equal(g.check(),true);assert.equal(g.check(),false);assert.equal(g.entry().status,'wrong');assert.equal(g.state.stats[q.id].attempts,1);
  g=H.createTheory(store,()=>0.42);assert.equal(g.current().id,q.id);assert.equal(g.entry().status,'wrong');assert.ok(g.start('mistakes'));assert.equal(g.state.session.order.length,1);g.select(0);g.check();assert.equal(g.state.stats[q.id].correct,1);assert.equal(g.state.stats[q.id].attempts,2);assert.equal(g.state.stats[q.id].last,true);assert.equal(g.start('mistakes'),false);
  assert.equal(data['histology-prototype-v1'],'old-progress');assert.equal(data['histology-structures-v1'],'structures');assert.equal(data['anatomy-colloquium-v1'],'anatomy');
});

test('тест по одному препарату, восстановление черновика и повреждённое хранилище',()=>{
  const data={}, {H,store}=load(data);let g=H.createTheory(store,()=>0.42);assert.equal(g.start('all','p141'),true);assert.equal(g.state.session.order.length,1);assert.equal(g.current().slideId,'p141');g.select(2);g=H.createTheory(store,()=>0.42);assert.equal(g.entry().selected,2);assert.equal(g.start('all','p40'),false);assert.equal(g.current().slideId,'p141');
  const bad=JSON.stringify({session:{order:['unknown'],index:0,entries:{}}});assert.equal(H.createTheory({getItem:()=>bad,setItem(){}},()=>0.42).state.session,null);
  g=H.createTheory({getItem:()=>'{',setItem(){throw Error('off');}},()=>0.42);assert.ok(g.start('all'));assert.equal(g.storageFailed(),true);assert.ok(g.current());
});

test('гистологические ссылки доступны из меню и поддерживают историю и активную тренировку',()=>{
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),view=fs.readFileSync(path.join(ROOT,'js/views-histology.js'),'utf8'),drawer=fs.readFileSync(path.join(ROOT,'js/course-drawer.js'),'utf8');
  for(const section of ['setup','atlas','structures','theory','errors','stats'])assert.ok(html.includes(`data-histo-sidebar="${section}"`));
  assert.match(view,/href="#\/histology\?section=/);assert.match(view,/lastSectionHash/);assert.match(view,/histology\.openSection/);assert.match(drawer,/histology\.openSection/);
  assert.match(view,/data-atlas-group/);assert.match(view,/theory-filter-slide/);assert.match(view,/Замечание к источнику/);
});

test('галерея охватывает все препараты, страницы существуют и имеют точные ссылки на источник',()=>{
  const {H,context}=load();vm.runInContext(fs.readFileSync(path.join(ROOT,'js/histology-atlas-data.js'),'utf8'),context);const gallery=context.window.HistologyAtlasPhotos;
  assert.equal(Object.keys(gallery).length,H.slides.length);let total=0;const files=new Set();
  for(const slide of H.slides){const pages=gallery[slide.id];assert.ok(pages&&pages.length,slide.id);total+=pages.length;for(const p of pages){assert.match(p.image,/^assets\/histology\/atlas\/part[1-4]-\d{3}\.webp$/);assert.match(p.source,/^часть [1-4], страница \d+$/);const file=path.join(ROOT,p.image);assert.ok(fs.statSync(file).size>1000,p.image);const h=fs.readFileSync(file).subarray(0,12);assert.equal(h.toString('ascii',0,4),'RIFF');assert.equal(h.toString('ascii',8,12),'WEBP');files.add(p.image);}}
  assert.equal(total,277);assert.equal(files.size,274);assert.ok(gallery.p110.some(x=>x.note&&x.note.includes('гипофункции')));assert.ok(gallery.p159.some(x=>x.note&&x.note.includes('плодная и материнская')));
});

test('просмотрщик поддерживает галерею и не открывает картинки разбора до ответа',()=>{
  const view=fs.readFileSync(path.join(ROOT,'js/views-histology.js'),'utf8'),app=fs.readFileSync(path.join(ROOT,'js/app.js'),'utf8');
  assert.match(view,/function openImageViewer/);assert.match(view,/data-viewer-prev/);assert.match(view,/data-viewer-next/);assert.match(view,/data-zoom-fit/);assert.match(view,/pointermove/);assert.match(view,/data-viewer-retry/);assert.match(view,/game\.entry\(\)\.status!==['"]unanswered['"]&&val===q\.review/);assert.match(app,/histology-atlas-data\.js\?v=1/);
});

test('все отобранные снимки доступны по отдельности и ошибки привязаны к конкретному снимку',()=>{
  const context=vm.createContext({window:{},console});
  vm.runInContext(fs.readFileSync(path.join(ROOT,'js/histology-practice-data.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(ROOT,'js/histology.js'),'utf8'),context);
  const H=context.window.HistologyPrototype, data={}, store={getItem:k=>data[k]||null,setItem:(k,v)=>data[k]=v};
  const g=H.create(store,()=>0.42);
  assert.equal(g.state.sampling,'images');
  assert.equal(H.slides.reduce((n,s)=>n+s.variants.length,0),201);
  assert.equal(g.candidates().length,201);
  for(const slide of H.slides) for(const v of slide.variants) if(v && v.practiceOnly) {
    assert.ok(fs.existsSync(path.join(ROOT,v.image))); assert.ok(fs.existsSync(path.join(ROOT,v.review)));
    assert.doesNotMatch(v.image,/печень|почка|хрящ/i);
  }
  g.start();const first=g.current(), firstKey=g.state.session.order[0];g.dontKnow();
  g.navigate(1);const second=g.current();g.select(second.id);g.check();
  const restored=H.create(store,()=>0.42);assert.equal(restored.state.session.order[0],firstKey);
  restored.setScope('mistakes');restored.setSampling('images');
  assert.deepEqual(Array.from(restored.candidates()),[firstKey]);
  restored.start();assert.equal(restored.current().id,first.id);restored.select(first.id);restored.check();
  assert.equal(restored.state.imageStats[firstKey].last,true);assert.equal(restored.candidates().length,0);
  restored.setScope('all');restored.setSampling('slides');assert.equal(restored.candidates().length,67);
});

test('старые сессии и ошибки восстанавливаются при загрузке дополнительных снимков',()=>{
  const previous=load();previous.g.start();const current=previous.g.current();previous.g.dontKnow();
  const ctx=vm.createContext({window:{},console});
  for (const file of ['js/histology-practice-data.js','js/histology.js']) vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),ctx);
  const g=ctx.window.HistologyPrototype.create(previous.store,()=>0.42);
  assert.equal(g.current().id,current.id);assert.equal(g.entry().status,'wrong');
  g.setScope('mistakes');g.setSampling('images');
  assert.ok(g.candidates().every(key=>key.startsWith(current.id+'@')));
  assert.equal(g.candidates().length,ctx.window.HistologyPrototype.byId[current.id].variants.length);
});

test('ни один новый вопрос с вводом не раскрывает ответ и исходную подпись до проверки',()=>{
  const ctx=vm.createContext({window:{},console});
  for (const file of ['js/histology-practice-data.js','js/histology.js']) vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),ctx);
  const H=ctx.window.HistologyPrototype, data={}, store={getItem:k=>data[k]||null,setItem:(k,v)=>data[k]=v};
  const g=H.create(store,()=>0.42);g.setMode('text');g.start();
  ctx.window.localStorage=store;ctx.window.AT={views:{},utils:{esc:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')},ui:{}};
  const viewSource=fs.readFileSync(path.join(ROOT,'js/views-histology.js'),'utf8');
  for(let i=0;i<g.state.session.order.length;i++){
    g.state.session.index=i;store.setItem(H.STORAGE_KEY,JSON.stringify(g.state));
    vm.runInContext(viewSource,ctx);
    const q=g.current(), html=ctx.window.AT.views.histology().html;
    assert.ok(!html.includes(q.name),`${q.id}: название до ответа`);
    assert.ok(!q.review || !html.includes(q.review),`${q.id}: разбор до ответа`);
    assert.ok(html.includes(q.image),`${q.id}: снимок отсутствует`);
  }
});

test('цветовые темы совпадают в атласе и разборе и не подсказывают препарат заранее',()=>{
  const {H,context}=load();
  const style=fs.readFileSync(path.join(ROOT,'css/histology.css'),'utf8');
  for(const group of H.atlasGroups) assert.ok(style.includes(`[data-histo-group="${group.id}"]`),group.id);
  assert.doesNotMatch(style,/--histo-section-color|\[data-histo-section=/);
  const colors=H.atlasGroups.map(group=>style.match(new RegExp(`\\[data-histo-group="${group.id}"\\] \\{ --histo-topic-color:(#[0-9a-f]{6})`))[1]);
  assert.equal(new Set(colors).size,H.atlasGroups.length);
  // The palette spans multiple hue families, not just close variants of pink/purple.
  const hue=hex=>{const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255), max=Math.max(...c), min=Math.min(...c), d=max-min; let h=max===c[0]?(c[1]-c[2])/d:max===c[1]?(c[2]-c[0])/d+2:(c[0]-c[1])/d+4;return (h*60+360)%360;};
  assert.ok(new Set(colors.map(c=>Math.floor(hue(c)/60))).size>=5);
  const data={},store={getItem:k=>data[k]||null,setItem:(k,v)=>{data[k]=v;}};
  const g=H.create(store,()=>0.42);g.setMode('text');g.start();const q=g.current();
  context.window.localStorage=store;context.window.AT={views:{},utils:{esc:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')},ui:{}};
  const source=fs.readFileSync(path.join(ROOT,'js/views-histology.js'),'utf8');
  vm.runInContext(source,context);let html=context.window.AT.views.histology().html;
  assert.doesNotMatch(html,/histo-topic-badge|data-histo-group=/);
  g.dontKnow();vm.runInContext(source,context);html=context.window.AT.views.histology().html;
  const group=H.atlasGroups.find(g=>g.ids.includes(q.id));
  assert.ok(html.includes(`class="histo-topic-badge" data-histo-group="${group.id}"`));
  assert.ok(html.includes(group.name));
});

test('оставшиеся подписи скрыты только в снимках тренировки, включая сохранённые варианты',()=>{
  const context=vm.createContext({window:{},console});
  for (const file of ['js/histology-practice-data.js','js/histology.js']) vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),context);
  const H=context.window.HistologyPrototype;
  for(const [id,image] of Object.entries({h03:'m01.webp',p120:'m02.webp',p128:'m03.webp',p133:'m04.webp',p93:'m05.webp'})) {
    assert.equal(H.byId[id].image,'assets/histology/masked/'+image);
    assert.equal(H.byId[id].masked,true);
    assert.ok(fs.existsSync(path.join(ROOT,H.byId[id].image)));
  }
  assert.ok(H.byId.p93.variants.some(v=>v && v.image.endsWith('/m06.webp')));
  assert.ok(H.byId.p120.variants.some(v=>v && v.image.endsWith('/m07.webp')));
  assert.equal(H.byId.p120.source,'часть 3, страница 11');
  assert.equal(H.byId.p120.review,'assets/histology/atlas/part3-011.webp');
  assert.ok(fs.existsSync(path.join(ROOT,'assets/histology/p133-image.webp')),'исходник не заменён');
});

test('центр структурных меток остаётся прозрачным, а номер вынесен за кольцо',()=>{
  const view=fs.readFileSync(path.join(ROOT,'js/views-histology.js'),'utf8');
  const css=fs.readFileSync(path.join(ROOT,'css/histology.css'),'utf8');
  assert.match(css,/\.histo-marker \{[^}]*background:transparent/);
  assert.match(css,/\.histo-marker::after \{[^}]*content:attr\(data-number\)/);
  assert.match(view,/data-number="'\+\(number\+1\)\+'/);
  assert.match(view,/button\.dataset\.number=String\(number\+1\)/);
  assert.match(view,/histo-marker--label-left/);
});

test('при восстановлении сохраняется исходная копия ранее записанных сессий',()=>{
 const data={};
 for(const key of ['histology-prototype-v1','histology-structures-v1','histology-theory-v1'])data[key]=JSON.stringify({stats:{missing:{attempts:5,correct:3,last:true}},session:{order:['missing']}});
 const original={...data}, {H,store}=load(data);
 H.create(store,()=>0.5).setMode('text');H.createStructures(store,()=>0.5).setMode('name');H.createTheory(store,()=>0.5).start('all');
 for(const key of Object.keys(original))assert.equal(data[key+'-pre-recovery-backup'],original[key]);
});


test('знак микроатласа изображает гистологический препарат и не зависит от эмодзи',()=>{
  const view=fs.readFileSync(path.join(ROOT,'js/views-histology.js'),'utf8');
  const css=fs.readFileSync(path.join(ROOT,'css/histology.css'),'utf8');
  assert.match(view, /histo-hero__mark" aria-hidden="true"><svg class="histo-hero__slide"/);
  assert.match(view, /<rect x="5" y="9" width="78" height="52"/);
  assert.doesNotMatch(view, /histo-hero__mark[^]*?<span>✳<\/span>/);
  assert.match(css, /\.histo-hero__slide \{[^}]*width: 84px/);
});
