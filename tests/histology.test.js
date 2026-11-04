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
  const q=g.current(), e=g.entry(); assert.equal(e.options.length,4);assert.equal(new Set(e.options).size,4);assert.ok(e.options.includes(q.id));
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
  assert.doesNotMatch(view,/target="_blank"/);
  assert.match(view,/dialog\.showModal\(\)/);
  assert.match(view,/data-zoom-close/);
  assert.match(view,/data-histo="retry-image"/);
  assert.match(app,/js\/views-histology\.js\?v=4/);
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
