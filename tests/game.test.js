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
  game.ensure().coins = 200;
  assert.equal(game.buy('hint-train').ok, true);
  assert.equal(game.ensure().coins, 40);
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

test('экзаменационные усиления дороже, бонус действует на двадцать верных ответов и помечается', () => {
  const AT = app(), game = AT.game;
  game.ensure().coins = 1000;
  assert.ok(game.products['hint-exam'].price > game.products['hint-train'].price);
  assert.ok(game.products['double-exam'].price > game.products['double-train'].price);
  assert.equal(game.buy('double-exam').ok, true);
  const qs = AT.dataset.questions.slice(0,21);
  const session = AT.startSession({mode:'exam', ids:qs.map(q => q.id)});
  assert.equal(game.activateDouble(session).ok, true);
  assert.equal(game.activateDouble(session).ok, false);
  qs.forEach(q => { session.results[q.id] = {selected: AT.keyApi.forQuestion(q).answers}; });
  AT.gradeSession(session);
  assert.equal(session.game.coinsEarned, 21*25);
  assert.equal(session.game.ratingEarned, 20*30+15);
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
  AT.game.ensure().coins = 200;
  assert.equal(AT.game.buy('hint-train').ok, true);
  const q = AT.dataset.questions[0];
  const {session, entry} = attempt(AT, q);
  assert.equal(AT.game.ensure().coins, 50);
  AT = app(storage);
  assert.equal(AT.game.ensure().coins, 50);
  assert.equal(AT.game.count('hint-train'), 1);
  assert.equal(AT.game.ensure().rating, 5);
  const loaded = AT.currentSession(), question = AT.dataset.byId.get(q.id);
  assert.equal(loaded.id, session.id);
  AT.game.awardTraining(loaded, question, loaded.results[q.id], false);
  assert.equal(AT.game.ensure().coins, 50);
  assert.equal(loaded.results[q.id].gameRewarded, entry.gameRewarded);
});

test('достижения рейтинга используют общую сумму из разных баз', () => {
  const storage = {};
  let AT = app(storage, '1'); AT.game.ensure().rating = 350; AT.save(true);
  AT = app(storage, '2'); AT.game.ensure().rating = 150; AT.game.syncAchievements(); AT.save(true);
  assert.equal(AT.game.totalRating(), 500);
  assert.equal(AT.game.achievements().find(a => a.id === 'rating-500').unlocked, true);
  assert.equal(AT.game.achievements().find(a => a.id === 'rating-2000').unlocked, false);
  AT = app(storage, '1');
  assert.equal(AT.game.achievements().find(a => a.id === 'rating-500').unlocked, true);
});

test('абсолютное освоение требует всю любую базу', () => {
  const AT = app({}, 'stom-2');
  const qs = AT.dataset.questions;
  for (const q of qs.slice(0, -1)) AT.getState().progress[q.id] = { attempts: 2, correct: 2, streak: 2 };
  let badge = AT.game.achievements().find(a => a.id === 'absolute-mastery');
  assert.equal(badge.goal, 1); assert.equal(badge.current, 0); assert.equal(badge.unlocked, false);
  AT.getState().progress[qs.at(-1).id] = { attempts: 2, correct: 2, streak: 2 };
  badge = AT.game.achievements().find(a => a.id === 'absolute-mastery');
  assert.equal(badge.unlocked, true);
});

test('абсолютный экзамен требует 20 из 20 без усилений', () => {
  for (const assisted of [false, true]) {
    const AT = app(), qs = AT.dataset.questions.slice(0, 20);
    const session = AT.startSession({mode:'exam', ids: qs.map(q => q.id)});
    qs.forEach(q => { session.results[q.id] = { selected: AT.keyApi.forQuestion(q).answers }; });
    if (assisted) session.game = { hintsUsed: 1 };
    AT.gradeSession(session); AT.finishSession();
    assert.equal(AT.game.achievements().find(a => a.id === 'absolute-exam').unlocked, !assisted);
  }
  assert.equal(app({}, 'credit-1').game.achievements().some(a => a.id === 'absolute-exam'), true);
});

test('обновлённые цены и ассортимент доступны в правилах и магазине', () => {
  const AT = app();
  assert.equal(AT.game.products['hint-train'].price, 160);
  assert.equal(AT.game.products['hint-exam'].price, 480);
  assert.equal(AT.game.products['double-train'].price, 320);
  assert.equal(AT.game.products['double-exam'].price, 800);
  const html = AT.views.rewards().html;
  assert.match(html, /Абсолютные достижения/);
  assert.match(html, /50 000 общего рейтинга/);
  assert.match(html, /800 валюты/);
});

test('подорожание не удаляет ранее купленные усиления и не списывает валюту', () => {
  const storage = { 'anatomy-colloquium-v1': JSON.stringify({ game: { coins: 37, rating: 4, inventory: { 'hint-train': 2, 'double-exam': 1 } } }) };
  const AT = app(storage);
  assert.equal(AT.game.ensure().coins, 37);
  assert.equal(AT.game.count('hint-train'), 2);
  assert.equal(AT.game.count('double-exam'), 1);
});

