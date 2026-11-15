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
  // Один раз догружаем активную базу и перерисовываем страницу.
  let bankReloaded = false;

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
    const hash = /^#tgWebApp/.test(location.hash) ? '/' : (location.hash.replace(/^#/, '') || '/');
    const [path, query] = hash.split('?');
    const segments = path.split('/').filter(Boolean);
    const params = {};
    (query || '').split('&').filter(Boolean).forEach((pair) => {
      const [k, v] = pair.split('=');
      params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
    const name = segments[0] || 'dashboard';
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
    dungeon: 'dungeon',
    key: 'key',
    settings: 'settings',
    profile: 'profile',
    histology: 'histology',
    'anatomy-skills': 'skills',
    'anatomy-oral': 'anatomyOral',
    myology: 'skills',
  };

  // Какому предмету принадлежит маршрут практических навыков.
  AT.skillsSubject = () => (parseHash().name === 'myology' ? 'myologySkills' : 'anatomySkills');
  // Предмет, данные которого нужны маршруту (для ленивой загрузки).
  function skillsSubjectFor(route) {
    return route.name === 'myology' ? 'myologySkills' : 'anatomySkills';
  }

  // Тяжёлые ресурсы подземелья не загружаются при обычном использовании тренажёра.
  let dungeonLoad = null, dungeonCss = null, dungeonReady = false;
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
  function loadDungeon() {
    if (dungeonLoad) return dungeonLoad;
    if (!dungeonCss) dungeonCss = resource('link', 'css/dungeon.css?v=12').catch(err => { dungeonCss = null; throw err; });
    const css = dungeonCss;
    const script = (window.DungeonEngine ? Promise.resolve() : resource('script', 'js/dungeon.js?v=11'))
      .then(() => AT.views.dungeon ? undefined : resource('script', 'js/views-dungeon.js?v=12'));
    dungeonLoad = Promise.all([css, script]).then(() => { dungeonReady = true; }).catch(err => { dungeonLoad = null; throw err; });
    return dungeonLoad;
  }

  let histologyLoad = null, histologyCss = null, histologyReady = false;
  function loadHistology() {
    if (histologyLoad) return histologyLoad;
    if (!histologyCss) histologyCss = resource('link', 'css/histology.css?v=17').catch(err => { histologyCss = null; throw err; });
    const script = (window.HistologyPracticePhotos ? Promise.resolve() : resource('script', 'js/histology-practice-data.js?v=1'))
      .then(() => window.HistologyFirstData ? undefined : resource('script', 'js/histology-first-data.js?v=1'))
      .then(() => window.HistologyTissueData ? undefined : resource('script', 'js/histology-tissues-data.js?v=1'))
      .then(() => window.HistologyElectronPages ? undefined : resource('script', 'js/histology-electron-data.js?v=1'))
      .then(() => window.HistologyElectronIndividual ? undefined : resource('script', 'js/histology-electron-individual-data.js?v=4'))
      .then(() => window.HistologyAdditionalPhotos ? undefined : resource('script', 'js/histology-additional-data.js?v=1'))
      .then(() => window.HistologyBloodFields ? undefined : resource('script', 'js/histology-blood-data.js?v=1'))
      .then(() => window.HistologyRecoveryTheory ? undefined : resource('script', 'js/histology-theory-recovery.js?v=2'))
      .then(() => window.HistologyExpandedTheory ? undefined : resource('script', 'js/histology-theory-expanded.js?v=1'))
      .then(() => window.HistologyStructureExtra ? undefined : resource('script', 'js/histology-structure-extra.js?v=1'))
      .then(() => window.HistologyTheoryHard ? undefined : resource('script', 'js/histology-theory-hard.js?v=1'))
      .then(() => window.HistologyFifthAnswer ? undefined : resource('script', 'js/histology-fifth-answer.js?v=1'))
      .then(() => window.HistologyPrototype ? undefined : resource('script', 'js/histology.js?v=22'))
      .then(() => window.HistologyAtlasPhotos ? undefined : resource('script', 'js/histology-atlas-data.js?v=1'))
      .then(() => AT.views.histology ? undefined : resource('script', 'js/views-histology.js?v=29'));
    histologyLoad = Promise.all([histologyCss, script]).then(() => { histologyReady = true; }).catch(err => { histologyLoad = null; throw err; });
    return histologyLoad;
  }
  // Практические навыки: общий интерфейс один, а данные грузятся по предмету.
  let skillsLoad = null, skillsCss = null, skillsReady = false;
  const SKILLS_DATA = {
    anatomySkills: ['js/anatomy-skills-data.js?v=2', 'js/anatomy-skills.js?v=6'],
    myologySkills: ['js/myology-data.js?v=2'],
  };
  // Файлы данных и описаний общие: их можно запросить один раз для всех предметов.
  const skillsFiles = new Map();
  function skillsFile(file) {
    const loaded = () => {
      if (file.indexOf('skills-engine') !== -1) return !!window.MedzoSkills;
      if (file.indexOf('skills-registry') !== -1) return !!window.MedzoSkillsRegistry;
      if (file.indexOf('views-skills') !== -1) return !!AT.views.skills;
      if (file.indexOf('anatomy-skills-data') !== -1) return !!window.AnatomySkillsData;
      if (file.indexOf('anatomy-skills.js') !== -1) return !!window.AnatomySkills;
      if (file.indexOf('myology-data') !== -1) return !!window.MedzoMyologyData;
      return false;
    };
    if (loaded()) return Promise.resolve();
    if (skillsFiles.has(file)) return skillsFiles.get(file);
    const task = resource('script', file).then(() => { if (!loaded()) throw new Error('Не удалось загрузить ' + file); })
      .catch((err) => { skillsFiles.delete(file); throw err; });
    skillsFiles.set(file, task);
    return task;
  }
  function loadSkills(subject) {
    const name = subject || 'anatomySkills';
    const files = SKILLS_DATA[name];
    if (!files) return Promise.reject(new Error('Неизвестный предмет навыков: ' + name));
    if (!skillsCss) skillsCss = resource('link', 'css/anatomy-skills.css?v=5').catch(err => { skillsCss = null; throw err; });
    // Порядок важен: движок, реестр предметов, затем данные предмета и оболочка.
    const chain = skillsFile('js/skills-engine.js?v=1')
      .then(() => skillsFile('js/skills-registry.js?v=1'))
      .then(() => files.reduce((step, file) => step.then(() => skillsFile(file)), Promise.resolve()))
      .then(() => skillsFile('js/views-skills.js?v=1'));
    return Promise.all([skillsCss, chain]).then(() => {
      // Реестр подключается вместе с предметом; если данных нет — это ошибка загрузки.
      const registry = window.MedzoSkillsRegistry;
      if (!registry || !registry.get(name)) throw new Error('Данные навыков не загрузились: ' + name);
    });
  }
  // Старое имя оставлено: на него ссылаются тесты.
  function loadAnatomySkills() { return loadSkills('anatomySkills'); }
  // Миология: тот же интерфейс навыков, данные — список мышц и иллюстрации.
  function loadMyology() { return loadSkills('myologySkills'); }
  let anatomyOralLoad = null, anatomyOralCss = null, anatomyOralReady = false;
  function loadAnatomyOral() {
    if (anatomyOralLoad) return anatomyOralLoad;
    if (!anatomyOralCss) anatomyOralCss=resource('link','css/anatomy-oral.css?v=4').catch(err=>{anatomyOralCss=null;throw err;});
    const script=(window.AnatomyOralData?Promise.resolve():resource('script','js/anatomy-oral-data.js?v=2'))
      .then(()=>window.AnatomyOralSource?undefined:resource('script','js/anatomy-oral-source.js?v=1'))
      .then(()=>window.AnatomySkillsData?undefined:resource('script','js/anatomy-skills-data.js?v=2'))
      .then(()=>window.AnatomyTicketSkills?undefined:resource('script','js/anatomy-ticket-skills.js?v=1'))
      .then(()=>window.AnatomyOral?undefined:resource('script','js/anatomy-oral.js?v=1'))
      .then(()=>AT.views.anatomyOral?undefined:resource('script','js/views-anatomy-oral.js?v=7'));
    anatomyOralLoad=Promise.all([anatomyOralCss,script]).then(()=>{anatomyOralReady=true;}).catch(err=>{anatomyOralLoad=null;throw err;});
    return anatomyOralLoad;
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

  // Теория есть у первого (билеты и карточки) и второго (вкладка «Вопросы и теория»).
  function theoryLink() {
    return AT.colloquium.id === '2'
      ? { label: 'Теория', href: '#/myology?section=questions' }
      : { label: 'Теория', href: '#/anatomy-oral?section=notes' };
  }
  function updateMobileNav(route, histology) {
    const items = histology
      ? [['Препараты','slide','#/histology?section=setup','setup'],['Атлас','atlas','#/histology?section=atlas','atlas'],['Ошибки','mistakes','#/histology?section=errors','errors'],['Статистика','stats','#/histology?section=stats','stats']]
      : [['Главная','home','#/','dashboard'],['Тренировка','train','#/tests','tests'],[theoryLink().label,'book',theoryLink().href,'anatomy-oral'],['Статистика','stats','#/stats','stats']];
    const active=histology?(route.params.section||'setup'):(route.name==='myology'?'anatomy-oral':trainingRoute(route)?'tests':route.name);
    document.querySelectorAll('[data-mobile-nav]').forEach((link,i)=>{
      const [label,iconName,href,key]=items[i];link.href=href;link.innerHTML=ui.icon(iconName)+'<span>'+label+'</span>';link.setAttribute('aria-label',label);
      link.classList.toggle('is-active',active===key);if(active===key)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
    });
  }

  function updateContext(route, histology) {
    const subject = document.getElementById('contextSubject');
    const base = document.getElementById('contextBase');
    const separator = document.getElementById('contextBaseSeparator');
    const page = document.getElementById('contextPage');
    const option = document.getElementById('colloquiumSelect').selectedOptions[0];
    const labels = {dashboard:'Главная', tests:'Тренировка · Базы', train:'Тренировка · Тесты', exam:'Экзамен', run:'Задания', summary:'Результат', mistakes:'Ошибки', portfolio:'Портфель', stats:'Статистика', rewards:'Награды', dungeon:'Подземелье', key:'Ключ', settings:'Настройки', profile:'Профиль', 'anatomy-skills':'Практические навыки', 'anatomy-oral':'Теория · 1 коллоквиум', myology:'Миология · 2 коллоквиум'};
    const skillsLabels = {skills:'Практические навыки', questions:'Вопросы и теория', sources:'Рисунки и источники'};
    const histologyLabels = {setup:'Препараты', atlas:'Атлас', structures:'Структуры', theory:'Тесты по теории', errors:'Ошибки', stats:'Статистика'};
    subject.textContent = histology ? 'Гистология' : 'Анатомия';
    subject.href = histology ? '#/histology' : '#/';
    base.hidden = separator.hidden = histology || ['profile','anatomy-oral','anatomy-skills','myology'].includes(route.name);
    if (!histology && option) base.value = option.value;
    // Подписи устной подготовки первого коллоквиума: у остальных её пока нет.
    const oralLabels = {cards:'Карточки · 1 коллоквиум', tickets:'Билеты · 1 коллоквиум'};
    const hasOral = AT.colloquium.id === '1';
    const skillsPage = route.name === 'myology' ? (skillsLabels[route.params.section] || 'Практические навыки') : null;
    page.textContent = histology ? (histologyLabels[route.params.section] || 'Препараты') : (route.name === 'anatomy-oral' && hasOral && oralLabels[route.params.section] || skillsPage || labels[route.name] || 'Страница');
  }

  // Старые ссылки сохранены; все тренировочные экраны образуют один раздел.
  // Какие разделы относятся к тренировке: у них показываются вкладки коллоквиума.
  function trainingSections(route) {
    return SECTION_ROUTES.indexOf(route.name) !== -1 ||
      (route.name === 'anatomy-oral' && ['cards','tickets'].includes(route.params.section));
  }
  function trainingRoute(route) {
    return trainingSections(route) || ['tests','run','summary'].includes(route.name);
  }
  // Разделы, между которыми переключает навигация коллоквиума.
  const SECTION_ROUTES = ['anatomy-skills','myology'];
  // Вкладки строятся по разделам коллоквиума, а не по жёсткому списку:
  // новый коллоквиум со навыками или теорией появляется здесь без правок.
  function trainingNav(route) {
    // Раздел навыков может принадлежать другому коллоквиуму (миология при
    // открытой первой базе), поэтому вкладки берём у того коллоквиума, который
    // сейчас на экране. Разделы уровня базы (тесты, ошибки) показываем только
    // для активной базы: иначе ссылка увела бы в чужую тренировку.
    const subject = window.MedzoSkillsRegistry && window.MedzoSkillsRegistry.SUBJECTS[skillsSubjectFor(route)];
    const target = subject ? (window.COLLOQUIUM_MODULES || {})[subject.colloquium] : null;
    const colloquium = target || AT.colloquium;
    const sameBank = colloquium.id === AT.colloquium.id;
    const baseSections = ['tests', 'train', 'exam', 'mistakes'];
    const sections = (colloquium.sections || []).filter((section) => sameBank || !baseSections.includes(section.key));
    // Для разделов с параметром (навыки, теория) активна вкладка этого раздела.
    const active = route.name === 'anatomy-oral' ? route.params.section : (route.name === 'myology' ? (route.params.section || 'skills') : route.name);
    const tabs = sections.map((section) => [section.section || section.route, section.label, section.href]);
    const nav = document.createElement('nav');
    nav.className = 'anatomy-training-nav';
    const colloquiumLabel = colloquium.kind === 'credit' ? 'зачёта' : 'коллоквиума ' + (colloquium.number || colloquium.id);
    nav.setAttribute('aria-label', 'Разделы ' + colloquiumLabel);
    nav.innerHTML = tabs.map(([key, label, href]) => '<a href="' + href + '"' + (key === active ? ' class="is-active" aria-current="page"' : '') + '>' + AT.utils.esc(label) + '</a>').join('');
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

    // Навыки — один маршрут для всех коллоквиумов; предмет задаёт параметр.
    if (viewName === 'skills') {
      const subject = skillsSubjectFor(route);
      const ready = window.MedzoSkillsRegistry && window.MedzoSkillsRegistry.get(subject) && AT.views.skills;
      if (!ready) {
        const title = subject === 'myologySkills' ? 'Миология · практические навыки' : 'Практические навыки';
        root.innerHTML = '<div class="view"><div class="card card--pad"><h1>' + title + '</h1><p>Загружаем список…</p></div></div>';
        updateNav(route.name);
        loadSkills(subject).then(() => { if (parseHash().name === route.name) render(); }).catch(err => {
          console.error(err);
          if (parseHash().name !== route.name) return;
          root.innerHTML = '<div class="view"><div class="card card--pad"><h1>Не удалось загрузить навыки</h1><p>Проверьте подключение и попробуйте ещё раз.</p><button class="btn btn--primary" id="skillsRetry">Повторить</button></div></div>';
          root.querySelector('#skillsRetry').addEventListener('click', render);
        });
        return;
      }
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

    if (viewName === 'dungeon' && !dungeonReady) {
      root.innerHTML = '<div class="view"><div class="card card--pad"><h1>Подземелье</h1><p>Загружаем игру…</p></div></div>';
      updateNav(route.name);
      loadDungeon().then(() => {
        if (parseHash().name === 'dungeon') render();
      }).catch(err => {
        console.error(err);
        if (parseHash().name !== 'dungeon') return;
        root.innerHTML = '<div class="view"><div class="card card--pad"><h1>Не удалось загрузить игру</h1><p>Проверьте подключение и попробуйте ещё раз.</p><button class="btn btn--primary" id="dungeonRetry">Повторить</button></div></div>';
        root.querySelector('#dungeonRetry').addEventListener('click', render);
      });
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
    if (trainingRoute(route) && !['run','summary'].includes(route.name) && AT.colloquium.sections && AT.colloquium.sections.length > 1) { const view=root.querySelector('.view'); if (view) view.prepend(trainingNav(route)); }
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

    const viewEl = root.querySelector('.view');
    if (viewEl) viewEl.classList.add('is-entering');
  }

  function updateNav(name) {
    if (!nav) return;
    const active = name === 'myology' ? 'anatomy-oral' : trainingRoute(parseHash()) ? 'tests' : name;
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

  // База могла не успеть загрузиться (медленная сеть, обрыв). Тогда вместо
  // пустых экранов сначала догружаем её и открываем запрошенную страницу.
  function bankReadyOrLoad(target) {
    if (!window.MedzoBanks || window.MedzoBanks.isLoaded(AT.colloquium.id) || !AT.colloquium.id) return true;
    if (bankLoading) return false;
    bankLoading = true;
    ui.toast('Загружаем базу вопросов…');
    window.MedzoBanks.load(AT.colloquium.id)
      .catch(() => { ui.toast('Не удалось загрузить базу. Проверьте подключение и попробуйте ещё раз.', 'warn'); })
      .then(() => { bankLoading = false; if (target) location.hash = target; else render(); });
    return false;
  }
  let bankLoading = false;
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#/"]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (window.MedzoBanks && window.MedzoBanks.isLoaded(AT.colloquium.id)) return;
    if (!bankReadyOrLoad(link.getAttribute('href'))) event.preventDefault();
  }, true);

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
        // База ещё не в памяти: подгружаем её здесь, чтобы после перезагрузки
        // страница открылась мгновенно из кэша браузера. Сбой загрузки не мешает
        // переключению — свежая страница попробует снова.
        if (window.MedzoBanks && !window.MedzoBanks.isLoaded(moduleSelect.value)) {
          window.MedzoBanks.load(moduleSelect.value).catch(() => null).then(() => location.reload());
        } else {
          location.reload();
        }
      } catch (e) {
        delete moduleSelect.dataset.nextRoute;
        moduleSelect.value = AT.colloquium.id;
        ui.toast('Не удалось переключить раздел: проверьте доступ к хранилищу браузера', 'warn');
      }
    });
    const quickSelect = document.getElementById('contextBase');
    quickSelect.innerHTML = moduleSelect.innerHTML;
    quickSelect.value = moduleSelect.value;
    quickSelect.addEventListener('change', () => { moduleSelect.value = quickSelect.value; moduleSelect.dispatchEvent(new Event('change', {bubbles:true})); });
    moduleSelect.addEventListener('change', () => { quickSelect.value = moduleSelect.value; });
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
  // На старте активная база загружена синхронно. Если её нет — файл не пришёл:
  // догружаем и только потом запускаем core.js заново, иначе словари вопросов,
  // сессий и портфеля останутся пустыми до перезагрузки страницы.
  if (window.MedzoBanks && !window.MedzoBanks.isLoaded(AT.colloquium.id)) {
    root.innerHTML = '<div class="view"><div class="card card--pad"><h1>' + AT.utils.esc(AT.colloquium.name) + '</h1><p>Загружаем вопросы базы…</p></div></div>';
    window.MedzoBanks.load(AT.colloquium.id).catch(() => null).then((ok) => { if (ok) window.location.reload(); else render(); });
  } else {
    render();
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
