const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness({mode = 'train', key = [1], enabled = true, total = 2} = {}) {
  let now = 0, nextId = 1, advances = 0;
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
  let panel = null;
  const target = { classes: new Set(), classList:{add(v){target.classes.add(v)}, remove(v){target.classes.delete(v)}} };
  const card = { querySelector: () => ({ insertAdjacentElement(_, el) { panel = el; } }) };
  const host = {isConnected:true, listeners:{}, addEventListener(k, fn){this.listeners[k]=fn}, removeEventListener(k){delete this.listeners[k]}, contains:()=>true,
    querySelector(s){if (s === '.question') return card; if (s === '.germ-squad') return panel; if (s === '.option--germ-target') return target; if (s.startsWith('[data-action="toggle-option"]')) return target; if (s === '.germ-squad__status') return {textContent:''}; return null;}};
  const doc = {hidden:false, activeElement:null, blocked:false, querySelector(){return this.blocked ? {} : null}, createElement(){return {innerHTML:'', querySelector:()=>null, remove(){panel=null}}}};
  let saves = 0;
  const AT = {getState:()=>({settings:{germSquad:enabled}}), currentSession:()=>session, save:()=>{saves++}, keyApi:{forQuestion:()=>key ? {answers:key} : null}, ui:{toast:()=>{}}};
  const ctx = vm.createContext({window:{AT}, document:doc, setTimeout:setTimeoutFake, clearTimeout:id=>timers.delete(id), Math});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js/germ-squad.js'), 'utf8'), ctx);
  const squad = AT.germSquad.mount({host, session, questions:qs, onAdvance:()=>{advances++;session.index++}});
  function pop(i) {
    const button = {disabled:false, classList:{add(){}}, getAttribute:()=>String(i), setAttribute(){}, closest(){return this}};
    host.listeners.click({target:button});
    return button;
  }
  return {AT, squad, session, qs, tick, pop, doc, target, timers, getPanel:()=>panel, getAdvances:()=>advances, getSaves:()=>saves};
}

test('тестовая вероятность 100%, три клика останавливают проделку и повторно не запускают её на вопросе', () => {
  const h = harness(); assert.equal(h.AT.germSquad.APPEARANCE_CHANCE, 1);
  h.squad.enter(); assert.match(h.getPanel().innerHTML, /Бригада микробов/);
  assert.equal(h.getSaves(), 1);
  for (let i = 0; i < 3; i++) assert.equal(h.pop(i).disabled, true);
  h.tick(30000); assert.equal(h.getAdvances(), 0); assert.deepEqual(h.session.results.q1.selected, [1]);
  h.squad.leave(); h.squad.enter(); assert.equal(h.timers.size, 0);
});

test('шалость имитирует неверный вариант и перелистывает без изменения ответа', () => {
  const h = harness(); h.squad.enter(); h.tick(12000);
  assert.equal(h.target.classes.has('option--germ-target'), true);
  h.tick(1800); assert.equal(h.getAdvances(), 1);
  assert.deepEqual(h.session.results.q1.selected, [1]);
  assert.equal(h.session.results.q1.revealed, false);
});

test('на последнем вопросе, при выходе, экзамене и без ключа нет опасного автозавершения', () => {
  const last = harness({total:1}); last.squad.enter(); last.tick(14000); assert.equal(last.getAdvances(), 0);
  const left = harness(); left.squad.enter(); left.squad.dispose(); left.tick(20000); assert.equal(left.getAdvances(), 0);
  for (const opts of [{mode:'exam'}, {key:null}, {key:[1,2,3]}, {enabled:false}]) {
    const h = harness(opts); h.squad.enter(); assert.equal(h.timers.size, 0); assert.equal(h.getPanel(), null);
  }
});

test('закрытие диалога или возвращение на вкладку не меняет ответ и не ускоряет действие', () => {
  const h = harness(); h.squad.enter(); h.doc.hidden = true; h.tick(15000); assert.equal(h.getAdvances(), 0);
  h.doc.hidden = false; h.doc.blocked = true; h.tick(3000); assert.equal(h.getAdvances(), 0);
  h.doc.blocked = false; h.tick(1500); assert.equal(h.target.classes.has('option--germ-target'), true);
  h.doc.blocked = true; h.tick(3000); assert.equal(h.getAdvances(), 0);
  h.doc.blocked = false; h.tick(1500); assert.equal(h.getAdvances(), 1);
});
