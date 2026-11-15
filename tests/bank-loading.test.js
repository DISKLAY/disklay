/* Ленивая загрузка баз: на старте подключается только активная база,
   а размеры и темы остальных берутся из манифеста. */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

// Прогон как в браузере: банк активной базы вставлен на месте (document.write).
function boot(selected, extra = []) {
  const storage = selected ? { 'anatomy-colloquium-selected': selected } : {};
  const document = { readyState: 'loading', write() {}, head: { appendChild() {} }, createElement: () => ({ setAttribute() {} }) };
  const window = {};
  const context = vm.createContext({ window, document, console, localStorage: {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null),
    setItem: (key, value) => { storage[key] = String(value); },
    removeItem: (key) => { delete storage[key]; },
  } });
  const bootFiles = ['js/data/bank-index.js', 'js/data/bank-questions.js', 'js/data/exam.js', 'js/bank-loader.js', 'js/data/questions.js', 'js/data/answers.js', 'js/modules.js'];
  bootFiles.forEach((file) => vm.runInContext(read(file), context, { filename: file }));
  extra.forEach((file) => vm.runInContext(read(file), context, { filename: file }));
  return { window, storage };
}

test('на старте подключается только активная база, остальные — из манифеста', () => {
  const html = read('index.html');
  // Ни одной базы, кроме первой, в разметке быть не должно.
  for (const bank of ['colloquium-2', 'colloquium-3', 'colloquium-4', 'colloquium-5', 'colloquium-6', 'colloquium-7', 'credit-1', 'credit-2', 'dental-2', 'dental-3']) {
    assert.doesNotMatch(html, new RegExp('js/data/' + bank + '.js'), bank);
  }
  assert.doesNotMatch(html, /js\/data\/questions\.js/);
  assert.match(html, /js\/data\/bank-index\.js/);
  assert.match(html, /js\/data\/bank-questions\.js/);
  assert.match(html, /js\/bank-loader\.js/);
  assert.match(html, /js\/active-bank\.js/);
});

test('выбранная база загружается при старте, а чужие остаются пустыми до запроса', () => {
  const { window } = boot(null);
  assert.equal(window.MEDZO_ACTIVE_BANK, '1');
  assert.equal(window.QUESTIONS.length, 211);
  assert.equal(Object.keys(window.ANSWER_KEY).length, 211);
  assert.equal(window.COLLOQUIUM_MODULES['2'].questions, undefined);
  // Метаданные есть всегда: список баз показывает размеры без загрузки данных.
  assert.equal(window.MEDZO_BANK_INDEX['2'].questions, 188);
  assert.equal(window.MEDZO_BANK_INDEX['stom-3'].keyed, 0);
  assert.ok(window.MEDZO_BANK_INDEX['2'].topics.includes('back'));
  assert.ok(window.MEDZO_BANK_INDEX['2'].topicTitles.back);
  assert.equal(window.MEDZO_BANK_QUESTIONS['2'].nums.length, 188);
});

test('манифест совпадает с реальными базами и знает нечисловые номера', () => {
  const { window } = boot(null);
  const index = window.MEDZO_BANK_INDEX;
  const expected = { '1': 211, '2': 188, '3': 254, '4': 257, '5': 161, '6': 118, '7': 209, 'credit-1': 245, 'credit-2': 297, 'stom-2': 102, 'stom-3': 132 };
  for (const [id, count] of Object.entries(expected)) {
    assert.equal(index[id].questions, count, id);
    assert.equal(window.MEDZO_BANK_QUESTIONS[id].nums.length, count, id);
  }
  // В первой базе есть вопрос № 58а — манифест хранит номер как строку.
  assert.ok(window.MEDZO_BANK_QUESTIONS['1'].nums.includes('58а'));
});

test('база, подключённая позже, сразу видна модулю и общему словарю', () => {
  const { window } = boot(null);
  const module = window.COLLOQUIUM_MODULES['2'];
  assert.equal(module.questions, undefined);
  // Файл базы пишем в то же окно, что и загрузчик: так работает ленивая подгрузка.
  const context = vm.createContext({ window, console });
  vm.runInContext(read('js/data/colloquium-2.js'), context);
  assert.equal(module.questions.length, 188);
  assert.equal(Object.keys(module.answers).length, 188);
  assert.ok(module.topics.length > 0);
});

test('портфель и достижения видят чужие базы, не загружая их', () => {
  const { window, storage } = boot(null, ['js/core.js']);
  storage['anatomy-colloquium-v1-2'] = JSON.stringify({ favorites: { q5: true }, progress: { q1: { attempts: 2, streak: 2 }, q2: { attempts: 2, streak: 2 } } });
  const groups = window.AT.portfolio.allFavorites();
  assert.equal(groups.length, 1);
  assert.equal(groups[0].module.id, '2');
  assert.equal(groups[0].loaded, false);
  assert.equal(groups[0].questions[0].question.num, '5');
  assert.equal(groups[0].questions[0].question.topic, 'back');
  assert.ok(groups[0].questions[0].question.pending);
  // Тема вопроса из манифеста: у миологии она есть, даже если файл не пришёл.
  assert.deepEqual(Array.from(window.AT.portfolio.banksWithFavorites()), ['2']);
  assert.equal(window.MEDZO_BANK_INDEX['2'].questions, 188);
});

test('раскладка баз пересобирается скриптом и не расходится с данными', () => {
  const script = read('scripts/build-bank-index.cjs');
  for (const file of ['questions.js', 'answers.js', 'colloquium-7.js', 'dental-3.js']) assert.match(script, new RegExp(file.replace('.', '\\.')));
  assert.match(script, /MEDZO_BANK_INDEX/);
  assert.match(script, /MEDZO_BANK_QUESTIONS/);
  // Загрузчик уточняет манифест, если база изменилась без пересборки.
  assert.match(read('js/bank-loader.js'), /function remember/);
});
