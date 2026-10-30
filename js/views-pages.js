/* ============================================================================
   views-pages.js — ошибки, статистика, ключ ответов, настройки
   ========================================================================== */
(function () {
  'use strict';

  const AT = window.AT;
  const { utils, dataset, keyApi, analytics } = AT;
  const { icon, progressBar, ring, emptyState, toast, confirmDialog } = AT.ui;
  const esc = utils.esc;
  const views = (AT.views = AT.views || {});

  const uiState = (AT.uiState = AT.uiState || {
    keySearch: '',
    keyFilter: 'all',
    mistakesSearch: '',
    lastImport: '',
    keyByPosition: false,
  });

  /* Портфель — обзор избранного из всех локальных баз. */
  views.portfolio = function () {
    const groups = AT.portfolio.allFavorites();
    const count = groups.reduce((n, group) => n + group.questions.length, 0);
    let html = '<div class="view view--portfolio"><div class="page-head"><h1>Портфель избранного</h1>' +
      '<p>Все отмеченные вопросы на этом устройстве, сгруппированные по базам. Варианты показаны в исходном порядке.</p></div>';
    if (!count) html += emptyState('star', 'Портфель пока пуст', 'Отметьте вопрос звёздочкой во время тренировки или в разборе.', '<a class="btn btn--primary" href="#/train">К тренировке</a>');
    else {
      html += '<p class="portfolio-total">Всего вопросов: <strong>' + count + '</strong></p>';
      groups.forEach(({module, questions}) => {
        const title = (module.faculty ? module.faculty + ' · ' : '') + (module.kind === 'credit' ? 'Зачёт' : 'Коллоквиум ' + (module.number || module.id)) + ' · ' + module.name;
        html += '<section class="portfolio-group"><div class="section__head"><h2>' + esc(title) + '</h2><span class="badge badge--soft">' + questions.length + '</span></div>';
        if (module.id === AT.colloquium.id) html += '<p class="muted small">Текущая база · <a class="link" href="#/train?scope=favorites">Тренировать избранное по темам</a></p>';
        else html += '<button class="btn btn--sm btn--ghost" data-action="open-favorite-base" data-module="' + esc(module.id) + '">Выбрать эту базу</button>';
        html += '<div class="portfolio-list">';
        questions.forEach(({question:q, comment}) => {
          const topic = (module.topics || []).find(t => t.id === q.topic);
          html += '<details class="portfolio-item"><summary><span class="badge">№ ' + esc(q.num) + '</span><span class="portfolio-item__text">' + esc(q.text) + '</span>' + icon('chevronDown') + '</summary>' +
            '<div class="portfolio-item__body"><p class="muted small">' + esc(topic ? topic.title : '') + '</p>' +
            '<ol class="portfolio-options">' + q.options.map(opt => '<li>' + esc(opt) + '</li>').join('') + '</ol>' +
            (comment ? '<div class="portfolio-comment"><strong>Личный комментарий</strong><p>' + esc(comment) + '</p></div>' : '') +
            '<button class="btn btn--sm btn--ghost" data-action="remove-favorite" data-module="' + esc(module.id) + '" data-qid="' + esc(q.id) + '">' + icon('star') + 'Убрать из избранного</button></div></details>';
        });
        html += '</div></section>';
      });
    }
    html += '</div>';
    const mount = root => {
      const view = root.querySelector('.view--portfolio');
      view.addEventListener('click', e => {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        const action = el.getAttribute('data-action'), id = el.getAttribute('data-module');
        if (action === 'remove-favorite') {
          if (AT.portfolio.removeFavorite(id, el.getAttribute('data-qid'))) { AT.rerender(); toast('Вопрос убран из избранного'); }
          else toast('Не удалось сохранить изменение', 'warn');
        } else if (action === 'open-favorite-base' && window.COLLOQUIUM_MODULES && window.COLLOQUIUM_MODULES[id]) {
          try {
            if (!AT.save(true)) throw new Error('storage');
            localStorage.setItem('anatomy-colloquium-selected', id);
            location.hash = '#/portfolio';
            location.reload();
          } catch (err) { toast('Не удалось переключить базу', 'warn'); }
        }
      });
    };
    return {title: 'Портфель избранного', html, mount};
  };

  /* ---------------------------------------------------------------- ошибки */

  views.mistakes = function () {
    const items = analytics.mistakes();
    const q = uiState.mistakesSearch.trim().toLowerCase();
    const list = q
      ? items.filter((item) => item.text.toLowerCase().indexOf(q) !== -1 || String(item.num).indexOf(q) !== -1)
      : items;

    let html = '<div class="view">';
    html += '<div class="page-head"><h1>Работа над ошибками</h1>' +
      '<p>Вопросы, где вы ошибались и ещё не закрепили ответ двумя верными подряд.</p></div>';

    if (!items.length) {
      html += emptyState('sparkles', 'Ошибок нет',
        'Отличная работа. Продолжайте тренировки, чтобы закрепить материал.',
        '<a class="btn btn--primary" href="#/train">Тренироваться</a>');
      html += '</div>';
      return { title: 'Ошибки', html };
    }

    html += '<div class="toolbar">' +
      '<button class="btn btn--primary" data-action="train-mistakes">' + icon('play') + 'Тренировать все (' + items.length + ')</button>' +
      '<label class="search"><span class="search__icon">' + icon('search') + '</span>' +
      '<input type="search" placeholder="Поиск по тексту или номеру" value="' + esc(uiState.mistakesSearch) + '" data-action="search-mistakes"></label>' +
      '</div>';

    html += '<div class="mistake-list">';
    list.forEach((item) => {
      const p = analytics.progressOf(item.id);
      const answer = keyApi.forQuestion(item);
      const topic = dataset.topic(item.topic);
      html += '<article class="mistake">' +
        '<div class="mistake__head"><span class="badge">№ ' + esc(item.num) + '</span>' +
        '<span class="badge badge--soft">' + esc(topic.title) + '</span>' +
        '<span class="mistake__stat">ошибок: ' + p.wrong + ' · попыток: ' + p.attempts + '</span></div>' +
        '<h3 class="mistake__text">' + esc(item.text) + '</h3>' +
        '<div class="mistake__answers">' +
        (answer
          ? '<span class="mistake__label">Верно:</span>' + answer.answers.map((i) =>
            '<span class="answer-pill">' + i + '. ' + esc(item.options[i - 1]) + '</span>').join('')
          : '<span class="muted small">Ключ для этого вопроса не заполнен</span>') +
        '</div>' +
        (p.lastSelected && p.lastSelected.length
          ? '<div class="mistake__answers mistake__answers--mine"><span class="mistake__label">Вы отвечали:</span>' +
          p.lastSelected.map((i) => '<span class="answer-pill answer-pill--muted">' + i + '. ' + esc(item.options[i - 1]) + '</span>').join('') + '</div>'
          : '') +
        '<div class="mistake__actions">' +
        '<button class="btn btn--sm btn--ghost" data-action="train-one" data-qid="' + item.id + '">' + icon('play') + 'Отработать</button>' +
        '<button class="btn btn--sm btn--ghost" data-action="mark-mastered" data-qid="' + item.id + '">' + icon('check') + 'Считаю выученным</button>' +
        '</div></article>';
    });
    html += '</div>';

    if (!list.length) html += '<p class="muted center">Ничего не найдено по запросу.</p>';
    html += '</div>';

    const mount = (root) => {
      root.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        const action = el.getAttribute('data-action');
        if (action === 'train-mistakes') {
          const ids = analytics.mistakes().map((item) => item.id);
          if (!ids.length) return;
          AT.startSession({ mode: 'train', ids: utils.shuffle(ids), scope: 'wrong', topicIds: ['all'], label: 'Работа над ошибками' });
          AT.go('#/run');
        } else if (action === 'train-one') {
          AT.startSession({
            mode: 'train',
            ids: [el.getAttribute('data-qid')],
            scope: 'single',
            topicIds: ['all'],
            label: 'Один вопрос',
          });
          AT.go('#/run');
        } else if (action === 'mark-mastered') {
          const qid = el.getAttribute('data-qid');
          const state = AT.getState();
          const p = state.progress[qid] || { attempts: 0, correct: 0, wrong: 0, streak: 0 };
          p.streak = 2;
          p.last = 'correct';
          state.progress[qid] = p;
          AT.save(true);
          AT.rerender();
          toast('Вопрос убран из списка ошибок');
        }
      });

      const search = root.querySelector('[data-action="search-mistakes"]');
      if (search) {
        search.addEventListener('input', () => {
          uiState.mistakesSearch = search.value;
          const pos = search.selectionStart;
          AT.rerender();
          const next = document.querySelector('[data-action="search-mistakes"]');
          if (next) {
            next.focus();
            try { next.setSelectionRange(pos, pos); } catch (err) { /* ignore */ }
          }
        });
      }
    };

    return { title: 'Ошибки', html, mount };
  };

  /* ------------------------------------------------------------ статистика */

  views.stats = function () {
    const overall = analytics.overall();
    const topics = analytics.byTopic().filter((t) => t.total > 0);
    const sessions = AT.getState().sessions;
    const keyed = keyApi.count();
    const best = topics.slice().sort((a, b) => b.accuracy - a.accuracy)[0];
    const worst = topics.filter((t) => t.attempts > 0).sort((a, b) => a.accuracy - b.accuracy)[0];

    let html = '<div class="view">';
    html += '<div class="page-head"><h1>Статистика</h1><p>Прогресс по всему банку и по каждой теме.</p></div>';

    html += '<div class="stat-grid">' +
      card('Освоено', overall.mastered + '<small>/' + overall.total + '</small>', 'два верных ответа подряд', 'sparkles') +
      card('Изучено', overall.started + '<small>/' + overall.total + '</small>', 'вопросов открыто', 'book') +
      card('Точность', overall.accuracy + '%', 'всего ' + overall.attempts + ' ' + utils.plural(overall.attempts, 'ответ', 'ответа', 'ответов'), 'target') +
      card('Ключ', utils.pct(keyed, overall.total) + '%', keyed + ' из ' + overall.total + ' вопросов', 'key') +
      '</div>';

    html += '<div class="split">';
    html += '<section class="card card--pad"><h2 class="card__title">Прогресс по темам</h2><div class="topic-progress">';
    topics.forEach((t) => {
      html += '<div class="tp-row">' +
        '<div class="tp-row__head"><a href="#/train?topic=' + t.topic.id + '" class="tp-row__name">' + esc(t.topic.title) + '</a>' +
        '<span class="tp-row__num">' + t.mastered + '/' + t.total + '</span></div>' +
        progressBar(t.mastery, t.mastery >= 70 ? 'ok' : t.mastery >= 30 ? 'mid' : 'low') +
        '<div class="tp-row__meta"><span>изучено ' + t.started + '</span><span>точность ' + (t.attempts ? t.accuracy + '%' : '—') + '</span></div>' +
        '</div>';
    });
    html += '</div></section>';

    html += '<section class="card card--pad"><h2 class="card__title">Что дальше</h2>';
    if (!overall.attempts) {
      html += '<p class="muted">Данных пока нет. Начните с тренировки — статистика появится сразу.</p>' +
        '<a class="btn btn--primary btn--block" href="#/train">Начать тренировку</a>';
    } else {
      html += '<div class="insight">' + icon('sparkles') + '<div><strong>Сильная тема</strong><span>' +
        esc(best ? best.topic.title : '—') + (best && best.attempts ? ' · ' + best.accuracy + '%' : ' · ещё нет данных') + '</span></div></div>';
      if (worst) {
        html += '<div class="insight insight--warn">' + icon('flag') + '<div><strong>Слабое место</strong><span>' +
          esc(worst.topic.title) + ' · ' + worst.accuracy + '%</span></div></div>' +
          '<a class="btn btn--ghost btn--block" href="#/train?topic=' + worst.topic.id + '">Повторить тему</a>';
      }
      html += '<a class="btn btn--ghost btn--block" href="#/mistakes">Разобрать ошибки (' + analytics.mistakes().length + ')</a>';
    }
    html += '</section></div>';

    if (sessions.length) {
      html += '<section class="section"><div class="section__head"><h2>История</h2>' +
        '<span class="section__hint">' + sessions.length + ' ' + utils.plural(sessions.length, 'запись', 'записи', 'записей') + '</span></div>' +
        '<div class="history">' + sessions.map((s) =>
          '<div class="history__row">' +
          '<span class="history__badge history__badge--' + s.mode + '">' + icon(s.mode === 'exam' ? 'exam' : 'train') + '</span>' +
          '<div class="history__main"><strong>' + (s.mode === 'exam' ? 'Экзамен' : 'Тренировка') + '</strong>' +
          '<span>' + esc(utils.formatDate(s.date)) + ' · ' + esc(s.label || 'Все темы') + ' · ' + utils.formatDuration(s.duration) + (s.assisted ? ' · с усилениями' : '') + '</span></div>' +
          '<div class="history__bar">' + progressBar(s.accuracy, s.accuracy >= 70 ? 'ok' : s.accuracy >= 40 ? 'mid' : 'low') + '</div>' +
          '<div class="history__score"><strong>' + s.correct + '/' + s.total + '</strong><span>' + s.accuracy + '%</span></div>' +
          '</div>').join('') + '</div></section>';
    }

    html += '<div class="page-actions"><button class="btn btn--ghost btn--danger" data-action="reset-progress">' +
      icon('trash') + 'Сбросить весь прогресс</button></div></div>';

    const mount = (root) => {
      root.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action="reset-progress"]');
        if (!el) return;
        confirmDialog({
          title: 'Сбросить прогресс?',
          text: 'Обнулятся статистика, история, ошибки, валюта, рейтинг и усиления этой базы. Избранное, комментарии, общие достижения, оформления и ключ ответов останутся.',
          confirm: 'Сбросить',
          danger: true,
        }).then((ok) => {
          if (!ok) return;
          AT.resetProgress();
          toast('Прогресс сброшен');
          AT.rerender();
        });
      });
    };

    return { title: 'Статистика', html, mount };
  };

  function card(label, value, sub, iconName) {
    return '<div class="stat-card"><span class="stat-card__icon">' + icon(iconName) + '</span>' +
      '<span class="stat-card__label">' + esc(label) + '</span>' +
      '<strong class="stat-card__value">' + value + '</strong>' +
      '<span class="stat-card__sub">' + esc(sub) + '</span></div>';
  }

  /* ----------------------------------------------------------- ключ ответов */

  views.key = function () {
    const total = dataset.total;
    const keyed = keyApi.count();
    const pct = utils.pct(keyed, total);
    const search = uiState.keySearch.trim().toLowerCase();
    const filter = uiState.keyFilter;

    let list = dataset.questions.slice();
    if (search) {
      list = list.filter((q) =>
        q.text.toLowerCase().indexOf(search) !== -1 ||
        String(q.num).toLowerCase().indexOf(search) !== -1 ||
        q.options.some((o) => o.toLowerCase().indexOf(search) !== -1)
      );
    }
    if (filter === 'empty') list = list.filter((q) => !keyApi.has(q));
    if (filter === 'filled') list = list.filter((q) => keyApi.has(q));
    if (filter === 'suspicious') {
      list = list.filter((q) => {
        const a = keyApi.forQuestion(q);
        return a && a.answers.length === q.options.length;
      });
    }

    let html = '<div class="view">';
    html += '<div class="page-head"><h1>Ключ ответов</h1>' +
      '<p>' + (AT.colloquium.hasBaseKey === false ? 'Ключ ответов пока не предоставлен. Можно добавить свои ответы вручную или импортировать ключ; до этого доступна самооценка.' : 'Правильные варианты для каждого задания. Ключ уже заполнен по базе теста — при необходимости поправьте ответы вручную или импортируйте свой.') + '</p></div>';

    html += '<div class="key-status">' +
      ring(pct, 96, pct + '%', 'заполнено') +
      '<div class="key-status__info"><strong>' + keyed + ' из ' + total + '</strong>' +
      '<span>' + (keyed === total ? 'Ключ полный — проверка работает автоматически.' :
        keyed ? 'Вопросы без ключа проверяются самооценкой.' : 'Ключа нет: вопросы доступны в режиме самооценки.') + '</span>' +
      (keyApi.count() ? '<button class="btn btn--sm btn--ghost btn--danger" data-action="clear-key">' + icon('trash') + 'Удалить все ответы</button>' : '') +
      '</div></div>' +
      (keyApi.count() === total && AT.colloquium.hasBaseKey !== false
        ? '<p class="key-source">' + icon('info') + '<span>Ключ загружен из базы теста: верные варианты отмечены в PDF подсветкой. ' +
          'Если ответ кажется спорным — снимите или поставьте галочку ниже, ваша правка будет главнее базы.</span></p>'
        : '');

    html += '<div class="split split--key">';

    html += '<section class="card card--pad">' +
      '<h2 class="card__title">' + icon('upload') + 'Импорт</h2>' +
      '<p class="muted small">Вставьте ключ в любом удобном виде:</p>' +
      '<pre class="code-hint">1: 1, 2, 4\n2: 1 2 3 4\n3 — а, в, д\n4 = 135\n{"5": [1, 3]}</pre>' +
      '<textarea class="textarea" id="keyInput" rows="6" placeholder="1: 1, 3&#10;2: 1, 2, 3, 4&#10;..."></textarea>' +
      '<label class="check-row"><input type="checkbox" data-action="key-by-position"' + (uiState.keyByPosition ? ' checked' : '') + '>' +
      '<span>Нумерация по порядку (1…' + total + '), а не по номерам из PDF</span></label>' +
      '<div class="card__actions">' +
      '<button class="btn btn--primary" data-action="import-key">' + icon('upload') + 'Импортировать</button>' +
      '<label class="btn btn--ghost btn--file">' + icon('book') + 'Из файла' +
      '<input type="file" accept=".txt,.json,.csv" data-action="key-file"></label>' +
      '</div>' +
      '<div id="importResult">' + (uiState.lastImport || '') + '</div>' +
      '</section>';

    html += '<section class="card card--pad">' +
      '<h2 class="card__title">' + icon('download') + 'Экспорт</h2>' +
      '<p class="muted small">Выгрузите текущий ключ, чтобы передать его или сохранить копию.</p>' +
      '<div class="card__actions card__actions--col">' +
      '<button class="btn btn--ghost" data-action="copy-key">' + icon('copy') + 'Скопировать текстом</button>' +
      '<button class="btn btn--ghost" data-action="download-key-txt">' + icon('download') + 'Скачать .txt</button>' +
      '<button class="btn btn--ghost" data-action="download-key-json">' + icon('download') + 'Скачать .json</button>' +
      '<button class="btn btn--ghost" data-action="download-template">' + icon('book') + 'Пустой шаблон для заполнения</button>' +
      '</div>' +
      '<hr class="hr">' +
      '<h2 class="card__title">' + icon('info') + 'Про нумерацию</h2>' +
      '<p class="muted small">' + (AT.colloquium.renumbered ? 'В исходном PDF нумерация повторяется по разделам. Здесь вопросы пронумерованы по порядку; у каждого указаны страница и номер в PDF.' : AT.colloquium.id === '1' ? 'Номера совпадают с PDF. Вопрос № 58 встречается дважды — второй помечен «58а». Вопроса № 92 в файле нет.' : 'Номера вопросов совпадают с исходным PDF.') + '</p>' +
      '</section></div>';

    html += '<section class="section">' +
      '<div class="section__head"><h2>Задания</h2><span class="section__hint">' + list.length + ' из ' + total + '</span></div>' +
      '<div class="toolbar toolbar--wrap">' +
      '<label class="search"><span class="search__icon">' + icon('search') + '</span>' +
      '<input type="search" placeholder="Поиск по номеру, тексту или варианту" value="' + esc(uiState.keySearch) + '" data-action="key-search"></label>' +
      '<div class="chips chips--sm">' +
      ['all', 'empty', 'filled', 'suspicious'].map((f) =>
        '<button class="chip' + (filter === f ? ' is-active' : '') + '" data-action="key-filter" data-filter="' + f + '">' +
        ({ all: 'Все', empty: 'Без ответа', filled: 'С ответом', suspicious: 'Все варианты' })[f] + '</button>').join('') +
      '</div></div>';

    html += '<div class="key-list">';
    if (!list.length) {
      html += '<p class="muted center">Ничего не найдено.</p>';
    }
    list.forEach((q) => {
      const answer = keyApi.forQuestion(q);
      const topic = dataset.topic(q.topic);
      html += '<article class="key-item" data-qid="' + q.id + '">' +
        '<div class="key-item__head"><span class="badge">№ ' + esc(q.num) + '</span>' +
        '<span class="badge badge--soft">' + esc(topic.title) + '</span>' +
        (answer ? '<span class="badge badge--ok">' + (answer.source === 'local' ? 'мой ответ' : 'из базы') + '</span>'
          : '<span class="badge badge--muted">нет ответа</span>') +
        '</div>' +
        '<p class="key-item__text">' + esc(q.text) + '</p>' +
        '<div class="key-item__options">' +
        q.options.map((opt, i) => {
          const on = answer && answer.answers.indexOf(i + 1) !== -1;
          return '<button type="button" class="opt-toggle' + (on ? ' is-on' : '') + '" data-action="key-toggle" data-qid="' + q.id + '" data-index="' + (i + 1) + '">' +
            '<span class="opt-toggle__key">' + (i + 1) + '</span><span>' + esc(opt) + '</span></button>';
        }).join('') +
        '</div></article>';
    });
    html += '</div></section></div>';

    const mount = (root) => {
      root.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        const action = el.getAttribute('data-action');

        if (action === 'key-toggle') {
          const q = dataset.byId.get(el.getAttribute('data-qid'));
          const idx = parseInt(el.getAttribute('data-index'), 10);
          const current = keyApi.forQuestion(q);
          const answers = current ? current.answers.slice() : [];
          const pos = answers.indexOf(idx);
          if (pos === -1) answers.push(idx);
          else answers.splice(pos, 1);
          keyApi.set(q, answers);
          const item = el.closest('.key-item');
          const answer = keyApi.forQuestion(q);
          item.querySelectorAll('.opt-toggle').forEach((btn) => {
            const index = parseInt(btn.getAttribute('data-index'), 10);
            btn.classList.toggle('is-on', !!answer && answer.answers.indexOf(index) !== -1);
          });
          const badges = item.querySelector('.key-item__head');
          const old = badges.querySelector('.badge--ok, .badge--muted');
          if (old) old.remove();
          const span = document.createElement('span');
          span.className = 'badge ' + (answer ? 'badge--ok' : 'badge--muted');
          span.textContent = answer ? (answer.source === 'local' ? 'мой ответ' : 'из базы') : 'нет ответа';
          badges.appendChild(span);
          updateKeyStatus(root);
        } else if (action === 'key-filter') {
          uiState.keyFilter = el.getAttribute('data-filter');
          AT.rerender();
        } else if (action === 'import-key') {
          const text = (document.getElementById('keyInput') || {}).value || '';
          importKey(text, root);
        } else if (action === 'copy-key') {
          const text = keyApi.exportText() || '';
          if (!text) return toast('Ключ пуст', 'warn');
          copyText(text).then(() => toast('Ключ скопирован'));
        } else if (action === 'download-key-txt') {
          downloadFile('anatomy-key.txt', keyApi.exportText() || '', 'text/plain;charset=utf-8');
        } else if (action === 'download-key-json') {
          const map = keyApi.exportMap();
          downloadFile('anatomy-key.json', JSON.stringify(map, null, 2), 'application/json;charset=utf-8');
        } else if (action === 'download-template') {
          const lines = dataset.questions.map((q) => q.num + ': ');
          downloadFile('anatomy-key-template.txt',
            '# Ключ ответов: номер вопроса — номера верных вариантов\n' + lines.join('\n') + '\n',
            'text/plain;charset=utf-8');
        } else if (action === 'clear-key') {
          confirmDialog({
            title: 'Удалить все ответы?',
            text: 'Будут удалены только ваши ответы, импортированные и отмеченные вручную.',
            confirm: 'Удалить',
            danger: true,
          }).then((ok) => {
            if (!ok) return;
            AT.getState().key = {};
            AT.save(true);
            AT.rerender();
            toast('Ключ очищен');
          });
        }
      });

      const search = root.querySelector('[data-action="key-search"]');
      if (search) {
        search.addEventListener('input', () => {
          uiState.keySearch = search.value;
          const pos = search.selectionStart;
          AT.rerender();
          const next = document.querySelector('[data-action="key-search"]');
          if (next) {
            next.focus();
            try { next.setSelectionRange(pos, pos); } catch (err) { /* ignore */ }
          }
        });
      }

      const posCheck = root.querySelector('[data-action="key-by-position"]');
      if (posCheck) {
        posCheck.addEventListener('change', () => {
          uiState.keyByPosition = posCheck.checked;
        });
      }

      const file = root.querySelector('[data-action="key-file"]');
      if (file) {
        file.addEventListener('change', () => {
          const f = file.files && file.files[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = () => {
            const area = document.getElementById('keyInput');
            if (area) area.value = String(reader.result || '');
            importKey(String(reader.result || ''), root);
          };
          reader.readAsText(f, 'utf-8');
        });
      }
    };

    return { title: 'Ключ ответов', html, mount };
  };

  function updateKeyStatus(root) {
    const total = dataset.total;
    const keyed = keyApi.count();
    const pct = utils.pct(keyed, total);
    const ringEl = root.querySelector('.key-status');
    if (!ringEl) return;
    const label = ringEl.querySelector('.ring__label strong');
    if (label) label.textContent = pct + '%';
    const circle = ringEl.querySelector('.ring__value');
    if (circle) {
      const r = parseFloat(circle.getAttribute('r'));
      const c = 2 * Math.PI * r;
      circle.setAttribute('stroke-dashoffset', (c - (pct / 100) * c).toFixed(1));
    }
    const info = ringEl.querySelector('.key-status__info strong');
    if (info) info.textContent = keyed + ' из ' + total;
  }

  function importKey(text, root) {
    const box = document.getElementById('importResult');
    if (!text.trim()) {
      toast('Вставьте ключ в поле', 'warn');
      return;
    }
    const parsed = AT.keyParser.parse(text, { byPosition: uiState.keyByPosition });
    if (!parsed.entries.length) {
      uiState.lastImport = '<div class="notice notice--bad">' + icon('x') +
        '<div><strong>Не удалось распознать ключ</strong><span>' +
        (parsed.problems.length ? esc(parsed.problems.slice(0, 4).join('; ')) : 'Проверьте формат: «1: 1, 3, 5»') +
        '</span></div></div>';
      if (box) box.innerHTML = uiState.lastImport;
      return;
    }

    let applied = 0;
    const state = AT.getState();
    parsed.entries.forEach((entry) => {
      state.key[entry.num] = entry.answers;
      applied += 1;
    });
    state.keyMeta.updatedAt = Date.now();
    AT.save(true);

    const unknown = [...new Set(parsed.unknownNums)];
    uiState.lastImport = '<div class="notice notice--ok">' + icon('check') +
      '<div><strong>Импортировано: ' + applied + '</strong><span>' +
      (unknown.length ? 'Не найдены номера: ' + esc(unknown.slice(0, 12).join(', ')) + (unknown.length > 12 ? '…' : '') : 'Все номера распознаны') +
      (parsed.problems.length ? '. Замечания: ' + esc(parsed.problems.slice(0, 3).join('; ')) : '') +
      '</span></div></div>';
    toast('Ключ импортирован: ' + applied);
    AT.rerender();
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    area.remove();
  }

  function downloadFile(name, content, type) {
    const blob = new Blob([content], { type: type || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  /* -------------------------------------------------------------- настройки */

  views.settings = function () {
    const settings = AT.getState().settings;
    const theme = AT.ui.getThemePref();

    let html = '<div class="view view--narrow">';
    html += '<div class="page-head"><h1>Настройки</h1><p>Оформление и правила проверки.</p></div>';

    html += '<section class="card card--pad"><h2 class="card__title">Оформление</h2>' +
      '<div class="segmented">' +
      ['auto', 'light', 'dark'].map((t) =>
        '<button class="segmented__btn' + (theme === t ? ' is-active' : '') + '" data-action="set-theme" data-theme="' + t + '">' +
        icon(t === 'dark' ? 'moon' : t === 'light' ? 'sun' : 'sparkles') +
        ({ auto: 'Как в системе', light: 'Светлая', dark: 'Тёмная' })[t] + '</button>').join('') +
      '</div><p class="settings-appearance-link"><a href="#/rewards">Цветовые оформления в магазине →</a></p></section>';

    html += '<section class="card card--pad"><h2 class="card__title">Проверка</h2>' +
      switchRow('strict', 'Строгая проверка',
        'Верно только при точном совпадении набора вариантов. Выключите — ответ засчитается, если выбрано не менее 60% верных и нет лишних.',
        settings.strict) +
      switchRow('hintCount', 'Подсказывать число верных ответов',
        'В тренировке показывать, сколько правильных вариантов в задании.', settings.hintCount) +
      switchRow('germSquad', 'Бригада микробов · эксперимент',
        'Пока для проверки появляется в каждом подходящем вопросе тренировки. Можно отключить; на статистику шалость не влияет.', settings.germSquad) +
      switchRow('shuffleAnswers', 'Перемешивать варианты ответов',
        'В тренировке и экзамене варианты меняют порядок. Для новых сессий этой базы; зависимые от порядка варианты не перемешиваются.', settings.shuffleAnswers) +
      '</section>';

    html += '<section class="card card--pad"><h2 class="card__title">Данные</h2>' +
      '<p class="muted small">Прогресс, история, избранное, комментарии и ключ хранятся локально в этом браузере. Сброс относится к текущей базе; избранное, комментарии, общие достижения и оформления сохраняются.</p>' +
      '<div class="card__actions card__actions--col">' +
      '<button class="btn btn--ghost" data-action="export-progress">' + icon('download') + 'Скачать прогресс</button>' +
      '<label class="btn btn--ghost btn--file">' + icon('upload') + 'Импортировать оформления<input type="file" accept=".json,application/json" data-action="appearance-file"></label>' +
      '<p class="muted small">Из файла добавляются только оформления, без изменения прогресса и валюты. Полное восстановление прогресса пока недоступно.</p>' +
      '<button class="btn btn--ghost btn--danger" data-action="reset-all">' + icon('trash') + 'Сбросить прогресс</button>' +
      '</div></section>';

    html += '<section class="card card--pad"><h2 class="card__title">О тренажёре</h2>' +
      '<p class="muted small">' + (AT.colloquium.semester ? esc(AT.colloquium.semester) + ' семестр · ' : '') + (AT.colloquium.kind === 'credit' ? 'Зачёт' : 'Коллоквиум ' + esc(AT.colloquium.number || AT.colloquium.id)) + ' · ' + esc(AT.colloquium.name) + (AT.colloquium.faculty ? ' · ' + esc(AT.colloquium.faculty) : '') + ' — ' + dataset.total + ' заданий. ' +
      (AT.colloquium.renumbered ? 'Вопросы пронумерованы по порядку; страница и исходный номер указаны в задании. ' : 'Нумерация сохранена как в PDF. ') +
      'Приложение работает офлайн и не отправляет данные на сервер.</p>' +
      '<p class="muted small">' + (AT.colloquium.hasBaseKey === false ? 'База «' + esc(AT.colloquium.source) + '» предоставлена без ключа ответов. До его добавления используется самооценка.' : 'Ключ ответов взят из «' + esc(AT.colloquium.source) + '» — варианты, отмеченные в PDF подсветкой. Спорные ответы можно поправить на странице «Ключ»: приоритет всегда у вашей правки.') + '</p>' +
      '</section></div>';

    const mount = (root) => {
      const view = root.querySelector('.view--narrow') || root;
      view.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        if (action === 'set-theme') {
          AT.ui.applyTheme(btn.getAttribute('data-theme'));
          AT.rerender();
        } else if (action === 'reset-all') {
          confirmDialog({
            title: 'Сбросить прогресс?',
            text: 'История, статистика, валюта, рейтинг и усиления этой базы будут удалены. Избранное, комментарии, общие достижения, оформления и ключ ответов останутся.',
            confirm: 'Сбросить',
            danger: true,
          }).then((ok) => {
            if (!ok) return;
            AT.resetProgress();
            toast('Прогресс сброшен');
            AT.rerender();
          });
        } else if (action === 'export-progress') {
          const state = AT.getState();
          downloadFile('anatomy-progress-' + AT.colloquium.id + '.json', JSON.stringify({
            colloquium: AT.colloquium.id,
            exportedAt: new Date().toISOString(),
            progress: state.progress,
            favorites: state.favorites,
            comments: state.comments,
            sessions: state.sessions,
            key: state.key,
            game: state.game,
            sharedRewards: AT.game.profile(),
          }, null, 2), 'application/json;charset=utf-8');
        }
      });

      view.addEventListener('change', async (e) => {
        const fileInput = e.target.closest('[data-action="appearance-file"]');
        if (fileInput) {
          const file = fileInput.files && fileInput.files[0];
          fileInput.value = '';
          if (!file) return;
          if (file.size > 1024 * 1024) { toast('Файл слишком большой'); return; }
          let data;
          try { data = JSON.parse(await file.text()); }
          catch (err) { toast('Не удалось прочитать JSON-файл'); return; }
          const check = AT.game.inspectAppearanceImport(data);
          if (!check.ok) { toast(check.message); return; }
          const ok = await confirmDialog({
            title: 'Добавить оформления?',
            text: 'Из файла будут добавлены: ' + check.titles.join(', ') + '. Валюта, прогресс и текущая тема не изменятся. Полная коллекция откроет достижение.',
            confirm: 'Добавить',
          });
          if (!ok) return;
          let result;
          try {
            result = navigator.locks && navigator.locks.request
              ? await navigator.locks.request('anatomy-cosmetic-purchase', () => AT.game.importAppearances(data))
              : AT.game.importAppearances(data);
          } catch (err) { result = { ok: false, message: 'Не удалось импортировать оформления' }; }
          toast(result.message);
          return;
        }
        const input = e.target.closest('[data-setting]');
        if (!input) return;
        const key = input.getAttribute('data-setting');
        AT.getState().settings[key] = input.checked;
        AT.save(true);
        AT.rerender();
      });
    };

    return { title: 'Настройки', html, mount };
  };

  function switchRow(key, title, text, checked) {
    return '<div class="setting-row"><div class="setting-row__text"><strong>' + esc(title) + '</strong><span>' + esc(text) + '</span></div>' +
      '<label class="switch"><input type="checkbox" data-setting="' + key + '"' + (checked ? ' checked' : '') + '>' +
      '<span class="switch__track"><span class="switch__thumb"></span></span></label></div>';
  }
})();
