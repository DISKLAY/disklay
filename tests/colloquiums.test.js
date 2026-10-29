const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scripts = ['js/data/questions.js', 'js/data/answers.js', 'js/data/exam.js',
  'js/data/colloquium-2.js', 'js/data/colloquium-3.js', 'js/modules.js',
  'js/core.js', 'js/ui.js', 'js/views-study.js', 'js/views-pages.js'];

function app(storage, selected) {
  if (selected) storage['anatomy-colloquium-selected'] = selected;
  const context = vm.createContext({ window: {}, console, setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage: { getItem: (k) => storage[k] || null, setItem: (k, v) => { storage[k] = v; } } });
  for (const file of scripts) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  return context.window.AT;
}

test('во всех коллоквиумах загружены вопросы, темы и ключи', () => {
  const storage = {};
  for (const [id, count] of [['1', 211], ['2', 188], ['3', 254]]) {
    const AT = app(storage, id);
    assert.equal(AT.colloquium.id, id);
    assert.equal(AT.dataset.total, count);
    assert.equal(AT.keyApi.count(), count);
    assert.equal(new Set(AT.dataset.questions.map((q) => q.id)).size, count);
    for (const q of AT.dataset.questions) {
      assert.ok(q.text && q.options.length >= 2);
      assert.ok(AT.dataset.topics.some((t) => t.id === q.topic));
      const key = AT.keyApi.forQuestion(q).answers;
      assert.ok(key.length && key.every((value) => value >= 1 && value <= q.options.length));
      assert.equal(AT.gradeQuestion(q, key).correct, true);
    }
    for (const view of ['dashboard', 'trainSetup', 'examSetup', 'mistakes', 'stats', 'key', 'settings']) {
      assert.ok(AT.views[view]().html, view + ' for ' + id);
    }
  }
});

test('в первом коллоквиуме экзамен по схеме; в других пока недоступен', () => {
  const storage = {};
  let AT = app(storage, '1');
  assert.match(AT.views.examSetup().html, /20 вопросов за 20 минут/);
  assert.equal(AT.buildExam().ids.length, 20);
  for (const id of ['2', '3']) {
    AT = app(storage, id);
    const html = AT.views.examSetup().html;
    assert.match(html, /Скоро добавится/);
    assert.doesNotMatch(html, /data-action="start-exam"/);
  }
});

test('прогресс, ключи и незаконченные сессии раздельны, включая прежнее сохранение', () => {
  const storage = {};
  let AT = app(storage, '1');
  AT.recordAttempt(AT.dataset.questions[0], true, [1]);
  AT.startSession({ mode: 'train', ids: ['q1'] });
  AT.keyApi.set(AT.dataset.questions[0], [3]);
  AT.save(true);
  assert.ok(storage['anatomy-colloquium-v1']);
  AT = app(storage, '2');
  assert.equal(AT.progressOf('q1').attempts, 0);
  assert.equal(AT.currentSession(), null);
  assert.equal(AT.keyApi.forQuestion(AT.dataset.questions[0]).source, 'base');
  AT.recordAttempt(AT.dataset.questions[0], false, [1]);
  AT.startSession({ mode: 'train', ids: ['q2'] });
  AT.save(true);
  AT = app(storage, '3');
  assert.equal(AT.progressOf('q1').attempts, 0);
  assert.equal(AT.currentSession(), null);
  AT = app(storage, '1');
  assert.equal(AT.progressOf('q1').correct, 1);
  assert.equal(AT.currentSession().ids[0], 'q1');
  assert.deepEqual(Array.from(AT.keyApi.forQuestion(AT.dataset.questions[0]).answers), [3]);
  AT = app(storage, '2');
  assert.equal(AT.progressOf('q1').wrong, 1);
  assert.equal(AT.currentSession().ids[0], 'q2');
});

test('в спланхнологии шестой вариант отображается и проверяется', () => {
  const AT = app({}, '3');
  const q = AT.dataset.byNum.get('49');
  assert.equal(q.options.length, 6);
  assert.ok(AT.keyApi.forQuestion(q).answers.includes(6));
  const html = AT.views.questionCard({ mode: 'train' }, q, { selected: [], revealed: false });
  assert.match(html, /data-index="6"/);
  assert.match(html, /<kbd>6<\/kbd>/);
});

test('проверенная попытка в тренировке записывается только один раз', () => {
  const AT = app({}, '2');
  const q = AT.dataset.questions[0];
  const session = AT.startSession({ mode: 'train', ids: [q.id] });
  const selected = AT.keyApi.forQuestion(q).answers;
  session.results[q.id] = { selected, correct: true, revealed: true };
  AT.recordAttempt(q, true, selected);
  AT.gradeSession(session);
  AT.finishSession();
  assert.equal(AT.progressOf(q.id).attempts, 1);
  assert.equal(AT.progressOf(q.id).correct, 1);
  assert.equal(AT.sessionStats(session).correct, 1);
});
