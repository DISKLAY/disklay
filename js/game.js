/* Локальная игровая система: кошелёк и достижения в состоянии текущей базы. */
(function () {
  'use strict';
  const AT = window.AT;
  const BANKS = window.COLLOQUIUM_IDS || [AT.colloquium.id];
  const PRODUCTS = {
    'hint-train': { title: 'Убрать неверный вариант', mode: 'train', kind: 'hint', price: 30, description: 'Убирает один неверный вариант в тренировке.' },
    'hint-exam': { title: 'Подсказка на экзамене', mode: 'exam', kind: 'hint', price: 80, description: 'Убирает один неверный вариант в пробном экзамене.' },
    'double-train': { title: 'Двойная награда', mode: 'train', kind: 'double', price: 60, description: 'Удваивает валюту за следующие 5 верных ответов в этой тренировке.' },
    'double-exam': { title: 'Двойная награда на экзамене', mode: 'exam', kind: 'double', price: 150, description: 'Удваивает валюту за первые 5 верных ответов при проверке экзамена.' },
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
    };
  }
  function syncAchievements() {
    const game = ensure();
    const counts = metrics();
    ACHIEVEMENTS.forEach(a => {
      if (!game.achievements[a.id] && counts[a.metric] >= a.goal) game.achievements[a.id] = Date.now();
    });
  }
  function achievements() {
    syncAchievements();
    const counts = metrics();
    return ACHIEVEMENTS.map(a => ({ ...a, current: ensure().achievements[a.id] ? a.goal : Math.min(counts[a.metric], a.goal), unlocked: !!ensure().achievements[a.id] }));
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
    g.bonusRemaining = 5;
    g.bonusUsed = true;
    AT.save(true);
    return { ok: true, message: 'Двойная валюта за 5 верных ответов' };
  }
  function awardTraining(session, q, entry, previouslyMastered) {
    if (!session || session.mode !== 'train' || session.finished || !q || !entry || entry.gameRewarded || entry.correct !== true || entry.self || !AT.keyApi.has(q)) return;
    const game = ensure(), g = sessionGame(session);
    let coins = previouslyMastered ? 2 : 10;
    const rating = previouslyMastered ? 1 : 5;
    if (g.bonusRemaining) { coins *= 2; g.bonusRemaining--; }
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
        rating += entry.gamePreviouslyMastered ? 3 : 15;
        if (g.bonusRemaining) { coins *= 2; g.bonusRemaining--; }
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
