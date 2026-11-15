/* Выбранный коллоквиум определяет данные до инициализации core.js.
   Базы грузятся лениво (см. js/bank-loader.js): метаданные модуля доступны всегда,
   а вопросы, темы и ключ читаются через геттеры из глобальных объектов.
   Пока база не загружена, геттер возвращает undefined — вызывающий код это учитывает. */
(function () {
  'use strict';

  // Откуда у каждой базы берутся вопросы, темы и ключ.
  const SOURCES = {
    '1': { object: () => window.QUESTIONS, answers: () => window.ANSWER_KEY },
    '2': { object: () => window.COLLOQUIUM_2 },
    '3': { object: () => window.COLLOQUIUM_3 },
    '4': { object: () => window.COLLOQUIUM_4 },
    '5': { object: () => window.COLLOQUIUM_5 },
    '6': { object: () => window.COLLOQUIUM_6 },
    '7': { object: () => window.COLLOQUIUM_7 },
    'credit-1': { object: () => window.CREDIT_1 },
    'credit-2': { object: () => window.CREDIT_2 },
    'stom-2': { object: () => window.DENTAL_2 },
    'stom-3': { object: () => window.DENTAL_3 },
  };

  // Данные базы в общем виде { questions, topics, answers } или undefined.
  function bankData(id) {
    const source = SOURCES[id];
    const value = source.object();
    if (!value) return undefined;
    if (Array.isArray(value)) return { questions: value, topics: window.TOPICS, answers: source.answers ? source.answers() : undefined };
    return value;
  }
  // Object.assign копирует значения, а нам нужны живые геттеры: база может
  // догрузиться позже, и модуль должен сразу её увидеть.
  function attachData(module, id) {
    ['questions', 'topics', 'answers'].forEach((field) => {
      Object.defineProperty(module, field, {
        enumerable: true,
        configurable: true,
        get() { const data = bankData(id); return data && data[field]; },
      });
    });
    return module;
  }

  const modules = {
    '1': attachData({ id: '1', semester: 1, name: 'Остеология и артросиндесмология', source: 'База теста 1 коллоквиум', keyNote: 'Вопросы с возможными расхождениями помечены. Восстановлены исходные отметки; официальный ключ отдельно не сверялся.', examAvailable: true,
      questionWarnings: {
        '41': 'В этом коллоквиуме ключ 1, 3, 5 соответствует трём ямкам плечевой кости. В одинаковом вопросе № 36 первого зачёта исходный ключ отличается и не содержит локтевую ямку. Официальный ключ не сверялся.',
        '119': 'В исходном ключе отмечены 1, 2, 4. По анатомическим источникам нижнюю стенку образуют верхняя челюсть, нёбная и скуловая кости (1, 3, 4). Сверьте требования официальной базы.',
        '121': 'В исходном ключе отмечен только вариант 1. По анатомическим источникам верхнюю стенку образуют клиновидная и лобная кости (1 и 5). Сверьте требования официальной базы.',
        '204': 'В исходном ключе отмечен вариант 4. Межкостная перепонка — фиброзное соединение; в классификации непрерывных соединений её также относят к синартрозам (вариант 2). Терминология классификаций различается; сверьте официальный ключ.'
      } }, '1'),
    '2': attachData({ id: '2', semester: 1, name: 'Миология', source: 'Миология 2025 by students', examAvailable: false }, '2'),
    '3': attachData({ id: '3', semester: 2, name: 'Спланхнология', source: 'Спланхнология ЛФ ПФ by students от 28.03.26', examAvailable: false }, '3'),
    '4': attachData({ id: '4', semester: 2, name: 'Центральная нервная система', source: 'ЦНС by students от 10.05.2026', examAvailable: false }, '4'),
    '5': attachData({ id: '5', semester: 3, name: 'Эстезиология и черепные нервы', source: 'Эстезиология и черепные нервы — анат 7 коллок', keyNote: 'Вопросы с неоднозначной разметкой или формулировкой помечены.', questionWarnings: {
      '15': 'По замечанию к источнику вариант 2 выделен зелёным, но без знака «+». Он оставлен в исходном ключе по подсветке; сверить PDF и официальный ключ.',
      '18': 'В исходном ключе отмечены варианты 1 и 2; вариант 3 помечен как неверный. Ресничная часть входит в слепую часть сетчатки, поэтому трактовка формулировки может быть неоднозначной.'
    }, examAvailable: false }, '5'),
    '6': attachData({ id: '6', semester: 3, name: 'Периферическая нервная система', source: 'ПНС (периферическая нервная система) — тест', keyMark: 'галочками', examAvailable: false }, '6'),
    '7': attachData({ id: '7', semester: 3, name: 'Сердечно-сосудистая система', source: 'rsmu_anat_sss_24_by_student.pdf', keyMark: 'подсветкой', examAvailable: false }, '7'),
    'credit-1': attachData({ keyNote: 'В № 36 сохранён исходный ключ с возможной ошибкой.', questionWarnings: { '36': 'В исходном ключе зачёта отмечены только 3 и 5. Локтевая ямка (вариант 1) также расположена на дистальном конце плечевой кости; в коллоквиуме № 41 отмечены 1, 3, 5. Сверьте официальный ключ.' }, id: 'credit-1', kind: 'credit', semester: 1, name: 'Остеология, артрология и миология', source: 'ОстеоАртроМио январь 2026 by students', examAvailable: false }, 'credit-1'),
    'credit-2': attachData({ id: 'credit-2', kind: 'credit', semester: 2, name: 'Спланхнология и ЦНС', source: 'Спланхнология и ЦНС зачёт by students от 21.05.26', examAvailable: false }, 'credit-2'),
    'stom-2': attachData({ id: 'stom-2', number: '2', faculty: 'Стоматологический факультет', name: 'Спланхнология', source: 'Модуль 2. Спланхология — стоматологический факультет', examAvailable: false, hasBaseKey: false, renumbered: true }, 'stom-2'),
    'stom-3': attachData({ id: 'stom-3', number: '3', faculty: 'Стоматологический факультет', name: 'Ангионеврология', source: 'Модуль 3. Ангионеврология — стоматологический факультет', examAvailable: false, hasBaseKey: false, renumbered: true }, 'stom-3'),
  };
  /* Разделы коллоквиума: по ним строится навигация и меню на главной.
     Пока раздел не готов, у модуля нет навыков — ссылка не показывается,
     но место в навигации уже предусмотрено для всех коллоквиумов. */
  function sectionsFor(id) {
    const module = modules[id];
    const sections = [
      { route: 'tests', label: 'Базы', href: '#/tests', key: 'tests' },
      { route: 'train', label: 'Тренировка', href: '#/train', key: 'train' },
    ];
    if (module.examAvailable) sections.push({ route: 'exam', label: module.kind === 'credit' ? 'Пробный зачёт' : 'Экзамен', href: '#/exam', key: 'exam' });
    if (id === '1') {
      sections.push({ route: 'anatomy-oral', section: 'notes', label: 'Теория', href: '#/anatomy-oral?section=notes', key: 'minutes' });
      sections.push({ route: 'anatomy-skills', label: 'Практические навыки', href: '#/anatomy-skills', key: 'skills' });
    }
    if (id === '2') {
      sections.push({ route: 'myology', section: 'questions', label: 'Теория', href: '#/myology?section=questions', key: 'questions' });
      sections.push({ route: 'myology', section: 'skills', label: 'Практические навыки', href: '#/myology?section=skills', key: 'skills' });
    }
    sections.push({ route: 'mistakes', label: 'Ошибки', href: '#/mistakes', key: 'mistakes' });
    return sections;
  }
  Object.keys(modules).forEach((id) => { modules[id].sections = sectionsFor(id); });
  window.COLLOQUIUM_SECTIONS = (id) => (modules[modules[id] ? id : '1'] || {}).sections || [];
  window.COLLOQUIUM_IDS = Object.keys(modules);
  window.COLLOQUIUM_MODULES = modules;

  // Какую базу открыть, уже решил js/active-bank.js — он же её и загрузил.
  let selected = window.MEDZO_ACTIVE_BANK;
  if (!selected) {
    selected = '1';
    try { selected = localStorage.getItem('anatomy-colloquium-selected') || '1'; } catch (e) { /* первый коллоквиум */ }
  }
  if (!modules[selected]) selected = '1';
  const module = modules[selected];
  window.ACTIVE_COLLOQUIUM = module;
  // Совместимость со старым кодом: window.QUESTIONS и др. — значения активной базы.
  window.QUESTIONS = module.questions;
  window.TOPICS = module.topics;
  window.ANSWER_KEY = module.answers;
  window.MEDZO_ACTIVE_BANK = selected;
})();