test('удвоение в тренировке увеличивает рейтинг, но не валюту', () => {
  const AT = app(), game = AT.game;
  game.ensure().coins = 320;
  assert.equal(game.buy('double-train').ok, true);
  const qs = AT.dataset.questions.slice(0, 21);
  const session = AT.startSession({mode:'train', ids:qs.map(q => q.id)});
  assert.equal(game.activateDouble(session).ok, true);
  qs.forEach(q => {
    const entry = session.results[q.id] = {selected: AT.keyApi.forQuestion(q).answers, correct:true, self:false, revealed:true};
    const mastered = AT.progressOf(q.id).streak >= 2;
    AT.recordAttempt(q, true, entry.selected);
    game.awardTraining(session, q, entry, mastered);
  });
  assert.equal(session.game.coinsEarned, 210);
  assert.equal(session.game.ratingEarned, 20 * 10 + 5);
  assert.equal(game.ensure().coins, 210);
  assert.equal(game.ensure().rating, 205);
  AT.finishSession();
  assert.match(AT.views.summary().html, /×2 рейтинг/);
});

test('старое активированное удвоение валюты сохраняется после обновления и помечается', () => {
  const storage = {}; let AT = app(storage), q = AT.dataset.questions[0];
  const session = AT.startSession({mode:'train', ids:[q.id]});
  session.game = {bonusUsed: true, bonusRemaining: 2};
  AT.save(true);
  AT = app(storage); q = AT.dataset.questions[0];
  const loaded = AT.currentSession();
  const entry = loaded.results[q.id] = {selected: AT.keyApi.forQuestion(q).answers, correct:true, self:false, revealed:true};
  AT.recordAttempt(q, true, entry.selected);
  AT.game.awardTraining(loaded, q, entry, false);
  assert.equal(AT.game.ensure().coins, 20);
  assert.equal(AT.game.ensure().rating, 5);
  assert.equal(loaded.game.bonusRemaining, 1);
  AT.finishSession();
  assert.match(AT.views.summary().html, /×2 валюта/);
});

test('неиспользованные старые покупки превращаются в усиления рейтинга', () => {
  const storage = { 'anatomy-colloquium-v1': JSON.stringify({game:{coins:0, rating:0, inventory:{'double-train':1}}}) };
  const AT = app(storage), q = AT.dataset.questions[0];
  const session = AT.startSession({mode:'train', ids:[q.id]});
  assert.equal(AT.game.activateDouble(session).ok, true);
  const entry = session.results[q.id] = {selected:AT.keyApi.forQuestion(q).answers, correct:true, self:false, revealed:true};
  AT.recordAttempt(q, true, entry.selected);
  AT.game.awardTraining(session, q, entry, false);
  assert.equal(AT.game.ensure().coins, 10);
  assert.equal(AT.game.ensure().rating, 10);
});

test('удвоенный рейтинг на экзамене не меняет валюту и штраф за ошибку', () => {
  const AT = app(), game = AT.game;
  game.ensure().inventory['double-exam'] = 1;
  const qs = AT.dataset.questions.slice(0, 20);
  const session = AT.startSession({mode:'exam', ids:qs.map(q => q.id)});
  assert.equal(game.activateDouble(session).ok, true);
  qs.slice(0, 19).forEach(q => { session.results[q.id] = {selected:AT.keyApi.forQuestion(q).answers}; });
  AT.gradeSession(session);
  assert.equal(session.game.coinsEarned, 19 * 25);
  assert.equal(session.game.ratingEarned, 19 * 30);
  assert.equal(session.game.coinsPenalty, 5);
  assert.equal(session.game.ratingPenalty, 3);
  assert.equal(game.ensure().coins, 19 * 25 - 5);
  assert.equal(game.ensure().rating, 19 * 30 - 3);
  AT.finishSession();
  assert.match(AT.views.summary().html, /×2 рейтинг/);
});

test('старый активный бонус в незавершённом экзамене по-прежнему удваивает валюту', () => {
  const storage = {}; let AT = app(storage), q = AT.dataset.questions[0];
  const session = AT.startSession({mode:'exam', ids:[q.id]});
  session.game = {bonusUsed: true, bonusRemaining: 1};
  session.results[q.id] = {selected: AT.keyApi.forQuestion(q).answers};
  AT.save(true);
  AT = app(storage);
  const loaded = AT.currentSession();
  AT.gradeSession(loaded); AT.finishSession();
  assert.equal(AT.game.ensure().coins, 50);
  assert.equal(AT.game.ensure().rating, 15);
  assert.match(AT.views.summary().html, /×2 валюта/);
});

test('удвоенный рейтинг открывает достижения по общему рейтингу', () => {
  const AT = app(), game = AT.game, q = AT.dataset.questions[0];
  game.ensure().rating = 490; game.ensure().inventory['double-train'] = 1;
  const session = AT.startSession({mode:'train', ids:[q.id]});
  assert.equal(game.activateDouble(session).ok, true);
  const entry = session.results[q.id] = {selected:AT.keyApi.forQuestion(q).answers, correct:true, self:false, revealed:true};
  AT.recordAttempt(q, true, entry.selected);
  game.awardTraining(session, q, entry, false);
  assert.equal(game.totalRating(), 500);
  assert.equal(game.achievements().find(a => a.id === 'rating-500').unlocked, true);
});

