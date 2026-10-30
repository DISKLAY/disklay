/* Кошелёк хранится отдельно по базам; достижения и оформления общие на устройстве. */
(function () {
  'use strict';
  const AT = window.AT;
  const BANKS = window.COLLOQUIUM_IDS || [AT.colloquium.id];
  const PRODUCTS = {
    'hint-train': { title: 'Убрать неверный вариант', mode: 'train', kind: 'hint', price: 160, description: 'Убирает один неверный вариант в тренировке.' },
    'hint-exam': { title: 'Подсказка на экзамене', mode: 'exam', kind: 'hint', price: 480, description: 'Убирает один неверный вариант в пробном экзамене.' },
    'double-train': { title: 'Двойной рейтинг', mode: 'train', kind: 'double', price: 320, description: 'Удваивает рейтинг за следующие 20 верных ответов в этой тренировке.' },
    'double-exam': { title: 'Двойной рейтинг на экзамене', mode: 'exam', kind: 'double', price: 800, description: 'Удваивает рейтинг за первые 20 верных ответов при проверке экзамена.' },
  };
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
    { id: 'absolute-rating', title: 'Легенда курса', description: 'Набрать 50 000 общего рейтинга', metric: 'rating', goal: 50000, absolute: true },
    { id: 'absolute-mastery', title: 'Вся база покорена', description: 'Освоить каждый вопрос любой одной базы (включая самооценку)', metric: 'completeBank', goal: 1, absolute: true },
    { id: 'absolute-exam', title: 'Идеальный экзамен', description: 'Ответить верно на все 20 вопросов пробного экзамена без усилений', metric: 'perfectExam', goal: 1, absolute: true },
  ];

  function number(value) { return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0; }
  function ensure() {
    const state = AT.getState();
    if (!state.game || typeof state.game !== 'object') state.game = {};
    const game = state.game;
    game.coins = number(game.coins);
    // Общий журнал списаний применяется ровно один раз к каждому кошельку.
    readShared();
    const spent = number(shared.cosmeticSpent[AT.colloquium.id]);
    const applied = number(game.cosmeticSpentApplied);
    if (spent > applied) game.coins = Math.max(0, game.coins - (spent - applied));
    game.cosmeticSpentApplied = Math.max(applied, spent);
    game.rating = number(game.rating);
    game.verified = number(game.verified);
    if (!game.inventory || typeof game.inventory !== 'object') game.inventory = {};
    if (!game.achievements || typeof game.achievements !== 'object') game.achievements = {};
    return game;
  }
  function sessionGame(session) {
    if (!session.game || typeof session.game !== 'object') session.game = {};
    const g = session.game;
    for (const field of ['coinsEarned', 'ratingEarned', 'coinsPenalty', 'ratingPenalty', 'hintsUsed', 'bonusRemaining']) g[field] = number(g[field]);
    for (const field of ['coinsChange', 'ratingChange']) g[field] = Number.isFinite(g[field]) ? Math.trunc(g[field]) : 0;
    // Старое уже активированное усиление остаётся валютным до конца действия.
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
  };
  const SHARED_KEY = 'anatomy-colloquium-rewards-shared-v1';
  let shared = { achievements: {}, appearances: {}, cosmeticSpent: {}, appearance: 'default' };
  function readShared() {
    try {
      const value = JSON.parse(localStorage.getItem(SHARED_KEY) || '{}');
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (value.achievements && typeof value.achievements === 'object') Object.assign(shared.achievements, value.achievements);
        if (value.appearances && typeof value.appearances === 'object') Object.assign(shared.appearances, value.appearances);
        if (value.cosmeticSpent && typeof value.cosmeticSpent === 'object') Object.assign(shared.cosmeticSpent, value.cosmeticSpent);
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
    return counts;
  }
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
      if (!shared.achievements[a.id] && counts[a.metric] >= a.goal) {
        shared.achievements[a.id] = Date.now(); changed = true;
      }
    });
    if (changed) saveShared();
    return counts;
  }
  function achievements() {
    const counts = syncAchievements();
    return ACHIEVEMENTS.map(a => ({ ...a, current: shared.achievements[a.id] ? a.goal : Math.min(counts[a.metric], a.goal), unlocked: !!shared.achievements[a.id] }));
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
  function walletBalances() {
    readShared();
    const modules = window.COLLOQUIUM_MODULES || {};
    // Сначала текущая база, затем остальные в привычном порядке.
    return [AT.colloquium.id, ...BANKS.filter(id => id !== AT.colloquium.id)].map(id => {
      const module = modules[id] || {}, state = bankState(id), game = state.game || {};
      const spent = number(shared.cosmeticSpent[id]);
      const pending = Math.max(0, spent - number(game.cosmeticSpentApplied));
      const label = module.kind === 'credit' ? 'Зачёт · ' + module.semester + ' семестр'
        : 'Коллоквиум ' + (module.number || id);
      return { id, label: label + (module.name ? ' · ' + module.name : '') + (module.faculty ? ' · стоматология' : ''),
        balance: Math.max(0, number(game.coins) - pending), current: id === AT.colloquium.id };
    });
  }
  function buyAppearance(id, allocation) {
    readShared();
    if (!Object.prototype.hasOwnProperty.call(APPEARANCES, id) || id === 'default') return { ok: false, message: 'Неизвестное оформление' };
    if (shared.appearances[id]) return { ok: false, message: 'Оформление уже куплено' };
    if (!allocation || typeof allocation !== 'object' || Array.isArray(allocation)) return { ok: false, message: 'Выберите суммы для оплаты' };
    const wallets = walletBalances();
    const allowed = new Set(wallets.map(w => w.id));
    let total = 0;
    for (const [bankId, amount] of Object.entries(allocation)) {
      const wallet = wallets.find(w => w.id === bankId);
      if (!allowed.has(bankId) || !Number.isSafeInteger(amount) || amount < 0 || amount > wallet.balance) {
        return { ok: false, message: 'Суммы изменились или превышают баланс базы. Проверьте распределение.' };
      }
      total += amount;
    }
    if (!Number.isSafeInteger(total) || total !== APPEARANCES[id].price) return { ok: false, message: 'Распределите точную стоимость оформления' };
    // До общей записи сохраняем текущий кошелёк. Никакое списание пока не произведено.
    ensure();
    if (!AT.save(true)) return { ok: false, message: 'Не удалось сохранить покупку' };
    const previous = JSON.parse(JSON.stringify(shared));
    Object.entries(allocation).forEach(([bankId, amount]) => {
      if (amount) shared.cosmeticSpent[bankId] = number(shared.cosmeticSpent[bankId]) + amount;
    });
    shared.appearances[id] = true;
    shared.appearance = id;
    // Приобретение и все списания фиксируются одной записью, до изменения кошельков.
    if (!saveShared()) { shared = previous; return { ok: false, message: 'Не удалось сохранить покупку' }; }
    ensure();
    // Если сохранение кошелька прервано, журнал применится при следующем открытии базы.
    AT.save(true);
    applyAppearance();
    return { ok: true, message: 'Оформление куплено и применено во всех базах' };
  }
  function count(id) { return number(ensure().inventory[id]); }
  function buy(id) {
    const product = PRODUCTS[id], game = ensure();
    if (!product) return { ok: false, message: 'Неизвестное усиление' };
    if (product.mode === 'exam' && !AT.colloquium.examAvailable) return { ok: false, message: 'Пробный экзамен для этой базы пока недоступен' };
    if (count(id) >= 99) return { ok: false, message: 'Достигнут предел запаса' };
    if (game.coins < product.price) return { ok: false, message: 'Недостаточно валюты в этой базе' };
    game.coins -= product.price;
    game.inventory[id] = count(id) + 1;
    AT.save(true);
    return { ok: true, message: 'Усиление добавлено в запас' };
  }
  function useHint(session, q, entry) {
    if (!session || session.finished || !q || !entry || session.ids[session.index] !== q.id || (session.mode !== 'exam' && entry.revealed)) return { ok: false, message: 'Подсказка сейчас недоступна' };
    const product = 'hint-' + session.mode, answer = AT.keyApi.forQuestion(q);
    if (!answer) return { ok: false, message: 'Для этого вопроса нет ключа' };
    if (entry.hiddenOptions && entry.hiddenOptions.length) return { ok: false, message: 'Подсказка уже использована в этом вопросе' };
    if (!count(product)) return { ok: false, message: 'Нет подсказок: их можно купить в магазине' };
    const candidates = q.options.map((_, i) => i + 1).filter(i => !answer.answers.includes(i) && !entry.selected.includes(i));
    if (!candidates.length) return { ok: false, message: 'Нет доступного неверного варианта для удаления' };
    const removed = candidates[Math.floor(Math.random() * candidates.length)];
    entry.hiddenOptions = [removed];
    ensure().inventory[product] = count(product) - 1;
    sessionGame(session).hintsUsed += 1;
    AT.save(true);
    return { ok: true, message: 'Один неверный вариант убран' };
  }
  function activateDouble(session) {
    if (!session || session.finished || !['train', 'exam'].includes(session.mode)) return { ok: false, message: 'Сейчас усиление недоступно' };
    const g = sessionGame(session), product = 'double-' + session.mode;
    if (g.bonusRemaining) return { ok: false, message: 'Бонус уже действует' };
    if (!count(product)) return { ok: false, message: 'Нет бонусов: их можно купить в магазине' };
    ensure().inventory[product] = count(product) - 1;
    g.bonusRemaining = 20;
    g.bonusUsed = true;
    g.bonusEffect = 'rating';
    if (!g.bonusEffects.includes('rating')) g.bonusEffects.push('rating');
    AT.save(true);
    return { ok: true, message: 'Двойной рейтинг за 20 верных ответов' };
  }
  function awardTraining(session, q, entry, previouslyMastered) {
    if (!session || session.mode !== 'train' || session.finished || !q || !entry || entry.gameRewarded || entry.correct !== true || entry.self || !AT.keyApi.has(q)) return;
    const game = ensure(), g = sessionGame(session);
    let coins = previouslyMastered ? 2 : 10;
    let rating = previouslyMastered ? 1 : 5;
    if (g.bonusRemaining) {
      if (g.bonusEffect === 'currency') coins *= 2;
      else rating *= 2;
      g.bonusRemaining--;
    }
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
        let coins = entry.gamePreviouslyMastered ? 5 : 25;
        let points = entry.gamePreviouslyMastered ? 3 : 15;
        if (g.bonusRemaining) {
          if (g.bonusEffect === 'currency') coins *= 2;
          else points *= 2;
          g.bonusRemaining--;
        }
        rating += points;
        earned += coins; game.verified++;
      } else if (entry.correct === false) wrong++;
    });
    const coinPenalty = wrong * 5, ratingPenalty = wrong * 3;
    const beforeCoins = game.coins, beforeRating = game.rating;
    game.coins = Math.max(0, beforeCoins + earned - coinPenalty);
    game.rating = Math.max(0, beforeRating + rating - ratingPenalty);
    g.coinsEarned = earned; g.ratingEarned = rating;
    g.coinsPenalty = coinPenalty; g.ratingPenalty = ratingPenalty;
    // Изменение может быть отрицательным; баланс никогда не уходит ниже нуля.
    g.coinsChange = game.coins - beforeCoins; g.ratingChange = game.rating - beforeRating;
    g.examScored = true;
    syncAchievements();
  }
  AT.game = { ensure, sessionGame, achievements, syncAchievements, totalRating, products: PRODUCTS, appearances: APPEARANCES, profile, applyAppearance, selectAppearance, walletBalances, buyAppearance, count, buy, useHint, activateDouble, awardTraining, awardExam };
  // Старый прогресс признаём только достижениями. Очки задним числом не начисляем.
  syncAchievements();
  AT.save(true);
})();
