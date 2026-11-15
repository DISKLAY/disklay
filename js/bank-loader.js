/* Ленивая загрузка баз вопросов.
   На старте подключены только данные активной базы; остальные банки
   подключаются, когда они действительно нужны (портфель, достижения, статистика,
   смена базы). Один и тот же файл никогда не подключается дважды. */
(function () {
  'use strict';

  // Какой файл и какое глобальное имя соответствует каждой базе.
  const FILES = {
    '1': ['js/data/questions.js', 'js/data/answers.js'],
    '2': ['js/data/colloquium-2.js'],
    '3': ['js/data/colloquium-3.js'],
    '4': ['js/data/colloquium-4.js'],
    '5': ['js/data/colloquium-5.js'],
    '6': ['js/data/colloquium-6.js'],
    '7': ['js/data/colloquium-7.js'],
    'credit-1': ['js/data/credit-1.js'],
    'credit-2': ['js/data/credit-2.js'],
    'stom-2': ['js/data/dental-2.js'],
    'stom-3': ['js/data/dental-3.js'],
  };
  const GLOBALS = {
    '1': 'QUESTIONS',
    '2': 'COLLOQUIUM_2',
    '3': 'COLLOQUIUM_3',
    '4': 'COLLOQUIUM_4',
    '5': 'COLLOQUIUM_5',
    '6': 'COLLOQUIUM_6',
    '7': 'COLLOQUIUM_7',
    'credit-1': 'CREDIT_1',
    'credit-2': 'CREDIT_2',
    'stom-2': 'DENTAL_2',
    'stom-3': 'DENTAL_3',
  };

  // Версия для сброса кэша браузера. Поднимайте вместе с ?v= у остальных файлов.
  const VERSION = '20261115';

  const pending = new Map();

  /** Загружена ли база (есть объект с вопросами). */
  function isLoaded(id) {
    const name = GLOBALS[id];
    if (!name) return false;
    const global = window[name];
    if (id === '1') return Array.isArray(global) && global.length > 0;
    return !!(global && Array.isArray(global.questions) && global.questions.length);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src + (src.indexOf('?') === -1 ? '?v=' + VERSION : '');
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => { script.remove(); reject(new Error('Не удалось загрузить ' + src)); };
      document.head.appendChild(script);
    });
  }

  /**
   * Подключает базу, если она ещё не подключена.
   * Возвращает Promise, который резолвится тем же объектом базы.
   */
  function load(id) {
    if (isLoaded(id)) return Promise.resolve(window[GLOBALS[id]]);
    if (!FILES[id]) return Promise.reject(new Error('Неизвестная база: ' + id));
    if (pending.has(id)) return pending.get(id);
    const task = FILES[id]
      .reduce((chain, src) => chain.then(() => loadScript(src)), Promise.resolve())
      .then(() => {
        if (!isLoaded(id)) throw new Error('База ' + id + ' загрузилась без данных');
        // Метаданные могли быть устаревшими — уточняем их по факту.
        remember(id);
        return window[GLOBALS[id]];
      })
      .catch((err) => { pending.delete(id); throw err; });
    pending.set(id, task);
    return task;
  }

  /** Загружает все базы: нужно портфелю и достижениям. */
  function loadAll() {
    return Promise.all(Object.keys(FILES).map((id) => load(id).catch(() => null)));
  }

  /** Уточняет число вопросов, если реальность разошлась с манифестом. */
  function remember(id) {
    const index = window.MEDZO_BANK_INDEX;
    if (!index) return;
    const module = (window.COLLOQUIUM_MODULES || {})[id];
    const questions = module && module.questions;
    if (!Array.isArray(questions)) return;
    if (!index[id]) index[id] = { questions: 0, keyed: 0, topics: [], topicTitles: {} };
    index[id].questions = questions.length;
    const map = (window.MEDZO_BANK_QUESTIONS || {})[id];
    // Манифест мог быть собран до правки базы — тогда обновляем номера по факту.
    if (map && (!map.nums || map.nums.length !== questions.length)) {
      const byTopic = {};
      questions.forEach((q) => {
        const topic = String(q.topic);
        (byTopic[topic] = byTopic[topic] || []).push(q.num);
      });
      map.nums = questions.map((q) => q.num);
      map.topics = byTopic;
    }
  }

  window.MedzoBanks = { isLoaded, load, loadAll, FILES, VERSION };
})();