test('достижения суммируются по всем базам и одинаково видны в каждой', () => {
  const storage = {}; let AT = app(storage, '1');
  for (const q of AT.dataset.questions.slice(0, 5)) AT.getState().progress[q.id] = {attempts:1, streak:1};
  AT.save(true);
  AT = app(storage, '2');
  for (const q of AT.dataset.questions.slice(0, 5)) AT.getState().progress[q.id] = {attempts:1, streak:1};
  AT.save(true);
  let badge = AT.game.achievements().find(a => a.id === 'explore-10');
  assert.equal(badge.current, 10); assert.equal(badge.unlocked, true);
  AT = app(storage, 'stom-3');
  badge = AT.game.achievements().find(a => a.id === 'explore-10');
  assert.equal(badge.current, 10); assert.equal(badge.unlocked, true);
});

test('старые достижения разных баз объединяются и остаются после сброса базы', () => {
  const storage = {
    'anatomy-colloquium-v1': JSON.stringify({game:{achievements:{'explore-50':123}}}),
    'anatomy-colloquium-v1-2': JSON.stringify({game:{achievements:{'master-50':456}}}),
  };
  let AT = app(storage, '1');
  assert.equal(AT.game.achievements().find(a => a.id === 'explore-50').unlocked, true);
  assert.equal(AT.game.achievements().find(a => a.id === 'master-50').unlocked, true);
  AT.resetProgress();
  AT = app(storage, '2'); AT.resetProgress();
  AT = app(storage, 'credit-2');
  assert.equal(AT.game.achievements().find(a => a.id === 'explore-50').unlocked, true);
  assert.equal(AT.game.achievements().find(a => a.id === 'master-50').unlocked, true);
  assert.equal(AT.game.profile().achievements['master-50'], 456);
});

test('качок учитывает миологию и мышечные разделы зачёта, но не другие темы', () => {
  const storage = {}; let AT = app(storage, '2');
  for (const q of AT.dataset.questions) AT.getState().progress[q.id] = {attempts:2, streak:2};
  AT.save(true);
  AT = app(storage, 'credit-1');
  const muscles = AT.dataset.questions.filter(q => ['trunk-muscles', 'head-neck', 'upper-muscles', 'lower-muscles'].includes(q.topic));
  const other = AT.dataset.questions.find(q => q.topic === 'skull');
  AT.getState().progress[other.id] = {attempts:2, streak:2};
  for (const q of muscles.slice(0, 11)) AT.getState().progress[q.id] = {attempts:2, streak:2};
  let badge = AT.game.achievements().find(a => a.id === 'muscles-200');
  assert.equal(badge.title, 'Качок'); assert.equal(badge.current, 199); assert.equal(badge.unlocked, false);
  AT.getState().progress[muscles[11].id] = {attempts:2, streak:2}; AT.save(true);
  badge = AT.game.achievements().find(a => a.id === 'muscles-200');
  assert.equal(badge.current, 200); assert.equal(badge.unlocked, true);
  AT = app(storage, '3');
  assert.equal(AT.game.achievements().find(a => a.id === 'muscles-200').unlocked, true);
});

test('направления считают только освоенные вопросы соответствующих тем', () => {
  const AT = app({}, 'credit-2');
  const organ = AT.dataset.questions.find(q => q.topic === 'digestive');
  const nerve = AT.dataset.questions.find(q => q.topic === 'brainstem');
  const unmastered = AT.dataset.questions.find(q => q.topic === 'pathways');
  AT.getState().progress[organ.id] = {attempts:2, streak:2};
  AT.getState().progress[nerve.id] = {attempts:2, streak:2};
  AT.getState().progress[unmastered.id] = {attempts:1};
  const badges = AT.game.achievements();
  assert.equal(badges.find(a => a.id === 'organs-200').current, 1);
  assert.equal(badges.find(a => a.id === 'nervous-200').current, 1);
  assert.equal(badges.find(a => a.id === 'muscles-200').current, 0);
});

test('оформление покупается валютой текущей базы, доступно везде и переживает сброс', () => {
  const storage = {}; let AT = app(storage, '1'), game = AT.game;
  game.ensure().coins = 500;
  assert.equal(game.buyAppearance('ruby', {'1': 500}).ok, false);
  assert.equal(game.buyAppearance('ocean', {'1': 500}).ok, true);
  assert.equal(game.ensure().coins, 0);
  assert.equal(game.profile().appearance, 'ocean');
  assert.equal(game.buyAppearance('ocean', {'1': 500}).ok, false);
  assert.equal(game.selectAppearance('__proto__').ok, false);
  assert.equal(game.selectAppearance('amber').ok, false);
  AT = app(storage, '2'); game = AT.game;
  assert.equal(game.ensure().coins, 0);
  assert.equal(game.profile().appearances.ocean, true);
  assert.equal(game.profile().appearance, 'ocean');
  assert.equal(game.selectAppearance('default').ok, true);
  assert.equal(game.selectAppearance('ocean').ok, true);
  AT.resetProgress();
  AT = app(storage, '1'); AT.resetProgress();
  AT = app(storage, 'stom-2');
  assert.equal(AT.game.profile().appearance, 'ocean');
  assert.equal(AT.game.profile().appearances.ocean, true);
});

test('ошибка сохранения общего профиля возвращает стоимость покупки', () => {
  const data = {};
  const storage = new Proxy(data, {set(target, key, value) {
    if (key === 'anatomy-colloquium-rewards-shared-v1') throw new Error('storage full');
    target[key] = value; return true;
  }});
  let AT = app(storage); AT.game.ensure().coins = 600; AT.save(true);
  assert.equal(AT.game.buyAppearance('ocean', {'1': 500}).ok, false);
  assert.equal(AT.game.ensure().coins, 600);
  assert.equal(AT.game.profile().appearances.ocean, undefined);
  AT = app(storage);
  assert.equal(AT.game.ensure().coins, 600);
});

