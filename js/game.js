/* Общий кошелёк, достижения и оформления на устройстве. */
(function () {
  'use strict';
  const AT = window.AT;
  const BANKS = window.COLLOQUIUM_IDS || [AT.colloquium.id];
  // Возврат за оставшиеся старые усиления по последним ценам магазина.
  const LEGACY_BOOST_PRICES = { 'hint-train': 160, 'hint-exam': 480, 'double-train': 320, 'double-exam': 800 };
  const ACHIEVEMENTS = [
    { id: 'explore-1', title: 'Первый шаг', description: 'Открыть и оценить 1 вопрос', metric: 'explored', goal: 1 },
    { id: 'explore-10', title: 'Начало пути', description: 'Изучить 10 разных вопросов', metric: 'explored', goal: 10 },
    { id: 'explore-50', title: 'Исследователь', description: 'Изучить 50 разных вопросов', metric: 'explored', goal: 50 },
    { id: 'explore-100', title: 'Сотня вопросов', description: 'Изучить 100 разных вопросов', metric: 'explored', goal: 100 },
    { id: 'master-10', title: 'Уверенные знания', description: 'Освоить 10 вопросов', metric: 'mastered', goal: 10 },
    { id: 'master-50', title: 'Крепкий фундамент', description: 'Освоить 50 вопросов', metric: 'mastered', goal: 50 },
    { id: 'sessions-1', title: 'Первое прохождение', description: 'Завершить 1 прохождение', metric: 'sessions', goal: 1 },
    { id: 'sessions-10', title: 'Постоянство', description: 'Завершить 10 прохождений', metric: 'sessions', goal: 10 },
    { id: 'verified-25', title: 'Проверено ключом', description: 'Дать 25 верных ответов по ключу после обновления', metric: 'verified', goal: 25 },
    { id: 'verified-100', title: 'Знаток', description: 'Дать 100 верных ответов по ключу после обновления', metric: 'verified', goal: 100 },
    { id: 'master-100', title: 'Железная память', description: 'Освоить 100 вопросов в любых базах', metric: 'mastered', goal: 100 },
    { id: 'verified-500', title: 'Настойчивость', description: 'Дать 500 верных ответов по ключу', metric: 'verified', goal: 500 },
    { id: 'verified-2000', title: 'Выдающаяся подготовка', description: 'Дать 2 000 верных ответов по ключу', metric: 'verified', goal: 2000 },
    { id: 'rating-500', title: 'Первые вершины', description: 'Набрать 500 общего рейтинга', metric: 'rating', goal: 500 },
    { id: 'rating-2000', title: 'Высокий результат', description: 'Набрать 2 000 общего рейтинга', metric: 'rating', goal: 2000 },
    { id: 'rating-10000', title: 'Эксперт курса', description: 'Набрать 10 000 общего рейтинга', metric: 'rating', goal: 10000 },
    { id: 'muscles-200', title: 'Качок', description: 'Освоить 200 вопросов по мышцам', metric: 'muscles', goal: 200, discipline: true },
    { id: 'bones-150', title: 'Знаток скелета', description: 'Освоить 150 вопросов по костям', metric: 'bones', goal: 150, discipline: true },
    { id: 'joints-100', title: 'Мастер соединений', description: 'Освоить 100 вопросов по соединениям костей', metric: 'joints', goal: 100, discipline: true },
    { id: 'organs-200', title: 'Знаток внутренних органов', description: 'Освоить 200 вопросов по спланхнологии', metric: 'organs', goal: 200, discipline: true },
    { id: 'nervous-200', title: 'Нейроанатом', description: 'Освоить 200 вопросов по нервной системе', metric: 'nervous', goal: 200, discipline: true },
    { id: 'absolute-collector', title: 'Полная коллекция', description: 'Купить все платные оформления', metric: 'stylesOwned', goal: 'all-appearances', absolute: true },
    { id: 'absolute-rating', title: 'Легенда курса', description: 'Набрать 50 000 общего рейтинга', metric: 'rating', goal: 50000, absolute: true },
    { id: 'absolute-mastery', title: 'Вся база покорена', description: 'Освоить каждый вопрос любой одной базы (включая самооценку)', metric: 'completeBank', goal: 1, absolute: true },
    { id: 'absolute-exam', title: 'Идеальный экзамен', description: 'Ответить верно на все 20 вопросов пробного экзамена без усилений', metric: 'perfectExam', goal: 1, absolute: true },
  ];

  function number(value) { return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0; }
  // Локальные записи остаются бухгалтерскими частями одного общего кошелька.
  // Прежние списания применяются до возврата усилений, каждый ровно один раз.
  function normalizeBank(state, id) {
    if (!state.game || typeof state.game !== 'object') state.game = {};
    const game = state.game;
    game.coins = Number.isFinite(game.coins) ? Math.trunc(game.coins) : 0;
    const spent = number(shared.cosmeticSpent[id]), applied = number(game.cosmeticSpentApplied);
    if (spent > applied) game.coins = Math.max(0, game.coins - (spent - applied));
    game.cosmeticSpentApplied = Math.max(applied, spent);
    if (game.inventory && typeof game.inventory === 'object') {
      for (const [product, price] of Object.entries(LEGACY_BOOST_PRICES)) {
        game.coins += number(game.inventory[product]) * price;
        delete game.inventory[product];
      }
    }
    const session = state.session, sg = session && session.game;
    if (sg && sg.bonusRemaining) {
      if (!session.finished && !sg.examScored && (session.mode === 'train' || session.mode === 'exam')) {
        game.coins += Math.floor(Math.min(number(sg.bonusRemaining), 20) * LEGACY_BOOST_PRICES['double-' + session.mode] / 20);
      }
      sg.bonusRemaining = 0;
    }
    if (session && !session.finished && session.results) {
      Object.values(session.results).forEach(entry => {
        if (entry && !entry.revealed && !entry.graded) delete entry.hiddenOptions;
      });
    }
    game.rating = number(game.rating);
    game.verified = number(game.verified);
    if (!game.achievements || typeof game.achievements !== 'object') game.achievements = {};
    return game;
  }
  function ensure() {
    readShared();
    return normalizeBank(AT.getState(), AT.colloquium.id);
  }
  function sessionGame(session) {
    if (!session.game || typeof session.game !== 'object') session.game = {};
    const g = session.game;
    for (const field of ['coinsEarned', 'ratingEarned', 'coinsPenalty', 'ratingPenalty', 'hintsUsed', 'bonusRemaining', 'germCoins', 'germsPopped']) g[field] = number(g[field]);
    for (const field of ['coinsChange', 'ratingChange']) g[field] = Number.isFinite(g[field]) ? Math.trunc(g[field]) : 0;
    // История ранее использованных усилений остаётся в результатах.
    if (g.bonusUsed && !g.bonusEffect) g.bonusEffect = 'currency';
    if (!Array.isArray(g.bonusEffects)) g.bonusEffects = g.bonusUsed ? [g.bonusEffect] : [];
    return g;
  }
  // Вопросы из разных банков учитываются раздельно, даже если формулировки совпадают.
  const DISCIPLINES = {
    '1': { bones: ['osteology', 'trunk-bones', 'upper-bones', 'lower-bones', 'skull-brain', 'skull-face', 'skull-topo'], joints: ['arthro-basic', 'arthro-trunk', 'arthro-upper', 'pelvis', 'arthro-lower'] },
    '2': { muscles: 'all' },
    '3': { organs: 'all' },
    '4': { nervous: 'all' },
    '5': { nervous: ['visual-pathways', 'hearing-pathways', 'cranial-nerves', 'trigeminal', 'facial', 'glossopharyngeal-vagus'] },
    '6': { nervous: 'all' },
    'credit-1': { bones: ['general', 'axial', 'limb-bones', 'skull-bones', 'skull'], joints: ['joints-trunk', 'joints-limbs'], muscles: ['trunk-muscles', 'head-neck', 'upper-muscles', 'lower-muscles'] },
    'credit-2': { organs: ['upper-digestive', 'digestive', 'peritoneum', 'airways', 'lungs', 'urinary', 'male', 'female'], nervous: ['spinal-cord', 'brainstem', 'cerebellum', 'diencephalon', 'cerebrum', 'pathways'] },
    'stom-2': { organs: 'all' },
    'stom-3': { nervous: ['spinal-cord', 'spinal-nerves', 'brain', 'cerebrum', 'pathways', 'autonomic'] },
  };
  const APPEARANCES = {
    default: { title: 'Классика', description: 'Стандартный цвет приложения.', price: 0, color: '#4f46e5' },
    ocean: { title: 'Океан', description: 'Прохладные сине-бирюзовые акценты.', price: 500, color: '#087d8c' },
    ruby: { title: 'Гранат', description: 'Тёплые рубиновые акценты.', price: 800, color: '#bc3658' },
    amber: { title: 'Янтарь', description: 'Золотистые акценты.', price: 1200, color: '#9a5a06' },
    autumn: { title: 'Осень', description: 'Тёплые краски, листья и жёлуди.', price: 1500, color: '#a64929' },
    winter: { title: 'Зима', description: 'Морозные оттенки и снежинки.', price: 1500, color: '#316f9e' },
    spring: { title: 'Весна', description: 'Цветы, лепестки и свежая зелень.', price: 1500, color: '#ae4264' },
    anime: { title: 'Аниме · Атака титанов', description: 'Атмосфера Attack on Titan: титаны, тёмный город и огонь.', price: 5000, color: '#745337', premium: true },
    rickmorty: { title: 'Рик и Морти', description: 'Портал в другие измерения и приключения Рика и Морти.', price: 5000, color: '#367741', premium: true },
    breakingbad: { title: 'Во все тяжкие', description: 'Уолтер и Джесси в жёлто-зелёных тонах сериала.', price: 5000, color: '#647232', premium: true },
  };
  const SHARED_KEY = 'anatomy-colloquium-rewards-shared-v1';
  let shared = { achievements: {}, appearances: {}, cosmeticSpent: {}, walletSpent: 0, appearance: 'default' };
  function readShared() {
    try {
      const value = JSON.parse(localStorage.getItem(SHARED_KEY) || '{}');
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (value.achievements && typeof value.achievements === 'object') Object.assign(shared.achievements, value.achievements);
        if (value.appearances && typeof value.appearances === 'object') Object.assign(shared.appearances, value.appearances);
        if (value.cosmeticSpent && typeof value.cosmeticSpent === 'object') Object.assign(shared.cosmeticSpent, value.cosmeticSpent);
        shared.walletSpent = number(value.walletSpent);
        if (typeof value.appearance === 'string') shared.appearance = value.appearance;
      }
    } catch (e) { /* При недоступном хранилище работаем с данными в памяти. */ }
    if (!Object.prototype.hasOwnProperty.call(APPEARANCES, shared.appearance) || (shared.appearance !== 'default' && !shared.appearances[shared.appearance])) shared.appearance = 'default';
    return shared;
  }
  function saveShared() {
    try {
      // Не теряем покупки и достижения, добавленные другой открытой вкладкой.
      const latest = JSON.parse(localStorage.getItem(SHARED_KEY) || '{}') || {};
      for (const field of ['achievements', 'appearances']) {
        if (latest[field] && typeof latest[field] === 'object') {
          Object.keys(latest[field]).forEach(key => { if (latest[field][key] && !shared[field][key]) shared[field][key] = latest[field][key]; });
        }
      }
      if (latest.cosmeticSpent && typeof latest.cosmeticSpent === 'object') {
        BANKS.forEach(id => { shared.cosmeticSpent[id] = Math.max(number(shared.cosmeticSpent[id]), number(latest.cosmeticSpent[id])); });
      }
      shared.walletSpent = Math.max(number(shared.walletSpent), number(latest.walletSpent));
      localStorage.setItem(SHARED_KEY, JSON.stringify(shared)); return true;
    } catch (e) { return false; }
  }
  function bankState(id) {
    if (id === AT.colloquium.id) return AT.getState();
    try {
      const key = id === '1' ? 'anatomy-colloquium-v1' : 'anatomy-colloquium-v1-' + id;
      return JSON.parse(localStorage.getItem(key) || '{}') || {};
    } catch (e) { return {}; }
  }
  function snapshots() { return BANKS.map(id => ({ id, state: bankState(id) })); }
  function metrics(states) {
    const counts = { explored: 0, mastered: 0, sessions: 0, verified: 0, rating: 0, perfectExam: 0, completeBank: 0, muscles: 0, bones: 0, joints: 0, organs: 0, nervous: 0 };
    const modules = window.COLLOQUIUM_MODULES || { [AT.colloquium.id]: { questions: AT.dataset.questions } };
    states.forEach(({ id, state }) => {
      const game = state.game || {}, questions = modules[id] && modules[id].questions || [];
      const progress = state.progress || {};
      const categories = DISCIPLINES[id] || {};
      let bankMastered = 0;
      questions.forEach(q => {
        const p = progress[q.id];
        if (!p) return;
        if (p.attempts > 0) counts.explored++;
        if (!(p.streak >= 2)) return;
        counts.mastered++; bankMastered++;
        Object.entries(categories).forEach(([metric, topics]) => {
          if (topics === 'all' || topics.includes(q.topic)) counts[metric]++;
        });
      });
      if (questions.length && bankMastered === questions.length) counts.completeBank = 1;
      const sessions = Array.isArray(state.sessions) ? state.sessions : [];
      counts.sessions += sessions.length;
      if (sessions.some(s => s && s.mode === 'exam' && s.total === 20 && s.correct === 20 && s.assisted === false)) counts.perfectExam = 1;
      counts.verified += number(game.verified);
      counts.rating += number(game.rating);
    });
    counts.stylesOwned = Object.keys(APPEARANCES).filter(id => APPEARANCES[id].price > 0 && !!shared.appearances[id]).length;
    return counts;
  }
  function achievementGoal(a) { return a.goal === 'all-appearances' ? Object.keys(APPEARANCES).filter(id => APPEARANCES[id].price > 0).length : a.goal; }
  function syncAchievements() {
    readShared();
    let changed = false;
    const states = snapshots();
    // Переносим ранее открытые достижения из всех сохранений без повторной выдачи.
    states.forEach(({ state }) => {
      const old = (state.game || {}).achievements || {};
      Object.keys(old).forEach(key => {
        if (old[key] && !shared.achievements[key]) { shared.achievements[key] = old[key]; changed = true; }
      });
      // Квитанция вместе со списанием позволяет восстановить покупку после прерывания.
      const receipts = (state.game || {}).appearanceReceipts || {};
      Object.keys(APPEARANCES).forEach(key => {
        if (key !== 'default' && receipts[key] === true && !shared.appearances[key]) {
          shared.appearances[key] = true; changed = true;
        }
      });
    });
    const counts = metrics(states);
    ACHIEVEMENTS.forEach(a => {
      if (!shared.achievements[a.id] && counts[a.metric] >= achievementGoal(a)) {
        shared.achievements[a.id] = Date.now(); changed = true;
      }
    });
    if (changed) saveShared();
    return counts;
  }
  function achievements() {
    const counts = syncAchievements();
    return ACHIEVEMENTS.map(a => {
      const goal = achievementGoal(a);
      return { ...a, goal, current: shared.achievements[a.id] ? goal : Math.min(counts[a.metric], goal), unlocked: !!shared.achievements[a.id] };
    });
  }
  function totalRating() { return BANKS.reduce((total, id) => total + number((bankState(id).game || {}).rating), 0); }
  function profile() { readShared(); return JSON.parse(JSON.stringify(shared)); }
  function applyAppearance() {
    readShared();
    if (typeof document !== 'undefined') document.documentElement.setAttribute('data-accent', shared.appearance);
  }
  function selectAppearance(id) {
    readShared();
    if (!Object.prototype.hasOwnProperty.call(APPEARANCES, id) || (id !== 'default' && !shared.appearances[id])) return { ok: false, message: 'Сначала купите оформление' };
    const previous = shared.appearance;
    shared.appearance = id;
    if (!saveShared()) { shared.appearance = previous; return { ok: false, message: 'Не удалось сохранить оформление' }; }
    applyAppearance();
    return { ok: true, message: 'Оформление изменено' };
  }
  // Из файла экспорта переносим только известные оформления, не затрагивая кошельки.
  function inspectAppearanceImport(file) {
    const owned = file && typeof file === 'object' && !Array.isArray(file) && file.sharedRewards && file.sharedRewards.appearances;
    if (!owned || typeof owned !== 'object' || Array.isArray(owned)) return { ok: false, message: 'В файле нет списка оформлений' };
    const ids = Object.keys(owned).filter(id => owned[id] === true && id !== 'default' && id !== 'meme'); // Старые файлы могут содержать временно скрытое оформление.
    if (!ids.length || ids.some(id => !Object.prototype.hasOwnProperty.call(APPEARANCES, id))) return { ok: false, message: 'Файл не содержит известных оформлений или создан для другой версии приложения' };
    if (Object.keys(owned).some(id => typeof owned[id] !== 'boolean')) return { ok: false, message: 'Неверный список оформлений' };
    return { ok: true, ids, titles: ids.map(id => APPEARANCES[id].title) };
  }
  function importAppearances(file) {
    const checked = inspectAppearanceImport(file);
    if (!checked.ok) return checked;
    readShared();
    const previous = JSON.parse(JSON.stringify(shared));
    checked.ids.forEach(id => { shared.appearances[id] = true; });
    if (!saveShared()) { shared = previous; return { ok: false, message: 'Не удалось сохранить оформления' }; }
    syncAchievements();
    return { ok: true, message: 'Оформления добавлены. Выберите их в разделе «Награды».' };
  }
  function walletBalance() {
    readShared();
    return Math.max(0, BANKS.reduce((sum, id) => sum + normalizeBank(bankState(id), id).coins, 0) - number(shared.walletSpent));
  }
  function buyAppearance(id) {
    readShared();
    if (!Object.prototype.hasOwnProperty.call(APPEARANCES, id) || id === 'default') return { ok: false, message: 'Неизвестное оформление' };
    if (shared.appearances[id]) return { ok: false, message: 'Оформление уже куплено' };
    if (walletBalance() < APPEARANCES[id].price) return { ok: false, message: 'Недостаточно валюты в общем кошельке' };
    // Сохраняем все начисления текущей базы до атомарной записи покупки.
    if (!AT.save(true)) return { ok: false, message: 'Не удалось сохранить покупку' };
    const previous = JSON.parse(JSON.stringify(shared));
    shared.walletSpent = number(shared.walletSpent) + APPEARANCES[id].price;
    shared.appearances[id] = true;
    shared.appearance = id;
    if (!saveShared()) { shared = previous; return { ok: false, message: 'Не удалось сохранить покупку' }; }
    syncAchievements();
    applyAppearance();
    return { ok: true, message: 'Оформление куплено и применено во всех базах' };
  }
  // Однократная награда за конкретного микроба в вопросе этой сессии.
  function awardMicrobe(session, q, index) {
    if (!session || AT.currentSession() !== session || session.mode !== 'train' || session.finished ||
        !q || AT.dataset.byId.get(q.id) !== q || session.ids[session.index] !== q.id ||
        !session.results[q.id] || session.results[q.id].revealed || !session.germSeen || !session.germSeen[q.id] ||
        !Number.isInteger(index) || index < 0 || index > 2) return {ok: false, message: 'Награда сейчас недоступна'};
    const game = ensure(), g = sessionGame(session);
    if (!g.germAwards || typeof g.germAwards !== 'object' || Array.isArray(g.germAwards)) g.germAwards = {};
    const hadReceipt = Object.prototype.hasOwnProperty.call(g.germAwards, q.id);
    const oldReceipt = g.germAwards[q.id];
    const mask = number(oldReceipt), bit = 1 << index;
    if (mask & bit) return {ok: false, message: 'Этот микроб уже учтён'};
    const before = {coins: game.coins, earned: g.coinsEarned, change: g.coinsChange, germCoins: g.germCoins, popped: g.germsPopped};
    g.germAwards[q.id] = mask | bit;
    game.coins += 50;
    g.coinsEarned += 50; g.coinsChange += 50; g.germCoins += 50; g.germsPopped++;
    if (!AT.save(true)) {
      game.coins = before.coins; g.coinsEarned = before.earned; g.coinsChange = before.change;
      g.germCoins = before.germCoins; g.germsPopped = before.popped;
      if (hadReceipt) g.germAwards[q.id] = oldReceipt; else delete g.germAwards[q.id];
      return {ok: false, message: 'Не удалось сохранить награду — попробуйте ещё раз'};
    }
    return {ok: true, coins: 50};
  }

  function awardTraining(session, q, entry, previouslyMastered) {
    if (!session || session.mode !== 'train' || session.finished || !q || !entry || entry.gameRewarded || entry.correct !== true || entry.self || !AT.keyApi.has(q)) return;
    const game = ensure(), g = sessionGame(session);
    const coins = previouslyMastered ? 2 : 10;
    const rating = previouslyMastered ? 1 : 5;
    game.coins += coins; game.rating += rating; game.verified++;
    g.coinsEarned += coins; g.ratingEarned += rating;
    g.coinsChange += coins; g.ratingChange += rating;
    entry.gameRewarded = true;
    syncAchievements();
    AT.save(true);
  }
  function awardExam(session, qs) {
    if (!session || session.mode !== 'exam') return;
    const game = ensure(), g = sessionGame(session);
    if (g.examScored) return;
    let earned = 0, rating = 0, wrong = 0;
    qs.forEach(q => {
      const entry = session.results[q.id];
      if (!entry || !entry.graded || entry.self) return;
      if (entry.correct === true) {
        const coins = entry.gamePreviouslyMastered ? 5 : 25;
        const points = entry.gamePreviouslyMastered ? 3 : 15;
        rating += points;
        earned += coins; game.verified++;
      } else if (entry.correct === false) wrong++;
    });
    const coinPenalty = wrong * 5, ratingPenalty = wrong * 3;
    const balance = walletBalance(), beforeRating = game.rating;
    const actualPenalty = Math.min(coinPenalty, balance + earned);
    game.coins += earned - actualPenalty;
    game.rating = Math.max(0, beforeRating + rating - ratingPenalty);
    g.coinsEarned = earned; g.ratingEarned = rating;
    g.coinsPenalty = coinPenalty; g.ratingPenalty = ratingPenalty;
    // Изменение может быть отрицательным; баланс никогда не уходит ниже нуля.
    g.coinsChange = earned - actualPenalty; g.ratingChange = game.rating - beforeRating;
    g.examScored = true;
    syncAchievements();
  }
  AT.game = { ensure, sessionGame, achievements, syncAchievements, totalRating, appearances: APPEARANCES, profile, applyAppearance, selectAppearance, inspectAppearanceImport, importAppearances, walletBalance, buyAppearance, awardMicrobe, awardTraining, awardExam };
  // Старый прогресс признаём только достижениями. Очки задним числом не начисляем.
  syncAchievements();
  AT.save(true);
})();
