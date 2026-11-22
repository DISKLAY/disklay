/* Режим разработчика: платформенная аналитика + заготовка редактора гистологии. */
(function () {
  'use strict';
  const AT = window.AT;
  if (!AT) return;

  function esc(s) { return AT.utils.esc(s); }
  function icon(name) { return AT.ui && AT.ui.icon ? AT.ui.icon(name) : ''; }

  function isDev() {
    const ids = window.MEDZO_DEV_IDS || ['7381851473'];
    const sync = window.MedzoStudySync;
    // Клиентская проверка — окончательная проверка на сервере.
    if (sync && typeof sync.isDev === 'function') return sync.isDev();
    try {
      const raw = localStorage.getItem('medzo-study-sync-session-v1');
      if (!raw) return false;
      const data = JSON.parse(raw);
      return data && ids.map(String).includes(String(data.userId));
    } catch (_) { return false; }
  }

  function fmt(n) {
    return Number.isFinite(n) ? n.toLocaleString('ru-RU') : '—';
  }

  function overviewCards(o) {
    if (!o) return '<p class="muted">Нет данных. Нажмите «Обновить».</p>';
    const rows = [
      ['Всего аккаунтов с облаком', o.total_users],
      ['В рейтинге', o.leaderboard_total],
      ['С фото', o.photos_total],
      ['Актив 24 ч', o.active_24h],
      ['Актив 7 дней', o.active_7d],
      ['Актив 30 дней', o.active_30d],
    ];
    return '<div class="stat-grid">' + rows.map(([label, val]) =>
      '<div class="card card--pad"><div class="card__title">' + esc(label) + '</div><strong style="font-size:1.4rem">' + fmt(val) + '</strong></div>'
    ).join('') + '</div>';
  }

  function leaderTable(leaders) {
    if (!leaders || !leaders.length) return '<p class="muted">Рейтинг пуст.</p>';
    return '<ol class="leaderboard__list">' + leaders.slice(0, 100).map((row, i) =>
      '<li><span class="leaderboard__place">' + (i + 1) + '</span>' +
      (row.photo ? '<img class="leaderboard__avatar" alt="" src="data:image/jpeg;base64,' + row.photo + '">' : '') +
      '<strong>' + esc(row.display_name || 'Участник') + '</strong>' +
      '<span class="leaderboard__score">' + fmt(row.score) + '</span></li>'
    ).join('') + '</ol>';
  }

  AT.views.dev = function () {
    if (!isDev()) {
      return {
        title: 'Режим разработчика',
        html: '<div class="view view--narrow"><div class="page-head"><h1>Режим разработчика</h1><p>Доступ только для указанных Telegram-аккаунтов.</p></div><div class="card card--pad"><p class="muted">Войдите через Telegram с разрешённым аккаунтом, чтобы увидеть панель.</p><a class="btn btn--ghost" href="#/profile">В профиль</a></div></div>',
        mount() {}
      };
    }

    let html = '<div class="view">';
    html += '<div class="page-head"><h1>Режим разработчика</h1><p>Платформенная аналитика и инструменты. Видно только вам.</p></div>';

    html += '<section class="card card--pad" data-dev-overview><h2 class="card__title">Актив платформы</h2>' +
      '<p class="muted small">Данные из облака: medzo_study_sync, leaderboard, фото. Обновляется по кнопке.</p>' +
      '<div data-dev-stats>Загрузка…</div>' +
      '<p class="muted small" data-dev-meta></p>' +
      '<div class="card__actions"><button class="btn btn--primary" data-action="dev-refresh">' + icon('refresh') + ' Обновить</button><a class="btn btn--ghost" href="#/stats">К рейтингу</a></div>' +
      '</section>';

    html += '<section class="card card--pad" data-dev-leaders><h2 class="card__title">Рейтинг — топ-100</h2>' +
      '<p class="muted small">Тот же расчёт, что в общем рейтинге (сумма очков анатомии из снимков).</p>' +
      '<div data-dev-leaders-list>Загрузка…</div>' +
      '<p class="muted small" data-dev-status role="status"></p></section>';

    html += '<section class="card card--pad"><h2 class="card__title">Редактор меток гистологии</h2>' +
      '<p class="muted small">Заготовка: здесь будет редактирование подписей, координат точек и правильных ответов для режима «по точкам».</p>' +
      '<div class="card__actions"><button class="btn btn--ghost" data-action="dev-histo-open">Открыть редактор (скоро)</button>' +
      '<a class="btn btn--ghost" href="#/histology?section=setup">К гистологии</a></div>' +
      '<p class="muted small">Сейчас данные гистологии лежат в <code>js/histology-*.js</code> и <code>js/histology-practice-data.js</code>. Редактор получит чтение/запись через защищённый эндпоинт.</p></section>';

    html += '</div>';
    return {
      title: 'Панель разработчика',
      html,
      mount(root) {
        const sync = window.MedzoStudySync;
        const statsBox = root.querySelector('[data-dev-stats]');
        const meta = root.querySelector('[data-dev-meta]');
        const leadersBox = root.querySelector('[data-dev-leaders-list]');
        const status = root.querySelector('[data-dev-status]');

        function render() {
          if (!sync) return;
          const overview = sync.getDevOverview ? sync.getDevOverview() : null;
          const leaders = sync.getDevLeaders ? sync.getDevLeaders() : [];
          const st = sync.getDevStatus ? sync.getDevStatus() : '';
          if (statsBox) statsBox.innerHTML = sync.isDevLoading ? '<p class="muted">Загружаем…</p>' : overviewCards(overview);
          if (meta && overview) meta.textContent = 'Обновлено: ' + new Date().toLocaleString('ru-RU');
          if (leadersBox) leadersBox.innerHTML = sync.isDevLoading ? '<p class="muted">Загружаем…</p>' : leaderTable(leaders.length ? leaders : overview && overview.leaders ? overview.leaders : leaders);
          if (status) status.textContent = st || '';
        }

        // Подписываемся на обновления sync
        const onSync = () => render();
        // MedzoStudySync использует единый listener; добавляем свой через onCleanup обёртку
        let stop = null;
        if (AT.onCleanup) {
          const prevCleanup = AT.onCleanup;
          // Не ломаем существующий механизм — просто слушаем изменения через интервал опроса
        }
        // Простой polling + слушатель события
        const interval = setInterval(render, 1000);
        render();
        if (sync && sync.loadDevStats) sync.loadDevStats();

        root.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-action]');
          if (!btn) return;
          if (btn.dataset.action === 'dev-refresh' && sync && sync.loadDevStats) {
            sync.loadDevStats(true);
          }
          if (btn.dataset.action === 'dev-histo-open') {
            if (AT.ui && AT.ui.toast) AT.ui.toast('Редактор откроется в следующем обновлении — подготовлю форму для меток');
            else alert('Редактор откроется в следующем обновлении');
          }
        });

        if (AT.onCleanup) AT.onCleanup(() => { clearInterval(interval); });
      }
    };
  };
})();
