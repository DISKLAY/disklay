const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness({mode = 'train', key = [1], enabled = true, total = 2} = {}) {
  let now = 0, nextId = 1, advances = 0, nextFrameId = 1;
  const choices = [], listeners = {};
  const frames = new Map();
  const sprites = Array.from({length:3}, (_, i) => ({style:{}, hovered:false, matches(){return this.hovered}, getAttribute:()=>String(i)}));
  const timers = new Map();
  const setTimeoutFake = (fn, delay) => { const id = nextId++; timers.set(id, {fn, at: now + delay}); return id; };
  const tick = ms => {
    const until = now + ms;
    while (true) {
      const next = [...timers.entries()].filter(([, t]) => t.at <= until).sort((a,b) => a[1].at - b[1].at)[0];
      if (!next) break;
      timers.delete(next[0]); now = next[1].at; next[1].fn();
    }
    now = until;
  };
  const qs = Array.from({length:total}, (_, i) => ({id:'q' + (i+1), options:['A','B','C']}));
  const session = {mode, index:0, results:{q1:{selected:[1], revealed:false}}};
  let panel = null, overlay = null;
  const target = { classes: new Set(), classList:{add(v){target.classes.add(v)}, remove(v){target.classes.delete(v)}} };
  const card = { getBoundingClientRect:()=>({left:40, top:130, width:300, height:600}), querySelector: () => ({ insertAdjacentElement(_, el) { panel = el; } }) };
  const host = {isConnected:true, listeners:{}, addEventListener(k, fn){this.listeners[k]=fn}, removeEventListener(k){delete this.listeners[k]}, contains:()=>true,
    querySelector(s){if (s === '.question') return card; if (s === '.germ-squad') return panel; if (s === '.option--germ-target') return target; if (s.startsWith('[data-action="toggle-option"]')) return target; if (s === '.germ-squad__status') return {textContent:''}; return null;}};
  const doc = {hidden:false, activeElement:null, blocked:false, querySelector(){return this.blocked ? {} : null},
    body:{appendChild(el){overlay = el}},
    createElement(){return {innerHTML:'', listeners:{}, setAttribute(){}, addEventListener(k, fn){this.listeners[k]=fn}, contains:()=>true,
      querySelector:()=>null, querySelectorAll:()=>sprites, remove(){if (overlay === this) overlay=null; else panel=null}}}};
  let saves = 0;
  const AT = {getState:()=>({settings:{germSquad:enabled}}), currentSession:()=>session, save:()=>{saves++}, keyApi:{forQuestion:()=>key ? {answers:key} : null}, ui:{toast:()=>{}}};
  const win = {AT, innerWidth:390, innerHeight:844, matchMedia:()=>({matches:false}), addEventListener(k,fn){listeners[k]=fn}, removeEventListener(k){delete listeners[k]},
    requestAnimationFrame(fn){const id = nextFrameId++; frames.set(id, fn); return id}, cancelAnimationFrame(id){frames.delete(id)}};
  const ctx = vm.createContext({window:win, document:doc, setTimeout:setTimeoutFake, clearTimeout:id=>timers.delete(id), Math});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js/germ-squad.js'), 'utf8'), ctx);
  const squad = AT.germSquad.mount({host, session, questions:qs, onChooseWrong:index=>{choices.push(index); session.results.q1.selected.push(index); return true;}});
  function pop(i) {
    const button = {disabled:false, classList:{add(){}}, getAttribute:()=>String(i), setAttribute(){}, closest(){return this}};
    overlay.listeners.click({target:button});
    return button;
  }
  function frame(time) { const [id, callback] = frames.entries().next().value; frames.delete(id); callback(time); }
  return {AT, squad, session, qs, tick, pop, doc, target, timers, frames, sprites, frame, listeners, choices, getOverlay:()=>overlay, getPanel:()=>panel, getAdvances:()=>advances, getSaves:()=>saves};
}

test('тестовая вероятность 100%, три клика останавливают проделку и повторно не запускают её на вопросе', () => {
  const h = harness(); assert.equal(h.AT.germSquad.APPEARANCE_CHANCE, 1);
  h.squad.enter(); assert.equal(h.getPanel(), null); assert.match(h.getOverlay().innerHTML, /data-action="pop-germ"/);
  assert.equal(h.getSaves(), 1);
  for (let i = 0; i < 3; i++) assert.equal(h.pop(i).disabled, true);
  h.tick(30000); assert.equal(h.getAdvances(), 0); assert.deepEqual(h.session.results.q1.selected, [1]);
  h.squad.leave(); h.squad.enter(); assert.equal(h.timers.size, 0);
});

