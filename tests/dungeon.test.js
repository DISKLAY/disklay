const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ctx = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/dungeon.js'), 'utf8'), ctx);
const engine = ctx.window.DungeonEngine;
const questions = Array.from({length: 10}, (_, i) => ({id: 'q' + i, options: ['а', 'б', 'в', 'г']}));
function fixture(bank = 'test') {
  const values = new Map();
  const storage = { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v) };
  const env = { storage, bank, questions, byId: id => questions.find(q => q.id === id), answer: q => q ? { answers: [1, 3] } : null, random: () => 0 };
  // Исторические тесты проверяют сохранённые походы старой версии боя.
  function make() {
    const game = engine.create(env), start = game.start;
    game.start = level => {
      if (!start(level)) return false;
      const r = game.state.run;
      r.combatVersion = 1; delete r.monsterStatsVersion; r.maxHp = 4 + game.state.upgrades.armor * 2; r.hp = r.maxHp;
      r.enemyMax = 1 + level; r.enemyHp = r.enemyMax;
      r.enemyDamage = 1 + Math.min(2, Math.floor((level - 1) / 4));
      game.save(); return true;
    };
    return game;
  }
  return { env, storage, make, makeModern: () => engine.create(env) };
}
function correct(game) { assert.ok(game.toggle(1)); assert.ok(game.toggle(3)); assert.ok(game.attack()); assert.equal(game.state.run.result.correct, true); assert.equal(game.attack(), false); assert.ok(game.next()); }
function victory(game) { while (game.state.run.status === 'fight') correct(game); }
test('победа над тремя монстрами даёт золото ровно один раз и открывает следующий уровень', () => {
  const f = fixture(), g = f.make();
  assert.equal(g.start(2), false); assert.ok(g.start(1)); victory(g);
  assert.equal(g.state.run.status, 'victory'); assert.equal(g.state.gold, 154); assert.equal(g.state.unlocked, 2);
  assert.equal(g.next(), false); assert.equal(f.make().state.gold, 154);
  assert.ok(g.abandon()); assert.ok(g.start(2)); assert.equal(g.state.run.level, 2);
});
test('неверный ответ снимает здоровье, поражение не даёт золота', () => {
  const g = fixture().make(); g.start(1);
  for (let i = 0; i < 4; i++) { g.toggle(2); g.attack(); assert.equal(g.state.run.result.correct, false); g.next(); }
  assert.equal(g.state.run.status, 'defeat'); assert.equal(g.state.gold, 0); assert.equal(g.state.unlocked, 1);
});
test('покупки, способности и сохранение похода между перезагрузками', () => {
  const f = fixture(); let g = f.make(); g.start(1); victory(g); g.abandon();
  assert.ok(g.buy('sword')); assert.equal(g.state.gold, 54); assert.equal(g.buy('armor'), false);
  g.start(1); g.toggle(1); g.toggle(3); g.attack(); assert.equal(g.state.run.enemyHp, 1);
  g = f.make(); assert.equal(g.state.run.enemyHp, 1); assert.equal(g.state.run.result.correct, true); assert.ok(g.next());
  correct(g); assert.equal(g.state.run.enemy, 1); victory(g); g.abandon(); assert.ok(g.buy('armor')); assert.equal(g.state.upgrades.armor, 1);
  g.start(1); assert.equal(g.state.run.maxHp, 6);
});
test('способности одноразовые, щит поглощает ошибку, подсказка скрывает только неверное', () => {
  const f = fixture(); const seed = {version:1,gold:1000,unlocked:1,upgrades:{sword:0,armor:0,heal:0,shield:0,focus:0},run:null};
  f.storage.setItem(engine.STORAGE, JSON.stringify(seed)); const g = f.make();
  ['heal','shield','focus'].forEach(id => assert.ok(g.buy(id)));
  g.start(1); assert.equal(g.ability('heal'), false); assert.ok(g.ability('shield')); assert.ok(g.ability('focus'));
  assert.deepEqual(Array.from(g.state.run.hidden), [2,4]); assert.equal(g.toggle(2), false); assert.equal(g.ability('focus'), false);
  g.toggle(1); g.attack(); assert.equal(g.state.run.result.shielded,true); assert.equal(g.state.run.hp,4); g.next();
  g.toggle(2); g.attack(); g.next(); assert.equal(g.state.run.hp,3); assert.ok(g.ability('heal')); assert.equal(g.state.run.hp,4); assert.equal(g.ability('heal'),false);
});
test('режим не запускается без ключей и не использует незавершённый поход другой базы', () => {
  const f = fixture(); f.env.answer = () => null; let g = f.make(); assert.equal(g.pool().length,0); assert.equal(g.start(1),false);
  f.env.answer = () => ({answers:[1]}); g = f.make(); g.start(1); f.env.bank='2'; g=f.make(); assert.equal(g.toggle(1),false); assert.equal(g.start(1),false); assert.ok(g.abandon()); assert.ok(g.start(1));
});
test('интеграция не изменяет обычный кошелёк и учебную статистику', () => {
  const f = fixture(), g = f.make(); g.start(1); victory(g);
  assert.equal(f.storage.getItem(engine.STORAGE).includes('coins'), false);
  const index = fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const app = fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
  assert.match(index, /data-sidebar-route="dungeon"/); assert.match(app, /dungeon: 'dungeon'/);
});
test('ошибка сохранения заметна интерфейсу', () => {
  const f = fixture(); f.env.storage.setItem = () => { throw new Error('blocked'); };
  const g = f.make(); assert.ok(g.start(1)); assert.equal(g.saved, false);
});
function seeded(level, upgrades = {}) {
  const f = fixture();
  f.storage.setItem(engine.STORAGE, JSON.stringify({version:1,gold:5000,unlocked:level,upgrades:{sword:0,armor:6,heal:0,shield:0,focus:0,...upgrades},discovered:[],run:null}));
  const g = f.make(); assert.ok(g.start(level)); return {f,g};
}
function miss(g) { assert.ok(g.toggle(2)); assert.ok(g.attack()); return g.state.run.result; }
function hit(g) { g.toggle(1); g.toggle(3); assert.ok(g.attack()); return g.state.run.result; }
function toMonster(g, index) { while (g.state.run.enemy < index) correct(g); }
test('сложность и состав боёв растут по уровням, доступ к закрытым уровням запрещён', () => {
  assert.ok(engine.stats(3).hp > engine.stats(1).hp);
  assert.ok(engine.stats(5).damage > engine.stats(1).damage);
  assert.notDeepEqual(Array.from(engine.rosterFor(1)), Array.from(engine.rosterFor(2)));
  const {g} = seeded(3); assert.equal(g.start(4),false); assert.equal(g.state.run.enemyMax,4);
  for (let level=2; level<=100; level++) assert.ok(engine.stats(level).hp > engine.stats(level-1).hp);
  assert.deepEqual(Array.from(g.state.discovered), ['bat']);
  toMonster(g,1); assert.ok(g.state.discovered.includes('spider'));
});
test('костяная защита поглощает только часть первого удара; голем защищён всегда', () => {
  let {g} = seeded(1,{sword:2}); let result = hit(g); assert.equal(result.damage,2); g.next();
  // Если первый удар не убил, второй уже идёт с полной силой.
  if (g.state.run.enemy === 0) assert.equal(hit(g).damage,3);
  ({g} = seeded(4,{sword:2})); toMonster(g,2); assert.equal(g.state.run.roster[2],'golem');
  assert.equal(hit(g).damage,2); g.next(); assert.equal(hit(g).damage,2);
});
test('слизень лечится при промахе, даже при активном щите', () => {
  const {g} = seeded(1,{shield:1}); toMonster(g,1); hit(g); g.next(); assert.equal(g.state.run.enemyHp,1);
  g.ability('shield'); const result = miss(g); assert.equal(result.shielded,true); assert.equal(g.state.run.enemyHp,2); assert.match(result.notes.join(' '),/восстанавливает/);
});
test('мышь усиливает каждый второй промах, а лич — каждый', () => {
  let {g} = seeded(1); toMonster(g,2); let result=miss(g); assert.equal(result.incoming,1); g.next(); result=miss(g); assert.equal(result.incoming,2);
  ({g}=seeded(5)); toMonster(g,2); result=miss(g); assert.equal(result.incoming,3);
});
test('паук отравляет на следующий ответ, а щит предотвращает укус', () => {
  let {g} = seeded(2,{shield:1}); toMonster(g,2); g.ability('shield'); let result=miss(g); assert.equal(result.shielded,true); assert.equal(g.state.run.poison,false); g.next();
  miss(g); assert.equal(g.state.run.poison,true); g.next(); const before=g.state.run.hp; result=hit(g); assert.equal(g.state.run.hp,before-1); assert.match(result.notes.join(' '),/Яд/);
  // Яд срабатывает до завершения боя, даже если ответ побеждает паука.
  ({g}=seeded(4,{sword:5})); miss(g); g.next(); hit(g); g.next(); assert.equal(g.state.run.enemy,1); assert.equal(g.state.run.poison,false);
});
test('призрак теряет завесу при первом правильном ответе и она сохраняется после перезагрузки', () => {
  const {g,f}=seeded(3); toMonster(g,2); let result=hit(g); assert.equal(result.damage,0); assert.equal(g.state.run.special.veil,true);
  const reloaded=f.make(); assert.equal(reloaded.state.run.result.damage,0); reloaded.next(); result=hit(reloaded); assert.equal(result.damage,1);
});
test('цену улучшений видно и она растёт; старые сохранения и походы мигрируют', () => {
  const f=fixture(); f.storage.setItem(engine.STORAGE, JSON.stringify({version:1,gold:1000,unlocked:2,upgrades:{sword:1},run:null}));
  let g=f.make(); assert.equal(engine.price(engine.ITEMS.sword,1),200); assert.deepEqual(Array.from(g.state.discovered),['skeleton','slime','lich']);
  assert.ok(g.buy('sword')); assert.equal(g.state.gold,800);
  g.start(1); const old=JSON.parse(f.storage.getItem(engine.STORAGE)); delete old.discovered; delete old.run.roster; delete old.run.special; delete old.run.enemyDamage; f.storage.setItem(engine.STORAGE,JSON.stringify(old));
  g=f.make(); assert.equal(g.state.run.legacy,true); assert.equal(g.state.run.enemyHp,2); assert.equal(g.state.run.roster[0],'skeleton'); assert.ok(g.state.discovered.includes('skeleton'));
});
test('игровые ресурсы не подключены к index.html и загружаются по маршруту', () => {
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'); const app=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
  assert.doesNotMatch(html,/dungeon\.css|dungeon\.js|views-dungeon\.js/);
  assert.match(html, /<script src="js\/app\.js\?v=[^"]+"><\/script>/);
  assert.match(app,/viewName === 'dungeon' && !dungeonReady/); assert.match(app,/js\/views-dungeon\.js/);
  const css=fs.readFileSync(path.join(__dirname,'../css/dungeon.css'),'utf8'); assert.match(css,/min-width:761px\) and \(prefers-reduced-motion:no-preference/);
});
function special(bank, index, upgrades = {}) {
  const f = fixture(bank);
  f.storage.setItem(engine.STORAGE, JSON.stringify({version:1,gold:0,unlocked:5,upgrades:{sword:2,armor:6,heal:1,shield:1,focus:1,...upgrades},discovered:[],run:null}));
  const g=f.make(); assert.ok(g.start(5)); toMonster(g,index); return {g,f};
}
test('двое уникальных монстров каждой из 11 баз встречаются только в своей базе на каждом уровне', () => {
  const banks=['1','2','3','4','5','6','7','credit-1','credit-2','stom-2','stom-3'];
  const ids = new Set();
  for (const bank of banks) {
    assert.equal(engine.BANK_MONSTERS[bank].length,2);
    for (const [id] of engine.BANK_MONSTERS[bank]) {
      assert.ok(!ids.has(id)); ids.add(id);
      assert.equal(engine.MONSTERS[id].bank,bank);
      assert.ok(engine.MONSTERS[id].mechanic && engine.MONSTERS[id].description && engine.MONSTERS[id].tactic);
      for (const other of banks.filter(b => b!==bank)) for (let level=1;level<=100;level++) assert.equal(engine.rosterFor(level,other).includes(id),false);
      for (let level=1;level<=100;level++) assert.ok(engine.rosterFor(level,bank).includes(id));
    }
    const f=fixture(bank); f.storage.setItem(engine.STORAGE,JSON.stringify({version:1,gold:0,unlocked:1,upgrades:{sword:5,armor:6},discovered:[],run:null}));
    let g=f.make(); assert.ok(g.start(1)); victory(g); const first=engine.BANK_MONSTERS[bank][0][0], second=engine.BANK_MONSTERS[bank][1][0];
    assert.ok(g.state.discovered.includes(first)); assert.ok(g.state.discovered.includes(second));
    g=f.make(); assert.ok(g.state.discovered.includes(first)); assert.ok(g.state.discovered.includes(second));
  }
  assert.equal(ids.size,22);
});
test('оглушение ограничивает следующий удар, щит предотвращает эффект', () => {
  let {g}=special('1',1); miss(g); assert.equal(g.state.run.special.stunned,true); g.next(); assert.equal(hit(g).damage,1);
  ({g}=special('1',1)); g.ability('shield'); miss(g); assert.equal(g.state.run.special.stunned,undefined); g.next(); assert.equal(hit(g).damage,3);
});
test('переменная броня ослабляет нечётные попадания, а не чётные', () => {
  const {g}=special('1',2); assert.equal(hit(g).damage,2); g.next(); assert.equal(hit(g).damage,3); g.next(); assert.equal(hit(g).damage,2);
});
test('шипы ранят после несмертельного попадания, но не после победного', () => {
  const {g}=special('2',1); let hp=g.state.run.hp; hit(g); assert.equal(g.state.run.hp,hp-1); g.next(); hp=g.state.run.hp; hit(g); assert.equal(g.state.run.enemyHp,0); assert.equal(g.state.run.hp,hp);
});
test('ярость увеличивает урон за ошибки подряд и сбрасывается верным ответом', () => {
  const {g}=special('2',2); assert.equal(miss(g).incoming,2); g.next(); assert.equal(miss(g).incoming,3); g.next(); assert.equal(miss(g).incoming,4); g.next(); hit(g); g.next(); assert.equal(miss(g).incoming,2);
});
test('туман запрещает подсказку только до конца боя и не тратит заряд', () => {
  const {g}=special('3',2); assert.equal(g.ability('focus'),false); assert.equal(g.state.run.used.focus,undefined);
  while (g.state.run.enemyHp>0) { hit(g); if(g.state.run.enemyHp>0) g.next(); }
  g.next(); assert.equal(g.state.run.status,'victory'); assert.equal(g.state.run.used.focus,undefined);
});
test('последний выброс однократно сохраняется после перезагрузки', () => {
  const {g,f}=special('7',2,{sword:5}); hit(g); assert.equal(g.state.run.enemyHp,1); assert.equal(g.state.run.special.laststand,true);
  const reloaded=f.make(); reloaded.next(); hit(reloaded); assert.equal(reloaded.state.run.enemyHp,0); reloaded.next(); assert.equal(reloaded.state.run.status,'victory');
});
test('пробой не расходует щит, который затем блокирует обычную атаку', () => {
  const {g}=special('credit-2',1); assert.ok(g.ability('shield')); let result=miss(g); assert.equal(result.shielded,false); assert.equal(g.state.run.shielded,true); assert.equal(result.incoming,2); g.next(); result=miss(g); assert.equal(result.shielded,true); assert.equal(g.state.run.shielded,false); assert.equal(result.incoming,0);
});
test('поглощение лечит и усиливает атаку только при незаблокированной ошибке', () => {
  const {g}=special('credit-2',2); hit(g); g.next(); const initial=g.state.run.enemyHp; assert.ok(g.ability('shield')); let result=miss(g); assert.equal(result.shielded,true); assert.equal(g.state.run.enemyHp,initial); g.next(); result=miss(g); assert.equal(result.incoming,3); assert.equal(g.state.run.enemyHp,initial+1);
});
test('новый поиск существ сохраняет ранее открытых общих монстров между базами', () => {
  const f=fixture('1'); let g=f.make(); g.start(1); victory(g); const discovered=Array.from(g.state.discovered); g.abandon(); f.env.bank='2'; g=f.make();
  for(const id of discovered) assert.ok(g.state.discovered.includes(id));
  assert.ok(g.start(1)); assert.equal(g.state.run.roster[1],'tendon_keeper');
});
test('золото за каждого монстра начисляется сразу и сохраняется после поражения, выхода и перезагрузки', () => {
  const f=fixture(); let g=f.make(); g.start(1); correct(g); hit(g);
  assert.equal(g.state.run.enemyHp,0); assert.equal(g.state.gold,15); assert.equal(g.state.run.loot,15);
  assert.equal(g.attack(),false); assert.equal(g.state.gold,15);
  g=f.make(); assert.equal(g.state.gold,15); assert.equal(g.state.run.loot,15); g.next(); assert.equal(g.state.gold,15);
  for(let i=0;i<4;i++){ miss(g); g.next(); }
  assert.equal(g.state.run.status,'defeat'); assert.equal(g.state.gold,15); assert.equal(g.state.stars.test,undefined);
  g.abandon(); g.start(1); correct(g); correct(g); assert.equal(g.state.gold,30); g.abandon(); assert.equal(f.make().state.gold,30);
});
test('повторные попытки дают достаточно золота для прокачки без победы', () => {
  const g=fixture().make();
  for(let i=0;i<7;i++) {g.start(1);correct(g);correct(g);g.abandon();}
  assert.equal(g.state.gold,105); assert.ok(g.buy('sword')); assert.equal(g.state.gold,5);
});
test('звёзды учитывают все ошибки и сохраняют лучший результат отдельно по базе и уровню', () => {
  const f=fixture(); f.storage.setItem(engine.STORAGE,JSON.stringify({version:1,gold:0,unlocked:1,upgrades:{armor:6},discovered:[],run:null}));
  let g=f.make(); g.start(1); victory(g); assert.equal(g.state.run.stars,3); assert.equal(g.state.stars.test[1],3); g.abandon();
  g.start(1); miss(g); g.next(); victory(g); assert.equal(g.state.run.stars,2); assert.equal(g.state.stars.test[1],3); g.abandon();
  f.env.bank='1'; g=f.make(); g.start(1); for(let i=0;i<3;i++){miss(g);g.next();} victory(g);
  assert.equal(g.state.run.stars,1); assert.equal(g.state.stars['1'][1],1); assert.equal(g.state.stars.test[1],3);
  assert.equal(f.make().state.stars['1'][1],1);
});
test('первый смертельный удар при последнем выбросе не приносит золото, реальная победа приносит', () => {
  const {g}=special('7',2,{sword:5}); let before=g.state.gold; hit(g); assert.equal(g.state.run.enemyHp,1); assert.equal(g.state.gold,before);
  g.next(); hit(g); assert.equal(g.state.run.enemyHp,0); assert.equal(g.state.gold,before+engine.monsterReward(5,2));
});
test('награда за монстра сохраняется даже при одновременном поражении героя', () => {
  const {g}=special('3',1,{sword:5}); g.state.run.hp=1; g.state.run.poison=true; const old=g.state.gold;
  hit(g); assert.equal(g.state.run.hp,0); assert.equal(g.state.run.enemyHp,0); assert.equal(g.state.gold,old+engine.monsterReward(5,1));
  g.next(); assert.equal(g.state.run.status,'defeat'); assert.equal(g.state.gold,old+engine.monsterReward(5,1));
});
test('старый поход не получает ложные три звезды и не начисляет награду за старые бои повторно', () => {
  const f=fixture(); let g=f.make();g.start(1);correct(g);correct(g);
  const old=JSON.parse(f.storage.getItem(engine.STORAGE)); old.gold=0; delete old.stars; delete old.run.mistakes; delete old.run.loot; delete old.run.rewarded; f.storage.setItem(engine.STORAGE,JSON.stringify(old));
  g=f.make(); assert.equal(g.state.run.mistakes,null); victory(g); assert.equal(g.state.run.stars,1); assert.equal(g.state.stars.test[1],1);
  assert.equal(g.state.gold,100+engine.monsterReward(1,1)+engine.monsterReward(1,2));
});

