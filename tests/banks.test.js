/* Ленивая загрузка баз: синхронно грузится выбранная, остальные регистрируются фоном. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function makeContext(storage) {
  return vm.createContext({
    window: {}, console, setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage: { getItem: (k) => storage[k] || null, setItem: (k, v) => { storage[k] = v; } }
  });
}
function run(context, file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

test('modules.js подключает только загруженные базы, остальные — через registerColloquiumBanks()', () => {
  const context = makeContext({ 'anatomy-colloquium-selected': '3' });
  run(context, 'js/data/colloquium-3.js');
  run(context, 'js/modules.js');
  const w = context.window;
  assert.deepEqual(Array.from(w.COLLOQUIUM_IDS), ['3']);
  assert.equal(w.ACTIVE_COLLOQUIUM.id, '3');
  assert.equal(w.ACTIVE_COLLOQUIUM.semester, 2);
  assert.equal(w.QUESTIONS.length, 254);
  assert.equal(Object.keys(w.ANSWER_KEY).length > 0, true);
  assert.equal(typeof w.registerColloquiumBanks, 'function');

  // фон подгружает остальные базы
  for (const file of ['js/data/questions.js', 'js/data/answers.js', 'js/data/exam.js',
    'js/data/colloquium-2.js', 'js/data/colloquium-4.js', 'js/data/colloquium-5.js', 'js/data/colloquium-6.js',
    'js/data/colloquium-7.js', 'js/data/credit-1.js', 'js/data/credit-2.js', 'js/data/dental-2.js', 'js/data/dental-3.js']) {
    run(context, file);
  }
  assert.equal(w.registerColloquiumBanks(), true, 'появились новые базы');
  assert.equal(w.COLLOQUIUM_IDS.length, 11);
  // активная база и её глобалы не заменились фоновой регистрацией
  assert.equal(w.ACTIVE_COLLOQUIUM.id, '3');
  assert.equal(w.QUESTIONS.length, 254);
  assert.equal(w.COLLOQUIUM_MODULES['1'].questions.length, 211);
  assert.equal(w.COLLOQUIUM_MODULES['stom-3'].questions.length, 132);
  assert.equal(w.registerColloquiumBanks(), false, 'повторный вызов идемпотентен');
});

test('modules.js: выбранная база 1 со всеми своими файлами работает как раньше', () => {
  const context = makeContext({});
  run(context, 'js/data/questions.js');
  run(context, 'js/data/answers.js');
  run(context, 'js/data/exam.js');
  run(context, 'js/modules.js');
  const w = context.window;
  assert.deepEqual(Array.from(w.COLLOQUIUM_IDS), ['1']);
  assert.equal(w.ACTIVE_COLLOQUIUM.examAvailable, true);
  assert.equal(w.QUESTIONS.length, 211);
  assert.equal(w.COLLOQUIUM_MODULES['1'].questions.length, 211);
});
