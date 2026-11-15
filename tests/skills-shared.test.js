/* Практические навыки всех коллоквиумов: один интерфейс, один движок.
   Проверяем, что миология переехала в тот же каркас ps-*, что и первый
   коллоквиум, и что её оценки по-прежнему совместимы с отдельным снимком. */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function load(files, storage = {}) {
  const window = {};
  const context = vm.createContext({ window, console, localStorage: {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null),
    setItem: (key, value) => { storage[key] = String(value); },
    removeItem: (key) => { delete storage[key]; },
  } });
  files.forEach((file) => vm.runInContext(read(file), context, { filename: file }));
  return { window, storage };
}

const base = ['js/skills-engine.js', 'js/skills-registry.js'];

test('оба коллоквиума описаны в одном реестре и дают одинаковую форму данных', () => {
  const { window } = load([...base, 'js/anatomy-skills-data.js', 'js/myology-data.js', 'js/anatomy-skills.js']);
  const registry = window.MedzoSkillsRegistry;
  const first = registry.get('anatomySkills'), second = registry.get('myologySkills');
  assert.ok(first && second);
  assert.equal(first.items.length, 330);
  assert.equal(second.items.length, 222);
  assert.equal(first.sections.length, 23);
  // У миологии разделов нет — темы и разделы справочника совпадают.
  assert.equal(second.sections.length, second.groups.length);
  assert.equal(second.sections[0].from, 1);
  // Ключи хранения разные: прогресс коллоквиумов не смешивается.
  assert.equal(first.key, 'anatomy-practical-skills-1-v1');
  assert.equal(second.key, 'medzo-skills-2-v1');
  // Миология продолжает писать в старый ключ отдельного снимка.
  assert.equal(second.mirror.key, 'medzo-myology-practice-v1');
  assert.equal(first.mirror, null);
});

test('движок общий: одинаковые операции дают одинаковое состояние', () => {
  const { window } = load([...base, 'js/anatomy-skills-data.js', 'js/myology-data.js', 'js/anatomy-skills.js']);
  const random = () => 0.42;
  for (const name of ['anatomySkills', 'myologySkills']) {
    const spec = window.MedzoSkillsRegistry.get(name);
    const game = window.MedzoSkills.create(spec, { getItem: () => null, setItem() {} }, random);
    assert.equal(game.start(), true);
    assert.equal(game.state.session.order.length, 10);
    const item = game.current();
    game.mark('known');
    assert.equal(game.state.stats[item.id].last, 'known');
    game.favorite(item.id);
    assert.equal(game.state.favorites[item.id], true);
    game.note(item.id, 'заметка');
    game.reset();
    // Сброс оценок сохраняет избранное и заметки.
    assert.equal(game.state.stats[item.id], undefined);
    assert.equal(game.state.favorites[item.id], true);
    assert.equal(game.state.notes[item.id], 'заметка');
  }
});

test('оценки миологии переносятся в новый ключ и продолжают уходить в старый', () => {
  const storage = { 'medzo-myology-practice-v1': JSON.stringify({ skills: { 4: 'known', 7: 'again' }, questions: { 1: 'known' }, session: { order: [4], index: 0 }, preferences: { groups: ['back'] } }) };
  // localStorage ещё не загружен окном — подменяем чтение при создании движка.
  const { window } = load([...base, 'js/myology-data.js']);
  const spec = window.MedzoSkillsRegistry.get('myologySkills');
  let legacy = JSON.parse(storage['medzo-myology-practice-v1']);
  const store = {
    getItem: (key) => (key === spec.mirror.key ? JSON.stringify(legacy) : (storage[key] || null)),
    setItem: (key, value) => {
      storage[key] = String(value);
      if (key === spec.mirror.key) legacy = JSON.parse(value);
    },
  };
  const game = window.MedzoSkills.create(spec, store, () => 0.5);
  // Старые оценки на месте: они видны и в статистике, и в подборках.
  assert.equal(game.state.stats[4].last, 'known');
  assert.equal(game.state.stats[7].last, 'again');
  assert.equal(game.state.stats[4].attempts, 1);
  game.favorite(4);
  game.mark('known');
  // Зеркало сохраняет чужие поля снимка и обновляет только оценки навыков.
  assert.deepEqual(legacy.skills, { 4: 'known', 7: 'again' });
  assert.deepEqual(legacy.questions, { 1: 'known' });
  assert.deepEqual(legacy.session, { order: [4], index: 0 });
  assert.deepEqual(legacy.preferences, { groups: ['back'] });
  assert.equal(JSON.parse(storage[spec.key]).favorites['4'], true);
});

test('интерфейс навыков один: отдельного оформления и представления миологии нет', () => {
  const html = read('index.html'), app = read('js/app.js');
  // Маршруты навыков ведут в одно представление.
  assert.match(app, /'anatomy-skills': 'skills'/);
  assert.match(app, /myology: 'skills'/);
  assert.match(app, /function loadSkills\(/);
  assert.doesNotMatch(app, /views-anatomy-skills/);
  assert.doesNotMatch(app, /js\/views-myology\.js/);
  assert.doesNotMatch(html, /myology\.css/);
  assert.ok(!fs.existsSync(path.join(root, 'js/views-myology.js')));
  assert.ok(!fs.existsSync(path.join(root, 'js/views-anatomy-skills.js')));
  // Классы интерфейса — только ps-*: миология больше не рисует свой myo-*.
  const view = read('js/views-skills.js');
  assert.doesNotMatch(view, /\bmyo-/);
  assert.match(view, /ps-picker/);
  assert.match(view, /ps-card/);
  // Оба коллоквиума используют одни и те же стили.
  const css = read('css/anatomy-skills.css');
  assert.match(css, /\.ps-tabs/);
  assert.ok(!fs.existsSync(path.join(root, 'css/myology.css')));
});

test('навигация строится по разделам коллоквиума, а не по жёсткому списку', () => {
  const app = read('js/app.js'), modules = read('js/modules.js');
  assert.doesNotMatch(app, /Навыки · 1/);
  assert.doesNotMatch(app, /\['cards','Карточки · 1'/);
  assert.match(app, /AT\.colloquium\.sections/);
  assert.match(modules, /function sectionsFor\(id\)/);
  // Навыки и теория предусмотрены для всех коллоквиумов: реестр разделов
  // живёт рядом с реестром баз и дополняется данными, а не правкой навигации.
  assert.match(modules, /COLLOQUIUM_SECTIONS/);
  assert.match(modules, /sectionsFor/);
});