test('все тематические достижения достижимы и остаются общими', () => {
  const storage = {};
  for (const id of ['1','2','3','4','credit-1','credit-2','stom-2','stom-3']) {
    const AT = app(storage, id);
    for (const q of AT.dataset.questions) AT.getState().progress[q.id] = {attempts:2, streak:2};
    AT.save(true);
  }
  const AT = app(storage, '1');
  for (const id of ['muscles-200','bones-150','joints-100','organs-200','nervous-200','absolute-mastery']) {
    assert.equal(AT.game.achievements().find(a => a.id === id).unlocked, true, id);
  }
  const other = app(storage, 'stom-3');
  for (const id of ['muscles-200','bones-150','joints-100','organs-200','nervous-200','absolute-mastery']) {
    assert.equal(other.game.achievements().find(a => a.id === id).unlocked, true, id);
  }
});

test('ошибка сохранения кошелька не выдаёт оформление и не списывает валюту', () => {
  const data = {}; let block = false;
  const storage = new Proxy(data, {set(target, key, value) {
    if (block && key === 'anatomy-colloquium-v1') throw new Error('storage full');
    target[key] = value; return true;
  }});
  const AT = app(storage); AT.game.ensure().coins = 500; AT.save(true);
  block = true;
  assert.equal(AT.game.buyAppearance('ocean', {'1': 500}).ok, false);
  assert.equal(AT.game.ensure().coins, 500);
  assert.equal(AT.game.profile().appearances.ocean, undefined);
  block = false;
  assert.equal(app(storage).game.ensure().coins, 500);
});

test('результат идеального экзамена виден в базе без экзамена', () => {
  const storage = {}; let AT = app(storage), qs = AT.dataset.questions.slice(0,20);
  const session = AT.startSession({mode:'exam', ids:qs.map(q => q.id)});
  qs.forEach(q => { session.results[q.id] = {selected:AT.keyApi.forQuestion(q).answers}; });
  AT.gradeSession(session); AT.finishSession();
  AT = app(storage, 'credit-1');
  assert.equal(AT.game.achievements().find(a => a.id === 'absolute-exam').unlocked, true);
});

test('покупка восстанавливается по квитанции при прерывании между сохранениями', () => {
  const storage = {
    'anatomy-colloquium-v1': JSON.stringify({game:{coins:0, appearanceReceipts:{ocean:true}}}),
  };
  let AT = app(storage, '2');
  assert.equal(AT.game.profile().appearances.ocean, true);
  assert.equal(AT.game.selectAppearance('ocean').ok, true);
  AT = app(storage, '1'); AT.resetProgress();
  AT = app(storage, '3');
  assert.equal(AT.game.profile().appearances.ocean, true);
  assert.equal(AT.game.profile().appearance, 'ocean');
});

test('верные ответы и завершённые прохождения суммируются между базами', () => {
  const storage = {
    'anatomy-colloquium-v1': JSON.stringify({game:{verified:20}, sessions:Array.from({length:5}, () => ({}))}),
    'anatomy-colloquium-v1-2': JSON.stringify({game:{verified:5}, sessions:Array.from({length:5}, () => ({}))}),
  };
  const AT = app(storage, 'stom-2');
  assert.equal(AT.game.achievements().find(a => a.id === 'verified-25').unlocked, true);
  assert.equal(AT.game.achievements().find(a => a.id === 'sessions-10').unlocked, true);
  assert.equal(AT.game.totalRating(), 0);
});

test('сезонные оформления покупаются, сохраняются и доступны во всех базах', () => {
  for (const id of ['autumn', 'winter', 'spring']) {
    const storage = {};
    let AT = app(storage, '1');
    assert.equal(AT.game.appearances[id].price, 1500);
    AT.game.ensure().coins = 1500;
    assert.equal(AT.game.buyAppearance(id, {'1': 1500}).ok, true);
    assert.equal(AT.game.ensure().coins, 0);
    assert.equal(AT.game.profile().appearance, id);
    AT = app(storage, 'stom-2');
    assert.equal(AT.game.profile().appearances[id], true);
    assert.equal(AT.game.profile().appearance, id);
    assert.equal(AT.game.selectAppearance('default').ok, true);
    assert.equal(AT.game.selectAppearance(id).ok, true);
    assert.match(AT.views.rewards().html, new RegExp('appearance-preview--' + id));
  }
});

test('сезонные рисунки локальны, статичны и доступны в обеих темах', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css/styles.css'), 'utf8');
  for (const id of ['autumn', 'winter', 'spring']) {
    const image = fs.readFileSync(path.join(__dirname, '..', 'assets', 'season-' + id + '.svg'), 'utf8');
    assert.match(image, /<svg\b/);
    assert.match(image, /<use\b/);
    assert.doesNotMatch(image, /<(?:script|animate|foreignObject)\b|https?:\/\/(?!www\.w3\.org)/i);
    assert.match(css, new RegExp('data-theme="dark"\\]\\[data-accent="' + id + '"'));
    assert.match(css, new RegExp('appearance-preview--' + id));
  }
});

