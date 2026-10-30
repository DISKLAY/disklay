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
    stats: 'stats',
    rewards: 'rewards',
    key: 'key',
    settings: 'settings',
  };

  function render() {
    runCleanups();
    lastRenderedHash = location.hash;
    const route = parseHash();
    currentRoute = route;
    const viewName = ROUTES[route.name] || 'notFound';

    if (viewName === 'trainSetup' && route.params.topic) {
      AT.setup.train.topics = route.params.topic === 'all' ? ['all'] : [route.params.topic];
      history.replaceState(null, '', '#/train');
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
    const active = name === 'run' || name === 'summary' ? 'train' : name;
    nav.querySelectorAll('[data-route]').forEach((link) => {
      const r = link.getAttribute('data-route');
      const isActive = r === active || (active === 'dashboard' && r === 'dashboard');
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
    window.initModulePicker(moduleSelect, document.getElementById('modulePicker'), document.getElementById('courseSidebar'), document.getElementById('courseSidebarNav'));
  }

  /* ---------------------------------------------------------------- запуск */

  if (AT.colloquium.kind === 'credit') {
    const examLink = nav.querySelector('[data-route="exam"]');
    if (examLink) examLink.textContent = 'Пробный зачёт';
  }
  ui.applyTheme();
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
