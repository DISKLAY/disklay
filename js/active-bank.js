/* Активная база грузится синхронно, остальные — по требованию.
   Файл стоит сразу после js/bank-loader.js и до js/modules.js: core.js читает
   window.QUESTIONS на старте, поэтому к этому моменту активная база уже на месте. */
(function () {
  'use strict';
  const VERSION = (window.MedzoBanks && window.MedzoBanks.VERSION) || '20261115';
  let selected = '1';
  try { selected = localStorage.getItem('anatomy-colloquium-selected') || '1'; } catch (e) { /* первый коллоквиум */ }
  const files = (window.MedzoBanks && window.MedzoBanks.FILES[selected]) || ['js/data/questions.js', 'js/data/answers.js'];
  const GLOBAL = {
    '1': 'QUESTIONS', '2': 'COLLOQUIUM_2', '3': 'COLLOQUIUM_3', '4': 'COLLOQUIUM_4',
    '5': 'COLLOQUIUM_5', '6': 'COLLOQUIUM_6', '7': 'COLLOQUIUM_7',
    'credit-1': 'CREDIT_1', 'credit-2': 'CREDIT_2', 'stom-2': 'DENTAL_2', 'stom-3': 'DENTAL_3',
  };
  const loaded = () => {
    const value = window[GLOBAL[selected]];
    return selected === '1' ? Array.isArray(value) && value.length > 0 : !!(value && value.questions);
  };
  // Во время разбора страницы document.write вставляет скрипт синхронно, поэтому
  // core.js ниже уже видит данные. Вне разбора так нельзя — тогда базу догрузит
  // js/app.js (у него есть отдельный путь для незагруженной базы).
  const parsing = document.readyState === 'loading';
  const inject = (file) => {
    if (parsing) document.write('<script src="' + file + '?v=' + VERSION + '"><\/script>');
  };
  for (const file of files) {
    if (loaded()) break;
    inject(file);
  }
  window.MEDZO_ACTIVE_BANK = selected;
  // Если база не нашлась (например, файл ещё не добавлен), страница не должна падать.
  if (!loaded() && selected !== '1') {
    console.warn('База ' + selected + ' не загрузилась, открываем первый коллоквиум');
    window.MEDZO_ACTIVE_BANK = '1';
    inject('js/data/questions.js');
    inject('js/data/answers.js');
    try { localStorage.setItem('anatomy-colloquium-selected', '1'); } catch (e) { /* без сохранения */ }
  }
})();