test('оформление оплачивается выбранными суммами из нескольких баз без переноса валюты', () => {
  const storage = {}; let AT = app(storage, '1'); AT.game.ensure().coins = 100; AT.save(true);
  AT = app(storage, '2'); AT.game.ensure().coins = 250; AT.save(true);
  AT = app(storage, '3'); AT.game.ensure().coins = 300; AT.save(true);
  let wallets = AT.game.walletBalances();
  assert.equal(wallets[0].id, '3'); assert.equal(wallets[0].balance, 300);
  assert.equal(wallets.find(w => w.id === '1').balance, 100);
  assert.equal(AT.game.buyAppearance('ocean', {'1':100, '2':200, '3':200}).ok, true);
  assert.equal(AT.game.ensure().coins, 100);
  wallets = AT.game.walletBalances();
  assert.equal(wallets.find(w => w.id === '1').balance, 0);
  assert.equal(wallets.find(w => w.id === '2').balance, 50);
  assert.equal(wallets.find(w => w.id === '3').balance, 100);
  AT = app(storage, '2'); assert.equal(AT.game.ensure().coins, 50);
  AT = app(storage, '1'); assert.equal(AT.game.ensure().coins, 0);
  assert.equal(AT.game.profile().appearances.ocean, true);
  AT = app(storage, '3'); assert.equal(AT.game.ensure().coins, 100);
});

test('неверное распределение не списывает валюту и не покупает оформление', () => {
  const storage = {}; let AT = app(storage, '1'); AT.game.ensure().coins = 400; AT.save(true);
  AT = app(storage, '2'); AT.game.ensure().coins = 200; AT.save(true);
  for (const allocation of [undefined, {'1':400}, {'1':401,'2':99}, {'1':-1,'2':501}, {'1':300.5,'2':199.5}, {'1':400, '2':101}, {'1':400, unknown:100}]) {
    assert.equal(AT.game.buyAppearance('ocean', allocation).ok, false);
    assert.equal(AT.game.ensure().coins, 200);
    assert.equal(AT.game.walletBalances().find(w => w.id === '1').balance, 400);
    assert.equal(AT.game.profile().appearances.ocean, undefined);
  }
});

test('при ошибке записи общего журнала все выбранные кошельки сохраняют баланс', () => {
  const data = {}; let fail = false;
  const storage = new Proxy(data, {set(target, key, value) {
    if (fail && key === 'anatomy-colloquium-rewards-shared-v1') throw new Error('storage full');
    target[key] = value; return true;
  }});
  let AT = app(storage, '1'); AT.game.ensure().coins = 300; AT.save(true);
  AT = app(storage, '2'); AT.game.ensure().coins = 300; AT.save(true);
  fail = true;
  assert.equal(AT.game.buyAppearance('ocean', {'1':200, '2':300}).ok, false);
  assert.equal(AT.game.ensure().coins, 300);
  assert.equal(AT.game.walletBalances().find(w => w.id === '1').balance, 300);
  assert.equal(AT.game.profile().appearances.ocean, undefined);
  fail = false; AT = app(storage, '1'); assert.equal(AT.game.ensure().coins, 300);
});

test('журнал применяется к каждому кошельку ровно один раз даже после перезагрузки', () => {
  const storage = {
    'anatomy-colloquium-v1': JSON.stringify({game:{coins:120}}),
    'anatomy-colloquium-v1-2': JSON.stringify({game:{coins:125}}),
    'anatomy-colloquium-rewards-shared-v1': JSON.stringify({appearances:{ocean:true}, appearance:'ocean', cosmeticSpent:{'1':70,'2':100}}),
  };
  let AT = app(storage, '1');
  assert.equal(AT.game.ensure().coins, 50);
  assert.equal(AT.game.walletBalances().find(w => w.id === '2').balance, 25);
  AT = app(storage, '1'); assert.equal(AT.game.ensure().coins, 50);
  AT = app(storage, '2'); assert.equal(AT.game.ensure().coins, 25);
  AT = app(storage, '2'); assert.equal(AT.game.ensure().coins, 25);
});

test('открытая вкладка не перезаписывает списание из другой базы', () => {
  const storage = {}; const oldTab = app(storage, '1');
  oldTab.game.ensure().coins = 400; oldTab.save(true);
  const buyer = app(storage, '2'); buyer.game.ensure().coins = 200; buyer.save(true);
  assert.equal(buyer.game.buyAppearance('ocean', {'1':300,'2':200}).ok, true);
  oldTab.save(true);
  assert.equal(oldTab.game.ensure().coins, 100);
  assert.equal(app(storage, '1').game.ensure().coins, 100);
});

test('сброс базы не переносит старые списания на новые заработанные очки', () => {
  const storage = {}; let AT = app(storage, '1'); AT.game.ensure().coins = 500; AT.save(true);
  assert.equal(AT.game.buyAppearance('ocean', {'1':500}).ok, true);
  AT.resetProgress();
  AT.game.ensure().coins += 50; AT.save(true);
  AT = app(storage, '1');
  assert.equal(AT.game.ensure().coins, 50);
  assert.equal(AT.game.profile().appearances.ocean, true);
});

