const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function app(storage = {}, selected = '1') {
  storage['anatomy-colloquium-selected'] = selected;
  const ctx = vm.createContext({ window: {}, console, setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage: { getItem: key => storage[key] || null, setItem: (key, value) => { storage[key] = value; } } });
  for (const f of ['js/data/questions.js','js/data/answers.js','js/data/exam.js','js/data/colloquium-2.js','js/data/colloquium-3.js','js/data/colloquium-4.js','js/data/credit-1.js','js/data/credit-2.js','js/data/dental-2.js','js/data/dental-3.js','js/modules.js','js/core.js','js/game.js','js/ui.js','js/views-study.js','js/views-pages.js','js/views-rewards.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
  }
  return ctx.window.AT;
}
function attempt(AT, q) {
  const session = AT.startSession({ mode: 'train', ids: [q.id] });
  const selected = AT.keyApi.forQuestion(q).answers;
  const entry = session.results[q.id] = { selected, correct: true, revealed: true, self: false };
  const mastered = AT.progressOf(q.id).streak >= 2;
  AT.recordAttempt(q, true, selected);
  AT.game.awardTraining(session, q, entry, mastered);
  return {session, entry};
}

test('старый прогресс признаётся достижениями, но не выдаёт ретроочки', () => {
  const storage = { 'anatomy-colloquium-v1': JSON.stringify({ progress: { q1: {attempts: 2, correct: 2, streak: 2} }, sessions: [{ id: 'old', mode: 'train' }] }) };
  const AT = app(storage);
  assert.equal(AT.game.ensure().coins, 0);
  assert.equal(AT.game.totalRating(), 0);
  assert.equal(AT.game.achievements().find(a => a.id === 'explore-1').unlocked, true);
  assert.equal(AT.game.achievements().find(a => a.id === 'sessions-1').unlocked, true);
  assert.equal(AT.game.ensure().verified, 0);
});

test('награды за проверенные ответы однократны и ниже за освоенный вопрос', () => {
  const AT = app(), q = AT.dataset.questions[0];
  const {session, entry} = attempt(AT, q);
  assert.equal(AT.game.ensure().coins, 10);
  AT.game.awardTraining(session, q, entry, false);
  assert.equal(AT.game.ensure().coins, 10);
  attempt(AT, q);
  attempt(AT, q);
  assert.equal(AT.game.ensure().coins, 22);
  assert.equal(AT.game.ensure().rating, 11);
  assert.equal(AT.game.ensure().verified, 3);
});

test('самооценка без ключа не начисляет награду', () => {
  const AT = app({}, 'stom-2'), q = AT.dataset.questions[0];
  const session = AT.startSession({mode:'train', ids:[q.id]});
  const entry = {selected:[1], correct:true, self:true, revealed:true};
  AT.recordAttempt(q, true, [1]);
  AT.game.awardTraining(session, q, entry, false);
  assert.equal(AT.game.ensure().coins, 0);
  assert.equal(AT.game.ensure().rating, 0);
  assert.equal(AT.game.achievements().find(a => a.id === 'explore-1').unlocked, true);
});

test('кошельки изолированы, рейтинг суммируется, сброс затрагивает одну базу', () => {
  const storage = {};
  let AT = app(storage, '1'); attempt(AT, AT.dataset.questions[0]);
  AT = app(storage, '2'); assert.equal(AT.game.ensure().coins, 0); assert.equal(AT.game.totalRating(), 5);
  attempt(AT, AT.dataset.questions[0]);
  assert.equal(AT.game.totalRating(), 10);
  AT.resetProgress();
  assert.equal(AT.game.totalRating(), 5);
  AT = app(storage, '1');
  assert.equal(AT.game.ensure().coins, 10);
  assert.equal(AT.game.totalRating(), 5);
});

test('покупка и использование подсказки атомарны и не удаляют верный вариант', () => {
  const AT = app(), q = AT.dataset.questions[0], game = AT.game;
  assert.equal(game.buy('hint-train').ok, false);
  game.ensure().coins = 100;
  assert.equal(game.buy('hint-train').ok, true);
  assert.equal(game.ensure().coins, 70);
  const session = AT.startSession({mode:'train', ids:[q.id]});
  const entry = session.results[q.id] = {selected:[], correct:null, revealed:false};
  assert.equal(game.useHint(session, q, entry).ok, true);
  assert.equal(game.count('hint-train'), 0);
  assert.equal(game.useHint(session, q, entry).ok, false);
  assert.equal(game.count('hint-train'), 0);
  assert.equal(AT.keyApi.forQuestion(q).answers.includes(entry.hiddenOptions[0]), false);
  assert.doesNotMatch(AT.views.questionCard(session, q, entry), new RegExp('data-index="' + entry.hiddenOptions[0] + '"'));
  assert.equal(session.game.hintsUsed, 1);
});

test('экзамен даёт больше очков, ошибки штрафуются и расчёт не повторяется', () => {
  const AT = app();
  const [q1,q2] = AT.dataset.questions;
  const session = AT.startSession({mode:'exam', ids:[q1.id,q2.id]});
  session.results[q1.id] = { selected: AT.keyApi.forQuestion(q1).answers, revealed: false };
  session.results[q2.id] = { selected: [], revealed: false };
  AT.gradeSession(session);
  assert.equal(AT.game.ensure().coins, 20);
  assert.equal(AT.game.ensure().rating, 12);
  assert.equal(session.game.coinsEarned, 25);
  assert.equal(session.game.coinsPenalty, 5);
  AT.gradeSession(session);
  assert.equal(AT.game.ensure().coins, 20);
  const record = AT.finishSession();
  assert.equal(record.assisted, false);
});

test('экзаменационные усиления дороже, бонус действует на пять верных ответов и помечается', () => {
  const AT = app(), game = AT.game;
  game.ensure().coins = 200;
  assert.ok(game.products['hint-exam'].price > game.products['hint-train'].price);
  assert.ok(game.products['double-exam'].price > game.products['double-train'].price);
  assert.equal(game.buy('double-exam').ok, true);
  const qs = AT.dataset.questions.slice(0,6);
  const session = AT.startSession({mode:'exam', ids:qs.map(q => q.id)});
  assert.equal(game.activateDouble(session).ok, true);
  assert.equal(game.activateDouble(session).ok, false);
  qs.forEach(q => { session.results[q.id] = {selected: AT.keyApi.forQuestion(q).answers}; });
  AT.gradeSession(session);
  assert.equal(session.game.coinsEarned, 5*50+25);
  assert.equal(session.game.ratingEarned, 6*15);
  assert.equal(AT.finishSession().assisted, true);
  assert.match(AT.views.summary().html, /Использованы усиления/);
  assert.match(AT.views.stats().html, /с усилениями/);
});

test('штрафы не опускают баланс и рейтинг ниже нуля, недоступные экзамены не продаются', () => {
  let AT = app(), q = AT.dataset.questions[0];
  const session = AT.startSession({mode:'exam', ids:[q.id]});
  AT.gradeSession(session);
  assert.equal(AT.game.ensure().coins, 0);
  assert.equal(AT.game.ensure().rating, 0);
  AT = app({}, 'credit-1'); AT.game.ensure().coins = 500;
  assert.equal(AT.game.buy('hint-exam').ok, false);
  assert.equal(AT.game.ensure().coins, 500);
  assert.match(AT.views.examSetup().html, /Скоро добавится/);
});

test('штрафы вычитаются из существующих очков и сохраняют отрицательное изменение', () => {
  const AT = app(), q = AT.dataset.questions[0];
  AT.game.ensure().coins = 10; AT.game.ensure().rating = 8;
  const session = AT.startSession({mode:'exam', ids:[q.id]});
  AT.gradeSession(session); AT.finishSession();
  assert.equal(AT.game.ensure().coins, 5);
  assert.equal(AT.game.ensure().rating, 5);
  assert.equal(AT.game.sessionGame(session).coinsChange, -5);
  assert.match(AT.views.summary().html, /Валюта: -5/);
});

test('подсказка без ключа или для уже выбранных неверных вариантов не расходуется', () => {
  const AT = app({}, 'stom-2'), q = AT.dataset.questions[0];
  const game = AT.game; game.ensure().inventory['hint-train'] = 1;
  const session = AT.startSession({mode:'train', ids:[q.id]});
  const entry = session.results[q.id] = {selected: [1], correct:null, revealed:false};
  assert.equal(game.useHint(session, q, entry).ok, false);
  assert.equal(game.count('hint-train'), 1);
  AT.keyApi.set(q, [1,2,3,4]);
  entry.selected = [5];
  assert.equal(game.useHint(session, q, entry).ok, false);
  assert.equal(game.count('hint-train'), 1);
});

test('покупки, активные усиления и начисления переживают перезагрузку без повторной награды', () => {
  const storage = {}; let AT = app(storage);
  AT.game.ensure().coins = 100;
  assert.equal(AT.game.buy('hint-train').ok, true);
  const q = AT.dataset.questions[0];
  const {session, entry} = attempt(AT, q);
  assert.equal(AT.game.ensure().coins, 80);
  AT = app(storage);
  assert.equal(AT.game.ensure().coins, 80);
  assert.equal(AT.game.count('hint-train'), 1);
  assert.equal(AT.game.ensure().rating, 5);
  const loaded = AT.currentSession(), question = AT.dataset.byId.get(q.id);
  assert.equal(loaded.id, session.id);
  AT.game.awardTraining(loaded, question, loaded.results[q.id], false);
  assert.equal(AT.game.ensure().coins, 80);
  assert.equal(loaded.results[q.id].gameRewarded, entry.gameRewarded);
});
