// Запуск: node --test tests/exam.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function loadApp() {
  const storage = {};
  const listeners = {};
  const host = { innerHTML: '', addEventListener(type, fn) { listeners[type] = fn; } };
  const document = {
    createElement() { return host; },
    getElementById() { return null; },
    addEventListener(type, fn) { listeners['document-' + type] = fn; },
    removeEventListener() {},
  };
  const context = vm.createContext({
    window: {}, document, console, setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage: { getItem: (key) => storage[key] || null, setItem: (key, value) => { storage[key] = value; } },
  });
  for (const file of ['js/data/questions.js', 'js/data/answers.js', 'js/data/exam.js', 'js/core.js', 'js/ui.js', 'js/views-study.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  }
  const AT = context.window.AT;
  const cleanups = [];
  AT.onCleanup = (fn) => cleanups.push(fn);
  AT.go = (route) => { AT.lastRoute = route; };
  return { AT, listeners, host, cleanup: () => cleanups.forEach((fn) => fn()) };
}

test('экзамен соблюдает квоты и использует только вопросы нужных разделов', () => {
  const { AT } = loadApp();
  const plan = AT.examPlan;
  assert.equal(plan.minutes, 20);
  assert.equal(plan.total, 20);
  assert.deepEqual(Array.from(plan.sections, (section) => section.count), [2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 1]);
  assert.deepEqual(Array.from(plan.sections.find((section) => section.id === 'skull-base').questions, (q) => q.num), [110, 111, 112, 113, 114, 115, 116, 117]);
  for (let i = 0; i < 200; i++) {
    const exam = AT.buildExam();
    assert.equal(exam.ids.length, 20);
    assert.equal(new Set(exam.ids).size, 20);
    for (const section of plan.sections) {
      const ids = exam.ids.filter((id) => exam.sectionOf[id] === section.title);
      assert.equal(ids.length, section.count);
      for (const id of ids) assert.ok(section.questions.some((q) => q.id === id));
    }
  }
  const setup = AT.views.examSetup().html;
  assert.match(setup, /20 вопросов за 20 минут/);
  assert.equal((setup.match(/exam-plan__row/g) || []).length, 11);
  assert.doesNotMatch(setup, /toggle-timer|set-minutes|set-limit|toggle-topic-exam/);
});

test('при нехватке вопросов экзамен не создаётся неполным', () => {
  const { AT } = loadApp();
  AT.examPlan.sections[0].questions.length = 1;
  assert.equal(AT.buildExam(), null);
});

test('таймер ограничивает ответы даже при возвращении после истечения времени', () => {
  const { AT, listeners, cleanup } = loadApp();
  const exam = AT.buildExam();
  const session = AT.startSession({ mode: 'exam', ids: exam.ids, timerMinutes: AT.examPlan.minutes, sectionOf: exam.sectionOf });
  assert.equal(session.limitSeconds, 1200);
  session.startedAt = Date.now() - 1200001;
  const run = AT.views.run();
  run.mount({ appendChild() {} });
  // Событие до очередного тика таймера также не может изменить ответ.
  listeners.click({ target: { closest: () => ({ disabled: false, getAttribute: () => 'toggle-option' }) } });
  assert.equal(session.finished, true);
  assert.equal(AT.lastRoute, '#/summary');
  assert.equal(AT.getState().sessions[0].total, 20);
  assert.equal(AT.getState().sessions[0].correct, 0);
  cleanup();
});

test('подсказка о количестве ответов не показывается на экзамене', () => {
  const { AT } = loadApp();
  AT.getState().settings.hintCount = true;
  const q = AT.dataset.questions[0];
  const entry = { selected: [], revealed: false };
  assert.doesNotMatch(AT.views.questionCard({ mode: 'exam' }, q, entry), /верных:/);
  assert.match(AT.views.questionCard({ mode: 'train' }, q, entry), /верных:/);
});

test('все 211 вопросов первого коллоквиума входят в банк экзамена ровно по одному разу', () => {
  const { AT } = loadApp();
  const questions = AT.examPlan.sections.flatMap((section) => section.questions);
  const poolIds = questions.map((q) => q.id);
  assert.equal(questions.length, 211);
  assert.equal(new Set(poolIds).size, 211);
  assert.deepEqual(Array.from(poolIds).sort(), Array.from(AT.dataset.questions, (q) => q.id).sort());
  for (const [sectionId, numbers] of [
    ['face-bones', Array.from({ length: 20 }, (_, i) => i + 118)],
    ['brain-bones', [138, 139, 140]],
    ['lower-bones', [188, 189, 190, 191]],
  ]) {
    const section = AT.examPlan.sections.find((item) => item.id === sectionId);
    for (const num of numbers) assert.ok(section.questions.some((q) => q.num === num), `${sectionId}: № ${num}`);
  }
  assert.match(AT.views.examSetup().html, /В банке экзамена: 211 вопросов/);
});