test('покупка доступна при достаточном общем балансе, усиления всё ещё раздельны', () => {
  const storage = {}; let AT = app(storage, '1'); AT.game.ensure().coins = 400; AT.save(true);
  AT = app(storage, '2'); AT.game.ensure().coins = 150; AT.save(true);
  const html = AT.views.rewards().html;
  assert.match(html, /Во всех базах: 550/);
  assert.match(html, /data-action="buy-appearance" data-appearance="ocean">/);
  assert.equal(AT.game.buy('hint-train').ok, false);
  assert.equal(AT.game.walletBalances().find(w => w.id === '1').balance, 400);
});

test('общая покупка восстанавливает списание если сохранение текущего кошелька прервалось', () => {
  const data = {}; let arm = false, failBank = false;
  const storage = new Proxy(data, {set(target, key, value) {
    if (arm && key === 'anatomy-colloquium-rewards-shared-v1') failBank = true;
    if (failBank && key === 'anatomy-colloquium-v1-2') { failBank = false; throw new Error('storage full'); }
    target[key] = value; return true;
  }});
  let AT = app(storage, '1'); AT.game.ensure().coins = 300; AT.save(true);
  AT = app(storage, '2'); AT.game.ensure().coins = 300; AT.save(true);
  arm = true;
  assert.equal(AT.game.buyAppearance('ocean', {'1':200,'2':300}).ok, true);
  arm = false;
  assert.equal(AT.game.ensure().coins, 0);
  AT = app(storage, '2'); assert.equal(AT.game.ensure().coins, 0);
  AT = app(storage, '1'); assert.equal(AT.game.ensure().coins, 100);
  assert.equal(AT.game.profile().appearances.ocean, true);
});

test('аниме — самое дорогое оформление и покупается через общую оплату', () => {
  const storage = {}; let AT = app(storage, '1'); AT.game.ensure().coins = 2500; AT.save(true);
  AT = app(storage, '2'); AT.game.ensure().coins = 9000; AT.save(true);
  const styles = AT.game.appearances;
  const regularPrices = Object.entries(styles).filter(([id]) => id !== 'anime').map(([, style]) => style.price);
  assert.ok(styles.anime.price > Math.max(...regularPrices)); assert.equal(styles.anime.price, 5000);
  assert.equal(AT.game.buyAppearance('anime', {'1':2500, '2':2500}).ok, true);
  assert.equal(AT.game.ensure().coins, 6500); assert.equal(AT.game.walletBalances().find(w => w.id === '1').balance, 0);
  AT = app(storage, '3'); assert.equal(AT.game.profile().appearances.anime, true);
  assert.equal(AT.game.profile().appearance, 'anime');
});

test('достижение за все доступные оформления учитывает покупку аниме и сохраняется между базами', () => {
  const purchases = {ocean:true, ruby:true, amber:true, autumn:true, winter:true, spring:true};
  const storage = {'anatomy-colloquium-rewards-shared-v1': JSON.stringify({appearances:purchases, achievements:{}})};
  let AT = app(storage, '1'); let badge = AT.game.achievements().find(a => a.id === 'absolute-collector');
  assert.equal(badge.absolute, true); assert.equal(badge.goal, 7); assert.equal(badge.current, 6); assert.equal(badge.unlocked, false);
  AT.game.ensure().coins = 2500; AT.save(true);
  AT = app(storage, '2'); AT.game.ensure().coins = 2500; AT.save(true);
  assert.equal(AT.game.buyAppearance('anime', {'1':2500, '2':2500}).ok, true);
  badge = AT.game.achievements().find(a => a.id === 'absolute-collector');
  assert.equal(badge.current, 7); assert.equal(badge.unlocked, true);
  AT.resetProgress(); AT = app(storage, 'credit-1');
  assert.equal(AT.game.achievements().find(a => a.id === 'absolute-collector').unlocked, true);
});

test('временно скрытое мемное оформление не продаётся, право на него не удаляется', () => {
  const storage = {'anatomy-colloquium-rewards-shared-v1': JSON.stringify({appearance:'meme', appearances:{meme:true}, achievements:{}})};
  let AT = app(storage); assert.equal(AT.game.profile().appearance, 'default');
  assert.equal(AT.game.profile().appearances.meme, true);
  assert.equal(AT.game.buyAppearance('meme', {'1':6000}).ok, false);
  assert.doesNotMatch(AT.views.rewards().html, /Мемопад/);
  assert.equal(AT.game.inspectAppearanceImport({sharedRewards:{appearances:{anime:true,meme:true}}}).ok, true);
  assert.equal(AT.game.importAppearances({sharedRewards:{appearances:{anime:true,meme:true}}}).ok, true);
  AT = app(storage, '2'); assert.equal(AT.game.profile().appearances.meme, true);
});

test('аниме оформление имеет локальный полноэкранный фон, постер и анимацию', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css/styles.css'), 'utf8');
  assert.match(css, /data-theme="dark"\]\[data-accent="anime"/); assert.match(css, /prefers-reduced-motion/);
  for (const name of ['attack-on-titan-key-visual.jpg', 'titan-sunset.webp', 'titan-intro.gif']) assert.ok(fs.statSync(path.join(__dirname, '..', 'assets', name)).size > 10000);
  assert.match(css, /titan-sunset\.webp/); assert.match(css, /cover no-repeat/);
  assert.match(css, /height: 100lvh/); assert.match(css, /0%, 75% \{ opacity: 1; \}/);
  assert.match(css, /position: absolute; inset: 0; width: 100%; height: 100%/);
  const study = fs.readFileSync(path.join(__dirname, '..', 'js/views-study.js'), 'utf8');
  assert.match(study, /matchMedia\('\(max-width: 760px\)'\)/);
  assert.match(app().views.dashboard().html, /hero__titan-media/);
  const gif = fs.readFileSync(path.join(__dirname, '..', 'assets', 'titan-intro.gif'));
  assert.match(gif.toString('ascii', 0, 6), /^GIF8/); assert.equal(gif.includes(Buffer.from('NETSCAPE2.0')), false);
  assert.match(css, /--teal: var\(--primary\)/); assert.match(css, /\.hero:not\(\.hero--credit\)/);
  assert.match(app().views.rewards().html, /Атака титанов/);
});

