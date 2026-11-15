/* Практические навыки: одно представление для всех коллоквиумов.
   Интерфейс, клавиши и состояния одинаковы; различия приходят из описания
   предмета (см. js/skills-registry.js): заголовки, подписи и дополнительные
   вкладки «Вопросы и теория» / «Рисунки и источники». */
(function () {
  'use strict';
  const AT = window.AT, esc = AT.utils.esc;
  const countLabel = window.MedzoSkills.countLabel;
  // Хранилище общее, а канал синхронизации зависит от предмета: оценки миологии
  // уходят отдельным снимком, оценки первого коллоквиума — общим учебным.
  let store, syncChannel = 'study';
  try {
    const local = window.localStorage;
    store = {
      getItem: (key) => local.getItem(key),
      setItem: (key, value) => {
        local.setItem(key, value);
        if (!window.MedzoStudySync) return;
        if (syncChannel === 'myology' && window.MedzoStudySync.myologyChanged) window.MedzoStudySync.myologyChanged();
        else window.MedzoStudySync.changed();
      },
    };
  } catch (e) {
    store = { getItem() { return null; }, setItem() { throw e; } };
  }

  const openSections = new Set();
  const skillsView = {
    spec: null,
    game: null,
    screen: 'setup',
    search: '',
    groupMenuOpen: false,

    /** Подключает предмет к представлению: вызывается один раз при загрузке маршрута. */
    use(spec) {
      if (this.spec === spec) return;
      this.spec = spec;
      syncChannel = spec.sync || 'study';
      this.game = window.MedzoSkills.create(spec, store);
      this.screen = 'setup';
      this.search = '';
      openSections.clear();
      // После загрузки оценок из облака перечитываем зеркало миологии.
      if (!this.listening && window.MedzoStudySync) {
        this.listening = true;
        window.addEventListener('medzo-myology-updated', () => {
          if (this.game && this.game.reload && this.game.reload()) AT.rerender();
        });
      }
    },

    choices() {
      const labels = this.spec.labels;
      return {
        group: [['all', labels.allGroupsLabel], ...this.spec.groups.map((g) => [g.id, g.name])],
        scope: [['all', 'Все ' + this.spec.labels.unitPlural], ['unseen', 'Ещё не оценённые'], ['again', 'Требуют повторения'], ['favorites', 'Избранные']],
        limit: [['10', '10 ' + this.spec.labels.unitPlural], ['20', '20 ' + this.spec.labels.unitPlural], ['50', '50 ' + this.spec.labels.unitPlural], ['0', 'Все доступные']],
        sequence: [['random', 'Вперемешку'], ['ordered', 'По порядку']],
      };
    },

    picker(name, label, value, instance) {
      const entries = this.choices()[name];
      const selectedGroups = Array.isArray(value) ? value : [String(value)];
      const selected = entries.find((x) => x[0] === String(value)) || entries[0];
      const key = name + '-' + (instance || 'setup');
      const labelText = name === 'group' && selectedGroups.length > 1 ? 'Выбрано тем: ' + selectedGroups.length : selected[1];
      const opened = name === 'group' && this.groupMenuOpen;
      return '<div class="ps-picker" data-picker="' + name + '" data-picker-instance="' + (instance || 'setup') + '"><span class="ps-picker__label" id="ps-label-' + key + '">' + label + '</span><button type="button" class="ps-picker__trigger" data-picker-trigger aria-labelledby="ps-label-' + key + ' ps-value-' + key + '" aria-controls="ps-menu-' + key + '" aria-expanded="' + opened + '"><span id="ps-value-' + key + '">' + esc(labelText) + '</span><span class="ps-chevron" aria-hidden="true"></span></button><div class="ps-picker__menu" id="ps-menu-' + key + '" role="group" aria-labelledby="ps-label-' + key + '"' + (opened ? '' : ' hidden') + '>' + entries.map(([id, text]) => {
        const active = name === 'group' ? selectedGroups.includes(id) : id === selected[0];
        return '<button type="button" class="ps-picker__option' + (active ? ' is-selected' : '') + '" data-ps-option="' + name + '" data-value="' + esc(id) + '" aria-pressed="' + active + '"><span>' + esc(text) + '</span><span class="ps-picker__check" aria-hidden="true">' + (active ? '✓' : '') + '</span></button>';
      }).join('') + '</div></div>';
    },

    catalog() {
      const spec = this.spec, game = this.game, s = game.state;
      return '<section class="ps-catalog"><div class="ps-catalog__head"><div><span class="ps-eyebrow">' + esc(spec.labels.catalogEyebrow) + '</span><h2>' + esc(spec.labels.catalogTitle) + '</h2></div><span class="ps-count">' + spec.items.length + '</span></div><div class="ps-catalog__controls"><label class="ps-search"><span class="ps-search__icon" aria-hidden="true">⌕</span><input type="search" aria-label="Поиск по названию, номеру или разделу" data-ps-search value="' + esc(this.search) + '" placeholder="Найти ' + esc(spec.labels.unit) + ' или раздел"></label>' + this.picker('sequence', 'Порядок раздела', s.sequence, 'catalog') + '</div><div class="ps-sections">' + spec.sections.map((section) => {
        const items = spec.items.filter((item) => item.id >= section.from && item.id <= section.to);
        return '<section class="ps-section" data-section="' + esc(section.id) + '" data-section-name="' + esc(section.name.toLowerCase()) + '" data-total="' + items.length + '"><div class="ps-section__head"><button type="button" class="ps-section__toggle" data-section-toggle aria-expanded="' + openSections.has(section.id) + '" aria-controls="ps-section-' + esc(section.id) + '"><span class="ps-section__arrow" aria-hidden="true"></span><span class="ps-section__title">' + esc(section.name) + '<small data-section-count>' + countLabel(items.length, 'навык', 'навыка', 'навыков') + '</small></span></button><button type="button" class="ps-section__train" data-ps="section-start" data-id="' + esc(section.id) + '" aria-label="Тренировать весь раздел ' + esc(section.name) + '" title="Все навыки раздела">Тренировать <span aria-hidden="true">↗</span></button></div><div class="ps-section__items" id="ps-section-' + esc(section.id) + '"' + (openSections.has(section.id) ? '' : ' hidden') + '>' + items.map((item) => '<div class="ps-list-item" data-search="' + esc((item.id + ' ' + item.latin).toLowerCase()) + '"><span class="ps-item-number">' + item.id + '</span><strong lang="la">' + esc(item.latin) + '</strong></div>').join('') + '</div></section>';
      }).join('') + '</div><p class="ps-no-results" data-no-results hidden>Ничего не найдено.</p></section>';
    },

    setupView() {
      const spec = this.spec, game = this.game, s = game.state, session = s.session;
      const stats = Object.values(s.stats);
      const learned = stats.filter((x) => x.last === 'known').length, again = stats.filter((x) => x.last === 'again').length;
      const labels = spec.labels;
      const related = (labels.related || []).map((link) => '<a class="link" href="' + link.href + '">' + esc(link.label) + '</a>').join(' · ');
      let html = '<header class="ps-head"><span class="ps-eyebrow">' + esc(labels.eyebrow) + '</span><h1>' + esc(labels.title) + '</h1><p>' + esc(labels.subtitle) + (related ? ' · ' + related : '') + '</p></header>' +
        '<div class="ps-stats" aria-label="Ваш прогресс"><div><strong>' + learned + '</strong><span>знаю</span></div><div><strong>' + again + '</strong><span>повторить</span></div><div><strong>' + stats.length + '<em> / ' + spec.items.length + '</em></strong><span>оценено</span></div></div>';
      if (session) html += '<div class="ps-resume"><div><strong>' + (session.finished ? 'Последняя подборка' : 'Продолжить тренировку') + '</strong><p>Оценено ' + Object.keys(session.answers).length + ' из ' + session.order.length + '</p></div><button class="btn btn--primary" type="button" data-ps="resume">' + (session.finished ? 'Посмотреть итог' : 'Продолжить →') + '</button></div>';
      html += '<section class="ps-panel ps-builder"><div class="ps-builder__head"><div><span class="ps-eyebrow">НАСТРОЙКА</span><h2>Новая тренировка</h2></div><span class="ps-builder__icon" aria-hidden="true">✦</span></div><div class="ps-filters">' + this.picker('group', labels.groupLabel, s.group) + this.picker('scope', 'Подборка', s.scope) + this.picker('limit', 'Количество', s.limit) + this.picker('sequence', 'Порядок', s.sequence) + '</div>' +
        '<div class="ps-start"><p data-ps-available>Доступно: <strong>' + game.pool().length + '</strong>' + (s.sequence === 'ordered' && s.limit && game.pool().length > s.limit ? ' · первые ' + s.limit : '') + '</p><button type="button" class="btn btn--primary" data-ps="start"' + (!game.pool().length ? ' disabled' : '') + '>Начать тренировку <span aria-hidden="true">→</span></button></div></section>' + this.catalog() +
        '<details class="ps-data"><summary>О данных</summary><p>' + esc(labels.note) + '</p><button type="button" data-ps="reset">Сбросить оценки</button></details>';
      return html;
    },

    runView() {
      const spec = this.spec, game = this.game, s = game.state.session, item = game.current();
      if (!s || !item) { this.screen = 'setup'; return this.setupView(); }
      const status = s.answers[item.id], fav = !!game.state.favorites[item.id], showHint = !!s.hints[item.id];
      return '<div class="ps-run-top"><button type="button" class="ps-back" data-ps="setup">← К настройкам</button><span>' + esc(spec.labels.termLabel) + ' ' + (s.index + 1) + ' / ' + s.order.length + '</span></div>' +
        '<div class="ps-progress" role="progressbar" aria-label="Позиция в подборке" aria-valuemin="1" aria-valuemax="' + s.order.length + '" aria-valuenow="' + (s.index + 1) + '"><span style="width:' + ((s.index + 1) / s.order.length * 100) + '%"></span></div>' +
        '<article class="ps-card"><div class="ps-card-head"><span class="ps-eyebrow">' + esc(spec.labels.termLabel) + ' № ' + item.id + '</span><button class="ps-favorite' + (fav ? ' is-active' : '') + '" data-ps="favorite" data-id="' + item.id + '" aria-label="' + (fav ? 'Убрать из избранного' : 'Добавить в избранное') + '" aria-pressed="' + fav + '" type="button">' + (fav ? '★' : '☆') + '</button></div>' +
        '<h1 tabindex="-1" class="ps-term" lang="la">' + esc(item.latin) + '</h1>' + (s.index === 0 ? '<p class="ps-prompt">Переведите и покажите структуру, затем сверьте себя с атласом.</p>' : '') +
        '<p class="ps-prompt">Клавиатура: 1 — знаю, 2 — повторить, H — подсказка, ← / → — назад / далее, Enter — далее.</p>' +
        '<div class="ps-hint">' + (showHint ? '<strong tabindex="-1" data-ps-hint-result>Ориентир:</strong> ' + esc(item.hint) : '<button type="button" class="ps-hint__button" data-ps="hint"><span aria-hidden="true">✧</span> Подсказка</button>') + '</div>' +
        '<div class="ps-review"><h2>Как получилось?</h2><div class="ps-review-actions"><button type="button" class="btn ' + (status === 'known' ? 'btn--success' : 'btn--ghost') + '" data-ps="mark" data-value="known" aria-pressed="' + (status === 'known') + '">Знаю и покажу</button><button type="button" class="btn ' + (status === 'again' ? 'btn--danger' : 'btn--ghost') + '" data-ps="mark" data-value="again" aria-pressed="' + (status === 'again') + '">Повторить</button></div>' + (status ? '<p class="ps-status" role="status">' + statusLabel(status) + '</p>' : '') + '</div>' +
        '<details class="ps-notes"><summary>Моя заметка</summary><label for="ps-note">Запись после сверки</label><textarea id="ps-note" data-ps-note maxlength="2000" placeholder="Личная заметка…">' + esc(game.state.notes[item.id] || '') + '</textarea><small>Заметка сохраняется на устройстве.</small></details>' +
        '<div class="ps-pagination"><button type="button" class="btn btn--ghost" data-ps="prev"' + (s.index === 0 ? ' disabled' : '') + '>← Назад</button><button type="button" class="btn btn--primary" data-ps="' + (s.index === s.order.length - 1 ? 'finish' : 'next') + '">' + (s.index === s.order.length - 1 ? 'К итогам' : 'Далее →') + '</button></div></article>';
    },

    summaryView() {
      const spec = this.spec, game = this.game, s = game.state.session;
      if (!s) { this.screen = 'setup'; return this.setupView(); }
      const known = s.order.filter((id) => s.answers[id] === 'known').length, again = s.order.filter((id) => s.answers[id] === 'again').length, unanswered = s.order.length - known - again;
      return '<header class="ps-head"><span class="ps-eyebrow">ТРЕНИРОВКА ЗАВЕРШЕНА</span><h1>Итоги подборки</h1><p>Результат вашей самооценки</p></header><div class="ps-stats"><div><strong>' + known + '</strong><span>знаю и покажу</span></div><div><strong>' + again + '</strong><span>повторить</span></div><div><strong>' + unanswered + '</strong><span>без оценки</span></div></div><section class="ps-panel"><h2>Навыки в подборке</h2><div class="ps-summary-list">' + s.order.map((id, index) => '<div class="ps-summary-item"><span><small>№ ' + id + ' · ' + statusLabel(s.answers[id]) + '</small><strong lang="la">' + esc(spec.byId[id].latin) + '</strong></span><button type="button" class="btn btn--ghost btn--sm" data-ps="open-index" data-index="' + index + '">Открыть</button></div>').join('') + '</div><div class="ps-summary-actions"><button type="button" class="btn btn--primary" data-ps="setup">К настройкам</button><button type="button" class="btn btn--ghost" data-ps="resume-run">Вернуться к подборке</button></div></section>';
    },

    /** Дополнительные вкладки предмета (теория, рисунки) — тот же каркас ps-*. */
    extraTabs(section) {
      const tabs = this.spec.labels.extraTabs || [];
      if (!tabs.length) return '';
      return '<nav class="ps-tabs" aria-label="Разделы ' + esc(this.spec.labels.title) + '">' + tabs.map((tab) =>
        '<a href="' + tab.href + '?section=' + tab.id + '"' + (section === tab.id ? ' class="is-active" aria-current="page"' : '') + '>' + esc(tab.label) + '</a>').join('') + '</nav>';
    },
  };

  function statusLabel(status) {
    return status === 'known' ? 'Знаю и могу показать' : status === 'again' ? 'Повторить' : 'Не оценено';
  }

  function jumpTop() {
    requestAnimationFrame(() => {
      const term = document.querySelector('.ps-term');
      if (term) { term.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'auto' }); }
    });
  }

  /* --------------------------------------------------------------- маршруты */

  window.MedzoSkillsView = skillsView;
  // Маршрут один на все коллоквиумы: предмет выбирает js/app.js по имени маршрута.
  AT.views.skills = function (params) {
    const name = (AT.skillsSubject && AT.skillsSubject()) || 'anatomySkills';
    const spec = window.MedzoSkillsRegistry ? window.MedzoSkillsRegistry.get(name) : skillsView.spec;
    if (!spec) return { title: 'Практические навыки', html: '<div class="view"><div class="card card--pad"><h1>Практические навыки</h1><p>Загружаем список…</p></div></div>' };
    skillsView.use(spec);
    const registry = window.MedzoSkillsRegistry;
    const game = skillsView.game;
    const section = (params && params.section) || 'skills';
    const extras = registry.extras;
    const body = section === 'skills'
      ? (skillsView.screen === 'run' ? skillsView.runView() : skillsView.screen === 'summary' ? skillsView.summaryView() : skillsView.setupView())
      : (extras[section] ? extras[section]() : skillsView.setupView());
    const html = '<div class="view ps-view">' + skillsView.extraTabs(section) + body + '</div>';
    return {
      title: spec.labels.title,
      html,
      mount(root) {
        const view = root.querySelector('.ps-view');
        const warn = () => { if (game.storageFailed()) AT.ui.toast('Не удалось сохранить навыки на устройстве', 'warn'); };
        const closePicker = (picker) => { if (picker.dataset.picker === 'group') skillsView.groupMenuOpen = false; picker.querySelector('[data-picker-trigger]').setAttribute('aria-expanded', 'false'); picker.querySelector('.ps-picker__menu').hidden = true; };
        const closeMenus = () => view.querySelectorAll('[data-picker]').forEach(closePicker);
        // Обновляем только фильтры: позиция прокрутки, фокус, открытые меню и справочник остаются.
        function syncOptions() {
          const state = game.state;
          view.querySelectorAll('[data-picker]').forEach((picker) => {
            const name = picker.dataset.picker, value = state[name];
            const selected = Array.isArray(value) ? value : [String(value)];
            const choices = skillsView.choices()[name];
            const entry = choices.find(([id]) => id === String(value)) || choices[0];
            const label = name === 'group' && selected.length > 1 ? 'Выбрано тем: ' + selected.length : entry[1];
            picker.querySelector('[data-picker-trigger] span').textContent = label;
            picker.querySelectorAll('[data-ps-option]').forEach((option) => {
              const active = name === 'group' ? selected.includes(option.dataset.value) : option.dataset.value === entry[0];
              option.classList.toggle('is-selected', active); option.setAttribute('aria-pressed', String(active));
              option.querySelector('.ps-picker__check').textContent = active ? '✓' : '';
            });
          });
          const count = game.pool().length, available = view.querySelector('[data-ps-available]');
          if (available) {
            available.replaceChildren('Доступно: ');
            const strong = document.createElement('strong'); strong.textContent = count; available.append(strong);
            if (state.sequence === 'ordered' && state.limit && count > state.limit) available.append(' · первые ' + state.limit);
          }
          const startButton = view.querySelector('[data-ps="start"]');
          if (startButton) startButton.disabled = !count;
        }

        function syncSearch(scope) {
          const q = skillsView.search.trim().toLowerCase();
          let visible = 0;
          scope.querySelectorAll('[data-section]').forEach((sectionEl) => {
            const nameMatch = q && sectionEl.dataset.sectionName.includes(q);
            let count = 0;
            sectionEl.querySelectorAll('[data-search]').forEach((item) => {
              const matches = !q || nameMatch || item.dataset.search.includes(q);
              item.hidden = !matches;
              if (matches) count++;
            });
            sectionEl.hidden = count === 0;
            if (!count) return;
            visible++;
            const expanded = q ? true : openSections.has(sectionEl.dataset.section);
            sectionEl.querySelector('[data-section-toggle]').setAttribute('aria-expanded', String(expanded));
            sectionEl.querySelector('.ps-section__items').hidden = !expanded;
            sectionEl.querySelector('[data-section-count]').textContent = q && count < Number(sectionEl.dataset.total) ? count + ' из ' + sectionEl.dataset.total : countLabel(count, 'навык', 'навыка', 'навыков');
          });
          const empty = scope.querySelector('[data-no-results]');
          if (empty) empty.hidden = visible > 0;
        }

        async function start(sectionId) {
          const s = game.state.session;
          if (s && !s.finished) {
            const ok = await AT.ui.confirmDialog({ title: 'Начать новую подборку?', text: 'Текущая подборка будет заменена. Уже выставленные оценки и избранное сохранятся.', confirm: 'Начать' });
            if (!ok) return;
          }
          if (sectionId ? game.startSection(sectionId) : game.start()) { skillsView.screen = 'run'; AT.rerender(); jumpTop(); warn(); }
        }

        view.addEventListener('click', async (e) => {
          const trigger = e.target.closest('[data-picker-trigger]');
          if (trigger) {
            const picker = trigger.closest('[data-picker]'), wasOpen = trigger.getAttribute('aria-expanded') === 'true';
            closeMenus();
            if (!wasOpen) {
              if (picker.dataset.picker === 'group') skillsView.groupMenuOpen = true;
              trigger.setAttribute('aria-expanded', 'true');
              picker.querySelector('.ps-picker__menu').hidden = false;
            }
            return;
          }
          const opt = e.target.closest('[data-ps-option]');
          if (opt) {
            e.stopPropagation();
            const name = opt.dataset.psOption;
            const values = { group: game.state.group, scope: game.state.scope, limit: game.state.limit, sequence: game.state.sequence };
            if (name === 'group') {
              const id = opt.dataset.value;
              const previous = Array.isArray(values.group) ? values.group : values.group === 'all' ? [] : [values.group];
              values.group = id === 'all' ? 'all' : previous.includes(id) ? previous.filter((x) => x !== id) : previous.concat(id);
              skillsView.groupMenuOpen = true;
            } else values[name] = opt.dataset.value;
            game.setOptions(values.group, values.scope, values.limit, values.sequence);
            syncOptions();
            const picker = opt.closest('[data-picker]');
            if (name !== 'group') { closePicker(picker); picker.querySelector('[data-picker-trigger]').focus({ preventScroll: true }); }
            warn();
            return;
          }
          const toggle = e.target.closest('[data-section-toggle]');
          if (toggle) {
            const sectionEl = toggle.closest('[data-section]'), expanded = toggle.getAttribute('aria-expanded') === 'true';
            toggle.setAttribute('aria-expanded', String(!expanded));
            sectionEl.querySelector('.ps-section__items').hidden = expanded;
            if (expanded) openSections.delete(sectionEl.dataset.section); else openSections.add(sectionEl.dataset.section);
            return;
          }
          const btn = e.target.closest('[data-ps]');
          if (!btn) return;
          const a = btn.dataset.ps, s = game.state.session;
          if (a === 'start' || a === 'section-start') { await start(a === 'section-start' ? btn.dataset.id : null); return; }
          if (a === 'reset') {
            const ok = await AT.ui.confirmDialog({ title: 'Сбросить оценки навыков?', text: 'Оценки и текущая подборка будут удалены. Избранное и заметки сохранятся; другие тренировки не изменятся.', confirm: 'Сбросить', danger: true });
            if (!ok) return;
            game.reset();
          } else if (a === 'setup') skillsView.screen = 'setup';
          else if (a === 'resume') skillsView.screen = s && s.finished ? 'summary' : 'run';
          else if (a === 'resume-run') { game.resume(); skillsView.screen = 'run'; }
          else if (a === 'open-index' && s) { game.resume(); game.navigate(Number(btn.dataset.index) - s.index); skillsView.screen = 'run'; }
          else if (a === 'favorite') game.favorite(Number(btn.dataset.id));
          else if (a === 'hint') game.hint();
          else if (a === 'mark') game.mark(btn.dataset.value);
          else if (a === 'prev' || a === 'next') game.navigate(a === 'prev' ? -1 : 1);
          else if (a === 'finish') { game.finish(); skillsView.screen = 'summary'; }
          else return;
          AT.rerender(); warn();
          if (['prev', 'next', 'resume-run', 'open-index', 'resume'].includes(a) && skillsView.screen === 'run') jumpTop();
          else if (a === 'hint') root.querySelector('[data-ps-hint-result]')?.focus({ preventScroll: true });
          else if (a === 'mark' || a === 'favorite') root.querySelector(a === 'mark' ? '[data-ps="mark"][data-value="' + btn.dataset.value + '"]' : '[data-ps="favorite"]')?.focus({ preventScroll: true });
        });

        view.addEventListener('keydown', (e) => {
          const picker = e.target.closest('[data-picker]');
          if (!picker) return;
          const trigger = picker.querySelector('[data-picker-trigger]'), menu = picker.querySelector('.ps-picker__menu');
          if (e.key === 'Escape' && !menu.hidden) { e.preventDefault(); closeMenus(); trigger.focus(); return; }
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
          e.preventDefault();
          if (menu.hidden) { closeMenus(); menu.hidden = false; trigger.setAttribute('aria-expanded', 'true'); }
          const opts = Array.from(menu.querySelectorAll('[data-ps-option]'));
          let i = opts.indexOf(document.activeElement);
          if (e.key === 'Home') i = 0;
          else if (e.key === 'End') i = opts.length - 1;
          else if (i < 0) i = opts.findIndex((o) => o.getAttribute('aria-pressed') === 'true');
          else i = (i + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length;
          opts[Math.max(0, i)].focus();
        });
        view.addEventListener('focusout', (e) => {
          const picker = e.target.closest('[data-picker]');
          if (picker) setTimeout(() => { if (view.isConnected && !picker.contains(document.activeElement)) closePicker(picker); }, 0);
        });
        const outside = (e) => { if (!view.contains(e.target) || !e.target.closest('[data-picker]')) closeMenus(); };
        document.addEventListener('click', outside);
        if (AT.onCleanup) AT.onCleanup(() => document.removeEventListener('click', outside));
        // Горячие клавиши работают только на экране подборки и не мешают диалогам и полям ввода.
        const hotkeys = (e) => {
          if (!view.isConnected || skillsView.screen !== 'run' || e.defaultPrevented || e.repeat || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || Array.from(document.querySelectorAll('dialog[open], [role="dialog"][aria-modal="true"]')).some((el) => el.getClientRects().length)) return;
          const target = e.target;
          if (target instanceof Element && (target.isContentEditable || target.closest('input,textarea,select,[contenteditable],[data-picker]'))) return;
          let button;
          if (e.code === 'Digit1' || e.code === 'Numpad1' || e.key === '1') button = view.querySelector('[data-ps="mark"][data-value="known"]');
          else if (e.code === 'Digit2' || e.code === 'Numpad2' || e.key === '2') button = view.querySelector('[data-ps="mark"][data-value="again"]');
          else if (e.code === 'KeyH') button = view.querySelector('[data-ps="hint"]');
          else if (e.key === 'ArrowLeft') button = view.querySelector('[data-ps="prev"]');
          else if (e.key === 'ArrowRight' || e.key === 'Enter') {
            if (e.key === 'Enter' && target instanceof Element && target.closest('button,a,summary,[role="button"]')) return;
            button = view.querySelector('[data-ps="next"], [data-ps="finish"]');
          }
          if (button && !button.disabled) {
            e.preventDefault();
            button.click();
            if (['mark', 'hint'].includes(button.dataset.ps)) root.querySelector('.ps-term')?.focus({ preventScroll: true });
          }
        };
        document.addEventListener('keydown', hotkeys);
        if (AT.onCleanup) AT.onCleanup(() => document.removeEventListener('keydown', hotkeys));
        view.addEventListener('input', (e) => {
          if (e.target.matches('[data-ps-note]')) { game.note(game.current()?.id, e.target.value); warn(); }
          if (e.target.matches('[data-ps-search]')) { skillsView.search = e.target.value; syncSearch(view); }
        });
        if (section === 'skills' && skillsView.screen === 'setup') syncSearch(view);

        /* ------------------------------------ вкладки предмета: теория и источники */
        if (section === 'questions' || section === 'sources') {
          const key = registry.myologyKey;
          const readSaved = () => { try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { return {}; } };
          const writeSaved = (mutate) => {
            try {
              const saved = readSaved();
              mutate(saved);
              localStorage.setItem(key, JSON.stringify(saved));
              if (window.MedzoStudySync && window.MedzoStudySync.myologyChanged) window.MedzoStudySync.myologyChanged();
              return true;
            } catch (e) { AT.ui.toast('Не удалось сохранить оценку на устройстве', 'warn'); return false; }
          };
          view.addEventListener('input', (e) => {
            const el = e.target;
            if (el.matches('[data-ps-qsearch]')) {
              const q = el.value.trim().toLowerCase();
              let count = 0;
              view.querySelectorAll('[data-ps-question]').forEach((row) => {
                const item = window.MedzoMyologyData.questions[Number(row.dataset.psQuestion) - 1];
                row.hidden = !!q && !registry.matchWords(item.id + ' ' + item.text, q);
                if (!row.hidden) count++;
              });
              const empty = view.querySelector('[data-ps-qempty]');
              if (empty) empty.hidden = !!count;
            }
            if (el.matches('[data-ps-ssearch]')) {
              const q = el.value.trim().toLowerCase();
              let count = 0;
              view.querySelectorAll('[data-ps-source]').forEach((row) => {
                const pages = window.MedzoMyologyData.variantPages[Number(row.dataset.variant) - 1];
                const page = pages[Number(row.dataset.page) - 1];
                row.hidden = !!q && !registry.matchWords(page.page + ' ' + page.text, q);
                if (!row.hidden) count++;
              });
              view.querySelectorAll('[data-ps-source-group]').forEach((group) => { group.hidden = !group.querySelector('[data-ps-source]:not([hidden])'); });
              const empty = view.querySelector('[data-ps-sempty]');
              if (empty) empty.hidden = !!count;
            }
          });
          view.addEventListener('click', (e) => {
            const mark = e.target.closest('[data-ps-qmark]');
            if (!mark) return;
            const id = Number(mark.dataset.id), value = mark.dataset.psQmark;
            writeSaved((saved) => {
              if (!saved.questions || typeof saved.questions !== 'object') saved.questions = {};
              if (saved.questions[id] === value) delete saved.questions[id]; else saved.questions[id] = value;
            });
            AT.rerender();
          });
          // Картинка страницы грузится лениво (loading="lazy"), поэтому при
          // раскрытии достаточно вернуть фокус на заголовок страницы.
          view.addEventListener('toggle', (event) => {
            const el = event.target;
            if (!el.matches || !el.matches('[data-ps-source]') || !el.open) return;
            const head = el.querySelector('summary');
            if (head) head.setAttribute('aria-expanded', 'true');
          }, true);
        }
      },
    };
  };
})();
