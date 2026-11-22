/* Раздел «Теория» — единственная точка входа в материалы по коллоквиумам.
   Здесь нет дублей из тренировки: конспекты, навыки, карточки и билеты
   сгруппированы по коллоквиумам, а сами материалы открываются на своих
   страницах (они же используются в тренировке для навыков и билетов). */
(function () {
  'use strict';
  const AT = window.AT, esc = AT.utils.esc;

  const TABS = [
    ['notes', 'Конспекты'],
    ['skills', 'Практические навыки'],
    ['cards', 'Карточки и билеты']
  ];

  // Каждая карточка — ссылка на готовую страницу материала. Новый коллоквиум
  // добавляется строкой в этот список и не занимает отдельный пункт в тренировке.
  const GROUPS = {
    notes: [
      {
        id: '1',
        title: 'Остеология и артрология',
        subtitle: '1 коллоквиум',
        text: 'Кости и их соединения: весь расписанный конспект по 72 темам и все рисунки исходника.',
        href: '#/anatomy-oral?section=notes'
      },
      {
        id: '2',
        title: 'Миология',
        subtitle: '2 коллоквиум',
        text: 'Мышцы, фасции и топография: 66 вопросов и весь текст конспекта с рисунками.',
        href: '#/myology?section=questions'
      }
    ],
    skills: [
      {
        id: '1',
        title: 'Практические навыки',
        subtitle: '1 коллоквиум',
        text: 'Названия структур на латыни с подсказками, избранным и самооценкой.',
        href: '#/anatomy-skills'
      },
      {
        id: '2',
        title: 'Практические навыки',
        subtitle: '2 коллоквиум',
        text: 'Мышцы и фасции: тот же тренажёр, что у первого коллоквиума.',
        href: '#/myology?section=skills'
      }
    ],
    cards: [
      {
        id: '1',
        title: 'Карточки',
        subtitle: '1 коллоквиум',
        text: 'Повторение по 72 темам: вопрос, ответ и самооценка, порядок можно перемешать.',
        href: '#/anatomy-oral?section=cards'
      },
      {
        id: '1',
        title: 'Билеты',
        subtitle: '1 коллоквиум',
        text: '35 билетов: 10 навыков и 3 вопроса с фотографией оригинала.',
        href: '#/anatomy-oral?section=tickets'
      }
    ]
  };

  const currentTab = value => (TABS.some(([id]) => id === value) ? value : 'notes');

  function card(item) {
    return '<a class="theory-card" href="' + item.href + '">' +
      '<span class="theory-card__badge" aria-hidden="true">' + esc(item.id) + '</span>' +
      '<span class="theory-card__body">' +
        '<span class="theory-card__kicker">' + esc(item.subtitle) + '</span>' +
        '<strong>' + esc(item.title) + '</strong>' +
        '<span class="theory-card__text">' + esc(item.text) + '</span>' +
      '</span>' +
      '<span class="theory-card__arrow" aria-hidden="true">→</span>' +
    '</a>';
  }

  AT.views.theory = function (params) {
    const tab = currentTab(params.section);
    const tabs = '<nav class="theory-tabs" aria-label="Материалы теории">' + TABS.map(([id, label]) =>
      '<a href="#/theory?section=' + id + '"' + (id === tab ? ' class="is-active" aria-current="page"' : '') + '>' + label + '</a>'
    ).join('') + '</nav>';
    const html = '<div class="view theory-view">' +
      '<header class="theory-head"><span class="theory-eyebrow">АНАТОМИЯ</span><h1>Теория</h1>' +
      '<p>Материалы по коллоквиумам в одном месте: конспекты, практические навыки, карточки и билеты. ' +
      'Тренировка отвечает за тесты, экзамен и работу над ошибками.</p></header>' +
      tabs +
      '<div class="theory-grid">' + GROUPS[tab].map(card).join('') + '</div>' +
      '</div>';
    return { title: 'Теория', html };
  };
})();
