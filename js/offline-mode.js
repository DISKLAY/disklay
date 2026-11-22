/* Офлайн-режим Medzo.
   Синхронизируемый с облаком прогресс в офлайне не читается и не сохраняется:
   приложение стартует с нуля и живёт вхолостую до перезагрузки. Как только сеть
   появляется, страница перезагружается и состояние приходит из облака (или из
   нетронутого локального хранилища), стирая офлайн-заметки.
   Сохраняются только локальные, несинхронизируемые данные: тема, настройки,
   выбранный коллоквиум, экскурсия, флаги Telegram. */
(function () {
  'use strict';

  var MODULES = ['1', '2', '3', '4', '5', '6', '7', 'credit-1', 'credit-2', 'stom-2', 'stom-3'];
  var SYNCABLE_KEYS = {};
  MODULES.forEach(function (id) { SYNCABLE_KEYS[id === '1' ? 'anatomy-colloquium-v1' : 'anatomy-colloquium-v1-' + id] = true; });
  ['histology-prototype-v1', 'histology-structures-v1', 'histology-theory-v1',
    'anatomy-practical-skills-1-v1', 'anatomy-colloquium-rewards-shared-v1',
    'anatomy-oral-1-v1', 'medzo-myology-practice-v1'
  ].forEach(function (key) { SYNCABLE_KEYS[key] = true; });

  var state = { active: typeof navigator !== 'undefined' ? !navigator.onLine : false };
  /* Была ли на этой странице офлайн-сессия: перезагружаемся только после реального офлайна,
     чтобы случайные события «online» не дёргали страницу у онлайн-пользователей. */
  var wasOffline = state.active;

  function syncable(key) { return Object.prototype.hasOwnProperty.call(SYNCABLE_KEYS, String(key)); }
  function inScope(selfObj) { try { return selfObj === window.localStorage; } catch (_) { return false; } }

  // В офлайне чтение синхронизируемого ключа → null (чистый старт),
  // запись и удаление → no-op (офлайн-заметки никуда не попадают).
  if (typeof Storage !== 'undefined' && Storage.prototype && !Storage.prototype.__medzoOfflineWrapped) {
    var proto = Storage.prototype;
    var origGet = proto.getItem, origSet = proto.setItem, origRemove = proto.removeItem;
    if (typeof origGet === 'function' && typeof origSet === 'function' && typeof origRemove === 'function') {
      proto.getItem = function (key) {
        if (state.active && inScope(this) && syncable(key)) return null;
        return origGet.call(this, key);
      };
      proto.setItem = function (key, value) {
        if (state.active && inScope(this) && syncable(key)) return;
        return origSet.call(this, key, value);
      };
      proto.removeItem = function (key) {
        if (state.active && inScope(this) && syncable(key)) return;
        return origRemove.call(this, key);
      };
      try { Object.defineProperty(proto, '__medzoOfflineWrapped', { value: true, configurable: false }); } catch (_) { /* не критично */ }
    }
  }

  var banner = null;
  function findBanner() {
    if (!banner && typeof document !== 'undefined' && typeof document.getElementById === 'function') banner = document.getElementById('offlineBanner');
    return banner;
  }
  function renderBanner() {
    var el = findBanner(); if (!el) return;
    el.hidden = !state.active;
  }

  window.addEventListener('offline', function () { state.active = true; wasOffline = true; renderBanner(); });
  window.addEventListener('online', function () {
    if (!wasOffline) { state.active = false; renderBanner(); return; }
    state.active = false;
    /* Офлайн-заметки стерты (записи подавлялись): перезагружаемся, чтобы
       прогресс пришёл из облака, а локальный — в том виде, в каком был до сети. */
    try { window.location.reload(); } catch (_) { /* navigator без reload */ }
  });

  window.MedzoOffline = {
    get active() { return state.active; },
    isSyncableKey: syncable,
    syncableKeys: function () { return Object.keys(SYNCABLE_KEYS); }
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderBanner);
    else renderBanner();
  }
})();