test('импорт оформлений добавляет коллекцию, сохраняя прогресс, валюту и выбранную тему', () => {
  const storage = {};
  let AT = app(storage, '1');
  AT.getState().progress.q1 = { attempts: 2, correct: 2, streak: 2 };
  AT.getState().key['1'] = [2];
  AT.game.ensure().coins = 321; AT.game.ensure().rating = 45; AT.save(true);
  const file = { sharedRewards: { appearances: Object.fromEntries(Object.keys(AT.game.appearances).filter(id => id !== 'default').map(id => [id, true])) }, game: { coins: 1000000 }, progress: {} };
  assert.equal(AT.game.inspectAppearanceImport(file).ids.length, 7);
  assert.equal(AT.game.importAppearances(file).ok, true);
  assert.equal(AT.game.ensure().coins, 321); assert.equal(AT.game.ensure().rating, 45);
  assert.equal(AT.getState().progress.q1.streak, 2); assert.deepEqual([...AT.getState().key['1']], [2]);
  assert.equal(AT.game.profile().appearance, 'default');
  assert.equal(AT.game.achievements().find(a => a.id === 'absolute-collector').unlocked, true);
  AT = app(storage, '2'); assert.equal(AT.game.profile().appearances.anime, true);
  assert.equal(AT.game.selectAppearance('anime').ok, true);
});

test('неверный или несовместимый файл оформления не меняет коллекцию', () => {
  const AT = app();
  for (const file of [null, {}, { sharedRewards: { appearances: [] } }, { sharedRewards: { appearances: { anime: true, future: true } } }, { sharedRewards: { appearances: { anime: 'true' } } }]) {
    assert.equal(AT.game.importAppearances(file).ok, false);
    assert.equal(!!AT.game.profile().appearances.anime, false);
  }
  assert.match(AT.views.settings().html, /Импортировать оформления/);
});

test('порядок вариантов сохраняется на всю сессию и меняется только для новых сессий', () => {
  const storage = {}; let AT = app(storage, '1');
  assert.equal(AT.getState().settings.shuffleAnswers, true);
  AT.utils.shuffle = values => values.slice().reverse();
  const q = AT.dataset.questions[0];
  const session = AT.startSession({mode:'train', ids:[q.id]});
  const expected = Array.from({length:q.options.length}, (_, i) => q.options.length - i);
  assert.deepEqual(Array.from(AT.optionOrder(session, q)), expected);
  AT.getState().settings.shuffleAnswers = false;
  AT.save(true);
  AT = app(storage, '1');
  assert.deepEqual(Array.from(AT.optionOrder(AT.currentSession(), q)), expected);
  const plain = AT.startSession({mode:'train', ids:[q.id]});
  assert.deepEqual(Array.from(AT.optionOrder(plain, q)), expected.slice().reverse());
  assert.match(AT.views.settings().html, /Перемешивать варианты ответов/);
  const legacy = {mode:'train', results:{[q.id]:{selected:[1], revealed:false}}};
  assert.deepEqual(Array.from(AT.optionOrder(legacy, q)), expected.slice().reverse());
  const damaged = {optionOrders:{[q.id]:expected.map(() => 1)}};
  assert.deepEqual(Array.from(AT.optionOrder(damaged, q)), expected.slice().reverse());
});

