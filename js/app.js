/* ============================================================================
   app.js — маршрутизация и запуск приложения
   ========================================================================== */
(function () {
  'use strict';

  const AT = window.AT;
  const ui = AT.ui;
  const root = document.getElementById('app');
  const nav = document.getElementById('mainNav');

  let cleanups = [];
  let currentRoute = { name: 'dashboard', params: {} };
  let lastRenderedHash = null;
  let lastRouteKey = null;

  AT.onCleanup = function (fn) {
    if (typeof fn === 'function') cleanups.push(fn);
  };

  function runCleanups() {
    cleanups.forEach((fn) => {
      try { fn(); } catch (e) { /* ignore */ }
    });
    cleanups = [];
  }

  function parseHash() {
    const hash = location.hash.replace(/^#/, '') || '/';
    const [path, query] = hash.split('?');
    const segments = path.split('/').filter(Boolean);
    const params = {};
    (query || '').split('&').filter(Boolean).forEach((pair) => {
      const [k, v] = pair.split('=');
      params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
    const name = segments[0] || 'dashboard';
    return { name, params };
  }

  const ROUTES = {
    dashboard: 'dashboard',
    train: 'trainSetup',
    exam: 'examSetup',
    run: 'run',
    summary: 'summary',
    mistakes: 'mistakes',
    portfolio: 'portfolio',
    stats: 'stats',
    rewards: 'rewards',
    dungeon: 'dungeon',
    key: 'key',
    settings: 'settings',
  };

  // Тяжёлые ресурсы подземелья не загружаются при обычном использовании тренажёра.
  let dungeonLoad = null, dungeonCss = null, dungeonReady = false;
  function loadDungeon() {
    if (dungeonLoad) return dungeonLoad;
    function resource(tag, url) {
      return new Promise((resolve, reject) => {
        const el = document.createElement(tag);
        if (tag === 'link') { el.rel = 'stylesheet'; el.href = url; }
        else { el.src = url; }
        el.onload = resolve;
        el.onerror = () => { el.remove(); reject(new Error('Не удалось загрузить ' + url)); };
        document.head.appendChild(el);
      });
    }
    if (!dungeonCss) dungeonCss = resource('link', 'css/dungeon.css?v=11').catch(err => { dungeonCss = null; throw err; });
    const css = dungeonCss;
    const script = (window.DungeonEngine ? Promise.resolve() : resource('script', 'js/dungeon.js?v=11'))
      .then(() => AT.views.dungeon ? undefined : resource('script', 'js/views-dungeon.js?v=11'));
    dungeonLoad = Promise.all([css, script]).then(() => { dungeonReady = true; }).catch(err => { dungeonLoad = null; throw err; });
    return dungeonLoad;
  }

  function render() {
    runCleanups();
    lastRenderedHash = location.hash;
    const route = parseHash();
    currentRoute = route;
    const viewName = ROUTES[route.name] || 'notFound';

    if (viewName === 'trainSetup' && (route.params.topic || route.params.scope === 'favorites')) {
      if (route.params.topic) AT.setup.train.topics = route.params.topic === 'all' ? ['all'] : [route.params.topic];
      if (route.params.scope === 'favorites') AT.setup.train.scope = 'favorites';
      history.replaceState(null, '', '#/train');
    }

    if (viewName === 'dungeon' && !dungeonReady) {
      root.innerHTML = '<div class="view"><div class="card card--pad"><h1>Подземелье</h1><p>Загружаем игру…</p></div></div>';
      updateNav(route.name);
      loadDungeon().then(() => {
        if (parseHash().name === 'dungeon') render();
      }).catch(err => {
        console.error(err);
        if (parseHash().name !== 'dungeon') return;
        root.innerHTML = '<div class="view"><div class="card card--pad"><h1>Не удалось загрузить игру</h1><p>Проверьте подключение и попробуйте ещё раз.</p><button class="btn btn--primary" id="dungeonRetry">Повторить</button></div></div>';
        root.querySelector('#dungeonRetry').addEventListener('click', render);
      });
      return;
    }

    const view = AT.views[viewName];
    let result;
    try {
      result = view ? view(route.params) : notFound();
    } catch (err) {
      console.error(err);
      result = errorView(err);
    }

    root.innerHTML = result.html;
    if (result.mount) {
      try {
        result.mount(root);
      } catch (err) {
        console.error(err);
      }
    }
    document.title = (result.title || 'Тренажёр') + ' · Анатомия — ' + (AT.colloquium.kind === 'credit' ? 'зачёт' : 'коллоквиум');
    updateNav(route.name);
    const routeKey = route.name + ':' + JSON.stringify(route.params);
    if (routeKey !== lastRouteKey) {
      window.scrollTo(0, 0);
      lastRouteKey = routeKey;
    }

    const viewEl = root.querySelector('.view');
    if (viewEl) viewEl.classList.add('is-entering');
  }

  function updateNav(name) {
    if (!nav) return;
    const session = AT.getState().session;
    const active = name === 'run' || name === 'summary' ? (session && session.mode === 'exam' ? 'exam' : 'train') : name;
    nav.querySelectorAll('[data-route]').forEach((link) => {
      const r = link.getAttribute('data-route');
      const isActive = r === active || (active === 'dashboard' && r === 'dashboard');
      link.classList.toggle('is-active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const sidebar = document.getElementById('courseSidebar');
    if (sidebar) sidebar.querySelectorAll('[data-sidebar-route]').forEach((link) => {
      const isActive = link.getAttribute('data-sidebar-route') === active;
      link.classList.toggle('is-active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function notFound() {
    return {
      title: 'Страница не найдена',
      html: '<div class="view">' + ui.emptyState('info', 'Такой страницы нет',
        'Возможно, ссылка устарела.', '<a class="btn btn--primary" href="#/">На главную</a>') + '</div>',
    };
  }

  function errorView(err) {
    return {
      title: 'Ошибка',
      html: '<div class="view">' + ui.emptyState('info', 'Что-то пошло не так',
        String(err && err.message ? err.message : err),
        '<a class="btn btn--primary" href="#/">На главную</a>') + '</div>',
    };
  }

  AT.rerender = render;
  AT.route = () => currentRoute.name;
  /** Переход без ожидания hashchange (и без двойной отрисовки). */
  AT.go = function (hash) {
    if (location.hash === hash) {
      render();
    } else {
      location.hash = hash;
      render();
    }
  };

  /* ------------------------------------------------------------- глобальные */

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action="toggle-theme"]');
    if (!el) return;
    const next = ui.toggleTheme();
    ui.toast(next === 'dark' ? 'Тёмная тема' : 'Светлая тема');
  });

  window.addEventListener('hashchange', () => {
    if (location.hash === lastRenderedHash) return;
    render();
  });

  const moduleSelect = document.getElementById('colloquiumSelect');
  if (moduleSelect) {
    moduleSelect.value = AT.colloquium.id;
    moduleSelect.addEventListener('change', () => {
      try {
        // Сохраняем незавершённую сессию до перезагрузки и переключения банка.
        AT.save(true);
        localStorage.setItem('anatomy-colloquium-selected', moduleSelect.value);
        location.hash = '#/';
        location.reload();
      } catch (e) {
        moduleSelect.value = AT.colloquium.id;
        ui.toast('Не удалось переключить раздел: проверьте доступ к хранилищу браузера', 'warn');
      }
    });
    const courseToggle = document.getElementById('courseToggle');
    const courseToggleCurrent = document.getElementById('courseToggleCurrent');
    const courseSidebarCurrent = document.getElementById('courseSidebarCurrent');
    const syncCourseToggle = () => {
      const option = moduleSelect.options[moduleSelect.selectedIndex];
      if (!option || !courseToggle || !courseToggleCurrent) return;
      courseToggleCurrent.textContent = option.textContent;
      if (courseSidebarCurrent) courseSidebarCurrent.textContent = 'Текущая база: ' + option.parentElement.label + ' · ' + option.textContent.replace(/^Стом\s*·\s*/, '');
      courseToggle.setAttribute('aria-label', 'Открыть меню. Текущая база: ' + option.parentElement.label + ', ' + option.textContent);
    };
    moduleSelect.addEventListener('change', syncCourseToggle);
    syncCourseToggle();
    window.initModulePicker(moduleSelect, document.getElementById('courseSidebarNav'));
    window.initCourseDrawer(document.getElementById('courseSidebar'), document.getElementById('courseToggle'), document.getElementById('courseClose'), document.getElementById('courseBackdrop'));
  }

  /* ---------------------------------------------------------------- запуск */

  if (AT.colloquium.kind === 'credit') {
    const examLink = nav.querySelector('[data-route="exam"]');
    if (examLink) examLink.textContent = 'Пробный зачёт';
    const sidebarExamLink = document.querySelector('[data-sidebar-route="exam"]');
    if (sidebarExamLink) sidebarExamLink.textContent = 'Пробный зачёт';
  }
  ui.applyTheme();
  AT.game.applyAppearance();
  render();

  // подсказка при первом визите
  try {
    if (!localStorage.getItem('anatomy-colloquium-hint')) {
      localStorage.setItem('anatomy-colloquium-hint', '1');
      setTimeout(() => {
        if (AT.keyApi.count() === 0) ui.toast('Ключ ответов пока не загружен — работает самопроверка', 'warn');
      }, 1200);
    }
  } catch (e) { /* ignore */ }
})();
