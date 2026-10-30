/* Локальная игровая система: кошелёк и достижения в состоянии текущей базы. */
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
    { id: 'master-100', title: 'Железная память', description: 'Освоить 100 вопросов этой базы', metric: 'mastered', goal: 100 },
    { id: 'verified-500', title: 'Настойчивость', description: 'Дать 500 верных ответов по ключу', metric: 'verified', goal: 500 },
    { id: 'verified-2000', title: 'Выдающаяся подготовка', description: 'Дать 2 000 верных ответов по ключу', metric: 'verified', goal: 2000 },
    { id: 'rating-500', title: 'Первые вершины', description: 'Набрать 500 общего рейтинга', metric: 'rating', goal: 500 },
    { id: 'rating-2000', title: 'Высокий результат', description: 'Набрать 2 000 общего рейтинга', metric: 'rating', goal: 2000 },
    { id: 'rating-10000', title: 'Эксперт курса', description: 'Набрать 10 000 общего рейтинга', metric: 'rating', goal: 10000 },
    { id: 'absolute-rating', title: 'Легенда курса', description: 'Набрать 50 000 общего рейтинга', metric: 'rating', goal: 50000, absolute: true },
    { id: 'absolute-mastery', title: 'Вся база покорена', description: 'Освоить каждый вопрос выбранной базы (включая самооценку)', metric: 'mastered', goal: 'all', absolute: true },
    { id: 'absolute-exam', title: 'Идеальный экзамен', description: 'Ответить верно на все 20 вопросов пробного экзамена без усилений', metric: 'perfectExam', goal: 1, absolute: true, examOnly: true },
  ];

  function number(value) { return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0; }
  function ensure() {
    const state = AT.getState();
    if (!state.game || typeof state.game !== 'object') state.game = {};
    const game = state.game;
    game.coins = number(game.coins);
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
  function metrics() {
    const state = AT.getState();
    const progress = Object.values(state.progress || {});
    return {
      explored: progress.filter(p => p && p.attempts > 0).length,
      mastered: progress.filter(p => p && p.streak >= 2).length,
      sessions: (state.sessions || []).length,
      verified: ensure().verified,
      rating: totalRating(),
      perfectExam: (state.sessions || []).some(s => s.mode === 'exam' && s.total === 20 && s.correct === 20 && s.assisted === false) ? 1 : 0,
    };
  }
  function definitions() {
    return ACHIEVEMENTS.filter(a => !a.examOnly || AT.colloquium.examAvailable).map(a => ({ ...a, goal: a.goal === 'all' ? AT.dataset.total : a.goal }));
  }
  function syncAchievements() {
    const game = ensure();
    const counts = metrics();
    definitions().forEach(a => {
      if (!game.achievements[a.id] && counts[a.metric] >= a.goal) game.achievements[a.id] = Date.now();
    });
  }
  function achievements() {
    syncAchievements();
    const counts = metrics();
    return definitions().map(a => ({ ...a, current: ensure().achievements[a.id] ? a.goal : Math.min(counts[a.metric], a.goal), unlocked: !!ensure().achievements[a.id] }));
  }
  function totalRating() {
    return BANKS.reduce((total, id) => {
      if (id === AT.colloquium.id) return total + ensure().rating;
      try {
        const key = id === '1' ? 'anatomy-colloquium-v1' : 'anatomy-colloquium-v1-' + id;
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        return total + number(data.game && data.game.rating);
      } catch (e) { return total; }
    }, 0);
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
  AT.game = { ensure, sessionGame, achievements, syncAchievements, totalRating, products: PRODUCTS, count, buy, useHint, activateDouble, awardTraining, awardExam };
  // Старый прогресс признаём только достижениями. Очки задним числом не начисляем.
  syncAchievements();
  AT.save(true);
})();
