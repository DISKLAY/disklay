/* Общая страница практических навыков для всех коллоквиумов.
   Раньше навыки первого и второго коллоквиума жили в разных разделах и занимали
   в тренировке два пункта. Теперь это один пункт «Навыки»: внутри страницы
   переключается коллоквиум, а движок, разметка и горячие клавиши общие.
   Состояния по-прежнему раздельные: у каждого коллоквиума свой ключ хранения. */
(function () {
  'use strict';
  const AT = window.AT, esc = AT.utils.esc;

  // Источники подключаются лениво: первый коллоквиум уже загружен приложением,
  // второй подтягивается только при переключении.
  const banks = {
    '1': {
      label: '1 коллоквиум',
      ready: () => !!(window.AnatomySkills && window.AnatomySkillsData && window.AT.views.anatomySkills),
      load: () => (window.AT.loadAnatomySkills ? window.AT.loadAnatomySkills() : Promise.reject(new Error('нет загрузчика навыков')))
    },
    '2': {
      label: '2 коллоквиум',
      ready: () => !!(window.MedzoMyologySkills && window.MedzoMyologyData && window.AT.views.myology),
      load: () => (window.AT.loadMyology ? window.AT.loadMyology() : Promise.reject(new Error('нет загрузчика миологии')))
    }
  };

  const ids = () => Object.keys(banks).filter(id => banks[id]);
  const pick = value => (Object.prototype.hasOwnProperty.call(banks, value) ? value : ids()[0]);

  AT.views.anatomySkillsAll = function (params) {
    const id = pick(params.colloquium);
    const bank = banks[id];
    const heads = {
      '1': ['Кости и их соединения', 'Переведите термин и найдите структуру в атласе или на препарате.'],
      '2': ['Мышцы, фасции, топография', 'Тот же тренажёр, что у первого коллоквиума: термин, подсказка, избранное и самооценка.']
    };
    const [title, lead] = heads[id] || ['Практические навыки', ''];
    const tabs = ids().length > 1
      ? '<nav class="theory-tabs theory-tabs--inner" aria-label="Коллоквиум">' + ids().map(value =>
          '<a href="#/anatomy-skills?colloquium=' + value + '"' + (value === id ? ' class="is-active" aria-current="page"' : '') + '>' + esc(banks[value].label) + '</a>'
        ).join('') + '</nav>'
      : '';
    const html = '<div class="view skills-hub-view">' +
      '<header class="skills-hub-head"><span class="theory-eyebrow">АНАТОМИЯ · НАВЫКИ</span><h1>' + esc(title) + '</h1><p>' + esc(lead) + '</p></header>' +
      tabs +
      '<div data-skills-host></div>' +
      '</div>';
    return {
      title: 'Практические навыки',
      html,
      mount(root) {
        const host = root.querySelector('[data-skills-host]');
        if (!host) return;
        const draw = () => {
          if (!host.isConnected) return;
          const options = { colloquium: id, embedded: '1' };
          const view = id === '1' ? AT.views.anatomySkills(options) : AT.views.myology(Object.assign({ section: 'skills' }, options));
          host.innerHTML = view.html;
          // Вложенная страница ищет свой корень от контейнера, поэтому передаём хост.
          if (view.mount) view.mount(host);
        };
        if (bank.ready()) { draw(); return; }
        host.innerHTML = '<div class="card card--pad"><p>Загружаем навыки…</p></div>';
        bank.load().then(() => { if (host.isConnected) draw(); }).catch(err => {
          console.error(err);
          if (host.isConnected) host.innerHTML = '<div class="card card--pad"><p>Не удалось загрузить навыки.</p><button class="btn btn--primary" type="button" data-skills-retry>Повторить</button></div>';
          const retry = host.querySelector('[data-skills-retry]');
          if (retry) retry.addEventListener('click', () => { host.innerHTML = '<div class="card card--pad"><p>Загружаем навыки…</p></div>'; bank.load().then(draw).catch(() => {}); });
        });
      }
    };
  };
})();
