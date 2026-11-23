/* Режим разработчика: платформенная аналитика (все пользователи) + редактор гистологии. */
(function () {
  'use strict';
  const AT = window.AT;
  if (!AT) return;

  function esc(s) { return AT.utils.esc(s); }
  function icon(name) { return AT.ui && AT.ui.icon ? AT.ui.icon(name) : ''; }

  function isDev() {
    const ids = window.MEDZO_DEV_IDS || ['7381851473'];
    const sync = window.MedzoStudySync;
    if (sync && typeof sync.isDev === 'function') return sync.isDev();
    try {
      const raw = localStorage.getItem('medzo-study-sync-session-v1');
      if (!raw) return false;
      const data = JSON.parse(raw);
      return data && ids.map(String).includes(String(data.userId));
    } catch (_) { return false; }
  }

  function fmt(n) { return Number.isFinite(n) ? n.toLocaleString('ru-RU') : '—'; }

  function overviewCards(o) {
    if (!o) return '<p class="muted">Нет данных. Нажмите «Обновить».</p>';
    const rows = [
      ['Всего аккаунтов с облаком', o.total_users],
      ['В рейтинге (opt-in)', o.leaderboard_total],
      ['С фото', o.photos_total],
      ['Актив 24 ч', o.active_24h],
      ['Актив 7 дней', o.active_7d],
      ['Актив 30 дней', o.active_30d],
    ];
    return '<div class="stat-grid">' + rows.map(([label, val]) =>
      '<div class="card card--pad"><div class="card__title">' + esc(label) + '</div><strong style="font-size:1.4rem">' + fmt(val) + '</strong></div>'
    ).join('') + '</div>';
  }

  function leaderRow(row, i, withMeta){
    const name = row.display_name ? esc(row.display_name) : (row.user_id ? esc('id:'+String(row.user_id).slice(0,6)+'…') : 'Участник');
    const score = fmt(row.score);
    const badge = row.in_leaderboard===false ? ' <span class="badge badge--muted">не в рейтинге</span>' : (row.in_leaderboard? ' <span class="badge badge--ok">в рейтинге</span>' : '');
    const updated = withMeta && row.updated_at ? '<small class="muted"> · '+new Date(row.updated_at).toLocaleString('ru-RU')+'</small>' : '';
    return '<li><span class="leaderboard__place">' + (i + 1) + '</span>' +
      (row.photo ? '<img class="leaderboard__avatar" alt="" src="data:image/jpeg;base64,' + row.photo + '">' : '') +
      '<strong>' + name + badge + '</strong>' +
      '<span class="leaderboard__score">' + score + '</span>'+updated+'</li>';
  }

  function leaderTable(leaders, withMeta){
    if (!leaders || !leaders.length) return '<p class="muted">Рейтинг пуст.</p>';
    return '<ol class="leaderboard__list">' + leaders.slice(0, 500).map((row,i)=> leaderRow(row,i,withMeta)).join('') + '</ol>';
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

    html += '<section class="card card--pad" data-dev-leaders><h2 class="card__title">Все пользователи по очкам</h2>' +
      '<p class="muted small">Полный рейтинг из снимков — очки всех аккаунтов, не только тех кто в opt-in рейтинге. Фото — только с согласия.</p>' +
      '<div style="display:flex;gap:8px;margin:8px 0;"><label style="flex:1;"><input type="search" class="input" placeholder="Поиск по имени или id" data-dev-search></label><label><input type="checkbox" data-dev-only-leaderboard> Только в рейтинге</label></div>' +
      '<div data-dev-leaders-list>Загрузка…</div>' +
      '<p class="muted small" data-dev-status role="status"></p></section>';

    html += '<section class="card card--pad" data-dev-leaders-optin><h2 class="card__title">Рейтинг opt-in (топ-100)</h2>' +
      '<p class="muted small">Тот же что видят обычные пользователи.</p>' +
      '<div data-dev-optin-list>Загрузка…</div></section>';

    html += '<section class="card card--pad" id="histoEditorSection"><h2 class="card__title">Редактор меток гистологии</h2>' +
      '<p class="muted small">Выберите препарат, перетащите метку, правьте название/алиасы. Сохранение — в браузере (localStorage), экспорт — JSON для коммита.</p>' +
      '<div data-histo-editor>Загрузка редактора…</div>' +
      '<p class="muted small">Данные лежат в <code>js/histology.js</code> + <code>js/histology-*.js</code>. Правки из браузера применяются после перезагрузки; для публикации закоммитьте экспорт.</p></section>';

    html += '</div>';
    return {
      title: 'Панель разработчика',
      html,
      mount(root) {
        const sync = window.MedzoStudySync;
        const statsBox = root.querySelector('[data-dev-stats]');
        const meta = root.querySelector('[data-dev-meta]');
        const leadersBox = root.querySelector('[data-dev-leaders-list]');
        const optinBox = root.querySelector('[data-dev-optin-list]');
        const status = root.querySelector('[data-dev-status]');
        const search = root.querySelector('[data-dev-search]');
        const onlyCb = root.querySelector('[data-dev-only-leaderboard]');

        function render(){
          if(!sync) return;
          const overview = sync.getDevOverview ? sync.getDevOverview() : null;
          const leaders = sync.getDevAllRatings ? sync.getDevAllRatings() : (sync.getDevLeaders? sync.getDevLeaders(): []);
          const optin = sync.getDevLeaders ? sync.getDevLeaders() : [];
          const st = sync.getDevStatus ? sync.getDevStatus() : '';
          if(statsBox) statsBox.innerHTML = sync.isDevLoading ? '<p class="muted">Загружаем…</p>' : overviewCards(overview);
          if(meta && overview) meta.textContent = 'Обновлено: ' + new Date().toLocaleString('ru-RU') + ' · Всего с очками: ' + (leaders.length || 0);
          // фильтр
          let filtered = leaders;
          const q = (search?.value||'').trim().toLowerCase();
          if(q) filtered = filtered.filter(r=> (r.display_name && r.display_name.toLowerCase().includes(q)) || (r.user_id && String(r.user_id).toLowerCase().includes(q)) );
          if(onlyCb?.checked) filtered = filtered.filter(r=> r.in_leaderboard);
          if(leadersBox) leadersBox.innerHTML = sync.isDevLoading ? '<p class="muted">Загружаем…</p>' : leaderTable(filtered, true);
          if(optinBox) optinBox.innerHTML = sync.isDevLoading ? '<p class="muted">Загружаем…</p>' : leaderTable(optin, false);
          if(status) status.textContent = st || '';
        }

        const interval = setInterval(render, 1000);
        render();
        if(sync && sync.loadDevStats) sync.loadDevStats();

        root.addEventListener('click', (e)=>{
          const btn=e.target.closest('[data-action]');
          if(btn && btn.dataset.action==='dev-refresh' && sync && sync.loadDevStats) sync.loadDevStats(true);
        });
        if(search) search.addEventListener('input', render);
        if(onlyCb) onlyCb.addEventListener('change', render);

        // монтируем редактор
        const editorHost=root.querySelector('[data-histo-editor]');
        if(editorHost){
          // гистология может быть не загружена — попробуем подтянуть
          function tryMount(){
            if(window.HistologyEditor){
              window.HistologyEditor.mount(editorHost);
            } else {
              editorHost.textContent='Редактор не загружен. Откройте гистологию один раз, затем вернитесь.';
            }
          }
          // если прототип ещё не готов, попробуем после загрузки
          if(!window.HistologyPrototype){
            // попробуем динамически загрузить гистологию
            if(window.AT && AT.loadHistology) AT.loadHistology && AT.loadHistology().then(tryMount).catch(tryMount);
            else tryMount();
          } else tryMount();
        }

        if(AT.onCleanup) AT.onCleanup(()=> clearInterval(interval));
      }
    };
  };
})();
