/* Выбранный коллоквиум определяет данные до инициализации core.js. */
(function () {
  'use strict';
  const modules = {
    '1': { id: '1', semester: 1, name: 'Остеология и артросиндесмология', source: 'База теста 1 коллоквиум', examAvailable: true,
      questions: window.QUESTIONS, topics: window.TOPICS, answers: window.ANSWER_KEY },
    '2': Object.assign({ id: '2', semester: 1, name: 'Миология', source: 'Миология 2025 by students', examAvailable: false }, window.COLLOQUIUM_2),
    '3': Object.assign({ id: '3', semester: 2, name: 'Спланхнология', source: 'Спланхнология ЛФ ПФ by students от 28.03.26', examAvailable: false }, window.COLLOQUIUM_3),
    '4': Object.assign({ id: '4', semester: 2, name: 'Центральная нервная система', source: 'ЦНС by students от 10.05.2026', examAvailable: false }, window.COLLOQUIUM_4),
    '5': Object.assign({ id: '5', semester: 3, name: 'Эстезиология и черепные нервы', source: 'Эстезиология и черепные нервы — анат 7 коллок', keyNote: 'В вопросе № 15 второй вариант выделен зелёным, но не отмечен знаком «+»; он включён по подсветке.', examAvailable: false }, window.COLLOQUIUM_5),
    '6': Object.assign({ id: '6', semester: 3, name: 'Периферическая нервная система', source: 'ПНС (периферическая нервная система) — тест', keyMark: 'галочками', examAvailable: false }, window.COLLOQUIUM_6),
    '7': Object.assign({ id: '7', semester: 3, name: 'Сердечно-сосудистая система', source: 'rsmu_anat_sss_24_by_student.pdf', keyMark: 'подсветкой', examAvailable: false }, window.COLLOQUIUM_7),
    'credit-1': Object.assign({ id: 'credit-1', kind: 'credit', semester: 1, name: 'Остеология, артрология и миология', source: 'ОстеоАртроМио январь 2026 by students', examAvailable: false }, window.CREDIT_1),
    'credit-2': Object.assign({ id: 'credit-2', kind: 'credit', semester: 2, name: 'Спланхнология и ЦНС', source: 'Спланхнология и ЦНС зачёт by students от 21.05.26', examAvailable: false }, window.CREDIT_2),
    'stom-2': Object.assign({ id: 'stom-2', number: '2', faculty: 'Стоматологический факультет', name: 'Спланхнология', source: 'Модуль 2. Спланхология — стоматологический факультет', examAvailable: false, hasBaseKey: false, renumbered: true }, window.DENTAL_2),
    'stom-3': Object.assign({ id: 'stom-3', number: '3', faculty: 'Стоматологический факультет', name: 'Ангионеврология', source: 'Модуль 3. Ангионеврология — стоматологический факультет', examAvailable: false, hasBaseKey: false, renumbered: true }, window.DENTAL_3),
  };
  window.COLLOQUIUM_IDS = Object.keys(modules);
  window.COLLOQUIUM_MODULES = modules;
  let selected = '1';
  try { selected = localStorage.getItem('anatomy-colloquium-selected') || '1'; } catch (e) { /* первый коллоквиум */ }
  const module = modules[selected] || modules['1'];
  window.ACTIVE_COLLOQUIUM = module;
  window.QUESTIONS = module.questions;
  window.TOPICS = module.topics;
  window.ANSWER_KEY = module.answers;
})();
