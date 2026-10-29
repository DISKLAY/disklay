/* Выбранный коллоквиум определяет данные до инициализации core.js. */
(function () {
  'use strict';
  const modules = {
    '1': { id: '1', name: 'Остеология и артросиндесмология', source: 'База теста 1 коллоквиум', examAvailable: true,
      questions: window.QUESTIONS, topics: window.TOPICS, answers: window.ANSWER_KEY },
    '2': Object.assign({ id: '2', name: 'Миология', source: 'Миология 2025 by students', examAvailable: false }, window.COLLOQUIUM_2),
    '3': Object.assign({ id: '3', name: 'Спланхнология', source: 'Спланхнология ЛФ ПФ by students от 28.03.26', examAvailable: false }, window.COLLOQUIUM_3),
    'stom-2': Object.assign({ id: 'stom-2', number: '2', faculty: 'Стоматологический факультет', name: 'Спланхнология', source: 'Модуль 2. Спланхология — стоматологический факультет', examAvailable: false, hasBaseKey: false, renumbered: true }, window.DENTAL_2),
    'stom-3': Object.assign({ id: 'stom-3', number: '3', faculty: 'Стоматологический факультет', name: 'Ангионеврология', source: 'Модуль 3. Ангионеврология — стоматологический факультет', examAvailable: false, hasBaseKey: false, renumbered: true }, window.DENTAL_3),
  };
  let selected = '1';
  try { selected = localStorage.getItem('anatomy-colloquium-selected') || '1'; } catch (e) { /* первый коллоквиум */ }
  const module = modules[selected] || modules['1'];
  window.ACTIVE_COLLOQUIUM = module;
  window.QUESTIONS = module.questions;
  window.TOPICS = module.topics;
  window.ANSWER_KEY = module.answers;
})();
