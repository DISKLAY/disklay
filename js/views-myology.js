/* Миология: второй коллоквиум. Навыки — тот же каркас, что у первого коллоквиума
   (ps-*); вопросы и теория — весь текст и все рисунки исходного расписанного
   конспекта прямо на странице, без ссылок на оригинальный PDF. */
(function () {
  'use strict';
  const AT = window.AT, esc = AT.utils.esc;
  const data = window.MedzoMyologyData;
  const source = window.MedzoMyologySource || [];
  const skills = window.MedzoMyologySkills;
  const folder = 'assets/anatomy/myology/';
  const pad = n => String(n).padStart(2, '0');
  const matches = (text, query) => query.split(/\s+/).filter(Boolean).every(word => text.toLowerCase().includes(word));
  const skillCount = n => n + ' ' + (n % 10 === 1 && n % 100 !== 11 ? 'навык' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'навыка' : 'навыков');
  const statusLabel = status => status === 'known' ? 'Знаю и могу показать' : status === 'again' ? 'Повторить' : 'Не оценено';

  let store;
  try { const local = window.localStorage; store = { getItem: key => local.getItem(key), setItem: (key, value) => { local.setItem(key, value); if (window.MedzoStudySync) window.MedzoStudySync.myologyChanged(); } }; } catch (e) { store = { getItem() { return null; }, setItem() { throw e; } }; }
  const game = skills.create(store);

  let screen = 'setup', search = '', groupMenuOpen = false;
  const openSections = new Set();
  const choices = {
    group: [['all', 'Все темы'], ...data.groups.map(g => [g.id, g.name])],
    scope: [['all', 'Все навыки'], ['unseen', 'Ещё не оценённые'], ['again', 'Требуют повторения'], ['favorites', 'Избранные']],
    limit: [['10', '10 навыков'], ['20', '20 навыков'], ['50', '50 навыков'], ['0', 'Все доступные']],
    sequence: [['random', 'Вперемешку'], ['ordered', 'По порядку']]
  };
  function picker(name, label, value, instance = 'setup') {
    const entries = choices[name], selectedGroups = Array.isArray(value) ? value : [String(value)];
    const selected = entries.find(x => x[0] === String(value)) || entries[0], key = name + '-' + instance;
    const labelText = name === 'group' && selectedGroups.length > 1 ? 'Выбрано тем: ' + selectedGroups.length : selected[1];
    const opened = name === 'group' && groupMenuOpen;
    return '<div class="ps-picker" data-picker="' + name + '" data-picker-instance="' + instance + '"><span class="ps-picker__label" id="ps-label-' + key + '">' + label + '</span><button type="button" class="ps-picker__trigger" data-picker-trigger aria-labelledby="ps-label-' + key + ' ps-value-' + key + '" aria-controls="ps-menu-' + key + '" aria-expanded="' + opened + '"><span id="ps-value-' + key + '">' + esc(labelText) + '</span><span class="ps-chevron" aria-hidden="true"></span></button><div class="ps-picker__menu" id="ps-menu-' + key + '" role="group" aria-labelledby="ps-label-' + key + '"' + (opened ? '' : ' hidden') + '>' + entries.map(([id, text]) => { const active = name === 'group' ? selectedGroups.includes(id) : id === selected[0]; return '<button type="button" class="ps-picker__option' + (active ? ' is-selected' : '') + '" data-ps-option="' + name + '" data-value="' + esc(id) + '" aria-pressed="' + active + '"><span>' + esc(text) + '</span><span class="ps-picker__check" aria-hidden="true">' + (active ? '✓' : '') + '</span></button>'; }).join('') + '</div></div>';
  }
  function catalog() {
    const s = game.state;
    return '<section class="ps-catalog"><div class="ps-catalog__head"><div><span class="ps-eyebrow">СПРАВОЧНИК</span><h2>Список навыков</h2></div><span class="ps-count">' + data.skills.length + '</span></div><div class="ps-catalog__controls"><label class="ps-search"><span class="ps-search__icon" aria-hidden="true">⌕</span><input type="search" aria-label="Поиск по названию, номеру или разделу" data-ps-search value="' + esc(search) + '" placeholder="Найти навык или тему"></label>' + picker('sequence', 'Порядок раздела', s.sequence, 'catalog') + '</div><div class="ps-sections">' + data.groups.map(section => {
      const items = data.skills.filter(item => item.id >= section.from && item.id <= section.to);
      return '<section class="ps-section" data-section="' + esc(section.id) + '" data-section-name="' + esc(section.name.toLowerCase()) + '" data-total="' + items.length + '"><div class="ps-section__head"><button type="button" class="ps-section__toggle" data-section-toggle aria-expanded="' + openSections.has(section.id) + '" aria-controls="ps-section-' + esc(section.id) + '"><span class="ps-section__arrow" aria-hidden="true"></span><span class="ps-section__title">' + esc(section.name) + '<small data-section-count>' + skillCount(items.length) + '</small></span></button><button type="button" class="ps-section__train" data-ps="section-start" data-id="' + esc(section.id) + '" aria-label="Тренировать весь раздел ' + esc(section.name) + '" title="Все навыки раздела">Тренировать <span aria-hidden="true">↗</span></button></div><div class="ps-section__items" id="ps-section-' + esc(section.id) + '"' + (openSections.has(section.id) ? '' : ' hidden') + '>' + items.map(item => '<div class="ps-list-item" data-search="' + esc((item.id + ' ' + item.latin).toLowerCase()) + '"><span class="ps-item-number">' + item.id + '</span><strong lang="la">' + esc(item.latin) + '</strong></div>').join('') + '</div></section>';
    }).join('') + '</div><p class="ps-no-results" data-no-results hidden>Ничего не найдено.</p></section>';
  }
  function setupView() {
    const s = game.state, session = s.session, stats = Object.values(s.stats);
    const learned = stats.filter(x => x.last === 'known').length, again = stats.filter(x => x.last === 'again').length;
    let html = '<div class="ps-stats" aria-label="Ваш прогресс"><div><strong>' + learned + '</strong><span>знаю</span></div><div><strong>' + again + '</strong><span>повторить</span></div><div><strong>' + stats.length + '<em> / ' + data.skills.length + '</em></strong><span>оценено</span></div></div>';
    if (session) html += '<div class="ps-resume"><div><strong>' + (session.finished ? 'Последняя подборка' : 'Продолжить тренировку') + '</strong><p>Оценено ' + Object.keys(session.answers).length + ' из ' + session.order.length + '</p></div><button class="btn btn--primary" type="button" data-ps="resume">' + (session.finished ? 'Посмотреть итог' : 'Продолжить →') + '</button></div>';
    html += '<section class="ps-panel ps-builder"><div class="ps-builder__head"><div><span class="ps-eyebrow">НАСТРОЙКА</span><h2>Новая тренировка</h2></div><span class="ps-builder__icon" aria-hidden="true">✦</span></div><div class="ps-filters">' + picker('group', 'Темы', s.group) + picker('scope', 'Подборка', s.scope) + picker('limit', 'Количество', s.limit) + picker('sequence', 'Порядок', s.sequence) + '</div>' +
      '<div class="ps-start"><p data-ps-available>Доступно: <strong>' + game.pool().length + '</strong>' + (s.sequence === 'ordered' && s.limit && game.pool().length > s.limit ? ' · первые ' + s.limit : '') + '</p><button type="button" class="btn btn--primary" data-ps="start"' + (!game.pool().length ? ' disabled' : '') + '>Начать тренировку <span aria-hidden="true">→</span></button></div></section>' + catalog() +
      '<details class="ps-data"><summary>О данных</summary><p>Навыки, оценки и заметки сохраняются в этом браузере. Оценки синхронизируются при входе в аккаунт; при конфликте выберите версию в профиле. Самооценка не начисляет очков. Подсказки — ориентир, сверяйтесь с атласом.</p><button type="button" data-ps="reset">Сбросить оценки</button></details>';
    return html;
  }
  function referencesView(item) {
    if (!item.references.length) return '';
    return '<details class="ps-reference"><summary>Свериться с рисунком (' + item.references.length + ' ' + (item.references.length === 1 ? 'вариант' : 'варианта') + ')</summary>' +
      item.references.map(r => '<div class="ps-reference-row"><strong>Вариант ' + r.variant + ' · стр. ' + r.page + '</strong><img src="' + folder + 'variant-' + r.variant + '-pages/' + pad(r.page) + '.webp" alt="Навык № ' + item.id + ' · вариант ' + r.variant + ', страница ' + r.page + ': рисунок с подписью" loading="lazy"></div>').join('') +
      '</details>';
  }
  function runView() {
    const s = game.state.session, item = game.current();
    if (!s || !item) { screen = 'setup'; return setupView(); }
    const status = s.answers[item.id], fav = !!game.state.favorites[item.id], showHint = !!s.hints[item.id];
    return '<div class="ps-run-top"><button type="button" class="ps-back" data-ps="setup">← К настройкам</button><span>НАВЫК ' + (s.index + 1) + ' / ' + s.order.length + '</span></div>' +
      '<div class="ps-progress" role="progressbar" aria-label="Позиция в подборке" aria-valuemin="1" aria-valuemax="' + s.order.length + '" aria-valuenow="' + (s.index + 1) + '"><span style="width:' + ((s.index + 1) / s.order.length * 100) + '%"></span></div>' +
      '<article class="ps-card"><div class="ps-card-head"><span class="ps-eyebrow">НАВЫК № ' + item.id + '</span><button class="ps-favorite' + (fav ? ' is-active' : '') + '" data-ps="favorite" data-id="' + item.id + '" aria-label="' + (fav ? 'Убрать из избранного' : 'Добавить в избранное') + '" aria-pressed="' + fav + '" type="button">' + (fav ? '★' : '☆') + '</button></div>' +
      '<h1 tabindex="-1" class="ps-term" lang="la">' + esc(item.latin) + '</h1>' + (s.index === 0 ? '<p class="ps-prompt">Переведите и покажите структуру, затем сверьте себя с атласом.</p>' : '') +
      '<p class="ps-prompt">Клавиатура: 1 — знаю, 2 — повторить, H — подсказка, ← / → — назад / далее, Enter — далее.</p>' +
      '<div class="ps-hint">' + (showHint ? '<strong tabindex="-1" data-ps-hint-result>Ориентир:</strong> ' + esc(item.hint) : '<button type="button" class="ps-hint__button" data-ps="hint"><span aria-hidden="true">✧</span> Подсказка</button>') + '</div>' +
      referencesView(item) +
      '<div class="ps-review"><h2>Как получилось?</h2><div class="ps-review-actions"><button type="button" class="btn ' + (status === 'known' ? 'btn--success' : 'btn--ghost') + '" data-ps="mark" data-value="known" aria-pressed="' + (status === 'known') + '">Знаю и покажу</button><button type="button" class="btn ' + (status === 'again' ? 'btn--danger' : 'btn--ghost') + '" data-ps="mark" data-value="again" aria-pressed="' + (status === 'again') + '">Повторить</button></div>' + (status ? '<p class="ps-status" role="status">' + statusLabel(status) + '</p>' : '') + '</div>' +
      '<details class="ps-notes"><summary>Моя заметка</summary><label for="ps-note">Запись после сверки</label><textarea id="ps-note" data-ps-note maxlength="2000" placeholder="Личная заметка…">' + esc(game.state.notes[item.id] || '') + '</textarea><small>Заметка сохраняется на устройстве.</small></details>' +
      '<div class="ps-pagination"><button type="button" class="btn btn--ghost" data-ps="prev"' + (s.index === 0 ? ' disabled' : '') + '>← Назад</button><button type="button" class="btn btn--primary" data-ps="' + (s.index === s.order.length - 1 ? 'finish' : 'next') + '">' + (s.index === s.order.length - 1 ? 'К итогам' : 'Далее →') + '</button></div></article>';
  }
  function summaryView() {
    const s = game.state.session;
    if (!s) { screen = 'setup'; return setupView(); }
    const known = s.order.filter(id => s.answers[id] === 'known').length, again = s.order.filter(id => s.answers[id] === 'again').length, unanswered = s.order.length - known - again;
    return '<header class="ps-head"><span class="ps-eyebrow">ТРЕНИРОВКА ЗАВЕРШЕНА</span><h1>Итоги подборки</h1><p>Результат вашей самооценки</p></header><div class="ps-stats"><div><strong>' + known + '</strong><span>знаю и покажу</span></div><div><strong>' + again + '</strong><span>повторить</span></div><div><strong>' + unanswered + '</strong><span>без оценки</span></div></div><section class="ps-panel"><h2>Навыки в подборке</h2><div class="ps-summary-list">' + s.order.map((id, index) => '<div class="ps-summary-item"><span><small>№ ' + id + ' · ' + statusLabel(s.answers[id]) + '</small><strong lang="la">' + esc(skills.byId[id].latin) + '</strong></span><button type="button" class="btn btn--ghost btn--sm" data-ps="open-index" data-index="' + index + '">Открыть</button></div>').join('') + '</div><div class="ps-summary-actions"><button type="button" class="btn btn--primary" data-ps="setup">К настройкам</button><button type="button" class="btn btn--ghost" data-ps="resume-run">Вернуться к подборке</button></div></section>';
  }
  function jumpTop() { requestAnimationFrame(() => { const term = document.querySelector('.ps-term'); if (term) { term.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'auto' }); } }); }
  function syncSearch(view) {
    const q = search.trim().toLowerCase(); let visible = 0;
    view.querySelectorAll('[data-section]').forEach(section => {
      const nameMatch = q && section.dataset.sectionName.includes(q); let count = 0;
      section.querySelectorAll('[data-search]').forEach(item => { const ok = !q || nameMatch || item.dataset.search.includes(q); item.hidden = !ok; if (ok) count++; });
      section.hidden = count === 0; if (!count) return; visible++;
      const expanded = q ? true : openSections.has(section.dataset.section);
      section.querySelector('[data-section-toggle]').setAttribute('aria-expanded', String(expanded));
      section.querySelector('.ps-section__items').hidden = !expanded;
      section.querySelector('[data-section-count]').textContent = q && count < Number(section.dataset.total) ? count + ' из ' + section.dataset.total : skillCount(count);
    });
    const empty = view.querySelector('[data-no-results]'); if (empty) empty.hidden = visible > 0;
  }

  /* ---------- Вопросы и теория: конспект прямо под вопросом ---------- */
  const anchored = new Set();
  source.forEach(page => page.blocks.forEach(block => { if (block.type === 'heading' && block.anchor) anchored.add(block.anchor); }));
  function markButtons(id) {
    const v = game.state.questions[id];
    return '<div class="myo-rate" aria-label="Самооценка"><button type="button" data-myo-rate="' + id + '" data-value="known" aria-pressed="' + (v === 'known') + '">Знаю</button><button type="button" data-myo-rate="' + id + '" data-value="again" aria-pressed="' + (v === 'again') + '">Повторить</button></div>';
  }
  function statusHint(q) {
    return ({ 'heading-only': 'В источнике только заголовок', diagram: 'В источнике — схема', external: 'В источнике — отсылка к meduniver', partial: 'В источнике материал частичный' })[q.sourceStatus] || '';
  }
  // Собираем секции по вопросам: от заголовка-вопроса до следующего заголовка-вопроса.
  // Баннеры перед заголовком относим к следующему вопросу, чтобы «ТОПОГРАФИЯ И ФАСЦИИ» не терялась.
  function buildSourceSections() {
    const map = new Map();
    let cur = null;
    let pending = [];
    const flushPending = target => {
      if (pending.length && target != null) {
        if (!map.has(target)) map.set(target, []);
        map.get(target).push(...pending);
      }
      pending = [];
    };
    for (const page of source) {
      for (const block of page.blocks) {
        if (block.type === 'heading' && block.anchor) {
          // баннеры, накопившиеся перед этим заголовком — к нему
          flushPending(block.anchor);
          cur = block.anchor;
          if (!map.has(cur)) map.set(cur, []);
          map.get(cur).push(block);
        } else if (block.type === 'banner') {
          // откладываем баннер до следующего вопроса
          pending.push(block);
        } else {
          if (cur == null) {
            // контент до первого вопроса — пропускаем (обложка уже исключена)
            continue;
          }
          // если был отложенный баннер без последующего заголовка на той же странице,
          // а сейчас идёт обычный текст — баннер относится к текущему вопросу
          if (pending.length) {
            map.get(cur).push(...pending);
            pending = [];
          }
          map.get(cur).push(block);
        }
      }
    }
    // оставшиеся баннеры в конце — к последнему вопросу
    if (pending.length && cur != null) {
      map.get(cur).push(...pending);
    }
    return map;
  }
  const sourceSections = buildSourceSections();
  // heading вопроса внутри самого вопроса дублирует summary — не рендерим повторно
  function isOwnHeading(block, questionId) {
    return block.type === 'heading' && block.anchor === questionId;
  }
  function questionsView() {
    return '<section class="myo-panel"><div class="myo-title-row"><div><h2>Вопросы по миологии</h2></div></div><label class="myo-search"><span>Найти вопрос</span><input type="search" data-myo-question-search placeholder="Название или номер"></label><div class="myo-list">' + data.questions.map(q => {
      const blocks = sourceSections.get(q.id) || [];
      const inner = blocks.filter(b => !isOwnHeading(b, q.id));
      const sourceHtmlInline = inner.length
        ? inner.map(blockHtml).join('')
        : '<p class="muted">В конспекте для этого вопроса только заголовок.</p>';
      return '<details class="myo-question" data-question="' + q.id + '"><summary><span>№ ' + q.id + '</span> ' + esc(q.text) + '</summary><div class="myo-question-body">' + markButtons(q.id) + '</div>' + (statusHint(q) ? '<p class="myo-question-note">' + statusHint(q) + '</p>' : '') + '<div class="myo-question-source">' + sourceHtmlInline + '</div></details>';
    }).join('') + '</div><p data-myo-question-empty hidden>Ничего не найдено.</p></section>';
  }
  function blockHtml(block) {
    if (block.type === 'heading') return '<h3 class="myo-q-heading">' + esc(block.text) + '</h3>';
    if (block.type === 'banner') return '<h4 class="myo-banner">' + esc(block.text) + '</h4>';
    if (block.type === 'table') return '<div class="myo-table"><h4>' + esc(block.caption) + '</h4>' + block.rows.map(row => '<dl class="myo-table__row">' + row.map((cell, i) => cell ? '<div><dt>' + esc(block.headers[i] || '') + '</dt><dd>' + esc(cell) + '</dd></div>' : '').join('') + '</dl>').join('') + '</div>';
    if (block.type === 'figure') return '<figure class="myo-figure"><button type="button" class="myo-figure__btn" data-myo-zoom="' + esc(block.file) + '" data-myo-zoom-alt="' + esc(block.alt) + '" aria-label="Увеличить: ' + esc(block.alt) + '"><img src="' + esc(block.file) + '" alt="' + esc(block.alt) + '" loading="lazy" width="' + block.width + '" height="' + block.height + '"></button></figure>';
    return '<p>' + esc(block.text) + '</p>';
  }
  AT.views.myology = function (params) {
    const section = ['skills', 'questions'].includes(params.section) ? params.section : 'skills';
    const body = section === 'skills' ? (screen === 'run' ? runView() : screen === 'summary' ? summaryView() : setupView()) : questionsView();
    // Внутри объединённой страницы навыков шапку и отступы даёт общий каркас,
    // поэтому собственный заголовок показываем только на странице теории.
    // «Встроенный» режим включается только когда страницу рисует хаб навыков.
    const standalone = !(params.colloquium === '2' && params.embedded === '1');
    const html = '<div class="view myo-view' + (standalone ? '' : ' myo-view--embedded') + '">' +
      (section === 'questions' ? '<header class="myo-head"><span>АНАТОМИЯ / 2 КОЛЛОКВИУМ</span><h1>Теория</h1></header>' : (standalone ? '<header class="myo-head"><span>АНАТОМИЯ / 2 КОЛЛОКВИУМ</span><h1>Практические навыки</h1></header>' : '')) +
      body + '</div>';
    return { title: 'Миология · 2 коллоквиум', html, mount(root) {
      const view = root.querySelector('.myo-view');
      const warn = () => { if (game.storageFailed()) AT.ui.toast('Не удалось сохранить миологию на устройстве', 'warn'); };
      // Синхронизация пришла из облака или из другой вкладки — обновляем экран.
      const refresh = () => { if (!view.isConnected) return; if (game.adopt()) AT.rerender(); };
      const storageEvent = event => { if (!event.key || event.key === skills.SYNC_KEY) refresh(); };
      window.addEventListener('medzo-myology-updated', refresh);
      window.addEventListener('storage', storageEvent);
      if (AT.onCleanup) AT.onCleanup(() => { window.removeEventListener('medzo-myology-updated', refresh); window.removeEventListener('storage', storageEvent); });
      const closePicker = pickerEl => { if (pickerEl.dataset.picker === 'group') groupMenuOpen = false; pickerEl.querySelector('[data-picker-trigger]').setAttribute('aria-expanded', 'false'); pickerEl.querySelector('.ps-picker__menu').hidden = true; };
      const closeMenus = () => view.querySelectorAll('[data-picker]').forEach(closePicker);
      function syncOptions() {
        const state = game.state;
        view.querySelectorAll('[data-picker]').forEach(pickerEl => {
          const name = pickerEl.dataset.picker, value = state[name];
          const selected = Array.isArray(value) ? value : [String(value)];
          const entry = choices[name].find(([id]) => id === String(value)) || choices[name][0];
          const label = name === 'group' && selected.length > 1 ? 'Выбрано тем: ' + selected.length : entry[1];
          pickerEl.querySelector('[data-picker-trigger] span').textContent = label;
          pickerEl.querySelectorAll('[data-ps-option]').forEach(option => {
            const active = name === 'group' ? selected.includes(option.dataset.value) : option.dataset.value === entry[0];
            option.classList.toggle('is-selected', active); option.setAttribute('aria-pressed', String(active));
            option.querySelector('.ps-picker__check').textContent = active ? '✓' : '';
          });
        });
        const count = game.pool().length, available = view.querySelector('[data-ps-available]');
        if (available) { available.replaceChildren('Доступно: '); const strong = document.createElement('strong'); strong.textContent = count; available.append(strong); if (state.sequence === 'ordered' && state.limit && count > state.limit) available.append(' · первые ' + state.limit); }
        const startButton = view.querySelector('[data-ps="start"]'); if (startButton) startButton.disabled = !count;
      }
      // Совместимость со старыми ссылками #myology-q-14 — открыть вопрос
      if (section === 'questions') {
        const m = (location.hash || '').match(/myology-q-(\d+)/);
        if (m) {
          const details = view.querySelector('[data-question="' + Number(m[1]) + '"]');
          if (details) { details.open = true; setTimeout(() => details.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); }
        }
      }
      if (section === 'skills' && screen === 'setup') syncSearch(view);
      async function start(sectionId) {
        const s = game.state.session;
        if (s && !s.finished) { const ok = await AT.ui.confirmDialog({ title: 'Начать новую подборку?', text: 'Текущая подборка будет заменена. Уже выставленные оценки и избранное сохранятся.', confirm: 'Начать' }); if (!ok) return; }
        if (sectionId ? game.startSection(sectionId) : game.start()) { screen = 'run'; AT.rerender(); jumpTop(); warn(); }
      }
      function openMyoViewer(src, alt) {
        let dlg = document.getElementById('myoImageViewer');
        if (dlg) dlg.remove();
        dlg = document.createElement('dialog');
        dlg.id = 'myoImageViewer';
        dlg.className = 'myo-viewer';
        dlg.innerHTML = '<div class="myo-viewer__head"><span>' + esc(alt || 'Изображение') + '</span><button type="button" class="btn btn--ghost btn--sm" data-myo-viewer-close>Закрыть</button></div><img src="' + esc(src) + '" alt="' + esc(alt || '') + '"><p class="muted small" style="margin:10px 0 0">Нажмите вне картинки или Esc, чтобы закрыть</p>';
        dlg.addEventListener('click', e => {
          if (e.target === dlg || e.target.closest('[data-myo-viewer-close]')) dlg.close();
        });
        dlg.addEventListener('close', () => dlg.remove());
        document.body.appendChild(dlg);
        if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
        dlg.querySelector('[data-myo-viewer-close]')?.focus();
      }
      view.addEventListener('click', async event => {
        const zoom = event.target.closest('[data-myo-zoom]');
        if (zoom) {
          event.preventDefault();
          openMyoViewer(zoom.dataset.myoZoom, zoom.dataset.myoZoomAlt || zoom.getAttribute('aria-label') || '');
          return;
        }
        const trigger = event.target.closest('[data-picker-trigger]');
        if (trigger) { const pickerEl = trigger.closest('[data-picker]'), wasOpen = trigger.getAttribute('aria-expanded') === 'true'; closeMenus(); if (!wasOpen) { if (pickerEl.dataset.picker === 'group') groupMenuOpen = true; trigger.setAttribute('aria-expanded', 'true'); pickerEl.querySelector('.ps-picker__menu').hidden = false; } return; }
        const opt = event.target.closest('[data-ps-option]');
        if (opt) { event.stopPropagation(); const name = opt.dataset.psOption, values = { group: game.state.group, scope: game.state.scope, limit: game.state.limit, sequence: game.state.sequence }; if (name === 'group') { const id = opt.dataset.value, previous = Array.isArray(values.group) ? values.group : values.group === 'all' ? [] : [values.group]; values.group = id === 'all' ? 'all' : previous.includes(id) ? previous.filter(x => x !== id) : previous.concat(id); groupMenuOpen = true; } else values[name] = opt.dataset.value; game.setOptions(values.group, values.scope, values.limit, values.sequence); syncOptions(); const pickerEl = opt.closest('[data-picker]'); if (name !== 'group') { closePicker(pickerEl); pickerEl.querySelector('[data-picker-trigger]').focus({ preventScroll: true }); } warn(); return; }
        const toggle = event.target.closest('[data-section-toggle]');
        if (toggle) { const sectionEl = toggle.closest('[data-section]'), expanded = toggle.getAttribute('aria-expanded') === 'true'; toggle.setAttribute('aria-expanded', String(!expanded)); sectionEl.querySelector('.ps-section__items').hidden = expanded; if (expanded) openSections.delete(sectionEl.dataset.section); else openSections.add(sectionEl.dataset.section); return; }
        const rate = event.target.closest('[data-myo-rate]');
        if (rate) { const id = Number(rate.dataset.myoRate), value = rate.dataset.value, current = game.state.questions[id]; if (!game.markQuestion(id, current === value ? '' : value)) { AT.ui.toast('Не удалось сохранить оценку', 'warn'); return; } rate.closest('.myo-rate').querySelectorAll('[data-myo-rate]').forEach(button => button.setAttribute('aria-pressed', String(game.state.questions[id] === button.dataset.value))); return; }
        const btn = event.target.closest('[data-ps]'); if (!btn) return; const action = btn.dataset.ps, s = game.state.session;
        if (action === 'start' || action === 'section-start') { await start(action === 'section-start' ? btn.dataset.id : null); return; }
        if (action === 'reset') {
          const ok = await AT.ui.confirmDialog({ title: 'Сбросить оценки навыков?', text: 'Оценки и текущая подборка будут удалены. Избранное и заметки сохранятся; оценки вопросов и другие тренировки не изменятся.', confirm: 'Сбросить', danger: true }); if (!ok) return; game.reset();
        } else if (action === 'setup') screen = 'setup';
        else if (action === 'resume') screen = s && s.finished ? 'summary' : 'run';
        else if (action === 'resume-run') { game.resume(); screen = 'run'; }
        else if (action === 'open-index' && s) { game.resume(); game.navigate(Number(btn.dataset.index) - s.index); screen = 'run'; }
        else if (action === 'favorite') game.favorite(Number(btn.dataset.id));
        else if (action === 'hint') game.hint();
        else if (action === 'mark') game.mark(btn.dataset.value);
        else if (action === 'prev' || action === 'next') game.navigate(action === 'prev' ? -1 : 1);
        else if (action === 'finish') { game.finish(); screen = 'summary'; }
        else return;
        AT.rerender(); warn();
        if (['prev', 'next', 'resume-run', 'open-index', 'resume'].includes(action) && screen === 'run') jumpTop();
        else if (action === 'hint') root.querySelector('[data-ps-hint-result]')?.focus({ preventScroll: true });
        else if (action === 'mark' || action === 'favorite') root.querySelector(action === 'mark' ? '[data-ps="mark"][data-value="' + btn.dataset.value + '"]' : '[data-ps="favorite"]')?.focus({ preventScroll: true });
      });
      view.addEventListener('keydown', event => {
        const pickerEl = event.target.closest('[data-picker]'); if (!pickerEl) return; const trigger = pickerEl.querySelector('[data-picker-trigger]'), menu = pickerEl.querySelector('.ps-picker__menu');
        if (event.key === 'Escape' && !menu.hidden) { event.preventDefault(); closeMenus(); trigger.focus(); return; }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); if (menu.hidden) { closeMenus(); menu.hidden = false; trigger.setAttribute('aria-expanded', 'true'); }
        const opts = Array.from(menu.querySelectorAll('[data-ps-option]')); let i = opts.indexOf(document.activeElement);
        if (event.key === 'Home') i = 0; else if (event.key === 'End') i = opts.length - 1; else if (i < 0) i = opts.findIndex(o => o.getAttribute('aria-pressed') === 'true'); else i = (i + (event.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length;
        opts[Math.max(0, i)].focus();
      });
      view.addEventListener('focusout', event => { const pickerEl = event.target.closest('[data-picker]'); if (pickerEl) setTimeout(() => { if (view.isConnected && !pickerEl.contains(document.activeElement)) closePicker(pickerEl); }, 0); });
      const outside = event => { if (!view.contains(event.target) || !event.target.closest('[data-picker]')) closeMenus(); }; document.addEventListener('click', outside); if (AT.onCleanup) AT.onCleanup(() => document.removeEventListener('click', outside));
      const hotkeys = event => {
        if (!view.isConnected || section !== 'skills' || screen !== 'run' || event.defaultPrevented || event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || Array.from(document.querySelectorAll('dialog[open], [role="dialog"][aria-modal="true"]')).some(el => el.getClientRects().length)) return;
        const target = event.target; if (target instanceof Element && (target.isContentEditable || target.closest('input,textarea,select,[contenteditable],[data-picker]'))) return;
        let button;
        if (event.code === 'Digit1' || event.code === 'Numpad1' || event.key === '1') button = view.querySelector('[data-ps="mark"][data-value="known"]');
        else if (event.code === 'Digit2' || event.code === 'Numpad2' || event.key === '2') button = view.querySelector('[data-ps="mark"][data-value="again"]');
        else if (event.key.toLowerCase() === 'h' || event.code === 'KeyH') button = view.querySelector('[data-ps="hint"]');
        else if (event.key === 'ArrowLeft') button = view.querySelector('[data-ps="prev"]');
        else if (event.key === 'ArrowRight' || event.key === 'Enter') {
          if (event.key === 'Enter' && target instanceof Element && target.closest('button,a,summary,[role="button"]')) return;
          button = view.querySelector('[data-ps="next"], [data-ps="finish"]');
        }
        if (button && !button.disabled) { event.preventDefault(); button.click(); if (['mark', 'hint'].includes(button.dataset.ps)) root.querySelector('.ps-term')?.focus({ preventScroll: true }); }
      };
      document.addEventListener('keydown', hotkeys); if (AT.onCleanup) AT.onCleanup(() => document.removeEventListener('keydown', hotkeys));
      view.addEventListener('input', event => {
        const el = event.target;
        if (el.matches('[data-ps-note]')) { game.note(game.current()?.id, el.value); warn(); }
        if (el.matches('[data-ps-search]')) { search = el.value; syncSearch(view); }
        if (el.matches('[data-myo-question-search]')) { const q = el.value.trim().toLowerCase(); let count = 0; view.querySelectorAll('[data-question]').forEach(row => { const x = data.questions[Number(row.dataset.question) - 1]; row.hidden = !!q && !matches(x.id + ' ' + x.text, q); if (!row.hidden) count++; }); view.querySelector('[data-myo-question-empty]').hidden = !!count; }
      });
    }};
  };
})();