test('боевая сцена расположена рядом с вопросом на ПК и остаётся видимой при прокрутке', () => {
  const view=fs.readFileSync(path.join(__dirname,'../js/views-dungeon.js'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'../css/dungeon.css'),'utf8');
  assert.match(view, /dg-battle-layout\"><div class="dg-battle-scene\"><div class="dg-arena/);
  assert.match(view, /<\/div><div class="dg-battle-grid"><section class="dg-question/);
  assert.match(view, /getBoundingClientRect\(\)\.height/);
  assert.match(view, /removeEventListener\('resize', positionScene\)/);
  assert.match(css, /@media \(min-width: 761px\)\s*\{\s*\.dg-battle-layout\s*\{\s*display:grid;\s*grid-template-columns:/);
  assert.match(css, /@media \(min-width: 761px\) and \(min-height: 650px\)\s*\{\s*\.dg-battle-scene\s*\{\s*position:sticky;/);
});

function sequence(values, fallback = .5) { let i = 0; return () => i < values.length ? values[i++] : fallback; }
test('новые походы используют увеличенное здоровье и диапазоны случайного урона', () => {
  const f=fixture(); const g=f.makeModern(); assert.ok(g.start(1));
  assert.equal(g.state.run.combatVersion,2); assert.equal(g.state.run.maxHp,100); assert.equal(g.state.run.enemyMax,40);
  assert.equal(engine.heroDamage(0),12); assert.equal(engine.heroDamage(2),28);
  assert.deepEqual({...engine.damageRange(12)}, {min:9,max:15});
  assert.equal(engine.rollDamage(12,()=>0),9); assert.equal(engine.rollDamage(12,()=>.999999),15);
  g.state.run.roster[0]='slime'; f.env.random=()=>0; let result=hit(g); assert.equal(result.damage,9); assert.equal(g.state.run.enemyHp,31);
  g.next(); f.env.random=()=>.999999; result=hit(g); assert.equal(result.damage,15); assert.equal(g.state.run.enemyHp,16);
});
test('ловкость покупается, сохраняется и повышает пассивный шанс с 5 до 35 процентов', () => {
  const f=fixture(); f.storage.setItem(engine.STORAGE,JSON.stringify({version:1,gold:10000,unlocked:1,upgrades:{armor:2},run:null}));
  let g=f.makeModern(); assert.equal(g.state.upgrades.agility,0); assert.equal(engine.dodgeChance(0),5);
  for(let i=1;i<=6;i++) { assert.ok(g.buy('agility')); assert.equal(engine.dodgeChance(g.state.upgrades.agility),5+i*5); }
  assert.equal(g.buy('agility'),false); g=f.makeModern(); assert.equal(g.state.upgrades.agility,6); g.start(1); assert.equal(g.state.run.maxHp,160);
});
test('шанс уклонения срабатывает до щита, сохраняет заряд и не отменяет ошибку', () => {
  const f=fixture(); f.storage.setItem(engine.STORAGE,JSON.stringify({version:1,gold:0,unlocked:1,upgrades:{shield:1},run:null}));
  let g=f.makeModern(); g.start(1); g.ability('shield'); f.env.random=sequence([.5,.049]); let result=miss(g);
  assert.equal(result.dodged,true); assert.equal(result.incoming,0); assert.equal(g.state.run.hp,100); assert.equal(g.state.run.shielded,true); assert.equal(g.state.run.mistakes,1);
  g=f.makeModern(); assert.equal(g.state.run.result.dodged,true); assert.equal(g.attack(),false); assert.equal(g.state.run.shielded,true);
  g.next(); f.env.random=sequence([.5,.05]); result=miss(g); assert.equal(result.dodged,false); assert.equal(result.shielded,true); assert.equal(g.state.run.shielded,false); assert.equal(g.state.run.mistakes,2);
});
test('уклонение предотвращает эффекты попадания, но не лечение за ошибку и не яд от прошлых ходов', () => {
  const f=fixture(); const g=f.makeModern(); g.start(1); g.state.run.roster[0]='bile_slime';
  f.env.random=sequence([.5,0]); let result=miss(g); assert.equal(result.dodged,true); assert.equal(g.state.run.poison,false);
  g.next(); g.state.run.poison=true; g.state.run.roster[0]='thrombus'; g.state.run.enemyHp=20; const hp=g.state.run.hp;
  f.env.random=sequence([.5,0]); result=miss(g); assert.equal(result.dodged,true); assert.equal(g.state.run.hp,hp-5); assert.equal(g.state.run.enemyHp,25);
});
test('щит и уклонение не останавливают ответные шипы', () => {
  const f=fixture();const g=f.makeModern();g.start(1);g.state.run.roster[0]='tendon_keeper';g.state.run.shielded=true;
  f.env.random=()=>.5;hit(g);assert.equal(g.state.run.hp,95);assert.equal(g.state.run.shielded,true);
});
test('старый незавершённый поход продолжает старую механику и прогресс остаётся прежним', () => {
  const f=fixture(); let old=f.make(); old.start(1); const stored=JSON.parse(f.storage.getItem(engine.STORAGE));
  delete stored.run.combatVersion; stored.gold=77;stored.unlocked=3;stored.discovered=['skeleton'];stored.upgrades.sword=2; f.storage.setItem(engine.STORAGE,JSON.stringify(stored));
  let g=f.makeModern(); assert.equal(g.state.gold,77);assert.equal(g.state.unlocked,3);assert.equal(g.state.upgrades.sword,2);assert.equal(g.state.upgrades.agility,0);assert.equal(g.state.run.hp,4);
  f.env.random=()=>0; let result=miss(g);assert.equal(result.dodged,false);assert.equal(result.incoming,1);assert.equal(g.state.run.hp,3);
  g.abandon();g.start(1);assert.equal(g.state.run.combatVersion,2);assert.equal(g.state.run.hp,100);
});
test('разброс вражеского урона и порог уклонения работают без смещения', () => {
  const f=fixture();f.storage.setItem(engine.STORAGE,JSON.stringify({version:1,gold:0,unlocked:1,upgrades:{agility:6},run:null}));const g=f.makeModern();g.start(1);
  f.env.random=sequence([0,.349999]);let result=miss(g);assert.equal(result.dodged,true);g.next();
  f.env.random=sequence([0,.35]);result=miss(g);assert.equal(result.dodged,false);assert.equal(result.incoming,8);g.next();
  f.env.random=sequence([.999999,.99]);result=miss(g);assert.equal(result.incoming,12);
});
test('верный удар против последней силы не выдаёт золото, пока монстр реально не побеждён', () => {
  const f=fixture();const g=f.makeModern();g.start(1);g.state.run.roster[0]='valve_lord';g.state.run.enemyHp=8;f.env.random=()=>.5;
  hit(g);assert.equal(g.state.run.enemyHp,5);assert.equal(g.state.gold,0);g.next();hit(g);assert.equal(g.state.run.enemyHp,0);assert.equal(g.state.gold,15);
});
test('уклонение не тратит особый пробой щита; затем пробой срабатывает и щит сохраняется', () => {
  const f=fixture();f.storage.setItem(engine.STORAGE,JSON.stringify({version:1,gold:0,unlocked:1,upgrades:{shield:1},run:null}));const g=f.makeModern();g.start(1);g.state.run.roster[0]='neuron_wanderer';g.ability('shield');
  f.env.random=sequence([.5,0]);let result=miss(g);assert.equal(result.dodged,true);assert.equal(g.state.run.special.pierced,undefined);assert.equal(g.state.run.shielded,true);g.next();
  f.env.random=sequence([.5,.9]);result=miss(g);assert.equal(result.dodged,false);assert.equal(result.shielded,false);assert.equal(g.state.run.special.pierced,true);assert.equal(g.state.run.shielded,true);g.next();
  f.env.random=sequence([.5,.9]);result=miss(g);assert.equal(result.shielded,true);assert.equal(g.state.run.shielded,false);
});
test('исцеление восстанавливает 20 здоровья в новой системе и не превышает максимум', () => {
  const f=fixture();f.storage.setItem(engine.STORAGE,JSON.stringify({version:1,gold:0,unlocked:1,upgrades:{heal:1},run:null}));const g=f.makeModern();g.start(1);g.state.run.hp=92;
  assert.ok(g.ability('heal'));assert.equal(g.state.run.hp,100);assert.equal(g.ability('heal'),false);
});

function dungeonViewFixture(saved, bank = 'test', hasKey = true, gameApi = null) {
  const values = new Map([[engine.STORAGE, JSON.stringify(saved)]]);
  const storage = {getItem: k => values.get(k) || null, setItem: (k,v) => values.set(k,v)};
  const q = questions[0]; q.num = 1; q.text = 'Вопрос'; q.topic = 'topic';
  let handler, html, focused, renders = 0;
  const attack = {disabled: true};
  const scene = {querySelector: selector => selector === '[data-dg="attack"]' ? attack : selector === '.dg-battle-scene' && html.includes('dg-battle-scene') ? {} : null,
    style: {setProperty() {}}, addEventListener: (name, fn) => { if (name === 'click') handler = fn; }};
  const root = {querySelector: selector => selector === '.dungeon' ? scene : {focus() { focused = selector; }}};
  const AT = {utils: {esc: s => String(s)}, colloquium: {id: bank, name: 'База'}, dataset: {questions: [q], byId: new Map([[q.id, q]]), topic: () => ({title:'Тема'})}, keyApi: {forQuestion: () => hasKey ? ({answers:[1]}) : null}, views: {}, onCleanup() {}, route: () => 'dungeon'};
  if (gameApi) AT.game = gameApi;
  const window = {AT, DungeonEngine: engine, localStorage: storage, COLLOQUIUM_MODULES:{}, addEventListener(){}, removeEventListener(){}};
  const math = Object.create(Math); math.random = () => 0;
  const context = vm.createContext({window, document:{querySelector:()=>null}, Math:math, console});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/views-dungeon.js'),'utf8'), context);
  AT.rerender = () => { renders++; const view = AT.views.dungeon(); html = view.html; view.mount(root); };
  AT.rerender();
  return {get html(){return html;}, get focused(){return focused;}, get renders(){return renders;}, attack, state:()=>JSON.parse(storage.getItem(engine.STORAGE)),
    click(action, data = {}) { const el = {dataset: {dg:action, ...data}, disabled:false, classes:new Set(), attrs:{}, mark:{textContent:''},
      setAttribute(k,v) { this.attrs[k] = v; }, querySelector(s){return s === '.dg-option-mark' ? this.mark : null;}};
      el.classList = {toggle:(k,on)=>on ? el.classes.add(k) : el.classes.delete(k)};
      handler({target:{closest:()=>el}}); return el; }};
}
test('карта показывает звёзды текущей базы, закрытые уровни, страницы и запускает выбранный уровень', () => {
  const ui = dungeonViewFixture({version:1, gold:0, unlocked:12, upgrades:{shield:1}, stars:{test:{1:3,11:2},other:{11:3}}, run:null});
  assert.match(ui.html, /УРОВНИ 11 — 20/); assert.match(ui.html, /Уровень 11, звёзд: 2 из 3/);
  assert.match(ui.html, /data-level="13"[^>]*disabled/); assert.match(ui.html, /data-level="12"[^>]*aria-pressed="true"/);
  ui.click('map-page',{page:'0',dir:'prev'}); assert.match(ui.html,/УРОВНИ 1 — 10/); assert.match(ui.html,/Уровень 1, звёзд: 3 из 3/);
  assert.equal(ui.focused,'[data-dg="map-page"][data-dir="next"]');
  ui.click('level',{level:'3'}); assert.match(ui.html,/data-level="3"[^>]*aria-pressed="true"/);
  ui.click('map-page',{page:'1',dir:'next'}); assert.equal(ui.focused,'[data-dg="map-page"][data-dir="next"]');
  assert.match(ui.html,/ВЫБРАННЫЙ УРОВЕНЬ<\/span><strong>3 /);
  ui.click('start'); assert.equal(ui.state().run.level,3);
  assert.match(ui.html,/dg-battle-scene[\s\S]*dg-abilities[\s\S]*dg-battle-grid[\s\S]*dg-question/);
  assert.match(ui.html,/aria-label="Подробнее о способностях и уклонении"/); assert.match(ui.html,/aria-label="Подробнее об особенности противника"/);
  ui.click('ability',{id:'shield'}); assert.equal(ui.state().run.shielded,true); assert.match(ui.html,/Щит активен/);
});
test('карта не показывает звёзды чужой базы и не позволяет начать поход без ключей', () => {
  const ui = dungeonViewFixture({version:1, unlocked:1, upgrades:{}, stars:{other:{1:3}}, run:null});
  assert.match(ui.html,/Уровень 1, доступен, ещё не пройден/); assert.doesNotMatch(ui.html,/звёзд: 3 из 3/);
  const noKey = dungeonViewFixture({version:1, unlocked:1, upgrades:{}, run:null}, 'test', false);
  assert.match(noKey.html, /data-dg="start" disabled/);
  noKey.click('start'); assert.equal(noKey.state().run, null);
});

test('у видов монстров устойчивый компромисс здоровья и урона на всех уровнях', () => {
  for (let level=1; level<=100; level++) {
    const bat=engine.monsterStats(level,'bat'), skeleton=engine.monsterStats(level,'skeleton'), slime=engine.monsterStats(level,'slime'), golem=engine.monsterStats(level,'golem');
    assert.ok(bat.hp < skeleton.hp && skeleton.hp < slime.hp && slime.hp < golem.hp);
    assert.ok(bat.damage > skeleton.damage && skeleton.damage > slime.damage && slime.damage >= golem.damage);
    for (const id of engine.IDS) { const d=engine.monsterStats(level,id); assert.ok(Number.isInteger(d.hp) && d.hp>0 && Number.isInteger(d.damage) && d.damage>0, id); }
  }
  assert.deepEqual({...engine.monsterStats(1,'joint_golem')},{hp:52,damage:8});
  assert.deepEqual({...engine.monsterStats(1,'muscle_beast')},{hp:30,damage:13});
});
test('новые походы меняют характеристики каждого встреченного монстра и сохраняют их при загрузке', () => {
  const f=fixture('1');let g=f.makeModern();g.start(1);
  assert.equal(g.state.run.monsterStatsVersion,1); assert.deepEqual([g.state.run.enemyMax,g.state.run.enemyDamage],[40,10]);
  function defeatCurrent() {g.state.run.enemyHp=0;g.state.run.result={correct:true};g.save(); assert.ok(g.next());}
  defeatCurrent(); assert.equal(g.state.run.roster[1],'bone_drake'); assert.deepEqual([g.state.run.enemyMax,g.state.run.enemyDamage],[44,9]);
  defeatCurrent(); assert.equal(g.state.run.roster[2],'joint_golem'); assert.deepEqual([g.state.run.enemyHp,g.state.run.enemyMax,g.state.run.enemyDamage],[52,52,8]);
  g=f.makeModern(); assert.deepEqual([g.state.run.enemyHp,g.state.run.enemyMax,g.state.run.enemyDamage],[52,52,8]);
});
test('старый поход второй версии не меняет характеристики при переходе к новому монстру', () => {
  const f=fixture('1');let g=f.makeModern();g.start(1); delete g.state.run.monsterStatsVersion;
  g.state.run.enemyMax=40;g.state.run.enemyDamage=10;g.state.run.enemy=1;g.state.run.enemyHp=0;g.state.run.result={correct:true};g.save();
  g=f.makeModern(); assert.ok(g.next());assert.equal(g.state.run.roster[2],'joint_golem');assert.deepEqual([g.state.run.enemyHp,g.state.run.enemyMax,g.state.run.enemyDamage],[40,40,10]);
});
test('результат хранит реальную потерю здоровья с учётом избыточного урона, яда и защиты', () => {
  const f=fixture();let g=f.makeModern();g.start(1);g.state.run.enemyHp=2;g.state.run.hp=3;g.state.run.poison=true;
  let result=hit(g);assert.equal(result.enemyHpLost,2);assert.ok(result.damage>2);assert.equal(result.heroHpLost,3);
  g=f.makeModern();assert.equal(g.state.run.result.heroHpLost,3);assert.equal(g.state.run.result.enemyHpLost,2);
  const f2=fixture();f2.storage.setItem(engine.STORAGE,JSON.stringify({version:1,unlocked:1,upgrades:{shield:1},run:null}));g=f2.makeModern();g.start(1);g.ability('shield');f2.env.random=()=>.5;result=miss(g);assert.equal(result.heroHpLost,0);assert.equal(result.enemyHpLost,0);
  const f3=fixture('7');g=f3.makeModern();g.start(1);g.state.run.roster[0]='valve_lord';g.state.run.enemyHp=8;g.state.upgrades.sword=5;result=hit(g);assert.equal(g.state.run.enemyHp,5);assert.equal(result.enemyHpLost,3);
});
test('визуализация рядом со шкалами показывает фактические потери, а не исходный бросок', () => {
  const ui=dungeonViewFixture({version:1,unlocked:1,upgrades:{},run:null});ui.click('start');ui.click('option',{index:'1'});ui.click('attack');
  assert.match(ui.html,/dg-health-wrap[\s\S]*dg-hp-loss[^>]*aria-label="Монстр потерял \d+ здоровья"[^>]*>−\d+/);
  assert.doesNotMatch(ui.html,/aria-label="Герой потерял/);
  const css=fs.readFileSync(path.join(__dirname,'../css/dungeon.css'),'utf8');assert.match(css,/prefers-reduced-motion:no-preference/);assert.match(css,/\.dg-hp-loss \{ animation:dg-hp-pop/);
});

function adventureFixture(level=1, bank='1') {
  const f=fixture(bank); f.env.adventure=true; f.env.random=()=>.5; f.env.ownsAppearance=()=>false;
  f.storage.setItem(engine.STORAGE,JSON.stringify({version:1,gold:0,unlocked:level,upgrades:{sword:0,armor:0},discovered:[],run:null}));
  const g=f.makeModern(); assert.ok(g.start(level)); return {f,g};
}
function forceVictoryAtLast(g) { const r=g.state.run; r.enemy=r.roster.length-1; r.enemyHp=0;r.result={correct:true};g.save();assert.ok(g.next()); }
test('30 уровней не уничтожают старые звёзды и старый поход выше нового предела', () => {
  const f=fixture(); f.env.adventure=true; f.storage.setItem(engine.STORAGE,JSON.stringify({version:1,gold:20,unlocked:60,stars:{test:{'45':3,'1':2}},upgrades:{},run:null}));
  let g=f.makeModern(); assert.equal(g.start(31),false);assert.equal(g.start(30),true);g.abandon();g=f.makeModern();
  assert.equal(g.state.unlocked,60);assert.equal(g.state.stars.test['45'],3);assert.equal(g.state.gold,20);
  f.env.adventure=false;g.start(45);const hp=g.state.run.enemyMax; f.env.adventure=true; g=f.makeModern();assert.equal(g.state.run.level,45);assert.equal(g.state.run.enemyMax,hp);assert.ok(g.toggle(1));assert.ok(g.toggle(3));assert.ok(g.attack());
});
test('вероятности каждого оформления точны и у босса в три раза выше, без изменения при дубликатах', () => {
  const expected=Object.fromEntries(engine.THEME_WEIGHTS), normal={}, boss={};
  for (let i=0;i<10000;i++) { const random=()=>(i+.5)/10000;const a=engine.themeRoll(random,false),b=engine.themeRoll(random,true);if(a)normal[a]=(normal[a]||0)+1;if(b)boss[b]=(boss[b]||0)+1; }
  for(const [id,weight] of Object.entries(expected)) {assert.equal(normal[id],weight,id);assert.equal(boss[id],3*weight,id);}
  assert.equal(Object.values(normal).reduce((a,b)=>a+b,0),100);assert.equal(Object.values(boss).reduce((a,b)=>a+b,0),300);
});
test('комбо усиливает каждый третий ответ, ошибка его сбрасывает и цель награждается единожды', () => {
  const {f,g}=adventureFixture(); const r=g.state.run;r.roster[0]='slime';r.enemyHp=r.enemyMax=300;
  hit(g);g.next();hit(g);g.next();const result=hit(g);assert.equal(result.damage,18);assert.equal(r.combo,3);assert.match(result.notes.join(' '),/Комбо/);assert.equal(g.state.gold,30);assert.equal(g.state.milestones.combo,true);
  g.next();miss(g);assert.equal(r.combo,0);g.next();hit(g);assert.equal(r.combo,1);assert.equal(g.state.gold,30);
  const reload=f.makeModern();assert.equal(reload.state.milestones.combo,true);
});
test('события сохраняются, выбор однократен и последствия не меняют основной кошелёк', () => {
  const {f,g}=adventureFixture();const r=g.state.run;r.enemyHp=0;r.result={correct:true};assert.ok(g.next());assert.equal(r.status,'event');const event=r.event;
  let reload=f.makeModern();assert.equal(reload.state.run.event,event);assert.equal(reload.choose('invalid'),false);
  const choice=engine.EVENTS[event].choices.find(id=>id==='gold') || engine.EVENTS[event].choices.find(id=>id==='blade');const before=reload.state.gold;assert.ok(reload.choose(choice));assert.equal(reload.choose(choice),false);
  if(choice==='gold')assert.equal(reload.state.gold,before+25);else assert.equal(reload.state.run.bonusDamage,6);
  reload.state.run.enemyHp=0;reload.state.run.result={correct:true};assert.ok(reload.next());assert.equal(reload.state.run.status,'event');assert.notEqual(reload.state.run.event,event);
  assert.equal(f.storage.getItem('anatomy-colloquium-rewards-shared-v1'),null);
});
test('реликвия не убивает героя; полное здоровье и активный щит нельзя потратить впустую', () => {
  const {g}=adventureFixture();const r=g.state.run;r.status='event';r.event='chest';r.hp=3;const gold=g.state.gold;assert.ok(g.choose('risk'));assert.equal(r.hp,1);assert.equal(g.state.gold,gold+55);
  r.status='event';r.event='altar';r.hp=r.maxHp;r.shielded=true;assert.equal(g.choose('heal'),false);assert.equal(g.choose('shield'),false);assert.ok(g.choose('blade'));
});
test('редкие враги и боссы сильнее, дают больше золота и показывают предупреждения', () => {
  const {g}=adventureFixture(5);const r=g.state.run;assert.equal(r.kinds[2],'boss');const normal=engine.adventureStats(5,r.roster[2],'normal'),boss=engine.adventureStats(5,r.roster[2],'boss');assert.ok(boss.hp>normal.hp);assert.ok(boss.damage>=normal.damage);
  r.enemy=2;r.enemyHp=r.enemyMax=boss.hp;r.enemyDamage=boss.damage;r.special={};assert.match(engine.intent(r),/Босс/);miss(g);g.next();assert.match(engine.intent(r),/готовит/);const second=miss(g);assert.match(second.notes.join(' '),/усиленный удар/);
  const e=adventureFixture(2);e.g.state.run.kinds[0]='elite';e.g.state.run.enemyHp=0;e.g.state.run.result={correct:true};e.g.next();assert.equal(e.g.state.run.loot,2*engine.monsterReward(2,0));assert.equal(e.g.state.milestones.elite,true);
});
test('награда оформления выпадает однократно, дубликат даёт золото, победа и цели сохраняются', () => {
  let {f,g}=adventureFixture(5);f.env.random=()=>0;forceVictoryAtLast(g);assert.equal(g.state.run.themeDrop.id,'ocean');assert.equal(g.state.run.themeDrop.duplicate,false);assert.equal(g.state.milestones.first,true);const gold=g.state.gold;
  g=f.makeModern();assert.equal(g.state.run.themeDrop.id,'ocean');assert.equal(g.next(),false);assert.equal(g.state.gold,gold);
  ({f,g}=adventureFixture(30));f.env.ownsAppearance=()=>true;f.env.random=()=>0;forceVictoryAtLast(g);assert.equal(g.state.run.themeDrop.duplicate,true);assert.equal(g.state.run.duplicateGold,50);assert.equal(g.state.milestones.finale,true);assert.equal(g.state.unlocked,30);
});
test('на высоких уровнях подготовленному герою не нужны десятки правильных ответов на монстра', () => {
  const {f,g}=adventureFixture(30);g.state.upgrades.sword=5;f.env.random=()=>.5;let hits=0,events=0;
  while(g.state.run.status==='fight'||g.state.run.status==='event') {
    if(g.state.run.status==='event') { const event=engine.EVENTS[g.state.run.event];const choice=event.choices.find(x=>x==='blade'||x==='gold');assert.ok(g.choose(choice));events++; }
    else {hit(g);hits++;g.next();} assert.ok(hits<20);
  }
  assert.equal(g.state.run.status,'victory');assert.equal(events,2);assert.ok(hits<=13);
});
test('выпавшее оформление выдаётся через общую коллекцию и повтор после ошибки не меняет кошелёк', () => {
  let fail=true, calls=0, owned=false, balance=100;
  const api={appearances:{ocean:{title:'Океан'}},profile:()=>({appearances:{ocean:owned}}),importAppearances(file){calls++;assert.equal(file.sharedRewards.appearances.ocean,true);if(fail)return {ok:false};owned=true;return {ok:true};}};
  const run={bank:'test',level:1,status:'victory',themeDrop:{id:'ocean',duplicate:false},loot:0,reward:100,stars:3,mistakes:0,roster:['skeleton','slime','bat'],special:{},rewarded:[]};
  const ui=dungeonViewFixture({version:1,unlocked:2,gold:100,upgrades:{},run},'test',true,api);
  assert.equal(owned,false);assert.match(ui.html,/data-dg="claim"/);assert.match(ui.html,/data-dg="abandon" disabled/);assert.equal(ui.state().run.themeGranted,undefined);
  fail=false;ui.click('claim');assert.equal(owned,true);assert.equal(ui.state().run.themeGranted,true);assert.equal(balance,100);assert.match(ui.html,/Открыто для всего сайта/);assert.equal(calls,2);
  ui.click('abandon');assert.equal(ui.state().run,null);
});
test('щит из находки нельзя случайно заменить зарядом способности', () => {
  const {g}=adventureFixture();g.state.upgrades.shield=1;g.state.run.shielded=true;
  assert.equal(g.ability('shield'),false);assert.equal(g.state.run.used.shield,undefined);assert.equal(g.state.run.shielded,true);
});

test('здоровье новых походов и каждое улучшение брони имеют понятные значения', () => {
  assert.equal(engine.heroMaxHp(0),40);for(let armor=1;armor<=6;armor++)assert.equal(engine.heroMaxHp(armor),40+armor*10);
  const {f,g}=adventureFixture();assert.equal(g.state.run.hp,40);assert.equal(g.state.run.maxHp,40);assert.equal(g.state.run.healthBalanceVersion,2);
  g.abandon();g.state.gold=200;assert.ok(g.buy('armor'));assert.ok(g.start(1));assert.equal(g.state.run.maxHp,50);assert.equal(f.makeModern().state.run.maxHp,50);
});
test('при четырёх одинаковых попаданиях дополнительный уровень брони может спасти героя', () => {
  for(const armor of [0,1]) {
    const {g}=adventureFixture();g.abandon();g.state.upgrades.armor=armor;g.start(1);const r=g.state.run;
    r.roster[0]='slime';r.enemyDamage=10;
    for(let i=0;i<4;i++){const result=miss(g);assert.equal(result.incoming,10);g.next();}
    if(armor===0)assert.equal(r.status,'defeat');else {assert.equal(r.status,'fight');assert.equal(r.hp,10);}
  }
});
test('новое лечение и лечебный настой слабее, прежние походы сохраняют старые значения после загрузки', () => {
  const {f,g}=adventureFixture();const r=g.state.run;g.state.upgrades.heal=1;r.hp=10;assert.ok(g.ability('heal'));assert.equal(r.hp,25);
  r.status='event';r.event='altar';r.hp=10;assert.ok(g.choose('heal'));assert.equal(r.hp,20);
  r.maxHp=100;r.hp=30;delete r.healthBalanceVersion;delete r.used.heal;r.status='fight';g.save();
  const old=f.makeModern();assert.equal(old.state.run.maxHp,100);assert.ok(old.ability('heal'));assert.equal(old.state.run.hp,50);
  old.state.run.status='event';old.state.run.event='altar';assert.ok(old.choose('heal'));assert.equal(old.state.run.hp,70);
});
test('мастерская показывает текущее здоровье и прибавку от следующего уровня брони', () => {
  const ui=dungeonViewFixture({version:1,unlocked:1,gold:100,upgrades:{armor:0},run:null});
  assert.match(ui.html,/Герой: 40 ♥/);ui.click('section',{id:'shop'});assert.match(ui.html,/40 ♥ → 50 ♥/);assert.match(ui.html,/\+10 за уровень/);
  ui.click('buy',{id:'armor'});assert.match(ui.html,/50 ♥ → 60 ♥/);ui.click('section',{id:'camp'});ui.click('start');assert.equal(ui.state().run.hp,50);
});

test('урон новых врагов растёт заметнее, сохраняя различия видов и показатели здоровья', () => {
  const levels=[1,5,15,30], expected=[10,12,17,24], old=[10,10,12,15];
  levels.forEach((level,i)=>{
    assert.equal(engine.adventureStats(level,'skeleton','normal').damage,expected[i]);
    assert.equal(engine.adventureStats(level,'skeleton','normal',1).damage,old[i]);
    assert.equal(engine.adventureStats(level,'skeleton','normal').hp,engine.adventureStats(level,'skeleton','normal',1).hp);
    assert.ok(engine.adventureStats(level,'bat','normal').damage>engine.adventureStats(level,'golem','normal').damage);
  });
  for(const id of engine.IDS)for(let level=2;level<=30;level++)assert.ok(engine.adventureStats(level,id,'normal').damage>=engine.adventureStats(level-1,id,'normal').damage,id);
});
test('новый поход сохраняет новую шкалу урона при переходах и перезагрузке', () => {
  const {f,g}=adventureFixture(30);let r=g.state.run;assert.equal(r.enemyBalanceVersion,2);
  assert.equal(r.enemyDamage,engine.adventureStats(30,r.roster[0],r.kinds[0]).damage);
  r.enemyHp=0;r.result={correct:true};assert.ok(g.next());assert.equal(r.status,'event');
  let next=f.makeModern();r=next.state.run;assert.equal(r.enemyBalanceVersion,2);assert.equal(r.enemyDamage,engine.adventureStats(30,r.roster[1],r.kinds[1]).damage);
  const choice=engine.EVENTS[r.event].choices.find(id=>id==='blade'||id==='gold');assert.ok(next.choose(choice));r.enemyHp=0;r.result={correct:true};assert.ok(next.next());
  assert.equal(r.enemyDamage,engine.adventureStats(30,r.roster[2],'boss').damage);
});
test('начатый до изменения поход сохраняет прежний урон для всех оставшихся врагов', () => {
  const {f,g}=adventureFixture(30);let r=g.state.run;delete r.enemyBalanceVersion;r.enemyDamage=19;r.hp=23;r.enemyHp=0;r.result={correct:true};g.save();
  let old=f.makeModern();assert.equal(old.state.run.enemyDamage,19);assert.equal(old.state.run.hp,23);assert.ok(old.next());r=old.state.run;
  assert.equal(r.enemyDamage,engine.adventureStats(30,r.roster[1],r.kinds[1],1).damage);
  let choice=engine.EVENTS[r.event].choices.find(id=>id==='blade'||id==='gold');assert.ok(old.choose(choice));r.enemyHp=0;r.result={correct:true};assert.ok(old.next());
  assert.equal(r.enemyDamage,engine.adventureStats(30,r.roster[2],'boss',1).damage);
});
test('в реальном ходе повышенный урон отражается в потере здоровья при ошибке', () => {
  for(const [version,expected] of [[1,15],[2,24]]) {
    const {g}=adventureFixture(30),r=g.state.run;r.roster[0]='skeleton';r.enemyDamage=engine.adventureStats(30,'skeleton','normal',version).damage;
    const result=miss(g);assert.equal(result.incoming,expected);assert.equal(result.heroHpLost,expected);assert.equal(r.hp,40-expected);
  }
});

test('выбор в бою обновляет кнопку без перерисовки и сохраняет ответ', () => {
  const ui = dungeonViewFixture();
  assert.match(ui.html, /Экспериментальная версия/);
  assert.match(ui.html, /лучше работает на ПК/);
  ui.click('start');
  const renders = ui.renders;
  const option = ui.click('option', {index:'1'});
  assert.equal(ui.renders, renders);
  assert.ok(option.classes.has('is-selected'));
  assert.equal(option.attrs['aria-pressed'], 'true');
  assert.equal(option.mark.textContent, '✓');
  assert.equal(ui.attack.disabled, false);
  assert.deepEqual(ui.state().run.selected, [1]);
  const removed = ui.click('option', {index:'1'});
  assert.equal(ui.renders, renders);
  assert.equal(removed.attrs['aria-pressed'], 'false');
  assert.equal(removed.mark.textContent, '1');
  assert.equal(ui.attack.disabled, true);
});