test('перемешивание сохраняет исходные ключи, подсказки и номера в разборе', () => {
  const AT = app(); const q = AT.dataset.questions[0];
  AT.utils.shuffle = values => values.slice().reverse();
  const session = AT.startSession({mode:'train', ids:[q.id]});
  const order = Array.from(AT.optionOrder(session, q));
  const key = Array.from(AT.keyApi.forQuestion(q).answers);
  assert.deepEqual(key, [1,2]);
  const entry = session.results[q.id] = {selected:key.slice(), revealed:false, correct:null};
  assert.equal(AT.gradeQuestion(q, entry.selected).correct, true);
  const html = AT.views.questionCard(session, q, entry);
  assert.match(html, /data-index="5"[^>]*>[\s\S]*?<span class="option__key">1<\/span>/);
  assert.match(html, /data-index="1"[^>]*>[\s\S]*?<span class="option__key">5<\/span>/);
  AT.game.ensure().inventory['hint-train'] = 1;
  assert.equal(AT.game.useHint(session, q, entry).ok, true);
  assert.ok(!key.includes(entry.hiddenOptions[0]));
  assert.doesNotMatch(AT.views.questionCard(session, q, entry), new RegExp('data-index="' + entry.hiddenOptions[0] + '"'));
  entry.revealed = true; entry.correct = true;
  assert.match(AT.views.questionCard(session, q, entry), /Правильный ответ: <b>4, 5<\/b>/);
  AT.finishSession();
  const summary = AT.views.summary().html;
  assert.match(summary, new RegExp('4\\. ' + AT.utils.esc(q.options[1]).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(summary, new RegExp('5\\. ' + AT.utils.esc(q.options[0]).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.deepEqual(Array.from(AT.keyApi.forQuestion(q).answers), key);
  assert.deepEqual(Array.from(AT.optionOrder(session, q)), order);
});

test('варианты во всех базах, включая вопросы с четырьмя и шестью ответами, не меняют проверку', () => {
  for (const id of ['1','2','3','4','credit-1','credit-2','stom-2','stom-3']) {
    const AT = app({}, id); AT.utils.shuffle = values => values.slice().reverse();
    const questions = AT.dataset.questions;
    const session = AT.startSession({mode:'train', ids:questions.map(q => q.id)});
    for (const q of questions) {
      const original = Array.from(q.options), order = Array.from(AT.optionOrder(session, q));
      assert.equal(new Set(order).size, original.length);
      assert.deepEqual(order.slice().sort((a,b)=>a-b), original.map((_, i)=>i+1));
      const answer = AT.keyApi.forQuestion(q);
      if (answer) assert.equal(AT.gradeQuestion(q, Array.from(answer.answers)).correct, true);
      else assert.equal(AT.gradeQuestion(q, []).correct, null);
      assert.deepEqual(Array.from(q.options), original);
    }
  }
});

test('вопросы с обобщающими вариантами не меняют исходный порядок', () => {
  for (const [id, num] of [['2','169'], ['credit-1','237']]) {
    const AT = app({}, id); AT.utils.shuffle = values => values.slice().reverse();
    const q = AT.dataset.byNum.get(num); const session = AT.startSession({mode:'train', ids:[q.id]});
    assert.match(q.options.join(' '), /все перечисленное верно/i);
    assert.deepEqual(Array.from(AT.optionOrder(session, q)), Array.from(q.options, (_,i)=>i+1));
  }
});

test('избранное и комментарии сохраняются отдельно по базам и не меняют прежние данные', () => {
  const storage = {'anatomy-colloquium-v1': JSON.stringify({progress:{q1:{attempts:3,correct:2,wrong:1,streak:1}}, key:{'1':[1]}, settings:{shuffleAnswers:false},game:{coins:75}})};
  let AT = app(storage, '1'); const q = AT.dataset.questions[0];
  assert.equal(AT.annotations.toggleFavorite(q.id), true);
  assert.equal(AT.annotations.setComment(q.id, 'Тест <script>\nстрока 2'), true);
  assert.equal(AT.annotations.isFavorite(q.id), true);
  const session = AT.startSession({mode:'train',ids:[q.id]});
  const html = AT.views.questionCard(session, q, {selected:[],revealed:false});
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /Тест &lt;script&gt;\nстрока 2/);
  assert.doesNotMatch(html, /Тест <script>/);
  AT = app(storage, '1');
  assert.equal(AT.annotations.comment(q.id), 'Тест <script>\nстрока 2');
  assert.equal(AT.annotations.isFavorite(q.id), true);
  assert.equal(AT.progressOf(q.id).attempts, 3);
  assert.equal(AT.game.ensure().coins, 75);
  assert.deepEqual(Array.from(AT.keyApi.forQuestion(q).answers), [1]);
  assert.equal(AT.getState().settings.shuffleAnswers, false);
  const other = app(storage, '2');
  assert.equal(other.annotations.isFavorite(q.id), false);
  assert.equal(other.annotations.comment(q.id), '');
  AT.resetProgress();
  assert.equal(AT.annotations.isFavorite(q.id), true);
  assert.equal(AT.annotations.comment(q.id), 'Тест <script>\nстрока 2');
  AT.annotations.toggleFavorite(q.id);
  AT.annotations.setComment(q.id, '');
  AT = app(storage, '1');
  assert.equal(AT.annotations.isFavorite(q.id), false);
  assert.equal(AT.annotations.comment(q.id), '');
});

test('режим избранного выбирает только отмеченные вопросы выбранных тем и учитывает лимит', () => {
  for (const id of ['1','2','3','4','credit-1','credit-2','stom-2','stom-3']) {
    const AT = app({}, id);
    const first = AT.dataset.questions[0];
    const second = AT.dataset.questions.find(q => q.topic !== first.topic);
    assert.ok(second, id);
    AT.annotations.toggleFavorite(first.id);
    AT.annotations.toggleFavorite(second.id);
    assert.deepEqual(Array.from(AT.pickQuestions({scope:'favorites', topicIds:[first.topic], limit:0})), [first.id]);
    assert.equal(AT.pickQuestions({scope:'favorites', topicIds:['all'], limit:1}).length, 1);
    assert.deepEqual(new Set(AT.pickQuestions({scope:'favorites', topicIds:['all']})), new Set([first.id, second.id]));
    AT.annotations.toggleFavorite(first.id);
    assert.equal(AT.pickQuestions({scope:'favorites', topicIds:[first.topic]}).length, 0);
    assert.equal(AT.annotations.toggleFavorite('unknown'), false);
    assert.equal(AT.annotations.setComment('unknown', 'no'), false);
    assert.match(AT.views.trainSetup().html, /data-scope="favorites"/);
  }
});
