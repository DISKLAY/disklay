/* ============================================================================
   views-study.js — главная, настройка, прохождение, итоги
   ========================================================================== */
(function () {
  'use strict';

  const AT = window.AT;
  const { utils, dataset, keyApi, analytics } = AT;
  const { icon, progressBar, ring, emptyState, toast, confirmDialog } = AT.ui;
  const esc = utils.esc;
  const views = (AT.views = AT.views || {});

  /* -------------------------------------------------------- setup-состояние */

  const setup = (AT.setup = AT.setup || {
    train: { topics: ['all'], scope: 'smart', limit: 20 },
    exam: { topics: ['all'], limit: 30, timer: true, minutes: 30 },
  });

  function topicTitle(id) {
    return id === 'all' ? 'Все темы' : dataset.topic(id).title;
  }

  function sessionLabel(topicIds) {
    if (!topicIds || !topicIds.length || topicIds.indexOf('all') !== -1) return 'Все темы';
    if (topicIds.length === 1) return topicTitle(topicIds[0]);
    return topicTitle(topicIds[0]) + ' +' + (topicIds.length - 1);
  }

  function topicChips(selected, action) {
    const isAll = selected.indexOf('all') !== -1;
    let html = '<div class="chips">';
    html += '<button type="button" class="chip' + (isAll ? ' is-active' : '') + '" data-action="' + action + '" data-topic="all">Все темы</button>';
    dataset.topics.forEach((t) => {
      const active = !isAll && selected.indexOf(t.id) !== -1;
      html += '<button type="button" class="chip' + (active ? ' is-active' : '') + '" data-action="' + action +
        '" data-topic="' + t.id + '">' + esc(t.title) + '</button>';
    });
    html += '</div>';
    return html;
  }

  function toggleTopic(list, id) {
    if (id === 'all') return ['all'];
    let out = list.filter((x) => x !== 'all');
    if (out.indexOf(id) === -1) out.push(id);
    else out = out.filter((x) => x !== id);
    if (!out.length) out = ['all'];
    return out;
  }

  function scopeCards(selected) {
    const items = [
      { id: 'smart', title: 'Умная очередь', text: 'Сначала ошибки и новые вопросы', icon: 'sparkles' },
      { id: 'learning', title: 'Не освоено', text: 'Всё, что ещё не закреплено', icon: 'target' },
      { id: 'wrong', title: 'Только ошибки', text: 'Вопросы с неверными ответами', icon: 'mistakes' },
      { id: 'unseen', title: 'Новые', text: 'Те, что вы ещё не открывали', icon: 'book' },
      { id: 'all', title: 'Все подряд', text: 'Перемешать весь выбранный банк', icon: 'refresh' },
    ];
    return '<div class="choice-grid">' + items.map((it) =>
      '<button type="button" class="choice' + (selected === it.id ? ' is-active' : '') +
      '" data-action="set-scope" data-scope="' + it.id + '">' +
      '<span class="choice__icon">' + icon(it.icon) + '</span>' +
      '<span class="choice__title">' + esc(it.title) + '</span>' +
      '<span class="choice__text">' + esc(it.text) + '</span></button>'
    ).join('') + '</div>';
  }

  function limitPicker(selected, values) {
    return '<div class="chips chips--sm">' + values.map((v) =>
      '<button type="button" class="chip' + (selected === v ? ' is-active' : '') +
      '" data-action="set-limit" data-limit="' + v + '">' + (v === 0 ? 'Все' : v) + '</button>'
    ).join('') + '</div>';
  }

  function availableCount(topicIds, scope) {
    return AT.pickQuestions({ topicIds, scope, limit: 0 }).length;
  }

  /* ---------------------------------------------------------------- главная */

  views.dashboard = function () {
    const overall = analytics.overall();
    const keyed = keyApi.count();
    const total = dataset.total;
    const mastery = utils.pct(overall.mastered, total);
    const mistakes = analytics.mistakes().length;
    const topics = analytics.byTopic();
    const lastSessions = AT.getState().sessions.slice(0, 3);

    let html = '<div class="view view--dashboard">';

    html +=
      '<section class="hero">' +
      '<div class="hero__body">' +
      '<span class="eyebrow"><span class="eyebrow__dot"></span>Анатомия человека · модуль 1</span>' +
      '<h1>Тренажёр к коллоквиуму</h1>' +
      '<p class="hero__lead">' + total + ' экзаменационных заданий по костям, соединениям и черепу. ' +
      'Учите по темам, разбирайте ошибки и проверяйте себя на время.</p>' +
      '<div class="hero__actions">' +
      '<a href="#/train" class="btn btn--primary btn--lg">' + icon('play') + 'Тренироваться</a>' +
      '<a href="#/exam" class="btn btn--ghost btn--lg">' + icon('exam') + 'Пробный экзамен</a>' +
      '</div>' +
      '</div>' +
      '<div class="hero__aside">' +
      ring(mastery, 148, mastery + '%', 'освоено') +
      '<p class="hero__ring-note">' + overall.mastered + ' из ' + total + ' вопросов закреплено</p>' +
      '</div>' +
      '</section>';

    const active = AT.currentSession();
    if (active) {
      const aq = AT.sessionQuestions(active);
      const answered = aq.filter((item) => {
        const r = active.results[item.id];
        return r && r.selected && r.selected.length;
      }).length;
      html += '<a class="banner banner--resume" href="#/run">' +
        '<span class="banner__icon">' + icon(active.mode === 'exam' ? 'exam' : 'play') + '</span>' +
        '<span class="banner__body"><strong>Незаконченная ' + (active.mode === 'exam' ? 'экзамен' : 'тренировка') + '</strong>' +
        '<span>Отвечено ' + answered + ' из ' + aq.length + ' · ' + esc(active.label || sessionLabel(active.topicIds)) + '</span></span>' +
        '<span class="banner__cta">Продолжить' + icon('chevronRight') + '</span></a>';
    }

    if (keyed < total) {
      const p = utils.pct(keyed, total);
      html +=
        '<a class="banner banner--warn" href="#/key">' +
        '<span class="banner__icon">' + icon('key') + '</span>' +
        '<span class="banner__body"><strong>Ключ ответов заполнен на ' + p + '%</strong>' +
        '<span>' + (keyed ? 'Пока проверяются ' + keyed + ' вопросов из ' + total + '. ' : 'Пока приложение работает в режиме самопроверки. ') +
        'Вставите ключ — проверка станет автоматической.</span></span>' +
        '<span class="banner__cta">Импортировать' + icon('chevronRight') + '</span>' +
        '</a>';
    }

    html +=
      '<div class="stat-grid">' +
      statCard('Изучено', overall.started, 'из ' + total, 'book') +
      statCard('Точность', overall.accuracy + '%', overall.attempts ? 'по ' + overall.attempts + ' ответам' : 'нет ответов', 'target') +
      statCard('Ошибки в работе', mistakes, mistakes === 1 ? 'вопрос' : 'вопросов', 'mistakes') +
      statCard('Тренировок', AT.getState().sessions.length, AT.getState().sessions.length ? 'в истории' : 'пока нет', 'stats') +
      '</div>';

    html +=
      '<section class="section">' +
      '<div class="section__head"><h2>Режимы</h2></div>' +
      '<div class="mode-grid">' +
      modeCard('Тренировка', 'Вопрос за вопросом с разбором', 'train', '#/train', 'primary') +
      modeCard('Экзамен', 'N вопросов на время', 'exam', '#/exam', 'violet') +
      modeCard('Работа над ошибками', mistakes ? mistakes + ' ' + utils.plural(mistakes, 'вопрос', 'вопроса', 'вопросов') + ' ждут разбора' : 'Пока пусто', 'mistakes', '#/mistakes', 'rose') +
      modeCard('Статистика', 'Прогресс по темам', 'stats', '#/stats', 'teal') +
      '</div></section>';

    if (lastSessions.length) {
      html += '<section class="section"><div class="section__head"><h2>Последние прохождения</h2>' +
        '<a class="link" href="#/stats">Вся статистика' + icon('chevronRight') + '</a></div><div class="session-list">' +
        lastSessions.map((s) =>
          '<div class="session-row">' +
          '<span class="session-row__icon session-row__icon--' + (s.mode === 'exam' ? 'violet' : 'primary') + '">' + icon(s.mode === 'exam' ? 'exam' : 'train') + '</span>' +
          '<div class="session-row__main"><strong>' + (s.mode === 'exam' ? 'Экзамен' : 'Тренировка') + '</strong>' +
          '<span>' + esc(utils.formatDate(s.date)) + ' · ' + (s.label ? esc(s.label) : 'Все темы') + '</span></div>' +
          '<div class="session-row__score"><strong>' + s.correct + '/' + s.total + '</strong><span>' + s.accuracy + '%</span></div>' +
          '</div>').join('') +
        '</div></section>';
    }

    html += '<section class="section"><div class="section__head"><h2>Темы</h2>' +
      '<span class="section__hint">' + dataset.total + ' ' + utils.plural(dataset.total, 'задание', 'задания', 'заданий') + '</span></div>' +
      '<div class="topic-list">' + topics.map((t, i) => topicRow(t, i)).join('') + '</div></section>';

    html += '</div>';

    return { title: 'Главная', html };
  };

  function statCard(label, value, sub, iconName) {
    return '<div class="stat-card">' +
      '<span class="stat-card__icon">' + icon(iconName) + '</span>' +
      '<span class="stat-card__label">' + esc(label) + '</span>' +
      '<strong class="stat-card__value">' + esc(value) + '</strong>' +
      '<span class="stat-card__sub">' + esc(sub) + '</span></div>';
  }

  function modeCard(title, text, iconName, href, color) {
    return '<a class="mode-card mode-card--' + color + '" href="' + href + '">' +
      '<span class="mode-card__icon">' + icon(iconName) + '</span>' +
      '<strong>' + esc(title) + '</strong>' +
      '<span class="mode-card__text">' + esc(text) + '</span>' +
      '<span class="mode-card__arrow">' + icon('arrowRight') + '</span></a>';
  }

  function topicRow(t, index) {
    const pct = t.mastery;
    return '<a class="topic" href="#/train?topic=' + t.topic.id + '">' +
      '<span class="topic__index">' + utils.pad(index + 1) + '</span>' +
      '<div class="topic__main">' +
      '<div class="topic__title"><strong>' + esc(t.topic.title) + '</strong>' +
      '<span class="topic__sub">' + esc(t.topic.subtitle) + '</span></div>' +
      progressBar(pct) +
      '<div class="topic__meta"><span>' + t.total + ' ' + utils.plural(t.total, 'вопрос', 'вопроса', 'вопросов') + '</span>' +
      '<span>освоено ' + t.mastered + '</span>' +
      (t.attempts ? '<span>точность ' + t.accuracy + '%</span>' : '<span>не начато</span>') +
      '</div></div>' +
      '<span class="topic__pct">' + pct + '%</span>' +
      '<span class="topic__go">' + icon('chevronRight') + '</span></a>';
  }

  /* -------------------------------------------------------- настройка: тренировка */

  views.trainSetup = function () {
    const s = setup.train;
    const available = availableCount(s.topics, s.scope);
    const total = availableCount(s.topics, 'all');

    let html = '<div class="view">';
    html += pageHead('Тренировка', 'Режим с мгновенной проверкой и разбором каждого вопроса.');
    html += '<div class="panel">' +
      '<div class="panel__block"><div class="panel__label">Темы</div>' +
      topicChips(s.topics, 'toggle-topic-train') +
      '<p class="muted small">Выбрано: ' + esc(sessionLabel(s.topics)) + ' · ' + total + ' ' +
      utils.plural(total, 'вопрос', 'вопроса', 'вопросов') + '</p></div>' +

      '<div class="panel__block"><div class="panel__label">Что тренировать</div>' + scopeCards(s.scope) + '</div>' +

      '<div class="panel__block"><div class="panel__label">Сколько вопросов</div>' +
      limitPicker(s.limit, [10, 20, 30, 50, 0]) +
      '<p class="muted small">' + (available ? 'Доступно по текущему фильтру: ' + available : 'По этому фильтру пока нет вопросов — попробуйте другой режим') + '</p></div>' +

      '<div class="panel__footer">' +
      '<button class="btn btn--primary btn--lg" data-action="start-train"' + (available ? '' : ' disabled') + '>' +
      icon('play') + 'Начать' + '</button>' +
      '<a class="btn btn--ghost" href="#/">Отмена</a>' +
      '</div></div>';
    html += '</div>';
    return { title: 'Тренировка', html, mount };
  };

  /* -------------------------------------------------------- настройка: экзамен */

  views.examSetup = function () {
    const s = setup.exam;
    const total = availableCount(s.topics, 'all');
    const count = s.limit === 0 ? total : Math.min(s.limit, total);

    let html = '<div class="view">';
    html += pageHead('Пробный экзамен', 'Вопросы идут без подсказок, проверка — после завершения.');
    html += '<div class="panel">' +
      '<div class="panel__block"><div class="panel__label">Темы</div>' +
      topicChips(s.topics, 'toggle-topic-exam') +
      '<p class="muted small">Выбрано: ' + esc(sessionLabel(s.topics)) + ' · ' + total + ' ' +
      utils.plural(total, 'вопрос', 'вопроса', 'вопросов') + '</p></div>' +

      '<div class="panel__block"><div class="panel__label">Количество вопросов</div>' +
      limitPicker(s.limit, [10, 20, 30, 50, 100, 0]) +
      '<p class="muted small">Будет ' + count + ' ' + utils.plural(count, 'вопрос', 'вопроса', 'вопросов') + '</p></div>' +

      '<div class="panel__block"><div class="panel__label">Время</div>' +
      '<div class="switch-row">' +
      '<label class="switch"><input type="checkbox" data-action="toggle-timer"' + (s.timer ? ' checked' : '') + '>' +
      '<span class="switch__track"><span class="switch__thumb"></span></span>' +
      '<span class="switch__label">Ограничить время</span></label>' +
      (s.timer ? '<span class="timer-input"><input type="number" min="5" max="180" step="5" value="' + s.minutes + '" data-action="set-minutes"> мин</span>' : '') +
      '</div>' +
      '<p class="muted small">' + (s.timer ? 'На один вопрос — около ' + Math.round((s.minutes * 60) / Math.max(1, count)) + ' сек.' : 'Без таймера — в удобном темпе.') + '</p>' +
      '</div>' +

      '<div class="panel__footer">' +
      '<button class="btn btn--primary btn--lg" data-action="start-exam">' + icon('exam') + 'Начать экзамен</button>' +
      '<a class="btn btn--ghost" href="#/">Отмена</a>' +
      '</div></div></div>';
    return { title: 'Экзамен', html, mount };
  };

  function pageHead(title, text, back) {
    return '<div class="page-head">' +
      (back ? '<a class="page-head__back" href="' + back + '">' + icon('arrowLeft') + 'Назад</a>' : '') +
      '<h1>' + esc(title) + '</h1>' +
      (text ? '<p>' + esc(text) + '</p>' : '') + '</div>';
  }

  /* --------------------------------------------------- обработчики настройки */

  function mount(root) {
    const view = root.querySelector('.view');
    if (!view) return;

    view.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const action = el.getAttribute('data-action');

      if (action === 'toggle-topic-train') {
        setup.train.topics = toggleTopic(setup.train.topics, el.getAttribute('data-topic'));
        AT.rerender();
      } else if (action === 'set-scope') {
        setup.train.scope = el.getAttribute('data-scope');
        AT.rerender();
      } else if (action === 'set-limit') {
        const mode = AT.route() === 'exam' ? 'exam' : 'train';
        setup[mode].limit = parseInt(el.getAttribute('data-limit'), 10);
        AT.rerender();
      } else if (action === 'toggle-topic-exam') {
        setup.exam.topics = toggleTopic(setup.exam.topics, el.getAttribute('data-topic'));
        AT.rerender();
      } else if (action === 'start-train') {
        startTraining('smart');
      } else if (action === 'start-exam') {
        startExam();
      }
    });

    view.addEventListener('change', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const action = el.getAttribute('data-action');
      if (action === 'toggle-timer') {
        setup.exam.timer = el.checked;
        AT.rerender();
      } else if (action === 'set-minutes') {
        setup.exam.minutes = utils.clamp(parseInt(el.value, 10) || 30, 5, 180);
      }
    });
  }

  function startTraining(scopeOverride) {
    const s = setup.train;
    const scope = scopeOverride || s.scope;
    const ids = AT.pickQuestions({
      topicIds: s.topics,
      scope,
      limit: s.limit || 0,
      shuffle: scope === 'all',
    });
    if (!ids.length) {
      toast('По этому фильтру нет вопросов', 'warn');
      return;
    }
    AT.startSession({
      mode: 'train',
      ids,
      scope,
      topicIds: s.topics,
      label: sessionLabel(s.topics),
    });
    AT.go('#/run');
  }

  function startExam() {
    const s = setup.exam;
    const ids = AT.pickQuestions({
      topicIds: s.topics,
      scope: 'all',
      limit: s.limit || 0,
      shuffle: true,
    });
    if (!ids.length) {
      toast('Нет вопросов для экзамена', 'warn');
      return;
    }
    AT.startSession({
      mode: 'exam',
      ids,
      scope: 'exam',
      topicIds: s.topics,
      label: sessionLabel(s.topics),
      timerMinutes: s.timer ? s.minutes : 0,
    });
    AT.go('#/run');
  }

  /* ------------------------------------------------------------- прохождение */

  function entryOf(session, qid) {
    if (!session.results[qid]) {
      session.results[qid] = { selected: [], revealed: false, correct: null, self: false };
    }
    return session.results[qid];
  }

  function answerLabel(list) {
    return list.length ? list.join(', ') : '—';
  }

  function optionHtml(q, index, entry, revealed, disabled) {
    const selected = entry.selected.indexOf(index) !== -1;
    const answer = AT.keyApi.forQuestion(q);
    let cls = 'option';
    let mark = '';
    if (selected) cls += ' is-selected';

    if (revealed && answer) {
      const isCorrectOption = answer.answers.indexOf(index) !== -1;
      if (isCorrectOption && selected) {
        cls += ' is-correct';
        mark = '<span class="option__tag">верно</span>';
      } else if (isCorrectOption && !selected) {
        cls += ' is-missed';
        mark = '<span class="option__tag">пропущено</span>';
      } else if (!isCorrectOption && selected) {
        cls += ' is-wrong';
        mark = '<span class="option__tag">лишнее</span>';
      }
      cls += ' is-locked';
    } else if (revealed) {
      cls += ' is-locked';
    }

    return '<button type="button" class="' + cls + '" data-action="toggle-option" data-index="' + index + '"' +
      (disabled ? ' disabled' : '') + ' aria-pressed="' + (selected ? 'true' : 'false') + '">' +
      '<span class="option__key">' + index + '</span>' +
      '<span class="option__text">' + esc(q.options[index - 1]) + '</span>' +
      mark +
      '<span class="option__check">' + icon('check') + '</span>' +
      '</button>';
  }

  function feedbackHtml(q, entry) {
    const answer = AT.keyApi.forQuestion(q);
    if (!answer) {
      return '<div class="feedback feedback--self">' +
        '<div class="feedback__head">' + icon('info') + '<strong>Ключа для этого вопроса ещё нет</strong></div>' +
        '<p>Оцените себя честно — результат пойдёт в статистику.</p>' +
        '<div class="feedback__actions">' +
        (entry.correct === null
          ? '<button class="btn btn--success" data-action="self-mark" data-value="1">' + icon('check') + 'Ответил верно</button>' +
          '<button class="btn btn--danger-ghost" data-action="self-mark" data-value="0">' + icon('x') + 'Ошибся</button>'
          : '<span class="feedback__self-done ' + (entry.correct ? 'is-good' : 'is-bad') + '">' +
          (entry.correct ? 'Отмечено: верно' : 'Отмечено: ошибка') + '</span>') +
        '</div></div>';
    }

    if (entry.correct) {
      return '<div class="feedback feedback--ok">' +
        '<div class="feedback__head">' + icon('check') + '<strong>Верно</strong></div>' +
        '<p>Правильный ответ: <b>' + answerLabel(answer.answers) + '</b></p>' +
        '</div>';
    }

    return '<div class="feedback feedback--bad">' +
      '<div class="feedback__head">' + icon('x') + '<strong>Неверно</strong></div>' +
      '<div class="feedback__grid">' +
      '<div><span class="feedback__label">Правильный ответ</span><p>' +
      answer.answers.map((i) => '<span class="answer-pill">' + i + '. ' + esc(q.options[i - 1]) + '</span>').join('') +
      '</p></div>' +
      '<div><span class="feedback__label">Ваш ответ</span><p>' +
      (entry.selected.length ? entry.selected.map((i) => '<span class="answer-pill answer-pill--muted">' + i + '. ' + esc(q.options[i - 1]) + '</span>').join('') : '<span class="muted">ничего не выбрано</span>') +
      '</p></div>' +
      '</div></div>';
  }

  function questionCard(session, q, entry) {
    const isExam = session.mode === 'exam';
    const answer = AT.keyApi.forQuestion(q);
    const revealed = !!entry.revealed && !isExam;
    const topic = dataset.topic(q.topic);
    const hint = AT.getState().settings.hintCount && answer && !revealed;

    let html = '<article class="question">' +
      '<div class="question__meta">' +
      '<span class="badge">№ ' + esc(q.num) + '</span>' +
      '<span class="badge badge--soft">' + esc(topic.title) + '</span>' +
      (hint ? '<span class="badge badge--accent">верных: ' + answer.answers.length + '</span>' : '') +
      '</div>' +
      '<h2 class="question__text">' + esc(q.text) + '</h2>' +
      '<p class="question__hint">' + (isExam ? 'Можно вернуться к вопросу позже' : 'Выберите все правильные варианты') + '</p>' +
      '<div class="options">';

    q.options.forEach((opt, i) => {
      html += optionHtml(q, i + 1, entry, revealed, revealed);
    });

    html += '</div>';

    if (!isExam) {
      html += '<div class="question__actions">';
      if (!revealed) {
        html += '<button class="btn btn--primary" data-action="check"' + (entry.selected.length ? '' : ' disabled') + '>' +
          icon('check') + 'Проверить</button>';
        html += '<button class="btn btn--ghost" data-action="skip">Пропустить</button>';
        html += '<span class="question__kb"><kbd>1</kbd>–<kbd>5</kbd> выбор, <kbd>Enter</kbd> проверить</span>';
      } else {
        html += '<button class="btn btn--primary" data-action="next">' + icon('arrowRight') + 'Далее</button>';
        html += '<button class="btn btn--ghost" data-action="prev">' + icon('arrowLeft') + 'Назад</button>';
        html += '<span class="question__kb"><kbd>Enter</kbd> далее</span>';
      }
      html += '</div>';
    }

    html += '</article>';

    if (!isExam && revealed) html += feedbackHtml(q, entry);
    return html;
  }

  views.run = function () {
    const session = AT.currentSession();
    if (!session) {
      return {
        title: 'Тренировка',
        html: '<div class="view">' + emptyState('train', 'Активной сессии нет',
          'Выберите темы и количество вопросов, чтобы начать.',
          '<a class="btn btn--primary" href="#/train">К настройке тренировки</a>') + '</div>',
      };
    }

    const qs = AT.sessionQuestions(session);
    const settings = AT.getState().settings;
    const isExam = session.mode === 'exam';
    const stats = AT.sessionStats(session);

    function render() {
      const q = qs[session.index];
      if (!q) return '';
      const entry = entryOf(session, q.id);
      const answeredCount = Object.keys(session.results).filter((id) => {
        const r = session.results[id];
        return r && r.selected && r.selected.length && r.correct !== undefined;
      }).length;

      let dotGrid = '';
      if (isExam && qs.length <= 80) {
        dotGrid = '<div class="dot-grid">' + qs.map((item, i) => {
          const r = session.results[item.id];
          const cls = 'dot' + (i === session.index ? ' is-current' : '') + (r && r.selected.length ? ' is-filled' : '');
          return '<button class="' + cls + '" data-action="jump" data-index="' + i + '" title="Вопрос ' + (i + 1) + '">' + (i + 1) + '</button>';
        }).join('') + '</div>';
      }

      return '<div class="runner">' +
        '<div class="runner__top">' +
        '<button class="btn btn--ghost btn--sm" data-action="exit">' + icon('arrowLeft') + 'Выйти</button>' +
        '<span class="runner__label">' + (isExam ? 'Экзамен' : 'Тренировка') + ' · ' + esc(session.label || sessionLabel(session.topicIds)) + '</span>' +
        (isExam && session.limitSeconds ? '<span class="runner__timer" id="examTimer">' + utils.formatDuration(session.limitSeconds - elapsed()) + '</span>' : '') +
        '<span class="runner__counter">' + (session.index + 1) + ' из ' + qs.length + '</span>' +
        '</div>' +
        progressBar(((session.index + 1) / qs.length) * 100, 'thin') +
        dotGrid +
        questionCard(session, q, entry) +
        (isExam
          ? '<div class="question__actions question__actions--exam">' +
            '<button class="btn btn--ghost" data-action="prev"' + (session.index === 0 ? ' disabled' : '') + '>' + icon('arrowLeft') + 'Назад</button>' +
            '<span class="question__kb">Отвечено: ' + answeredCount + ' из ' + qs.length + '</span>' +
            (session.index === qs.length - 1
              ? '<button class="btn btn--primary" data-action="finish">' + icon('flag') + 'Завершить</button>'
              : '<button class="btn btn--primary" data-action="next">' + icon('arrowRight') + 'Далее</button>') +
            '</div>'
          : '') +
        '</div>';
    }

    function elapsed() {
      return (Date.now() - session.startedAt) / 1000;
    }

    function persist() {
      AT.save();
    }

    function go(index) {
      session.index = utils.clamp(index, 0, qs.length - 1);
      renderInto(true);
    }

    function renderInto(scroll) {
      const host = document.getElementById('runnerHost');
      if (!host) return;
      host.innerHTML = render();
      if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const mount = (root) => {
      const host = document.createElement('div');
      host.id = 'runnerHost';
      host.innerHTML = render();
      root.appendChild(host);

      let finished = false;

      const finishUp = () => {
        if (finished) return;
        finished = true;
        session.limitSeconds = session.limitSeconds || 0;
        AT.gradeSession(session);
        const record = AT.finishSession();
        if (record) AT.go('#/summary');
      };

      let tick = null;
      if (isExam && session.limitSeconds) {
        tick = setInterval(() => {
          const left = session.limitSeconds - elapsed();
          const el = document.getElementById('examTimer');
          if (el) {
            el.textContent = utils.formatDuration(left);
            el.classList.toggle('is-low', left <= 60);
          }
          if (left <= 0) {
            clearInterval(tick);
            toast('Время вышло — экзамен завершён', 'warn');
            finishUp();
          }
        }, 500);
        if (window.AT.onCleanup) window.AT.onCleanup(() => clearInterval(tick));
      }

      const onKey = (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        const q = qs[session.index];
        const entry = entryOf(session, q.id);

        if (/^[1-5]$/.test(e.key)) {
          const idx = parseInt(e.key, 10);
          if (idx <= q.options.length) {
            e.preventDefault();
            toggleOption(idx);
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (isExam) {
            if (session.index === qs.length - 1) finishUp();
            else go(session.index + 1);
          } else if (!entry.revealed) {
            check();
          } else {
            next();
          }
        } else if (e.key === 'ArrowRight' && !isExam) {
          if (entry.revealed) next();
        }
      };
      document.addEventListener('keydown', onKey);
      if (window.AT.onCleanup) window.AT.onCleanup(() => document.removeEventListener('keydown', onKey));

      function toggleOption(idx) {
        const q = qs[session.index];
        const entry = entryOf(session, q.id);
        if (!isExam && entry.revealed) return;
        const pos = entry.selected.indexOf(idx);
        if (pos === -1) entry.selected.push(idx);
        else entry.selected.splice(pos, 1);
        entry.selected.sort((a, b) => a - b);
        if (isExam) persist();
        renderInto(false);
      }

      function check() {
        const q = qs[session.index];
        const entry = entryOf(session, q.id);
        if (!entry.selected.length || entry.revealed) return;
        entry.revealed = true;
        const answer = keyApi.forQuestion(q);
        if (answer) {
          const res = AT.gradeQuestion(q, entry.selected);
          entry.correct = res.correct;
          entry.self = false;
          AT.recordAttempt(q, res.correct, entry.selected);
        } else {
          entry.correct = null;
        }
        persist();
        renderInto(true);
      }

      function skip() {
        const q = qs[session.index];
        const entry = entryOf(session, q.id);
        entry.revealed = true;
        if (entry.correct === null) entry.self = true;
        AT.recordAttempt(q, false, []);
        persist();
        renderInto(true);
      }

      function next() {
        if (session.index >= qs.length - 1) {
          finishUp();
          return;
        }
        go(session.index + 1);
      }

      host.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el || el.disabled) return;
        const action = el.getAttribute('data-action');
        const q = qs[session.index];
        const entry = entryOf(session, q.id);

        if (action === 'toggle-option') toggleOption(parseInt(el.getAttribute('data-index'), 10));
        else if (action === 'check') check();
        else if (action === 'skip') skip();
        else if (action === 'next') next();
        else if (action === 'prev') go(session.index - 1);
        else if (action === 'jump') go(parseInt(el.getAttribute('data-index'), 10));
        else if (action === 'self-mark') {
          if (entry.revealed && entry.correct === null) {
            entry.correct = el.getAttribute('data-value') === '1';
            entry.self = true;
            entry.revealed = true;
            AT.recordAttempt(q, entry.correct, entry.selected);
            persist();
            renderInto(false);
          }
        } else if (action === 'finish') {
          const unanswered = qs.filter((item) => {
            const r = session.results[item.id];
            return !r || !r.selected.length;
          }).length;
          confirmDialog({
            title: 'Завершить экзамен?',
            text: unanswered ? 'Без ответа осталось вопросов: ' + unanswered + '. Они будут засчитаны как ошибки.' : 'Все вопросы отвечены. Покажем результат.',
            confirm: 'Завершить',
          }).then((ok) => {
            if (ok) finishUp();
          });
        } else if (action === 'exit') {
          confirmDialog({
            title: 'Выйти из сессии?',
            text: 'Прогресс по уже отвеченным вопросам сохранится, но сама сессия будет прервана.',
            confirm: 'Выйти',
            danger: true,
          }).then((ok) => {
            if (!ok) return;
            AT.discardSession();
            AT.go(isExam ? '#/exam' : '#/train');
          });
        }
      });
    };

    return { title: isExam ? 'Экзамен' : 'Тренировка', html: '<div class="view"></div>', mount, bare: true, stats };
  };

  /* ----------------------------------------------------------------- итоги */

  views.summary = function () {
    const state = AT.getState();
    const session = state.session;
    if (!session || !session.finished) {
      return {
        title: 'Итоги',
        html: '<div class="view">' + emptyState('flag', 'Итогов пока нет', 'Завершите тренировку или экзамен, чтобы увидеть результат.',
          '<a class="btn btn--primary" href="#/train">Начать тренировку</a>') + '</div>',
      };
    }

    const qs = AT.sessionQuestions(session);
    const stats = AT.sessionStats(session);
    const isExam = session.mode === 'exam';
    const duration = Math.round((session.finishedAt - session.startedAt) / 1000);
    const ungraded = qs.filter((q) => {
      const r = session.results[q.id];
      return !r || r.correct === null || r.correct === undefined;
    });
    const wrongQs = qs.filter((q) => {
      const r = session.results[q.id];
      return !r || r.correct === false || r.correct === null;
    });

    const scorePct = utils.pct(stats.correct, stats.total);
    const graded = stats.correct + (stats.total - stats.correct);

    let html = '<div class="view view--summary">';
    html += '<section class="result-hero' + (isExam ? ' result-hero--exam' : '') + '">' +
      '<div class="result-hero__ring">' + ring(scorePct, 156, scorePct + '%', isExam ? 'результат' : 'верных') + '</div>' +
      '<div class="result-hero__body">' +
      '<span class="eyebrow"><span class="eyebrow__dot"></span>' + (isExam ? 'Экзамен завершён' : 'Тренировка завершена') + '</span>' +
      '<h1>' + resultTitle(scorePct, isExam) + '</h1>' +
      '<p>' + stats.correct + ' из ' + stats.total + ' ' + utils.plural(stats.total, 'вопроса', 'вопросов', 'вопросов') + ' верно' +
      (duration ? ' · ' + utils.formatDuration(duration) : '') +
      (session.selfCheck || stats.self ? ' · с самопроверкой' : '') + '</p>' +
      '<div class="result-hero__actions">' +
      (wrongQs.length ? '<button class="btn btn--primary" data-action="retry-wrong">' + icon('refresh') + 'Разобрать ' + wrongQs.length + '</button>' : '') +
      '<button class="btn btn--ghost" data-action="retry-all">' + icon('play') + 'Пройти заново</button>' +
      '<a class="btn btn--ghost" href="#/">На главную</a>' +
      '</div></div></section>';

    html += '<div class="stat-grid stat-grid--compact">' +
      statCard('Верно', stats.correct, 'вопросов', 'check') +
      statCard('Ошибки', stats.total - stats.correct, 'вопросов', 'x') +
      statCard('Точность', stats.accuracy + '%', 'за сессию', 'target') +
      statCard('Время', duration ? utils.formatDuration(duration) : '—', isExam && session.limitSeconds ? 'лимит ' + utils.formatDuration(session.limitSeconds) : 'без лимита', 'clock') +
      '</div>';

    if (ungraded.length) {
      html += '<div class="banner banner--info"><span class="banner__icon">' + icon('info') + '</span>' +
        '<span class="banner__body"><strong>' + ungraded.length + ' ' + utils.plural(ungraded.length, 'вопрос', 'вопроса', 'вопросов') + ' без ключа</strong>' +
        '<span>Отметьте, ответили ли вы верно — так они попадут в статистику.</span></span></div>';
    }

    html += '<section class="section"><div class="section__head"><h2>Разбор</h2>' +
      '<span class="section__hint">' + qs.length + ' ' + utils.plural(qs.length, 'вопрос', 'вопроса', 'вопросов') + '</span></div>' +
      '<div class="review-list">';

    qs.forEach((q, i) => {
      const r = session.results[q.id] || { selected: [], correct: null };
      const answer = keyApi.forQuestion(q);
      const topic = dataset.topic(q.topic);
      const status = r.correct === true ? 'ok' : r.correct === false ? 'bad' : 'unknown';
      const icons = { ok: icon('check'), bad: icon('x'), unknown: icon('info') };

      html += '<details class="review review--' + status + '">' +
        '<summary>' +
        '<span class="review__num">' + (i + 1) + '</span>' +
        '<span class="review__text">' + esc(q.text) + '</span>' +
        '<span class="review__status">' + icons[status] + '</span>' +
        '</summary>' +
        '<div class="review__body">' +
        '<div class="review__meta"><span class="badge badge--soft">' + esc(topic.title) + '</span>' +
        '<span class="badge">№ ' + esc(q.num) + '</span></div>' +
        '<div class="review__cols">' +
        '<div><span class="feedback__label">Правильный ответ</span>' +
        (answer
          ? '<ul class="review__answers">' + answer.answers.map((idx) => '<li class="is-correct">' + idx + '. ' + esc(q.options[idx - 1]) + '</li>').join('') + '</ul>'
          : '<p class="muted">Ключа нет — вопрос в режиме самопроверки</p>') +
        '</div>' +
        '<div><span class="feedback__label">Ваш ответ</span>' +
        (r.selected && r.selected.length
          ? '<ul class="review__answers">' + r.selected.map((idx) => '<li class="' + (answer && answer.answers.indexOf(idx) !== -1 ? 'is-ok' : answer ? 'is-bad' : '') + '">' +
            idx + '. ' + esc(q.options[idx - 1]) + '</li>').join('') + '</ul>'
          : '<p class="muted">Нет ответа</p>') +
        '</div></div>' +
        (r.correct === null || r.correct === undefined
          ? '<div class="review__self"><span class="muted small">Ваша оценка:</span>' +
            '<button class="btn btn--sm btn--success-ghost" data-action="mark-self" data-qid="' + q.id + '" data-value="1">' + icon('check') + 'Верно</button>' +
            '<button class="btn btn--sm btn--danger-ghost" data-action="mark-self" data-qid="' + q.id + '" data-value="0">' + icon('x') + 'Ошибся</button>' +
            '</div>'
          : '') +
        '</div></details>';
    });

    html += '</div></section></div>';
    return { title: 'Итоги', html, mount: mountSummary };
  };

  function resultTitle(pct, isExam) {
    if (pct >= 90) return 'Отличный результат';
    if (pct >= 75) return isExam ? 'Экзамен сдан уверенно' : 'Хороший прогресс';
    if (pct >= 50) return 'Есть над чем поработать';
    return 'Стоит повторить материал';
  }

  function mountSummary(root) {
    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const action = el.getAttribute('data-action');
      const session = AT.getState().session;
      if (!session) return;

      if (action === 'mark-self') {
        const qid = el.getAttribute('data-qid');
        const value = el.getAttribute('data-value') === '1';
        const q = AT.dataset.byId.get(qid);
        const entry = session.results[qid] || (session.results[qid] = { selected: [], revealed: true, correct: null, self: true });
        if (entry.correct === null || entry.correct === undefined) {
          entry.correct = value;
          entry.self = true;
          AT.recordAttempt(q, value, entry.selected);
          const rec = AT.getState().sessions.find((item) => item.id === session.id);
          if (rec) {
            const fresh = AT.sessionStats(session);
            rec.correct = fresh.correct;
            rec.answered = fresh.answered;
            rec.accuracy = fresh.accuracy;
          }
          AT.save(true);
          AT.rerender();
        }
      } else if (action === 'retry-wrong' || action === 'retry-all') {
        const all = AT.sessionQuestions(session);
        const ids = action === 'retry-all'
          ? all.map((q) => q.id)
          : all.filter((q) => {
            const r = session.results[q.id];
            return !r || r.correct !== true;
          }).map((q) => q.id);
        if (!ids.length) return;
        AT.startSession({
          mode: 'train',
          ids: utils.shuffle(ids),
          scope: 'review',
          topicIds: session.topicIds,
          label: 'Разбор: ' + (session.label || 'сессия'),
        });
        AT.go('#/run');
      }
    });
  }

  views.questionCard = questionCard;
  views.mountSetup = mount;
})();
