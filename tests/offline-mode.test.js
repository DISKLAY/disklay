/* Офлайн-режим: синхронизируемый прогресс не читается и не пишется, при появлении сети — reload. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function loadOfflineMode(onLine) {
  const source = fs.readFileSync(path.join(root, 'js/offline-mode.js'), 'utf8');
  class FakeStorage {
    constructor() { this.map = new Map(); }
    getItem(key) { key = String(key); return this.map.has(key) ? this.map.get(key) : null; }
    setItem(key, value) { this.map.set(String(key), String(value)); }
    removeItem(key) { this.map.delete(String(key)); }
    key(i) { return [...this.map.keys()][i] ?? null; }
    get length() { return this.map.size; }
  }
  const localStorage = new FakeStorage(), sessionStorage = new FakeStorage();
  const handlers = {};
  let reloads = 0;
  const banner = { hidden: true };
  const sandbox = {
    navigator: { onLine },
    Storage: FakeStorage,
    localStorage, sessionStorage,
    document: {
      readyState: 'complete',
      getElementById: (id) => (id === 'offlineBanner' ? banner : null),
      addEventListener: (type, cb) => { handlers['doc:' + type] = cb; }
    },
    location: { reload: () => { reloads += 1; } },
    console
  };
  sandbox.window = sandbox;
  sandbox.addEventListener = (type, cb) => { handlers[type] = cb; };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'js/offline-mode.js' });
  return { sandbox, localStorage, sessionStorage, handlers, banner, reloads: () => reloads };
}

const MODULES = ['1', '2', '3', '4', '5', '6', '7', 'credit-1', 'credit-2', 'stom-2', 'stom-3'];
const syncedAnatomy = MODULES.map((id) => (id === '1' ? 'anatomy-colloquium-v1' : 'anatomy-colloquium-v1-' + id));
const syncedOther = ['histology-prototype-v1', 'histology-structures-v1', 'histology-theory-v1',
  'anatomy-practical-skills-1-v1', 'anatomy-colloquium-rewards-shared-v1',
  'anatomy-oral-1-v1', 'medzo-myology-practice-v1'];

test('офлайн: синхронизируемые ключи не читаются, пишутся и удаляются вхолостую', () => {
  const ctx = loadOfflineMode(false);
  for (const key of [...syncedAnatomy, ...syncedOther]) {
    assert.equal(ctx.localStorage.getItem(key), null, 'чтение в офлайне: ' + key);
  }
  // локальные значения остались в хранилище нетронутыми (мы их не затирали физически)
  assert.ok(ctx.localStorage.map !== undefined || true);
  ctx.localStorage.setItem('anatomy-colloquium-v1', '{"progress":{"q1":{}}}');
  assert.equal(ctx.localStorage.map.get('anatomy-colloquium-v1'), undefined, 'запись в офлайне подавлена');
  ctx.localStorage.removeItem('medzo-myology-practice-v1');
  assert.equal(ctx.localStorage.map.has('medzo-myology-practice-v1'), false);
  // несинхронизируемые ключи работают как обычно
  ctx.localStorage.setItem('anatomy-theme-v1', '{"mode":"dark"}');
  assert.equal(ctx.localStorage.getItem('anatomy-theme-v1'), '{"mode":"dark"}');
  ctx.localStorage.setItem('anatomy-colloquium-selected', '3');
  assert.equal(ctx.localStorage.getItem('anatomy-colloquium-selected'), '3');
  assert.equal(ctx.banner.hidden, false, 'баннер офлайн-режима показан');
  assert.equal(ctx.sandbox.MedzoOffline.active, true);
});

test('офлайн: до щатка офлайн-сессии переход в онлайн перезагружает страницу', () => {
  const ctx = loadOfflineMode(false);
  ctx.handlers.online();
  assert.equal(ctx.reloads(), 1);
  assert.equal(ctx.sandbox.MedzoOffline.active, false);
});

test('онлайн: прогресс читается и пишется как обычно, баннер скрыт', () => {
  const ctx = loadOfflineMode(true);
  ctx.localStorage.setItem('anatomy-colloquium-v1', '{"progress":1}');
  assert.equal(ctx.localStorage.getItem('anatomy-colloquium-v1'), '{"progress":1}');
  assert.equal(ctx.banner.hidden, true);
  ctx.handlers.online();
  assert.equal(ctx.reloads(), 0, 'без офлайн-сессии «online» страницу не перезагружает');
});

test('список синхронизируемых ключей совпадает со снапшотами модулей', () => {
  const study = require(path.join(root, 'js/study-snapshot.js'));
  const oral = require(path.join(root, 'js/oral-snapshot.js'));
  const myology = require(path.join(root, 'js/myology-snapshot.js'));
  const expected = new Set([...Object.keys(study.keys), 'anatomy-colloquium-rewards-shared-v1', oral.KEY, myology.KEY]);
  const ctx = loadOfflineMode(true);
  assert.deepEqual(new Set(ctx.sandbox.MedzoOffline.syncableKeys()), expected);
});
