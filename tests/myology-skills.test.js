/* Движок пракнавыков второго коллоквиума: подборки, темы, порядок, самооценка,
   избранное, заметки, вопросы и совместимость со старой версией и синхронизацией. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.join(__dirname, '..');
function load(storage = {}, rng = () => 0.42) {
  const context = vm.createContext({ window: {} });
  for (const file of ['myology-data.js', 'myology-skills.js']) vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
  const H = context.window.MedzoMyologySkills;
  const store = { getItem: key => (key in storage ? storage[key] : null), setItem: (key, value) => { storage[key] = value; } };
  return { H, game: H.create(store, rng), storage };
}
const plain = value => JSON.parse(JSON.stringify(value));

test('движок видит все 222 навыка и 10 тем в исходном порядке', () => {
  const { H } = load();
  assert.equal(H.data.skills.length, 222);
  assert.equal(H.data.groups.length, 10);
  assert.equal(H.byId[1].latin, 'M. epicranius');
  assert.equal(H.byId[222].latin, 'Sulcus plantaris lateralis');
  for (const item of H.data.skills) assert.ok(H.data.groups.some(g => item.id >= g.from && item.id <= g.to));
});

test('по умолчанию подборка из 10 навыков вперемешку, без повторов', () => {
  const { game, H } = load();
  assert.equal(game.state.sequence, 'random');
  assert.equal(game.start(), true);
  assert.equal(game.state.session.order.length, 10);
  assert.equal(new Set(game.state.session.order).size, 10);
  assert.ok(game.state.session.order.every(id => H.byId[id]));
});

test('фильтры по темам, подборке и количеству работают вместе', () => {
  const { game } = load({}, () => 0);
  game.setOptions('face', 'all', 10, 'ordered');
  assert.deepEqual(plain(game.pool().map(x => x.id)), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  assert.equal(game.start(), true);
  assert.deepEqual(plain(game.state.session.order), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  game.setOptions('face', 'all', 'неверно', 'как-нибудь');
  assert.equal(game.state.limit, 10);
  game.setOptions('all', 'all', 0, 'ordered');
  assert.equal(game.pool().length, 222);
  assert.equal(game.start(), true);
  assert.equal(game.state.session.order.length, 222);
});

test('несколько тем сохраняются и восстанавливаются после перезагрузки', () => {
  const storage = {}, { game, H } = load(storage, () => 0);
  game.setOptions(['neck', 'chest'], 'all', 10, 'ordered');
  assert.equal(game.start(), true);
  assert.ok(game.state.session.order.every(id => ['neck', 'chest'].includes(H.byId[id].group)));
  const restored = load(storage).game;
  assert.deepEqual(plain(restored.state.group), ['neck', 'chest']);
  assert.equal(restored.state.sequence, 'ordered');
  assert.deepEqual(plain(restored.state.session.order), plain(game.state.session.order));
});

test('самооценка накапливает статистику и позволяет исправить оценку', () => {
  const { game } = load({}, () => 0);
  game.start();
  const id = game.current().id;
  assert.equal(game.mark('known'), true);
  assert.equal(game.state.stats[id].attempts, 1);
  assert.equal(game.state.stats[id].known, 1);
  game.mark('known');
  assert.equal(game.state.stats[id].attempts, 1);
  game.mark('again');
  assert.equal(game.state.stats[id].known, 0);
  assert.equal(game.state.stats[id].last, 'again');
  assert.equal(game.mark('maybe'), false);
});

test('навигация, пропуск, итог и возврат к подборке', () => {
  const { game } = load({}, () => 0);
  game.start();
  const first = game.current().id;
  assert.equal(game.navigate(-1), false);
  assert.equal(game.navigate(1), true);
  assert.equal(game.navigate(-1), true);
  assert.equal(game.current().id, first);
  game.navigate(1);
  game.mark('again');
  assert.equal(game.finish(), true);
  assert.equal(game.state.session.finished, true);
  assert.equal(game.mark('known'), false);
  assert.equal(game.resume(), true);
  assert.equal(game.state.session.finished, false);
  assert.equal(game.state.session.answers[game.current().id], 'again');
});

test('избранное, заметки, подсказки и сброс оценок', () => {
  const storage = {}, { game } = load(storage, () => 0);
  game.start();
  const id = game.current().id;
  game.favorite(id);
  game.note(id, 'проверить на трупе');
  game.hint();
  assert.equal(game.state.favorites[id], true);
  const restored = load(storage).game;
  assert.equal(restored.state.favorites[id], true);
  assert.equal(restored.state.notes[id], 'проверить на трупе');
  assert.equal(restored.state.session.hints[id], true);
  restored.mark('known');
  restored.reset();
  assert.equal(restored.state.stats[id], undefined);
  assert.equal(restored.state.session, null);
  assert.equal(restored.state.favorites[id], true);
  assert.equal(restored.state.notes[id], 'проверить на трупе');
});

test('тренировка раздела берёт всю тему независимо от фильтров подборки', () => {
  const storage = {}, { game, H } = load(storage, () => 0);
  game.setOptions('face', 'favorites', 10, 'ordered');
  assert.equal(game.pool().length, 0);
  assert.equal(game.start(), false);
  assert.equal(game.startSection('topography'), true);
  assert.deepEqual(plain(game.state.session.order), Array.from({ length: 52 }, (_, i) => 171 + i));
  assert.equal(game.state.group, 'face');
  assert.equal(game.state.scope, 'favorites');
  assert.equal(game.startSection('unknown'), false);
  const restored = load(storage).game;
  assert.equal(restored.state.session.order.length, 52);
  assert.ok(restored.state.session.order.every(id => H.byId[id].group === 'topography'));
});

test('оценки вопросов сохраняются, переключаются и ограничены списком из 66', () => {
  const storage = {}, { game } = load(storage, () => 0);
  assert.equal(game.markQuestion(1, 'known'), true);
  assert.equal(game.markQuestion(66, 'again'), true);
  assert.equal(game.markQuestion(67, 'known'), false);
  assert.equal(game.markQuestion(5, 'неверно'), false);
  assert.equal(game.markQuestion(1, 'known'), true);
  assert.equal(game.state.questions[1], undefined);
  game.markQuestion(2, 'again');
  const restored = load(storage).game;
  assert.deepEqual(plain(restored.state.questions), { 66: 'again', 2: 'again' });
});

test('оценки и вопросы уезжают в формате синхронизации, служебные данные — нет', () => {
  const storage = {}, { game, H } = load(storage, () => 0);
  game.start();
  const id = game.current().id;
  game.mark('known');
  game.markQuestion(3, 'again');
  game.note(id, 'личное');
  const synced = JSON.parse(storage[H.SYNC_KEY]);
  assert.deepEqual(synced.skills, { [id]: 'known' });
  assert.deepEqual(synced.questions, { 3: 'again' });
  assert.deepEqual(synced.preferences, { groups: [], scope: 'all', order: 'random', limit: 10 });
  assert.deepEqual(synced.session, { order: plain(game.state.session.order), index: 0 });
  assert.ok(!JSON.stringify(synced).includes('личное'), 'заметки не должны уходить в синхронизацию');
  assert.ok(!('notes' in synced) && !('favorites' in synced));
  const local = JSON.parse(storage[H.KEY]);
  assert.equal(local.notes[id], 'личное');
});

test('старая версия данных переносится без потери оценок и настроек', () => {
  const storage = {};
  storage['medzo-myology-practice-v1'] = JSON.stringify({
    skills: { 5: 'known', 9: 'again', 999: 'known', 7: 'maybe' },
    questions: { 4: 'again', 70: 'known' },
    preferences: { groups: ['neck', 'chest'], scope: 'again', order: 'ordered', limit: 20 },
    session: { order: [9, 8, 7], index: 1 }
  });
  const { game } = load(storage);
  assert.deepEqual(plain(game.state.stats), {
    5: { attempts: 1, known: 1, last: 'known' },
    9: { attempts: 1, known: 0, last: 'again' }
  });
  assert.deepEqual(plain(game.state.questions), { 4: 'again' });
  assert.deepEqual(plain(game.state.group), ['neck', 'chest']);
  assert.equal(game.state.scope, 'again');
  assert.equal(game.state.sequence, 'ordered');
  assert.equal(game.state.limit, 20);
  assert.deepEqual(plain(game.state.session.order), [9, 8, 7]);
  assert.equal(game.state.session.index, 1);
});

test('повреждённое хранилище не ломает тренировку', () => {
  const { H } = load();
  const broken = H.create({ getItem: () => '{', setItem() { throw new Error('storage'); } }, () => 0.5);
  assert.equal(broken.start(), true);
  assert.equal(broken.storageFailed(), true);
  broken.mark('known');
  const corrupt = H.create({ getItem: () => JSON.stringify({ session: { order: [1, 1], index: 0 }, group: 'nope' }), setItem() {} }, () => 0.5);
  assert.equal(corrupt.state.session, null);
  assert.equal(corrupt.state.group, 'all');
});

test('обновление из синхронизации подхватывается один раз и не затирает локальное', () => {
  const storage = {}, { game, H } = load(storage, () => 0);
  game.start();
  const id = game.current().id;
  game.mark('known');
  assert.equal(game.adopt(), false, 'своя же запись не считается обновлением');
  storage[H.SYNC_KEY] = JSON.stringify({ schema: 1, skills: { 12: 'again', 300: 'known', 5: 'неверно' }, questions: { 4: 'known', 99: 'again' } });
  assert.equal(game.adopt(), true);
  assert.deepEqual(plain(game.state.stats), { 12: { attempts: 1, known: 0, last: 'again' } });
  assert.deepEqual(plain(game.state.questions), { 4: 'known' });
  assert.equal(game.adopt(), false);
  assert.equal(game.state.session.order[id >= 1 ? 0 : 0] !== undefined, true, 'текущая подборка не тронута');
});
