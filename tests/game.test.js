const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function app(storage = {}, selected = '1') {
  storage['anatomy-colloquium-selected'] = selected;
  const ctx = vm.createContext({ window: {}, console, setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage: { getItem: key => storage[key] || null, setItem: (key, value) => { storage[key] = value; } } });
  for (const f of ['js/data/questions.js','js/data/answers.js','js/data/exam.js','js/data/colloquium-2.js','js/data/colloquium-3.js','js/data/colloquium-4.js', 'js/data/colloquium-5.js', 'js/data/colloquium-6.js', 'js/data/colloquium-7.js','js/data/credit-1.js','js/data/credit-2.js','js/data/dental-2.js','js/data/dental-3.js','js/modules.js','js/core.js','js/game.js','js/ui.js','js/views-study.js','js/views-pages.js','js/views-rewards.js']) {
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

test('штрафы не опускают баланс и рейтинг ниже нуля, недоступные экзамены не продаются', () => {
  let AT = app(), q = AT.dataset.questions[0];
  const session = AT.startSession({mode:'exam', ids:[q.id]});
  AT.gradeSession(session);
  assert.equal(AT.game.ensure().coins, 0);
  assert.equal(AT.game.ensure().rating, 0);
  AT = app({}, 'credit-1'); AT.game.ensure().coins = 500;
  assert.equal(AT.game.walletBalance(), 500);
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

test('оформление покупается из общего кошелька, доступно везде и переживает сброс', () => {
  const storage = {}; let AT = app(storage, '1'), game = AT.game;
  game.ensure().coins = 500;
  assert.equal(game.buyAppearance('ruby', {'1': 500}).ok, false);
  assert.equal(game.buyAppearance('ocean', {'1': 500}).ok, true);
  assert.equal(game.walletBalance(), 0);
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
    assert.equal(AT.game.walletBalance(), 0);
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

test('аниме — одно из самых дорогих оформлений и покупается через общую оплату', () => {
  const storage = {}; let AT = app(storage, '1'); AT.game.ensure().coins = 2500; AT.save(true);
  AT = app(storage, '2'); AT.game.ensure().coins = 9000; AT.save(true);
  const styles = AT.game.appearances;
  const regularPrices = Object.entries(styles).filter(([, style]) => !style.premium).map(([, style]) => style.price);
  assert.ok(styles.anime.price > Math.max(...regularPrices)); assert.equal(styles.anime.price, 5000);
  assert.equal(AT.game.buyAppearance('anime', {'1':2500, '2':2500}).ok, true);
  assert.equal(AT.game.walletBalance(), 6500);
  AT = app(storage, '3'); assert.equal(AT.game.profile().appearances.anime, true);
  assert.equal(AT.game.profile().appearance, 'anime');
});

test('достижение за все доступные оформления учитывает покупку аниме и сохраняется между базами', () => {
  const purchases = {ocean:true, ruby:true, amber:true, autumn:true, winter:true, spring:true, rickmorty:true, breakingbad:true};
  const storage = {'anatomy-colloquium-rewards-shared-v1': JSON.stringify({appearances:purchases, achievements:{}})};
  let AT = app(storage, '1'); let badge = AT.game.achievements().find(a => a.id === 'absolute-collector');
  assert.equal(badge.absolute, true); assert.equal(badge.goal, 9); assert.equal(badge.current, 8); assert.equal(badge.unlocked, false);
  AT.game.ensure().coins = 2500; AT.save(true);
  AT = app(storage, '2'); AT.game.ensure().coins = 2500; AT.save(true);
  assert.equal(AT.game.buyAppearance('anime', {'1':2500, '2':2500}).ok, true);
  badge = AT.game.achievements().find(a => a.id === 'absolute-collector');
  assert.equal(badge.current, 9); assert.equal(badge.unlocked, true);
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
  assert.equal(AT.game.inspectAppearanceImport(file).ids.length, 9);
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

test('перемешивание сохраняет исходные ключи и номера в разборе', () => {
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

test('общий портфель собирает избранные вопросы и заметки всех баз без смешения одинаковых ID', () => {
  const storage = {}; const a = app(storage, '1'), q1 = a.dataset.questions[0];
  a.annotations.toggleFavorite(q1.id); a.annotations.setComment(q1.id, 'первый <script>');
  const b = app(storage, '2'), q2 = b.dataset.questions[0];
  assert.equal(q1.id, q2.id); b.annotations.toggleFavorite(q2.id); b.annotations.setComment(q2.id, 'второй');
  const bstate = b.getState(); bstate.progress[q2.id] = {attempts:7,correct:4,wrong:3,streak:0}; b.game.ensure().coins = 33; b.save(true);
  const groups = a.portfolio.allFavorites();
  assert.deepEqual(Array.from(groups, group => group.module.id), ['1','2']);
  assert.equal(groups[0].questions[0].comment, 'первый <script>');
  assert.equal(groups[1].questions[0].comment, 'второй');
  const html = a.views.portfolio().html;
  assert.match(html, /первый &lt;script&gt;/); assert.match(html, /второй/);
  assert.match(html, /Миология/); assert.match(html, /Остеология/);
  assert.equal(a.portfolio.removeFavorite('2', q2.id), true);
  assert.equal(a.portfolio.allFavorites().length, 1);
  const bAgain = app(storage, '2');
  assert.equal(bAgain.annotations.isFavorite(q2.id), false);
  assert.equal(bAgain.annotations.comment(q2.id), 'второй');
  assert.equal(bAgain.progressOf(q2.id).attempts, 7);
  assert.equal(bAgain.game.ensure().coins, 33);
  assert.equal(a.annotations.isFavorite(q1.id), true);
  assert.equal(a.portfolio.removeFavorite('unknown', q1.id), false);
});

test('возврат назад доступен без проверки и отключён на первом вопросе', () => {
  const AT = app(); const qs = AT.dataset.questions.slice(0,2);
  const session = AT.startSession({mode:'train', ids:qs.map(q => q.id)});
  let html = AT.views.questionCard(session, qs[0], {selected:[], revealed:false});
  assert.match(html, /data-action="prev" disabled/);
  session.index = 1;
  html = AT.views.questionCard(session, qs[1], {selected:[2], revealed:false});
  assert.match(html, /data-action="prev"(?! disabled)/);
  assert.equal(AT.progressOf(qs[1].id).attempts, 0);
});

test('каждый микроб даёт ровно 50 общей валюты без рейтинга и без повторных начислений', () => {
  const storage = {}; let AT = app(storage, '1');
  const q = AT.dataset.questions[0];
  const s = AT.startSession({mode:'train',ids:[q.id]});
  s.results[q.id] = {selected:[],revealed:false,correct:null}; s.germSeen = {[q.id]:true};
  AT.game.ensure().coins = 10; AT.game.ensure().rating = 23;
  const g = AT.game.sessionGame(s);
  for (let i = 0; i < 3; i++) assert.equal(AT.game.awardMicrobe(s, q, i).ok, true);
  assert.equal(AT.game.ensure().coins, 160); assert.equal(AT.game.ensure().rating, 23);
  assert.equal(g.coinsChange, 150); assert.equal(g.coinsEarned, 150); assert.equal(g.germCoins, 150); assert.equal(g.germsPopped, 3);
  assert.equal(AT.progressOf(q.id).attempts, 0);
  assert.equal(AT.game.awardMicrobe(s, q, 0).ok, false);
  AT = app(storage, '1');
  const restored = AT.currentSession(), qr = AT.dataset.byId.get(q.id);
  assert.equal(AT.game.ensure().coins, 160);
  assert.equal(AT.game.awardMicrobe(restored, qr, 2).ok, false);
  assert.equal(AT.game.ensure().coins, 160);
  assert.equal(app(storage, '2').game.walletBalance(), 160);
  AT.finishSession();
  assert.match(AT.views.summary().html, /Микробы: 3 · \+150 валюты/);
});

test('награда за микроба откатывается при ошибке записи и не начисляется в недопустимых состояниях', () => {
  const AT = app(), q = AT.dataset.questions[0], s = AT.startSession({mode:'train',ids:[q.id]});
  s.results[q.id] = {selected:[],revealed:false,correct:null}; s.germSeen = {[q.id]:true};
  const game = AT.game.ensure(), g = AT.game.sessionGame(s);
  game.coins = 7; game.rating = 11;
  const save = AT.save; AT.save = () => false;
  assert.equal(AT.game.awardMicrobe(s, q, 1).ok, false);
  assert.equal(game.coins, 7); assert.equal(game.rating, 11);
  assert.equal(g.coinsEarned, 0); assert.equal(g.coinsChange, 0); assert.equal(g.germCoins, 0); assert.equal(g.germsPopped, 0);
  AT.save = save;
  assert.equal(AT.game.awardMicrobe(s, q, 1).ok, true); assert.equal(game.coins, 57);
  assert.equal(AT.game.awardMicrobe(s, q, -1).ok, false);
  assert.equal(AT.game.awardMicrobe(s, q, 3).ok, false);
  s.results[q.id].revealed = true; assert.equal(AT.game.awardMicrobe(s, q, 0).ok, false);
  const exam = AT.startSession({mode:'exam',ids:[q.id]}); exam.germSeen = {[q.id]:true}; exam.results[q.id] = {selected:[],revealed:false};
  assert.equal(AT.game.awardMicrobe(exam, q, 0).ok, false);
  assert.equal(AT.game.awardMicrobe(s, q, 0).ok, false);
});

test('награда за микроба сохраняется даже при выходе из незавершённой тренировки', () => {
  const storage = {}; let AT = app(storage, '1'); const q = AT.dataset.questions[0];
  const s = AT.startSession({mode:'train', ids:[q.id]});
  s.results[q.id] = {selected:[], revealed:false, correct:null}; s.germSeen = {[q.id]:true};
  assert.equal(AT.game.awardMicrobe(s, q, 0).ok, true);
  AT.discardSession(); AT = app(storage, '1');
  assert.equal(AT.currentSession(), null);
  assert.equal(AT.game.ensure().coins, 50);
  assert.equal(AT.game.ensure().rating, 0);
});

test('общий кошелёк объединяет прежние балансы, старые списания и возврат неиспользованных усилений один раз', () => {
  const storage = {
    'anatomy-colloquium-v1': JSON.stringify({game:{coins:120, rating:12, inventory:{'hint-train':2}}}),
    'anatomy-colloquium-v1-2': JSON.stringify({game:{coins:125, rating:4, inventory:{'double-exam':1}}}),
    'anatomy-colloquium-rewards-shared-v1': JSON.stringify({appearances:{ocean:true}, appearance:'ocean', cosmeticSpent:{'1':70,'2':100}}),
  };
  for (const id of ['1','2','stom-2','1','2']) {
    const AT = app(storage, id);
    assert.equal(AT.game.walletBalance(), 1195);
    assert.equal(AT.game.totalRating(), 16);
    assert.equal(AT.game.profile().appearances.ocean, true);
  }
});

test('новые начисления общие и покупки списываются один раз из общей суммы', () => {
  const storage = {}; let AT = app(storage, '1');
  AT.game.ensure().coins = 300; AT.save(true);
  AT = app(storage, '2'); AT.game.ensure().coins = 300; AT.save(true);
  assert.equal(AT.game.walletBalance(), 600);
  assert.match(AT.views.rewards().html, /Общий кошелёк/);
  assert.doesNotMatch(AT.views.rewards().html, /Магазин усилений|buy-boost|data-wallet/);
  assert.equal(AT.game.buyAppearance('ocean').ok, true);
  assert.equal(AT.game.walletBalance(), 100);
  assert.equal(AT.game.buyAppearance('ocean').ok, false);
  AT = app(storage, '1'); assert.equal(AT.game.walletBalance(), 100);
  attempt(AT, AT.dataset.questions[0]);
  AT = app(storage, '3'); assert.equal(AT.game.walletBalance(), 110);
  assert.equal(AT.game.profile().appearances.ocean, true);
  assert.equal(AT.game.buyAppearance('ruby').ok, false);
  assert.equal(AT.game.walletBalance(), 110);
});

test('сброс любой базы сохраняет общий кошелёк, включая заработанное в ней, и купленные оформления', () => {
  const storage = {}; let AT = app(storage, '1');
  AT.game.ensure().coins = 400; AT.game.ensure().rating = 10; AT.save(true);
  AT = app(storage, '2'); AT.game.ensure().coins = 200; AT.game.ensure().rating = 7; AT.save(true);
  assert.equal(AT.game.buyAppearance('ocean').ok, true);
  AT.resetProgress(); assert.equal(AT.game.walletBalance(), 100); assert.equal(AT.game.totalRating(), 10);
  AT = app(storage, '1'); AT.resetProgress();
  AT = app(storage, '2'); assert.equal(AT.game.walletBalance(), 100);
  assert.equal(AT.game.totalRating(), 0); assert.equal(AT.game.profile().appearances.ocean, true);
  assert.match(AT.views.settings().html, /общий кошелёк/);
});

test('экзаменационный штраф списывается из общего кошелька и ограничен доступной суммой', () => {
  const storage = {}; let AT = app(storage, '2'); AT.game.ensure().coins = 7; AT.save(true);
  AT = app(storage, '1'); const qs = AT.dataset.questions.slice(0,2);
  const s = AT.startSession({mode:'exam',ids:qs.map(q=>q.id)});
  AT.gradeSession(s); AT.finishSession();
  assert.equal(s.game.coinsPenalty, 10); assert.equal(s.game.coinsChange, -7);
  assert.equal(AT.game.walletBalance(), 0);
  AT = app(storage, '2'); assert.equal(AT.game.walletBalance(), 0);
  AT.resetProgress(); assert.equal(AT.game.walletBalance(), 0);
  AT = app(storage, '1'); attempt(AT, qs[0]);
  assert.equal(AT.game.walletBalance(), 10);
});

test('остаток активного удвоения возвращается пропорционально, подсказка убрана, история сохраняется', () => {
  const storage = {}; let AT = app(storage, '1'); const q = AT.dataset.questions[0];
  AT.startSession({mode:'train',ids:[q.id]});
  const raw = JSON.parse(storage['anatomy-colloquium-v1']);
  raw.game.coins = 30; raw.game.inventory = {'hint-train':1, 'double-train':1};
  raw.session.game = {bonusUsed:true, bonusEffect:'rating', bonusRemaining:10, hintsUsed:1};
  raw.session.results[q.id] = {selected:[], revealed:false, hiddenOptions:[3]};
  storage['anatomy-colloquium-v1'] = JSON.stringify(raw);
  AT = app(storage, '2'); assert.equal(AT.game.walletBalance(), 670);
  AT = app(storage, '1'); const s = AT.currentSession();
  assert.equal(AT.game.walletBalance(), 670); assert.equal(s.game.bonusRemaining, 0);
  assert.equal(s.game.hintsUsed, 1); assert.equal(s.results[q.id].hiddenOptions, undefined);
  const question = AT.dataset.byId.get(q.id);
  assert.doesNotMatch(AT.views.questionCard(s, question, s.results[q.id]), /boost-bar|use-hint|use-double/);
  const entry = s.results[q.id] = {selected:AT.keyApi.forQuestion(question).answers, correct:true, self:false, revealed:true};
  AT.game.awardTraining(s, question, entry, false);
  assert.equal(AT.game.walletBalance(), 680); assert.equal(AT.game.ensure().rating, 5);
  AT.finishSession(); assert.equal(AT.getState().sessions[0].assisted, true);
  AT = app(storage, '1'); assert.equal(AT.game.walletBalance(), 680);
});

test('законченные усиления не возвращаются заново, старые записи о помощи остаются', () => {
  const storage = {'anatomy-colloquium-v1': JSON.stringify({game:{coins:22}, session:{mode:'exam', finished:true, game:{bonusUsed:true,bonusRemaining:12,hintsUsed:1}}})};
  const AT = app(storage);
  assert.equal(AT.game.walletBalance(), 22);
  assert.equal(AT.getState().session.game.bonusRemaining, 0);
  assert.equal(AT.getState().session.game.bonusUsed, true);
});

test('покупка не тратит валюту при ошибке записи общего профиля', () => {
  const data = {}; let fail = false;
  const storage = new Proxy(data, {set(target, key, value) {
    if (fail && key === 'anatomy-colloquium-rewards-shared-v1') throw new Error('storage full');
    target[key] = value; return true;
  }});
  let AT = app(storage, '1'); AT.game.ensure().coins = 300; AT.save(true);
  AT = app(storage, '2'); AT.game.ensure().coins = 300; AT.save(true);
  fail = true; assert.equal(AT.game.buyAppearance('ocean').ok, false);
  assert.equal(AT.game.walletBalance(), 600); assert.equal(AT.game.profile().appearances.ocean, undefined);
  fail = false; AT = app(storage, '1'); assert.equal(AT.game.walletBalance(), 600);
});

test('покупки из других открытых вкладок не теряются и повторно проверяют общий баланс', () => {
  const storage = {}; let a = app(storage, '1'); a.game.ensure().coins = 600; a.save(true);
  const b = app(storage, '2');
  assert.equal(b.game.buyAppearance('ocean').ok, true);
  a.save(true); assert.equal(a.game.walletBalance(), 100);
  assert.equal(a.game.buyAppearance('ocean').ok, false);
  assert.equal(a.game.buyAppearance('ruby').ok, false);
  assert.equal(app(storage, '2').game.walletBalance(), 100);
});

test('возврат усилений переживает ошибку записи и не дублируется после повторной загрузки', () => {
  const data = {'anatomy-colloquium-v1': JSON.stringify({game:{coins:15,inventory:{'hint-exam':1}}})};
  let fail = true;
  const storage = new Proxy(data, {set(target,key,value) {
    if (fail && key === 'anatomy-colloquium-v1') throw new Error('storage full');
    target[key] = value; return true;
  }});
  let AT = app(storage); assert.equal(AT.game.walletBalance(), 495);
  assert.equal(AT.game.buyAppearance('ocean').ok, false);
  fail = false; AT = app(storage); assert.equal(AT.game.walletBalance(), 495);
  AT = app(storage); assert.equal(AT.game.walletBalance(), 495);
});


test('пасхалка скрыта в настройках даже при сохранённом старом отключении', () => {
  const storage = {'anatomy-colloquium-v1': JSON.stringify({settings:{germSquad:false}})};
  const AT = app(storage);
  const html = AT.views.settings().html;
  assert.doesNotMatch(html, /germSquad|Бригада микробов|0,2%/);
});

test('ПНС участвует в общем кошельке, рейтинге и достижениях по нервной системе', () => {
  const storage = {}; let AT = app(storage, '1'); AT.game.ensure().coins = 300; AT.save(true);
  AT = app(storage, '6'); assert.equal(AT.game.walletBalance(), 300);
  const q = AT.dataset.questions[0]; attempt(AT, q); attempt(AT, q);
  assert.equal(AT.game.walletBalance(), 320);
  assert.equal(AT.game.achievements().find(a => a.id === 'nervous-200').current, 1);
  AT = app(storage, '1'); assert.equal(AT.game.walletBalance(), 320);
  assert.equal(AT.game.totalRating(), 10);
});

test('пятый коллоквиум использует общий кошелёк и считает освоенные вопросы по нервной системе', () => {
  const storage = {}; let AT = app(storage, '6'); AT.game.ensure().coins = 80; AT.save(true);
  AT = app(storage, '5'); assert.equal(AT.game.walletBalance(), 80);
  const q = AT.dataset.byNum.get('133'); attempt(AT, q); attempt(AT, q);
  assert.equal(AT.game.walletBalance(), 100);
  assert.equal(AT.game.achievements().find(a => a.id === 'nervous-200').current, 1);
  AT = app(storage, '6'); assert.equal(AT.game.walletBalance(), 100);
});

test('база ССС участвует в общем кошельке и рейтинге всех баз', () => {
  const storage = {}; let AT = app(storage, '6'); AT.game.ensure().coins = 80; AT.save(true);
  AT = app(storage, '7'); assert.equal(AT.game.walletBalance(), 80);
  const q = AT.dataset.questions[0]; attempt(AT, q);
  assert.equal(AT.game.walletBalance(), 90); assert.equal(AT.game.totalRating(), 5);
  AT = app(storage, '6'); assert.equal(AT.game.walletBalance(), 90);
});

test('оформления сериалов покупаются из общего кошелька, сохраняются и доступны во всех базах', () => {
  const storage = {}; let AT = app(storage, '5'); AT.game.ensure().coins = 6000; AT.save(true);
  AT = app(storage, '7'); AT.game.ensure().coins = 5000; AT.save(true);
  for (const id of ['rickmorty', 'breakingbad']) {
    assert.equal(AT.game.appearances[id].premium, true);
    assert.equal(AT.game.appearances[id].price, 5000);
    assert.equal(AT.game.buyAppearance(id).ok, true);
    assert.equal(AT.game.profile().appearance, id);
  }
  assert.equal(AT.game.walletBalance(), 1000);
  AT = app(storage, '6');
  for (const id of ['rickmorty', 'breakingbad']) {
    assert.equal(AT.game.profile().appearances[id], true);
    assert.match(AT.views.rewards().html, new RegExp('appearance-preview--' + id));
    assert.equal(AT.game.selectAppearance(id).ok, true);
  }
  AT.resetProgress(); AT = app(storage, '5');
  assert.equal(AT.game.walletBalance(), 1000);
  assert.equal(AT.game.profile().appearance, 'breakingbad');
  assert.equal(AT.game.profile().appearances.rickmorty, true);
  const css = fs.readFileSync(path.join(__dirname, '..', 'css/styles.css'), 'utf8');
  for (const [id, filename] of [['rickmorty', 'rick-morty-hero.webp'], ['breakingbad', 'breaking-bad.jpg']]) {
    assert.match(css, new RegExp('data-accent="' + id + '"'));
    assert.match(css, new RegExp('appearance-preview--' + id));
    assert.ok(css.includes(filename));
    assert.ok(fs.statSync(path.join(__dirname, '..', 'assets', filename)).size > 10000);
  }
});

test('ранее полученное достижение коллекционера сохраняется после расширения магазина', () => {
  const storage = {'anatomy-colloquium-rewards-shared-v1': JSON.stringify({achievements:{'absolute-collector':123}, appearances:{anime:true}})};
  const badge = app(storage).game.achievements().find(a => a.id === 'absolute-collector');
  assert.equal(badge.goal, 9); assert.equal(badge.unlocked, true);
});


test('общий фон и центральный блок оформлений сериалов используют разные локальные картинки', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css/styles.css'), 'utf8');
  for (const [id, hero, background] of [
    ['rickmorty', 'rick-morty-hero.webp', 'rick-morty-world.webp'],
    ['breakingbad', 'breaking-bad.jpg', 'breaking-bad-background.jpg'],
  ]) {
    const rule = css.match(new RegExp('\\[data-accent="' + id + '"\\] \\{([^}]+)\\}'))[1];
    assert.ok(rule.includes('--series-art: url(\'../assets/' + hero + '\')'));
    assert.ok(rule.includes('--series-background: url(\'../assets/' + background + '\')'));
    assert.ok(fs.statSync(path.join(__dirname, '..', 'assets', background)).size > 10000);
  }
  assert.match(css, /var\(--series-background\) center \/ cover no-repeat/);
  assert.match(css, /var\(--series-art\) center 45% \/ cover no-repeat/);
});

test('оформление Рика использует выбранные изображения и однократную GIF-сцену', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css/styles.css'), 'utf8');
  const study = fs.readFileSync(path.join(__dirname, '..', 'js/views-study.js'), 'utf8');
  assert.match(css, /rick-morty-hero\.webp/); assert.match(css, /rick-morty-world\.webp/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.hero__rick-intro/);
  assert.match(css, /\.hero__rick-intro img \{[^}]*object-fit: contain/);
  assert.match(css, /\.hero__rick-intro \{[^}]*mask-image: radial-gradient/);
  assert.match(css, /@media \(max-width: 760px\) \{ \.hero__rick-intro \{ display: none; animation: none;/);
  const mobileCheck = study.indexOf("matchMedia('(max-width: 760px)')");
  assert.ok(mobileCheck > 0 && mobileCheck < study.indexOf("appearance === 'rickmorty'"));
  assert.match(study, /rickIntroPlayed/); assert.match(study, /rick-morty-intro-hd\.gif/);
  assert.match(css, /\.hero--rick-playing \{\s*background: linear-gradient/);
  assert.match(study, /animationcancel/); assert.match(study, /hero\.classList\.remove\('hero--rick-playing'\)/);
  const gif = fs.readFileSync(path.join(__dirname, '..', 'assets', 'rick-morty-intro-hd.gif'));
  assert.match(gif.toString('ascii', 0, 6), /^GIF8/);
  assert.ok(gif.readUInt16LE(6) >= 800 && gif.readUInt16LE(8) >= 450);
  assert.equal(gif.includes(Buffer.from('NETSCAPE2.0')), false);
});
