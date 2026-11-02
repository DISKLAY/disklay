/* Выбранный коллоквиум определяет данные до инициализации core.js. */
(function () {
  'use strict';
  const modules = {
    '1': { id: '1', semester: 1, name: 'Остеология и артросиндесмология', source: 'База теста 1 коллоквиум', keyNote: 'Вопросы с возможными расхождениями помечены. Восстановлены исходные отметки; официальный ключ отдельно не сверялся.', examAvailable: true,
      questionWarnings: {
        '41': 'В этом коллоквиуме ключ 1, 3, 5 соответствует трём ямкам плечевой кости. В одинаковом вопросе № 36 первого зачёта исходный ключ отличается и не содержит локтевую ямку. Официальный ключ не сверялся.',
        '119': 'В исходном ключе отмечены 1, 2, 4. По анатомическим источникам нижнюю стенку образуют верхняя челюсть, нёбная и скуловая кости (1, 3, 4). Сверьте требования официальной базы.',
        '121': 'В исходном ключе отмечен только вариант 1. По анатомическим источникам верхнюю стенку образуют клиновидная и лобная кости (1 и 5). Сверьте требования официальной базы.',
        '204': 'В исходном ключе отмечен вариант 4. Межкостная перепонка — фиброзное соединение; в классификации непрерывных соединений её также относят к синартрозам (вариант 2). Терминология классификаций различается; сверьте официальный ключ.'
      },
      questions: window.QUESTIONS, topics: window.TOPICS, answers: window.ANSWER_KEY },
    '2': Object.assign({ id: '2', semester: 1, name: 'Миология', source: 'Миология 2025 by students', examAvailable: false }, window.COLLOQUIUM_2),
    '3': Object.assign({ id: '3', semester: 2, name: 'Спланхнология', source: 'Спланхнология ЛФ ПФ by students от 28.03.26', examAvailable: false }, window.COLLOQUIUM_3),
    '4': Object.assign({ id: '4', semester: 2, name: 'Центральная нервная система', source: 'ЦНС by students от 10.05.2026', examAvailable: false }, window.COLLOQUIUM_4),
    '5': Object.assign({ id: '5', semester: 3, name: 'Эстезиология и черепные нервы', source: 'Эстезиология и черепные нервы — анат 7 коллок', keyNote: 'Вопросы с неоднозначной разметкой или формулировкой помечены.', questionWarnings: {
      '15': 'По замечанию к источнику вариант 2 выделен зелёным, но без знака «+». Он оставлен в исходном ключе по подсветке; сверить PDF и официальный ключ.',
      '18': 'В исходном ключе отмечены варианты 1 и 2; вариант 3 помечен как неверный. Ресничная часть входит в слепую часть сетчатки, поэтому трактовка формулировки может быть неоднозначной.'
    }, examAvailable: false }, window.COLLOQUIUM_5),
    '6': Object.assign({ id: '6', semester: 3, name: 'Периферическая нервная система', source: 'ПНС (периферическая нервная система) — тест', keyMark: 'галочками', examAvailable: false }, window.COLLOQUIUM_6),
    '7': Object.assign({ id: '7', semester: 3, name: 'Сердечно-сосудистая система', source: 'rsmu_anat_sss_24_by_student.pdf', keyMark: 'подсветкой', examAvailable: false }, window.COLLOQUIUM_7),
    'credit-1': Object.assign({ keyNote: 'В № 36 сохранён исходный ключ с возможной ошибкой.', questionWarnings: { '36': 'В исходном ключе зачёта отмечены только 3 и 5. Локтевая ямка (вариант 1) также расположена на дистальном конце плечевой кости; в коллоквиуме № 41 отмечены 1, 3, 5. Сверьте официальный ключ.' }, id: 'credit-1', kind: 'credit', semester: 1, name: 'Остеология, артрология и миология', source: 'ОстеоАртроМио январь 2026 by students', examAvailable: false }, window.CREDIT_1),
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
