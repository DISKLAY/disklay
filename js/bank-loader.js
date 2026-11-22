/* Выбранная база вопросов грузится синхронно, остальные — в фоне после load.
   Переключение базы всегда перезагружает страницу, поэтому синхронной достаточно одной. */
(function () {
  'use strict';
  var BANK_FILES = {
    '1': ['js/data/questions.js?v=20261116-pwa9', 'js/data/answers.js?v=20261116-pwa9', 'js/data/exam.js?v=20261116-pwa9'],
    '2': ['js/data/colloquium-2.js?v=20261116-pwa9'],
    '3': ['js/data/colloquium-3.js?v=20261116-pwa9'],
    '4': ['js/data/colloquium-4.js?v=20261116-pwa9'],
    '5': ['js/data/colloquium-5.js?v=20261116-pwa9'],
    '6': ['js/data/colloquium-6.js?v=20261116-pwa9'],
    '7': ['js/data/colloquium-7.js?v=20261116-pwa9'],
    'credit-1': ['js/data/credit-1.js?v=20261116-pwa9'],
    'credit-2': ['js/data/credit-2.js?v=20261116-pwa9'],
    'stom-2': ['js/data/dental-2.js?v=20261116-pwa9'],
    'stom-3': ['js/data/dental-3.js?v=20261116-pwa9']
  };
  window.MEDZO_BANK_FILES = BANK_FILES;
  var selected = '1';
  try { selected = localStorage.getItem('anatomy-colloquium-selected') || '1'; } catch (e) { /* первый коллоквиум */ }
  if (!BANK_FILES[selected]) selected = '1';
  window.MEDZO_SELECTED_BANK = selected;
  // Синхронная вставка: modules.js ниже по парсеру должен увидеть глобалы базы.
  document.write(BANK_FILES[selected].map(function (src) {
    return '<script src="' + src + '"><\/script>';
  }).join(''));

  // Остальные базы — последовательно в фоне; ошибка одной не блокирует остальные.
  var ensurePromise = null;
  function ensure() {
    if (ensurePromise) return ensurePromise;
    ensurePromise = new Promise(function (resolve) {
      var rest = [];
      Object.keys(BANK_FILES).forEach(function (id) {
        if (id !== selected) rest = rest.concat(BANK_FILES[id]);
      });
      if (!rest.length) return resolve();
      var index = 0;
      function next() {
        if (index >= rest.length) return resolve();
        var el = document.createElement('script');
        el.src = rest[index];
        index += 1;
        el.onload = next;
        el.onerror = next;
        document.head.appendChild(el);
      }
      next();
    }).then(function () {
      if (typeof window.registerColloquiumBanks === 'function') window.registerColloquiumBanks();
    });
    return ensurePromise;
  }
  window.MedzoBanks = { ensure: ensure };
  window.addEventListener('load', function () { setTimeout(ensure, 0); });
})();
