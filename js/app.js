/* ============================================================================
   app.js — маршрутизация и запуск приложения
   ========================================================================== */
(function () {
  'use strict';

  const AT = window.AT;
  const ui = AT.ui;
  const root = document.getElementById('app');
  const nav = document.getElementById('mainNav');

  let cleanups = [];
  let currentRoute = { name: 'dashboard', params: {} };
  let lastRenderedHash = null;
  let lastRouteKey = null;

  AT.onCleanup = function (fn) {
    if (typeof fn === 'function') cleanups.push(fn);
  };

  function runCleanups() {
    cleanups.forEach((fn) => {
      try { fn(); } catch (e) { /* ignore */ }
    });
    cleanups = [];
  }

  function parseHash() {
    const hash = /^#tgWebApp/.test(location.hash) || /^#tgAuthResult/.test(location.hash) || location.hash.includes('tgAuthResult=') ? '/' : (location.hash.replace(/^#/, '') || '/');
    const [path, query] = hash.split('?');
    const segments = path.split('/').filter(Boolean);
    const params = {};
    (query || '').split('&').filter(Boolean).forEach((pair) => {
      const [k, v] = pair.split('=');
      params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
    let name = segments[0] || 'dashboard';
    // «Навыки» — один пункт для всех коллоквиумов: старые ссылки на отдельные
    // страницы навыков ведут на общую страницу с выбранным коллоквиумом.
    if (name === 'myology' && params.section === 'skills') { name = 'anatomy-skills'; params.colloquium = '2'; }
    if (name === 'anatomy-skills') params.colloquium = params.colloquium || '1';
    return { name, params };
  }

  const ROUTES = {
    dashboard: 'dashboard',
    tests: 'tests',
    train: 'trainSetup',
    exam: 'examSetup',
    run: 'run',
    summary: 'summary',
    mistakes: 'mistakes',
    portfolio: 'portfolio',
    stats: 'stats',
    rewards: 'rewards',
    key: 'key',
    settings: 'settings',
    profile: 'profile',
    histology: 'histology',
    // «Навыки» — одна страница на все коллоквиумы (см. parseHash).
    'anatomy-skills': 'anatomySkillsAll',
    'anatomy-oral': 'anatomyOral',
    myology: 'myology',
    teachers: 'teacherReviews',
    theory: 'theory',
    dev: 'dev',
  };

  // Тяжёлые разделы подключают свои скрипты и стили по требованию.
  function resource(tag, url) {
      return new Promise((resolve, reject) => {
        const el = document.createElement(tag);
        if (tag === 'link') { el.rel = 'stylesheet'; el.href = url; }
        else { el.src = url; }
        el.onload = resolve;
        el.onerror = () => { el.remove(); reject(new Error('Не удалось загрузить ' + url)); };
        document.head.appendChild(el);
      });
  }
  let histologyLoad = null, histologyCss = null, histologyReady = false;
  function loadHistology() {
    if (histologyLoad) return histologyLoad;
    if (!histologyCss) histologyCss = resource('link', 'css/histology.css?v=20261116-pwa14').catch(err => { histologyCss = null; throw err; });
    const script = (window.HistologyPracticePhotos ? Promise.resolve() : resource('script', 'js/histology-practice-data.js?v=20261116-pwa14'))
      .then(() => window.HistologyFirstData ? undefined : resource('script', 'js/histology-first-data.js?v=20261116-pwa14'))
      .then(() => window.HistologyTissueData ? undefined : resource('script', 'js/histology-tissues-data.js?v=20261116-pwa14'))
      .then(() => window.HistologyElectronPages ? undefined : resource('script', 'js/histology-electron-data.js?v=20261116-pwa14'))
      .then(() => window.HistologyElectronIndividual ? undefined : resource('script', 'js/histology-electron-individual-data.js?v=20261116-pwa14'))
      .then(() => window.HistologyAdditionalPhotos ? undefined : resource('script', 'js/histology-additional-data.js?v=20261116-pwa14'))
      .then(() => window.HistologyBloodFields ? undefined : resource('script', 'js/histology-blood-data.js?v=20261116-pwa14'))
      .then(() => window.HistologyRecoveryTheory ? undefined : resource('script', 'js/histology-theory-recovery.js?v=20261116-pwa14'))
      .then(() => window.HistologyExpandedTheory ? undefined : resource('script', 'js/histology-theory-expanded.js?v=20261116-pwa14'))
      .then(() => window.HistologyStructureExtra ? undefined : resource('script', 'js/histology-structure-extra.js?v=20261116-pwa14'))
      .then(() => window.HistologyTheoryHard ? undefined : resource('script', 'js/histology-theory-hard.js?v=20261116-pwa14'))
      .then(() => window.HistologyFifthAnswer ? undefined : resource('script', 'js/histology-fifth-answer.js?v=20261116-pwa14'))
      .then(() => window.HistologyPrototype ? undefined : resource('script', 'js/histology.js?v=20261116-pwa14'))
      .then(() => window.HistologyAtlasPhotos ? undefined : resource('script', 'js/histology-atlas-data.js?v=20261116-pwa14'))
      .then(() => AT.views.histology ? undefined : resource('script', 'js/views-histology.js?v=20261116-pwa14'));
    histologyLoad = Promise.all([histologyCss, script]).then(() => { histologyReady = true; }).catch(err => { histologyLoad = null; throw err; });
    return histologyLoad;
  }
  let anatomySkillsLoad = null, anatomySkillsCss = null, anatomySkillsReady = false;
  function loadAnatomySkills() {
    if (anatomySkillsLoad) return anatomySkillsLoad;
    if (!anatomySkillsCss) anatomySkillsCss = resource('link', 'css/anatomy-skills.css?v=20261116-pwa14').catch(err => { anatomySkillsCss = null; throw err; });
    const script = (window.AnatomySkillsData ? Promise.resolve() : resource('script', 'js/anatomy-skills-data.js?v=20261116-pwa14'))
      .then(() => window.AnatomySkills ? undefined : resource('script', 'js/anatomy-skills.js?v=20261116-pwa14'))
      .then(() => AT.views.anatomySkills ? undefined : resource('script', 'js/views-anatomy-skills.js?v=20261116-pwa14'));
    anatomySkillsLoad = Promise.all([anatomySkillsCss, script]).then(() => { anatomySkillsReady = true; }).catch(err => { anatomySkillsLoad = null; throw err; });
    return anatomySkillsLoad;
  }
  AT.loadAnatomySkills = loadAnatomySkills;
  let anatomyOralLoad = null, anatomyOralCss = null, anatomyOralReady = false;
  function loadAnatomyOral() {
    if (anatomyOralLoad) return anatomyOralLoad;
    if (!anatomyOralCss) anatomyOralCss=resource('link','css/anatomy-oral.css?v=20261116-pwa14').catch(err=>{anatomyOralCss=null;throw err;});
    const script=(window.AnatomyOralData?Promise.resolve():resource('script','js/anatomy-oral-data.js?v=20261116-pwa14'))
      .then(()=>window.AnatomyOralSource?undefined:resource('script','js/anatomy-oral-source.js?v=20261116-pwa14'))
      .then(()=>window.AnatomySkillsData?undefined:resource('script','js/anatomy-skills-data.js?v=20261116-pwa14'))
      .then(()=>window.AnatomyTicketSkills?undefined:resource('script','js/anatomy-ticket-skills.js?v=20261116-pwa14'))
      .then(()=>window.AnatomyOral?undefined:resource('script','js/anatomy-oral.js?v=20261116-pwa14'))
      .then(()=>AT.views.anatomyOral?undefined:resource('script','js/views-anatomy-oral.js?v=20261116-pwa14'));
    anatomyOralLoad=Promise.all([anatomyOralCss,script]).then(()=>{anatomyOralReady=true;}).catch(err=>{anatomyOralLoad=null;throw err;});
    return anatomyOralLoad;
  }

  let myologyLoad = null, myologyCss = null, myologyReady = false;
  function loadMyology() {
    if (myologyLoad) return myologyLoad;
    if (!myologyCss) myologyCss = resource('link', 'css/myology.css?v=20261116-pwa14').then(() => resource('link', 'css/anatomy-skills.css?v=20261116-pwa14')).catch(err => { myologyCss = null; throw err; });
    const css = myologyCss;
    const script = (window.MedzoMyologyData ? Promise.resolve() : resource('script', 'js/myology-data.js?v=20261116-pwa14'))
      .then(() => window.MedzoMyologySource ? undefined : resource('script', 'js/myology-source.js?v=20261116-pwa14'))
      .then(() => window.MedzoMyologySkills ? undefined : resource('script', 'js/myology-skills.js?v=20261116-pwa14'))
      .then(() => AT.views.myology ? undefined : resource('script', 'js/views-myology.js?v=20261116-pwa14'));
    myologyLoad = Promise.all([css, script]).then(() => { myologyReady = true; }).catch(err => { myologyLoad = null; throw err; });
    return myologyLoad;
  }
  AT.loadMyology = loadMyology;

  // Лёгкие страницы разделов грузятся по требованию.
  let theoryLoad = null;
  function loadTheory() {
    if (theoryLoad) return theoryLoad;
    theoryLoad = (AT.views.theory ? Promise.resolve() : resource('script', 'js/views-theory.js?v=20261116-pwa14'))
      .catch(err => { theoryLoad = null; throw err; });
    return theoryLoad;
  }
  let skillsHubLoad = null;
  function loadSkillsHub() {
    if (skillsHubLoad) return skillsHubLoad;
    skillsHubLoad = (AT.views.anatomySkillsAll ? Promise.resolve() : resource('script', 'js/views-skills-hub.js?v=20261116-pwa14'))
      .catch(err => { skillsHubLoad = null; throw err; });
    return skillsHubLoad;
  }

  function syncSubject(histology, section) {
    document.body.dataset.subject = histology ? 'histology' : 'anatomy';
    const brand = document.getElementById('subjectBrand');
    const brandLabel = document.getElementById('subjectBrandLabel');
    const sidebarLabel = document.getElementById('subjectSidebarLabel');
    if (brand) brand.setAttribute('href', histology ? '#/histology' : '#/');
    if (brandLabel) brandLabel.textContent = histology ? 'Гистология' : 'Анатомия';
    if (sidebarLabel) sidebarLabel.textContent = histology ? 'Гистология' : 'Анатомия';
    document.querySelectorAll('[data-histo-sidebar]').forEach(link => {
      const active = histology && link.getAttribute('data-histo-sidebar') === (section || 'setup');
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    document.querySelectorAll('[data-subject-link]').forEach(link => {
      if (link.getAttribute('data-subject-link') === (histology ? 'histology' : 'anatomy')) link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    });
  }

  function updateMobileNav(route, histology) {
    const items = histology
      ? [['Препараты','slide','#/histology?section=setup','setup'],['Атлас','atlas','#/histology?section=atlas','atlas'],['Ошибки','mistakes','#/histology?section=errors','errors'],['Статистика','stats','#/histology?section=stats','stats']]
      : [['Главная','home','#/','dashboard'],['Тренировка','train','#/tests','tests'],['Теория','book','#/theory','theory'],['Ошибки','mistakes','#/mistakes','mistakes']];
    // «Теория» — самостоятельный раздел: в нём живут оба конспекта, карточки
    // и билеты, поэтому он не подсвечивает «Тренировку».
    const theoryRoute=route.name==='anatomy-oral'||route.name==='myology';
    const active=histology?(route.params.section||'setup'):(theoryRoute?'theory':trainingRoute(route)?'tests':route.name);
    document.querySelectorAll('[data-mobile-nav]').forEach((link,i)=>{
      const [label,iconName,href,key]=items[i];link.href=href;link.innerHTML=ui.icon(iconName)+'<span>'+label+'</span>';link.setAttribute('aria-label',label);
      link.classList.toggle('is-active',active===key);if(active===key)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
    });
  }

  function updateContext(route, histology) {
    const subject = document.getElementById('contextSubject');
    const page = document.getElementById('contextPage');
    const option = document.getElementById('colloquiumSelect').selectedOptions[0];
    const labels = {dashboard:'Главная', tests:'Тренировка · Базы', train:'Тренировка · Тесты', exam:'Экзамен', run:'Задания', summary:'Результат', mistakes:'Ошибки', portfolio:'Портфель', stats:'Статистика', rewards:'Награды', settings:'Настройки', profile:'Профиль', 'anatomy-skills':'Практические навыки', 'anatomy-oral':'Теория · 1 коллоквиум', myology:'Теория · 2 коллоквиум', theory:'Теория', teachers:'Отзывы о преподавателях', dev:'Панель разработчика'};
    const histologyLabels = {setup:'Препараты', atlas:'Атлас', structures:'Структуры', theory:'Тесты по теории', errors:'Ошибки', stats:'Статистика'};
    subject.textContent = histology ? 'Гистология' : 'Анатомия';
    subject.href = histology ? '#/histology' : '#/';
    // Выбор коллоквиума живёт в шапке: здесь только путь, без второго списка.
    if (option && subject) subject.title = option.textContent.trim();
    const oralLabels = {cards:'Карточки · 1 коллоквиум', tickets:'Билеты · 1 коллоквиум'};
    page.textContent = histology ? (histologyLabels[route.params.section] || 'Препараты') : (route.name === 'anatomy-oral' && oralLabels[route.params.section] || labels[route.name] || 'Страница');
  }

  // Лента тренировки — короткая и постоянная: тесты, экзамен, навыки, билеты
  // (если они есть у базы), ошибки. Теория сюда не дублируется — для неё есть
  // отдельный раздел «Теория», а «Навыки» — один пункт на оба коллоквиума.
  function trainingSections() {
    const sections = [
      { key: 'tests', label: 'Базы', href: '#/tests' },
      { key: 'train', label: 'Тесты', href: '#/train' },
      { key: 'exam', label: AT.colloquium.kind === 'credit' ? 'Пробный зачёт' : 'Экзамен', href: '#/exam' }
    ];
    // Материалы (навыки, билеты, карточки) есть только у первого семестра —
    // у остальных баз пункты не показываем, чтобы лента не пухла пустыми ссылками.
    if (Number(AT.colloquium.semester) === 1) {
      sections.push({ key: 'skills', label: 'Навыки', href: '#/anatomy-skills', match: r => r.name === 'anatomy-skills' });
      sections.push({ key: 'tickets', label: 'Билеты', href: '#/anatomy-oral?section=tickets', match: r => r.name === 'anatomy-oral' && r.params.section === 'tickets' });
    }
    sections.push({ key: 'mistakes', label: 'Ошибки', href: '#/mistakes' });
    return sections;
  }
  // Экраны, которые относятся к тренировке: у них общая лента разделов.
  function trainingRoute(route) {
    return ['tests', 'train', 'exam', 'mistakes', 'anatomy-skills', 'anatomy-skills-all', 'run', 'summary'].includes(route.name) ||
      trainingSections().some(section => section.match && section.match(route));
  }
  function trainingNav(route) {
    const nav = document.createElement('nav');
    nav.className = 'anatomy-training-nav';
    nav.setAttribute('aria-label', 'Разделы тренировки по анатомии');
    nav.innerHTML = trainingSections().map(section => {
      const active = section.match ? section.match(route) : route.name === section.key;
      return '<a href="' + section.href + '"' + (active ? ' class="is-active" aria-current="page"' : '') + '>' + section.label + '</a>';
    }).join('');
    return nav;
  }

  function render() {
    runCleanups();
    lastRenderedHash = location.hash;
    const route = parseHash();
    currentRoute = route;
    const viewName = ROUTES[route.name] || 'notFound';
    if (viewName !== 'histology' && AT.views.histology && AT.views.histology.onLeave) AT.views.histology.onLeave();
    syncSubject(viewName === 'histology', route.params.section);
    updateMobileNav(route, viewName === 'histology');
    updateContext(route, viewName === 'histology');

    if (viewName === 'trainSetup' && (route.params.topic || route.params.scope === 'favorites')) {
      if (route.params.topic) AT.setup.train.topics = route.params.topic === 'all' ? ['all'] : [route.params.topic];
      if (route.params.scope === 'favorites') AT.setup.train.scope = 'favorites';
      history.replaceState(null, '', '#/train');
    }

    if (viewName === 'histology' && !histologyReady) {
      root.innerHTML = '<div class="view"><div class="card card--pad"><h1>Гистология</h1><p>Загружаем тренажёр…</p></div></div>';
      updateNav(route.name);
      loadHistology().then(() => { if (parseHash().name === 'histology') render(); }).catch(err => {
        console.error(err);
        if (parseHash().name !== 'histology') return;
        root.innerHTML = '<div class="view"><div class="card card--pad"><h1>Не удалось загрузить гистологию</h1><p>Проверьте подключение и попробуйте ещё раз.</p><button class="btn btn--primary" id="histologyRetry">Повторить</button></div></div>';
        root.querySelector('#histologyRetry').addEventListener('click', render);
      });
      return;
    }

    if (viewName === 'anatomySkills' && !anatomySkillsReady) {
      root.innerHTML = '<div class="view"><div class="card card--pad"><h1>Практические навыки</h1><p>Загружаем список…</p></div></div>';
      updateNav(route.name);
      loadAnatomySkills().then(() => { if (parseHash().name === 'anatomy-skills') render(); }).catch(err => {
        console.error(err);
        if (parseHash().name !== 'anatomy-skills') return;
        root.innerHTML = '<div class="view"><div class="card card--pad"><h1>Не удалось загрузить навыки</h1><p>Проверьте подключение и попробуйте ещё раз.</p><button class="btn btn--primary" id="skillsRetry">Повторить</button></div></div>';
        root.querySelector('#skillsRetry').addEventListener('click', render);
      });
      return;
    }

    if (viewName === 'anatomyOral' && !anatomyOralReady) {
      root.innerHTML = '<div class="view"><div class="card card--pad"><h1>Устная подготовка</h1><p>Загружаем материалы…</p></div></div>';
      updateNav(route.name);
      loadAnatomyOral().then(() => { if (parseHash().name === 'anatomy-oral') render(); }).catch(err => {
        console.error(err); if (parseHash().name !== 'anatomy-oral') return;
        root.innerHTML = '<div class="view"><div class="card card--pad"><h1>Не удалось загрузить материалы</h1><button class="btn btn--primary" id="oralRetry">Повторить</button></div></div>';
        root.querySelector('#oralRetry').addEventListener('click', render);
      }); return;
    }

    if (viewName === 'anatomySkillsAll' && !AT.views.anatomySkillsAll) {
      root.innerHTML = '<div class="view"><div class="card card--pad"><h1>Практические навыки</h1><p>Загружаем тренировку…</p></div></div>';
      updateNav(route.name);
      // Хаб сам подтягивает ресурсы нужного коллоквиума; здесь достаточно самого модуля.
      loadSkillsHub().then(() => { if (parseHash().name === 'anatomy-skills') render(); }).catch(err => {
        console.error(err);
        if (parseHash().name !== 'anatomy-skills') return;
        root.innerHTML = '<div class="view"><div class="card card--pad"><h1>Не удалось загрузить навыки</h1><p>Проверьте подключение и попробуйте ещё раз.</p><button class="btn btn--primary" id="skillsHubRetry">Повторить</button></div></div>';
        root.querySelector('#skillsHubRetry').addEventListener('click', render);
      });
      return;
    }

    if (viewName === 'theory' && !AT.views.theory) {
      root.innerHTML = '<div class="view"><div class="card card--pad"><h1>Теория</h1><p>Загружаем материалы…</p></div></div>';
      updateNav(route.name);
      loadTheory().then(() => { if (parseHash().name === 'theory') render(); }).catch(err => {
        console.error(err);
        if (parseHash().name !== 'theory') return;
        root.innerHTML = '<div class="view"><div class="card card--pad"><h1>Не удалось загрузить теорию</h1><p>Проверьте подключение и попробуйте ещё раз.</p><button class="btn btn--primary" id="theoryRetry">Повторить</button></div></div>';
        root.querySelector('#theoryRetry').addEventListener('click', render);
      });
      return;
    }

    if (viewName === 'myology' && !myologyReady) {
      root.innerHTML = '<div class="view"><div class="card card--pad"><h1>Миология · 2 коллоквиум</h1><p>Загружаем материалы…</p></div></div>';
      updateNav(route.name);
      loadMyology().then(() => {if (parseHash().name === 'myology') render();}).catch(err => {
        console.error(err);if(parseHash().name !== 'myology')return;
        root.innerHTML = '<div class="view"><div class="card card--pad"><h1>Не удалось загрузить материалы</h1><button class="btn btn--primary" id="myologyRetry">Повторить</button></div></div>';
        root.querySelector('#myologyRetry').addEventListener('click', render);
      });
      return;
    }

    // Ключ ответов переехал в настройки: старые ссылки и закладки ведут туда.
    if (route.name === 'key') {
      location.replace('#/settings?section=key');
      return;
    }

    const view = AT.views[viewName];
    let result;
    try {
      result = view ? view(route.params) : notFound();
    } catch (err) {
      console.error(err);
      result = errorView(err);
    }

    root.innerHTML = result.html;
    if (trainingRoute(route) && !['run','summary'].includes(route.name)) { const view=root.querySelector('.view'); if (view) view.prepend(trainingNav(route)); }
    if (result.mount) {
      try {
        result.mount(root);
      } catch (err) {
        console.error(err);
      }
    }
    document.title = viewName === 'histology' ? 'Гистология · Medzo' : (result.title || 'Тренажёр') + ' · Анатомия — ' + (AT.colloquium.kind === 'credit' ? 'зачёт' : 'коллоквиум') + ' · Medzo';
    updateNav(route.name);
    const routeKey = route.name + ':' + JSON.stringify(route.params);
    if (routeKey !== lastRouteKey) {
      window.scrollTo(0, 0);
      lastRouteKey = routeKey;
    }
    if (route.name === 'settings' && /[?&]section=key/.test(location.hash)) {
      const sec = root.querySelector('#keySection');
      if (sec) requestAnimationFrame(() => sec.scrollIntoView({ block: 'start' }));
    }

    const viewEl = root.querySelector('.view');
    if (viewEl) viewEl.classList.add('is-entering');
  }

  function updateNav(name) {
    if (!nav) return;
    const hash = parseHash();
    const theoryRoute = name === 'anatomy-oral' || name === 'myology';
    const active = theoryRoute ? 'theory' : trainingRoute(hash) ? 'tests' : name;
    nav.querySelectorAll('[data-route]').forEach((link) => {
      const r = link.getAttribute('data-route');
      const isActive = r === active || (active === 'dashboard' && r === 'dashboard');
      link.classList.toggle('is-active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.querySelectorAll('[data-sidebar-route]').forEach((link) => {
      const isActive = link.getAttribute('data-sidebar-route') === active;
      link.classList.toggle('is-active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function notFound() {
    return {
      title: 'Страница не найдена',
      html: '<div class="view">' + ui.emptyState('info', 'Такой страницы нет',
        'Возможно, ссылка устарела.', '<a class="btn btn--primary" href="#/">На главную</a>') + '</div>',
    };
  }

  function errorView(err) {
    return {
      title: 'Ошибка',
      html: '<div class="view">' + ui.emptyState('info', 'Что-то пошло не так',
        String(err && err.message ? err.message : err),
        '<a class="btn btn--primary" href="#/">На главную</a>') + '</div>',
    };
  }

  AT.rerender = render;
  AT.route = () => currentRoute.name;
  /** Переход без ожидания hashchange (и без двойной отрисовки). */
  AT.go = function (hash) {
    if (location.hash === hash) {
      render();
    } else {
      location.hash = hash;
      render();
    }
  };

  /* ------------------------------------------------------------- глобальные */

  document.addEventListener('click', (e) => {
    const link=e.target.closest('[data-mobile-nav]');
    if(link && link.getAttribute('href').startsWith('#/histology?') && location.hash===link.getAttribute('href') && !e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey&&e.button===0 && AT.views.histology?.openSection){
      const section=new URLSearchParams(link.hash.split('?')[1]||'').get('section');if(section){e.preventDefault();AT.views.histology.openSection(section);}
    }
    const el = e.target.closest('[data-action="toggle-theme"]');
    if (!el) return;
    const next = ui.toggleTheme();
    ui.toast(next === 'dark' ? 'Тёмная тема' : 'Светлая тема');
  });

  window.addEventListener('hashchange', () => {
    if (location.hash === lastRenderedHash) return;
    render();
  });

  const moduleSelect = document.getElementById('colloquiumSelect');
  if (moduleSelect) {
    moduleSelect.value = AT.colloquium.id;
    moduleSelect.addEventListener('change', () => {
      try {
        // Сохраняем незавершённую сессию до перезагрузки и переключения банка.
        AT.save(true);
        localStorage.setItem('anatomy-colloquium-selected', moduleSelect.value);
        location.hash = moduleSelect.dataset.nextRoute === 'train' ? '#/train' : '#/';
        delete moduleSelect.dataset.nextRoute;
        location.reload();
      } catch (e) {
        delete moduleSelect.dataset.nextRoute;
        moduleSelect.value = AT.colloquium.id;
        ui.toast('Не удалось переключить раздел: проверьте доступ к хранилищу браузера', 'warn');
      }
    });
    window.initColloquiumSwitch(moduleSelect, document.getElementById('courseSwitchTrigger'), document.getElementById('courseSwitchPanel'));
    const sidebar = document.getElementById('courseSidebar');
    sidebar.querySelectorAll('[data-nav-icon]').forEach(link => {
      const label = link.textContent.trim();
      link.innerHTML = ui.icon(link.dataset.navIcon) + '<span class="course-nav-label"></span>';
      link.querySelector('.course-nav-label').textContent = label;
      link.setAttribute('aria-label', label); link.title = label;
    });
    window.initCourseDrawer(sidebar, document.getElementById('courseToggle'), document.getElementById('courseBackdrop'));
  }

  /* ---------------------------------------------------------------- запуск */

  if (AT.colloquium.kind === 'credit') {
    const examLink = nav.querySelector('[data-route="exam"]');
    if (examLink) examLink.textContent = 'Пробный зачёт';
    document.querySelectorAll('[data-sidebar-route="exam"]').forEach(link => { link.querySelector('.course-nav-label').textContent = 'Пробный зачёт'; link.setAttribute('aria-label', 'Пробный зачёт'); link.title = 'Пробный зачёт'; });
  }
  ui.applyTheme();
  AT.game.applyAppearance();
  render();

  // Остальные базы подгружаются в фоне; когда все на месте — досинхронизируем
  // достижения и перерисуем текущий экран, если он зависит от всех баз сразу.
  if (window.MedzoBanks && typeof window.MedzoBanks.ensure === 'function') {
    window.MedzoBanks.ensure().then(() => {
      try {
        if (window.AT && window.AT.game && typeof window.AT.game.syncAchievements === 'function') window.AT.game.syncAchievements();
        const route = typeof window.AT.route === 'function' ? window.AT.route() : null;
        if (route && ['portfolio', 'rewards', 'tests'].includes(route) && typeof window.AT.rerender === 'function') window.AT.rerender();
      } catch (_) { /* фоновая подгрузка баз не должна ломать страницу */ }
    }).catch(() => { /* без остальных баз страница работает */ });
  }

  // подсказка при первом визите
  try {
    if (!localStorage.getItem('anatomy-colloquium-hint')) {
      localStorage.setItem('anatomy-colloquium-hint', '1');
      setTimeout(() => {
        if (AT.keyApi.count() === 0) ui.toast('Ключ ответов пока не загружен — работает самопроверка', 'warn');
      }, 1200);
    }
  } catch (e) { /* ignore */ }
})();
