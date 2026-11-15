/* Реестр практических навыков по коллоквиумам.
   Навигация строится по нему, поэтому новый коллоквиум со навыками достаточно
   описать здесь: маршрут, данные и подписи. Пока данных нет, раздел не
   показывается — пустых ссылок в интерфейсе не появляется. */
(function () {
  'use strict';

  // Описание предмета. data() вызывается при открытии раздела: файлы данных
  // подключаются лениво в js/views-skills.js и js/app.js.
  const SUBJECTS = {
    anatomySkills: {
      route: 'anatomy-skills',
      colloquium: '1',
      sync: 'study',
      data: () => window.AnatomySkillsData,
      labels: {
        eyebrow: 'АНАТОМИЯ / 1 КОЛЛОКВИУМ',
        title: 'Практические навыки',
        subtitle: 'Переведите термин и найдите структуру в атласе или на препарате.',
        termLabel: 'НАВЫК',
        unit: 'навык',
        unitPlural: 'навыков',
      },
    },
    myologySkills: {
      route: 'myology',
      colloquium: '2',
      sync: 'myology',
      data: () => window.MedzoMyologyData,
      // Совместимость: оценки навыков продолжают уходить отдельным снимком миологии,
      // который уже проверен сервером и старыми клиентами.
      mirror: { key: 'medzo-myology-practice-v1' },
      labels: {
        eyebrow: 'АНАТОМИЯ / 2 КОЛЛОКВИУМ',
        title: 'Миология · практические навыки',
        subtitle: 'Переведите название мышцы и покажите её на препарате.',
        termLabel: 'НАВЫК',
        unit: 'навык',
        unitPlural: 'навыков',
        note: 'Навыки из присланного списка (222 пункта); формулировки и нумерация сохранены как в источнике. Оценки сохраняются в этом браузере и синхронизируются отдельно при входе в аккаунт. Самооценка не начисляет очки.',
        extraTabs: [
          { id: 'questions', label: 'Вопросы и теория', href: '#/myology' },
          { id: 'sources', label: 'Рисунки и источники', href: '#/myology' },
        ],
        // Раньше это была отдельная ссылка «← Теория 1 коллоквиума».
        related: [{ label: 'Теория 1 коллоквиума', href: '#/anatomy-oral?section=notes' }],
      },
    },
  };

  // Ключ хранения: у первого коллоквиума исторический ключ, у остальных — свой.
  const KEYS = {
    anatomySkills: 'anatomy-practical-skills-1-v1',
    myologySkills: 'medzo-skills-2-v1',
  };

  // Описание предмета строится один раз: иначе каждый рендер создавал бы новый
  // движок и сбрасывал открытый экран тренировки.
  const cache = {};
  function get(routeName) {
    const subject = SUBJECTS[routeName];
    if (!subject) return null;
    const data = subject.data && subject.data();
    if (!data) return null;
    const items = data.items || data.skills || [];
    if (!items.length) return null;
    const cached = cache[routeName];
    if (cached && cached.data === data) return cached.spec;
    const spec = window.MedzoSkills.normalize({
      key: KEYS[routeName],
      data,
      sync: subject.sync,
      labels: subject.labels,
      mirror: subject.mirror,
    });
    cache[routeName] = { data, spec };
    return spec;
  }

  /* ---------------------------------------------------- вопросы и источники */

  // Теоретические вопросы и присланные страницы миологии: отдельные вкладки
  // коллоквиума 2 в общем каркасе навыков (ps-*). Оценки вопросов по-прежнему
  // живут в ключе миологии, поэтому синхронизация не меняется.
  const myologyKey = 'medzo-myology-practice-v1';
  const matchWords = (text, query) => query.split(/\s+/).filter(Boolean).every((word) => text.toLowerCase().includes(word));
  function myologyPrefs() {
    try {
      const saved = JSON.parse(localStorage.getItem(myologyKey) || '{}');
      return { questions: (saved && saved.questions) || {}, session: (saved && saved.session) || null, saved };
    } catch (e) { return { questions: {}, session: null, saved: {} }; }
  }
  const questionStatus = (q) => ({
    'heading-only': 'В расписанном источнике только заголовок.',
    diagram: 'В источнике приведена схема; текстовый ответ неполный.',
    external: 'В источнике дана ссылка на внешний материал, а не полный ответ.',
    partial: 'Материал в источнике частичный или входит в другую тему.',
    text: 'Материал есть в исходном документе; проверьте полноту ответа.',
  })[q.sourceStatus] || '';

  function myologyQuestionsView() {
    const data = window.MedzoMyologyData, esc = AT.utils.esc;
    const saved = myologyPrefs().questions;
    return '<section class="ps-panel"><div class="ps-catalog__head"><div><span class="ps-eyebrow">ТЕОРИЯ</span><h2>Вопросы по миологии</h2></div><span class="ps-count">' + data.questions.length + '</span></div>' +
      '<p class="ps-warning">На обложке расписанного файла указан другой номер коллоквиума, но по уточнению материал относится ко второму. Содержимое приведено без изменения; возможны ошибки, сверяйте с учебником.</p>' +
      '<p class="muted small">Оценки вопросов сохраняются на устройстве и синхронизируются отдельно при входе в аккаунт. Самооценка не даёт очков.</p>' +
      '<label class="ps-search"><span class="ps-search__icon" aria-hidden="true">⌕</span><input type="search" data-ps-qsearch placeholder="Найти вопрос по названию или номеру"></label>' +
      '<div class="ps-sections">' + data.questions.map((q) => {
        const mark = saved[q.id];
        return '<details class="ps-section" data-ps-question="' + q.id + '"><summary class="ps-section__head"><span class="ps-section__title">№ ' + q.id + ' · ' + esc(q.text) + '</span></summary>' +
          '<div class="ps-section__items"><p class="muted small">' + esc(questionStatus(q)) + '</p>' +
          '<p class="muted small">Страницы источника: ' + q.pages.join(', ') + '</p>' +
          '<div class="ps-review-actions"><button type="button" class="btn ' + (mark === 'known' ? 'btn--success' : 'btn--ghost') + '" data-ps-qmark="known" data-id="' + q.id + '">Знаю</button>' +
          '<button type="button" class="btn ' + (mark === 'again' ? 'btn--danger' : 'btn--ghost') + '" data-ps-qmark="again" data-id="' + q.id + '">Повторить</button></div></div></details>';
      }).join('') + '</div><p class="ps-no-results" data-ps-qempty hidden>Ничего не найдено.</p></section>';
  }

  function myologySourcesView() {
    const data = window.MedzoMyologyData, esc = AT.utils.esc, folder = 'assets/anatomy/myology/';
    const pad = (n) => String(n).padStart(2, '0');
    const links = [['skills-list.pdf', 'Список навыков PDF'], ['skills-variant-1.pdf', 'Рисунки · вариант 1'], ['skills-variant-2.pdf', 'Рисунки · вариант 2'], ['questions-list.pdf', 'Список вопросов PDF'], ['questions-source.pdf', 'Расписанные вопросы PDF']]
      .map(([file, label]) => '<a class="btn btn--sm btn--ghost" href="' + folder + file + '" target="_blank" rel="noopener">' + label + ' ↗</a>').join('');
    return '<section class="ps-panel"><div class="ps-catalog__head"><div><span class="ps-eyebrow">ИСТОЧНИКИ</span><h2>Рисунки и оригиналы</h2></div></div>' +
      '<p>Оригинальные страницы и все пять PDF. Подписи могут отличаться от официального списка или содержать ошибки; проверяйте по атласу и учебнику.</p>' +
      '<div class="ps-filters">' + links + '</div>' +
      '<label class="ps-search"><span class="ps-search__icon" aria-hidden="true">⌕</span><input type="search" data-ps-ssearch placeholder="Например, m. trapezius"></label>' +
      data.variantPages.map((pages, i) => '<section class="ps-section" data-ps-source-group><h3>Практические навыки · вариант ' + (i + 1) + '</h3><div class="ps-sections">' + pages.map((p) =>
        '<details class="ps-section" data-ps-source data-variant="' + (i + 1) + '" data-page="' + p.page + '"><summary class="ps-section__head"><span class="ps-section__title">Страница ' + p.page + ' · открыть изображение</span></summary>' +
        '<div class="ps-section__items" data-ps-source-body><a class="btn btn--sm btn--ghost" href="' + folder + (i === 0 ? 'skills-variant-1.pdf' : 'skills-variant-2.pdf') + '#page=' + p.page + '" target="_blank" rel="noopener">Открыть оригинал · страница ' + p.page + ' ↗</a>' +
        '<img src="' + folder + (i === 0 ? 'variant-1-pages' : 'variant-2-pages') + '/' + pad(p.page) + '.webp" alt="Страница ' + p.page + ' исходного документа" loading="lazy"></div></details>').join('') + '</div></section>').join('') +
      '<p class="ps-no-results" data-ps-sempty hidden>Совпадений в текстовых подписях не найдено. Подписи внутри изображений поиском не распознаются.</p></section>';
  }

  // Раздел навыков нужен каждому коллоквиуму; какие уже готовы — знает реестр.
  function available() {
    return Object.keys(SUBJECTS).filter((name) => {
      const subject = SUBJECTS[name];
      return !!(subject.data && subject.data());
    });
  }

  window.MedzoSkillsRegistry = {
    SUBJECTS, KEYS, get, available,
    extras: { questions: myologyQuestionsView, sources: myologySourcesView },
    myologyKey, myologyPrefs, matchWords,
  };
})();