test('микробы выбирают только невыбранные неправильные варианты без проверки и перелистывания', () => {
  const h = harness(); h.squad.enter(); h.tick(12000);
  assert.equal(h.target.classes.has('option--germ-target'), true);
  h.tick(1800); assert.equal(h.getAdvances(), 0);
  assert.equal(h.choices.length, 1); assert.ok([2,3].includes(h.choices[0]));
  assert.ok(h.session.results.q1.selected.includes(1));
  assert.equal(h.session.results.q1.revealed, false);
  h.tick(13800); assert.equal(h.choices.length, 2);
  assert.deepEqual([...h.session.results.q1.selected].sort(), [1,2,3]);
  h.tick(30000); assert.equal(h.choices.length, 2); assert.equal(h.getAdvances(), 0);
});

test('микробы не снимают уже выбранный или скрытый вариант во время атаки', () => {
  const h = harness(); h.squad.enter(); h.tick(12000);
  h.session.results.q1.selected = [1,2,3];
  h.tick(1800); assert.deepEqual(h.session.results.q1.selected, [1,2,3]); assert.equal(h.choices.length, 0);
  h.session.results.q1.selected = [1]; h.session.results.q1.hiddenOptions = [2];
  h.tick(13800); assert.deepEqual(h.choices, [3]);
});

test('на последнем вопросе, при выходе, экзамене и без ключа нет опасного автозавершения', () => {
  const last = harness({total:1}); last.squad.enter(); last.tick(14000); assert.equal(last.getAdvances(), 0);
  const left = harness(); left.squad.enter(); left.squad.dispose(); left.tick(20000); assert.equal(left.getAdvances(), 0);
  for (const opts of [{mode:'exam'}, {key:null}, {key:[1,2,3]}, {enabled:false}]) {
    const h = harness(opts); h.squad.enter(); assert.equal(h.timers.size, 0); assert.equal(h.getOverlay(), null);
  }
});

test('закрытие диалога или возвращение на вкладку не меняет ответ и не ускоряет действие', () => {
  const h = harness(); h.squad.enter(); h.doc.hidden = true; h.tick(15000); assert.equal(h.getAdvances(), 0);
  h.doc.hidden = false; h.doc.blocked = true; h.tick(3000); assert.equal(h.getAdvances(), 0);
  h.doc.blocked = false; h.tick(1500); assert.equal(h.target.classes.has('option--germ-target'), true);
  h.doc.blocked = true; h.tick(3000); assert.equal(h.getAdvances(), 0);
  h.doc.blocked = false; h.tick(1500); assert.equal(h.getAdvances(), 0); assert.equal(h.choices.length, 1);
});


test('микробы появляются за тремя краями экрана и движутся к вопросу, не теряясь при перерисовке', () => {
  const h = harness(); h.squad.enter(); const layer = h.getOverlay();
  const coords = sprite => sprite.style.transform.match(/translate3d\(([-.\d]+)px,([-.\d]+)px/).slice(1).map(Number);
  h.frame(0); const start = h.sprites.map(coords);
  assert.ok(start[0][0] < -26); assert.ok(start[1][0] > 390); assert.ok(start[2][1] < -26);
  h.frame(4000); const middle = h.sprites.map(coords);
  assert.ok(middle[0][0] > start[0][0]); assert.ok(middle[1][0] < start[1][0]); assert.ok(middle[2][1] > start[2][1]);
  h.squad.refresh(); assert.equal(h.getOverlay(), layer);
  h.squad.leave(); assert.equal(h.getOverlay(), null); assert.equal(h.frames.size, 0);
});


test('микробы следуют за курсором, замирают при наведении и удаляют обработчик при выходе', () => {
  const h = harness(); h.squad.enter(); h.frame(0); h.frame(8500);
  const coord = s => s.style.transform.match(/translate3d\(([-.\d]+)px,([-.\d]+)px/).slice(1).map(Number);
  const before = coord(h.sprites[0]);
  h.listeners.pointermove({pointerType:'mouse', clientX:80, clientY:90});
  for (let time = 8516; time <= 9500; time += 16) h.frame(time);
  const after = coord(h.sprites[0]);
  assert.ok(Math.hypot(after[0]-80, after[1]-90) < Math.hypot(before[0]-80, before[1]-90));
  h.sprites[0].hovered = true;
  h.listeners.pointermove({pointerType:'mouse', clientX:280, clientY:500});
  h.frame(9520); assert.deepEqual(coord(h.sprites[0]), after);
  h.squad.dispose(); assert.equal(h.listeners.pointermove, undefined);
});
