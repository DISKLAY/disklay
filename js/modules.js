/* Выбранный коллоквиум определяет данные до инициализации core.js.
   Выбранная база грузится синхронно (js/bank-loader.js), остальные — в фоне;
   registerColloquiumBanks() подключает базы, подгруженные позже. */
(function () {
  'use strict';
  const builders = {
    '1': () => (window.QUESTIONS && window.TOPICS && window.ANSWER_KEY ? { id: '1', semester: 1, name: 'Остеология и артросиндесмология', source: 'База теста 1 коллоквиум', keyNote: 'Вопросы с возможными расхождениями помечены. Восстановлены исходные отметки; официальный ключ отдельно не сверялся.', examAvailable: true,
      questionWarnings: {
        '41': 'В этом коллоквиуме ключ 1, 3, 5 соответствует трём ямкам плечевой кости. В одинаковом вопросе № 36 первого зачёта исходный ключ отличается и не содержит локтевую ямку. Официальный ключ не сверялся.',
        '204': 'В исходном ключе отмечен вариант 4. Межкостная перепонка — фиброзное соединение; в классификации непрерывных соединений её также относят к синартрозам (вариант 2). Терминология классификаций различается; сверьте официальный ключ.'
      },
      questions: window.QUESTIONS, topics: window.TOPICS, answers: window.ANSWER_KEY } : null),
    '2': () => (window.COLLOQUIUM_2 ? Object.assign({ id: '2', semester: 1, name: 'Миология', source: 'Миология 2025 by students', examAvailable: false }, window.COLLOQUIUM_2) : null),
    '3': () => (window.COLLOQUIUM_3 ? Object.assign({ id: '3', semester: 2, name: 'Спланхнология', source: 'Спланхнология ЛФ ПФ by students от 28.03.26', examAvailable: false }, window.COLLOQUIUM_3) : null),
    '4': () => (window.COLLOQUIUM_4 ? Object.assign({ id: '4', semester: 2, name: 'Центральная нервная система', source: 'ЦНС by students от 10.05.2026', examAvailable: false }, window.COLLOQUIUM_4) : null),
    '5': () => (window.COLLOQUIUM_5 ? Object.assign({ id: '5', semester: 3, name: 'Эстезиология и черепные нервы', source: 'Эстезиология и черепные нервы — анат 7 коллок', keyNote: 'Вопросы с неоднозначной разметкой или формулировкой помечены.', questionWarnings: {
      '15': 'По замечанию к источнику вариант 2 выделен зелёным, но без знака «+». Он оставлен в исходном ключе по подсветке; сверить PDF и официальный ключ.',
      '18': 'В исходном ключе отмечены варианты 1 и 2; вариант 3 помечен как неверный. Ресничная часть входит в слепую часть сетчатки, поэтому трактовка формулировки может быть неоднозначной.'
    }, examAvailable: false }, window.COLLOQUIUM_5) : null),
    '6': () => (window.COLLOQUIUM_6 ? Object.assign({ id: '6', semester: 3, name: 'Периферическая нервная система', source: 'ПНС (периферическая нервная система) — тест', keyMark: 'галочками', examAvailable: false }, window.COLLOQUIUM_6) : null),
    '7': () => (window.COLLOQUIUM_7 ? Object.assign({ id: '7', semester: 3, name: 'Сердечно-сосудистая система', source: 'rsmu_anat_sss_24_by_student.pdf', keyMark: 'подсветкой', examAvailable: false }, window.COLLOQUIUM_7) : null),
    'credit-1': () => (window.CREDIT_1 ? Object.assign({ keyNote: 'В № 36 сохранён исходный ключ с возможной ошибкой.', questionWarnings: { '36': 'В исходном ключе зачёта отмечены только 3 и 5. Локтевая ямка (вариант 1) также расположена на дистальном конце плечевой кости; в коллоквиуме № 41 отмечены 1, 3, 5. Сверьте официальный ключ.' }, id: 'credit-1', kind: 'credit', semester: 1, name: 'Остеология, артрология и миология', source: 'ОстеоАртроМио январь 2026 by students', examAvailable: false }, window.CREDIT_1) : null),
    'credit-2': () => (window.CREDIT_2 ? Object.assign({ id: 'credit-2', kind: 'credit', semester: 2, name: 'Спланхнология и ЦНС', source: 'Спланхнология и ЦНС зачёт by students от 21.05.26', examAvailable: false }, window.CREDIT_2) : null),
    'stom-2': () => (window.DENTAL_2 ? Object.assign({ id: 'stom-2', number: '2', faculty: 'Стоматологический факультет', name: 'Спланхнология', source: 'Модуль 2. Спланхология — стоматологический факультет', examAvailable: false, hasBaseKey: false, renumbered: true }, window.DENTAL_2) : null),
    'stom-3': () => (window.DENTAL_3 ? Object.assign({ id: 'stom-3', number: '3', faculty: 'Стоматологический факультет', name: 'Ангионеврология', source: 'Модуль 3. Ангионеврология — стоматологический факультет', examAvailable: false, hasBaseKey: false, renumbered: true }, window.DENTAL_3) : null),
  };
  const ORDER = ['1', '2', '3', '4', '5', '6', '7', 'credit-1', 'credit-2', 'stom-2', 'stom-3'];
  const modules = {};
  let activeModule = null;
  // Подключает все базы, чьи глобалы уже загружены. Возвращает true, если появились новые.
  function registerColloquiumBanks() {
    let changed = false;
    for (const id of ORDER) {
      if (modules[id]) continue;
      try { const built = builders[id](); if (built) { modules[id] = built; changed = true; } } catch (_) { /* повреждённый глобал — пропускаем базу */ }
    }
    window.COLLOQUIUM_IDS = Object.keys(modules);
    window.COLLOQUIUM_MODULES = modules;
    /* Базовые файлы банка 1 переопределяют window.QUESTIONS/ANSWER_KEY —
       возвращаем глобалы активной базы, чтобы поздние читатели не спутали банки. */
    if (activeModule) {
      window.QUESTIONS = activeModule.questions;
      window.TOPICS = activeModule.topics;
      window.ANSWER_KEY = activeModule.answers;
    }
    return changed;
  }
  registerColloquiumBanks();
  window.registerColloquiumBanks = registerColloquiumBanks;

  let selected = '1';
  try { selected = localStorage.getItem('anatomy-colloquium-selected') || '1'; } catch (e) { /* первый коллоквиум */ }
  const module = modules[selected] || modules['1'] || (ORDER.map(id => modules[id]).find(Boolean)) || null;
  activeModule = module;
  window.ACTIVE_COLLOQUIUM = module;
  window.QUESTIONS = module && module.questions;
  window.TOPICS = module && module.topics;
  window.ANSWER_KEY = module && module.answers;
})();
