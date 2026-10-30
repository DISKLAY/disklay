/* ============================================================================
   core.js — состояние, ключ ответов, подсчёт результатов
   ========================================================================== */
(function () {
  'use strict';

  const COLLOQUIUM = window.ACTIVE_COLLOQUIUM || { id: '1', name: 'Остеология и артросиндесмология', source: 'База теста 1 коллоквиум', examAvailable: true };
  // Ключ первого коллоквиума не меняется: старый прогресс и правки сохраняются.
  const STORAGE_KEY = COLLOQUIUM.id === '1' ? 'anatomy-colloquium-v1' : 'anatomy-colloquium-v1-' + COLLOQUIUM.id;
  const MAX_SESSIONS = 60;

  /* ------------------------------------------------------------------ utils */

  const utils = {
    esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    clamp(n, min, max) {
      return Math.max(min, Math.min(max, n));
    },
    pct(part, total) {
      if (!total) return 0;
      return Math.round((part / total) * 100);
    },
    plural(n, one, few, many) {
      const abs = Math.abs(n) % 100;
      const last = abs % 10;
      if (abs > 10 && abs < 20) return many;
      if (last > 1 && last < 5) return few;
      if (last === 1) return one;
      return many;
    },
    pad(n) {
      return String(n).padStart(2, '0');
    },
    formatDuration(sec) {
      sec = Math.max(0, Math.round(sec));
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      if (h > 0) return h + ':' + utils.pad(m) + ':' + utils.pad(s);
      return utils.pad(m) + ':' + utils.pad(s);
    },
    formatDate(ts) {
      const d = new Date(ts);
      return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) +
        ', ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    },
    clone(o) {
      return JSON.parse(JSON.stringify(o));
    },
  };

  /* ---------------------------------------------------------------- dataset */

  const QUESTIONS = (window.QUESTIONS || []).slice();
  const TOPICS = (window.TOPICS || []).slice();
  const byId = new Map();
  const byNum = new Map();
  const byPos = new Map();
  QUESTIONS.forEach((q) => {
    byId.set(q.id, q);
    byNum.set(String(q.num), q);
    byPos.set(q.pos, q);
  });

  const dataset = {
    questions: QUESTIONS,
    topics: TOPICS,
    byId,
    byNum,
    byPos,
    topic(id) {
      return TOPICS.find((t) => t.id === id) || { id: 'all', title: 'Все вопросы', subtitle: '' };
    },
    topicQuestions(topicId) {
      if (!topicId || topicId === 'all') return QUESTIONS.slice();
      return QUESTIONS.filter((q) => q.topic === topicId);
    },
    topicIndex(id) {
      return TOPICS.findIndex((t) => t.id === id);
    },
    total: QUESTIONS.length,
  };

  /* ------------------------------------------------------------- exam plan */

  function examPoolFor(section) {
    const pool = (section && section.pool) || {};
    let out = [];
    (pool.topics || []).forEach((id) => { out = out.concat(dataset.topicQuestions(id)); });
    (pool.nums || []).forEach((n) => {
      const q = byNum.get(String(n));
      if (q) out.push(q);
    });
    const uniq = new Map();
    out.forEach((q) => uniq.set(q.id, q));
    return [...uniq.values()];
  }

  const RAW_EXAM_SECTIONS = window.EXAM_SECTIONS || [];

  const examPlan = {
    minutes: window.EXAM_MINUTES || 20,
    total: 0,
    sections: RAW_EXAM_SECTIONS.map((sec) => {
      const questions = examPoolFor(sec);
      return { id: sec.id, title: sec.title, questions, count: sec.count };
    }),
  };
  examPlan.total = examPlan.sections.reduce((s, sec) => s + sec.count, 0);

  /** Собирает экзамен: случайные вопросы в пределах квоты каждого раздела. */
  function buildExam() {
    const ids = [];
    const sectionOf = {};
    for (const sec of examPlan.sections) {
      const available = sec.questions.filter((q) => !Object.prototype.hasOwnProperty.call(sectionOf, q.id));
      if (available.length < sec.count) return null;
      utils.shuffle(available).slice(0, sec.count).forEach((q) => {
        ids.push(q.id);
        sectionOf[q.id] = sec.title;
      });
    }
    return ids.length === 20 ? { ids, sectionOf } : null;
  }

  /* ---------------------------------------------------------------- storage */

  const DEFAULT_STATE = {
    version: 1,
    settings: {
      theme: 'auto',
      strict: true,
      hintCount: false,
      shuffleAnswers: true,
    },
    key: {},          // правки/импорт: { "1": [1,2] }
    keyMeta: { updatedAt: null, source: '' },
    progress: {},     // { q1: {attempts, correct, wrong, streak, last, lastAt} }
    favorites: {},    // личные закладки вопросов текущей базы
    comments: {},     // личные комментарии к вопросам текущей базы
    sessions: [],     // история
    session: null,    // текущая/незавершённая сессия
    seen: {},         // служебное
  };

  function mergeDefaults(base, incoming) {
    const out = utils.clone(base);
    if (!incoming || typeof incoming !== 'object') return out;
    Object.keys(incoming).forEach((k) => {
      const v = incoming[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
        out[k] = mergeDefaults(out[k], v);
      } else if (v !== undefined) {
        out[k] = v;
      }
    });
    return out;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return utils.clone(DEFAULT_STATE);
      return mergeDefaults(DEFAULT_STATE, JSON.parse(raw));
    } catch (e) {
      console.warn('Не удалось прочитать сохранение', e);
      return utils.clone(DEFAULT_STATE);
    }
  }

  let state = loadState();
  let saveTimer = null;

  function save(immediate) {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    const write = () => {
      try {
        // Учитываем покупки из других вкладок, прежде чем сохранить локальный кошелёк.
        if (window.AT && window.AT.game) window.AT.game.ensure();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
      } catch (e) {
        console.warn('Не удалось сохранить прогресс', e);
        return false;
      }
    };
    if (immediate) return write();
    saveTimer = setTimeout(write, 200);
  }

  /* -------------------------------------------------------------- key logic */

  const baseKey = window.ANSWER_KEY || {};
  const baseMeta = window.ANSWER_KEY_META || {};

  function normalizeAnswers(raw, optCount) {
    if (raw == null) return [];
    let arr;
    if (Array.isArray(raw)) arr = raw;
    else if (typeof raw === 'number') arr = [raw];
    else if (typeof raw === 'string') arr = raw.split(/[\s,;./|]+/).filter(Boolean);
    else return [];
    const set = new Set();
    arr.forEach((v) => {
      let n = typeof v === 'number' ? v : parseInt(String(v).trim(), 10);
      if (!isNaN(n) && n >= 1 && n <= optCount) set.add(n);
    });
    return [...set].sort((a, b) => a - b);
  }

  const keyApi = {
    /** Правильный ответ для вопроса: локальная правка → база. */
    forQuestion(q) {
      if (!q) return null;
      const num = String(q.num);
      let raw = null;
      let source = null;
      if (Object.prototype.hasOwnProperty.call(state.key, num)) {
        raw = state.key[num];
        source = 'local';
      } else if (Object.prototype.hasOwnProperty.call(baseKey, num)) {
        raw = baseKey[num];
        source = 'base';
      }
      if (raw == null) return null;
      const answers = normalizeAnswers(raw, q.options.length);
      if (!answers.length) return null;
      return { answers, source };
    },
    has(q) {
      return !!keyApi.forQuestion(q);
    },
    count() {
      return QUESTIONS.filter((q) => keyApi.forQuestion(q)).length;
    },
    isComplete() {
      return keyApi.count() === QUESTIONS.length;
    },
    sourceLabel(source) {
      if (source === 'base') return 'из базы';
      if (source === 'local') return 'мой ответ';
      return '';
    },
    set(q, answers) {
      const clean = normalizeAnswers(answers, q.options.length);
      if (!clean.length) {
        delete state.key[String(q.num)];
      } else {
        state.key[String(q.num)] = clean;
      }
      state.keyMeta.updatedAt = Date.now();
      save();
      return clean;
    },
    clear(q) {
      delete state.key[String(q.num)];
      save();
    },
    /** Значения для экспорта: локальные правки поверх базы. */
    exportMap() {
      const out = {};
      QUESTIONS.forEach((q) => {
        const a = keyApi.forQuestion(q);
        if (a) out[String(q.num)] = a.answers;
      });
      return out;
    },
    exportText() {
      const map = keyApi.exportMap();
      return Object.keys(map)
        .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
        .map((num) => num + ': ' + map[num].join(', '))
        .join('\n');
    },
  };

  /* ------------------------------------------------------------ key parser */

  const CYR_LETTERS = { 'а': 1, 'б': 2, 'в': 3, 'г': 4, 'д': 5, 'е': 6 };
  const LAT_LETTERS = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 };

  function letterToIndex(tok) {
    const ch = tok.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(LAT_LETTERS, ch)) return LAT_LETTERS[ch];
    if (Object.prototype.hasOwnProperty.call(CYR_LETTERS, ch)) return CYR_LETTERS[ch];
    return null;
  }

  function parseAnswerTokens(payload, optCount) {
    const out = new Set();
    const problems = [];
    const cleaned = payload
      .replace(/[()\[\]{}]/g, ' ')
      .replace(/\s*(?:и|and)\s+/gi, ' ')
      .trim();
    const tokens = cleaned.split(/[\s,;.|/]+/).filter(Boolean);

    tokens.forEach((rawTok) => {
      let tok = rawTok.replace(/^[№#]+/, '').replace(/[.:;]+$/, '').replace(/^[-–—]+/, '');
      if (!tok) return;

      // диапазон 1-3 / 1–3
      const range = tok.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
      if (range) {
        let a = parseInt(range[1], 10);
        let b = parseInt(range[2], 10);
        if (a > b) [a, b] = [b, a];
        for (let i = a; i <= b; i++) if (i >= 1 && i <= optCount) out.add(i);
        return;
      }

      if (/^\d+$/.test(tok)) {
        const n = parseInt(tok, 10);
        if (n >= 1 && n <= optCount) {
          out.add(n);
          return;
        }
        // слитная запись вида 135 или 24
        const digits = tok.split('').map(Number);
        if (digits.every((d) => d >= 1 && d <= optCount)) {
          digits.forEach((d) => out.add(d));
          return;
        }
        problems.push(tok);
        return;
      }

      // буквы, возможно слитно: «авд»
      const chars = tok.split('');
      const mapped = chars.map(letterToIndex);
      if (mapped.every((v) => v != null && v >= 1 && v <= optCount)) {
        mapped.forEach((v) => out.add(v));
        return;
      }
      problems.push(tok);
    });

    return { answers: [...out].sort((a, b) => a - b), problems };
  }

  function normalizeNumToken(tok) {
    let t = String(tok).trim().toLowerCase().replace(/^№/, '');
    t = t.replace(/[.)]+$/, '');
    if (/^\d+[аaбb]$/.test(t)) {
      const n = t.slice(0, -1);
      return n + 'а';
    }
    if (/^\d+\.\d+$/.test(t)) return t;
    return t;
  }

  const keyParser = {
    /**
     * Разбирает текст ключа. Поддерживаются:
     *   1: 1, 3, 5       1. 135       1 — а,в,д       1 = 2 4
     *   {"1": [1,2]}     [{ "num": 1, "answers": [1,2] }]
     * Возвращает { entries: [{num, answers, question}], unknownNums, problems }
     */
    parse(text, options) {
      const byPosition = !!(options && options.byPosition);
      const result = { entries: [], unknownNums: [], problems: [], json: false };
      if (!text || !text.trim()) return result;
      const trimmed = text.trim();

      if (trimmed[0] === '{' || trimmed[0] === '[') {
        let parsed;
        try {
          parsed = JSON.parse(trimmed);
        } catch (e) {
          result.problems.push('JSON не распознан: ' + e.message);
          return result;
        }
        result.json = true;
        const items = [];
        if (Array.isArray(parsed)) {
          parsed.forEach((it) => {
            if (it && typeof it === 'object') {
              const num = it.num != null ? it.num : it.number != null ? it.number : it.qnum;
              const ans = it.answers || it.correct || it.keys || it.values;
              if (num != null) items.push([num, ans]);
            }
          });
        } else if (parsed && typeof parsed === 'object') {
          const container = Array.isArray(parsed.questions) ? parsed.questions : null;
          if (container) {
            container.forEach((it) => {
              if (it && typeof it === 'object') {
                const num = it.num != null ? it.num : it.number != null ? it.number : it.qnum;
                const ans = it.answers || it.correct || it.keys || it.values;
                if (num != null) items.push([num, ans]);
              }
            });
          } else {
            Object.keys(parsed).forEach((k) => items.push([k, parsed[k]]));
          }
        }
        items.forEach(([num, ans]) => {
          const q = lookupQuestion(num, byPosition);
          if (!q) {
            result.unknownNums.push(String(num));
            return;
          }
          const answers = normalizeAnswers(ans, q.options.length);
          if (!answers.length) {
            result.problems.push('№' + num + ': нет корректных вариантов');
            return;
          }
          result.entries.push({ num: String(q.num), answers, question: q });
        });
        return result;
      }

      // текстовый формат
      let body = trimmed.replace(/\r/g, '');
      // несколько записей в одной строке: "1: 2,3  2: 1,4" / "1:23 2:14"
      body = body.replace(/(\d{1,3}[аaб]?)\s*[:=]\s*([^\n]*?)(?=\s+\d{1,3}[аaб]?\s*[:=]|$)/g, (m, n, a) => '\n' + n + ': ' + a);

      const lines = body.split('\n');
      lines.forEach((lineRaw) => {
        let line = lineRaw.trim();
        if (!line) return;
        if (/^(#|\/\/)/.test(line)) return;
        line = line.replace(/^[•\-–—*]\s*/, '');
        line = line.replace(/^(вопрос|вопр\.?|q)\s*/i, '');
        const m = line.match(/^(\d{1,3}[аaбb]?(?:\.\d+)?)\s*(?:[).:\-–—=]|\s)\s*(.+)$/);
        if (!m) {
          if (/^\d+$/.test(line)) {
            result.problems.push('Строка без ответа: «' + line + '»');
          }
          return;
        }
        const numTok = normalizeNumToken(m[1]);
        const q = lookupQuestion(numTok, byPosition);
        if (!q) {
          result.unknownNums.push(numTok);
          return;
        }
        const parsedAns = parseAnswerTokens(m[2], q.options.length);
        if (!parsedAns.answers.length) {
          result.problems.push('№' + numTok + ': не удалось разобрать «' + m[2] + '»');
          return;
        }
        result.entries.push({ num: String(q.num), answers: parsedAns.answers, question: q });
      });

      return result;
    },
  };

  function lookupQuestion(token, byPosition) {
    const t = String(token).trim().toLowerCase().replace(/^№/, '').replace(/^вопрос\s*/, '');
    // явная позиция: "p92" или "поз.92"
    const posMatch = t.match(/^(?:p|поз\.?|позиция)\s*(\d+)$/);
    if (posMatch && byPos.has(parseInt(posMatch[1], 10))) return byPos.get(parseInt(posMatch[1], 10));
    if (byPosition && /^\d+$/.test(t) && byPos.has(parseInt(t, 10))) {
      return byPos.get(parseInt(t, 10));
    }
    if (byNum.has(t)) return byNum.get(t);
    const noZero = t.replace(/^0+/, '');
    if (byNum.has(noZero)) return byNum.get(noZero);
    // 58.2 → дубль 58
    if (/^\d+\.2$/.test(t)) {
      const q = byNum.get(t.replace(/\.2$/, 'а'));
      if (q) return q;
    }
    return null;
  }

  /* --------------------------------------------------------------- grading */

  function gradeQuestion(q, selected) {
    const answer = keyApi.forQuestion(q);
    const sel = [...new Set(selected)].sort((a, b) => a - b);
    const base = {
      selected: sel,
      answered: sel.length > 0,
      hasKey: !!answer,
      answer: answer ? answer.answers : null,
      source: answer ? answer.source : null,
      correct: null,
      hit: [],
      extra: [],
      missed: [],
      score: 0,
    };
    if (!answer) return base;
    const correctSet = new Set(answer.answers);
    const selSet = new Set(sel);
    base.hit = sel.filter((i) => correctSet.has(i));
    base.extra = sel.filter((i) => !correctSet.has(i));
    base.missed = answer.answers.filter((i) => !selSet.has(i));
    const recall = base.hit.length / answer.answers.length;
    const precision = sel.length ? base.hit.length / sel.length : 0;
    base.score = Math.max(0, Math.min(1, recall - (1 - precision)));
    if (state.settings.strict) {
      base.correct = sel.length === answer.answers.length && base.extra.length === 0;
    } else {
      base.correct = base.extra.length === 0 && recall >= 0.6;
    }
    return base;
  }

  /* -------------------------------------------------------------- progress */

  function progressOf(qid) {
    return state.progress[qid] || { attempts: 0, correct: 0, wrong: 0, streak: 0, last: null, lastAt: 0 };
  }

  function recordAttempt(q, isCorrect, selected) {
    const p = progressOf(q.id);
    p.attempts += 1;
    p.lastAt = Date.now();
    p.lastSelected = Array.isArray(selected) ? selected.slice() : [];
    if (isCorrect) {
      p.correct += 1;
      p.streak = (p.streak || 0) + 1;
      p.last = 'correct';
    } else {
      p.wrong += 1;
      p.streak = 0;
      p.last = 'wrong';
    }
    state.progress[q.id] = p;
    if (window.AT && window.AT.game) window.AT.game.syncAchievements();
    save();
  }

  function mastery(q) {
    const p = progressOf(q.id);
    if (!p.attempts) return 'new';
    if (p.streak >= 2) return 'mastered';
    return 'learning';
  }

  const analytics = {
    progressOf,
    mastery,
    overall() {
      let attempts = 0;
      let correct = 0;
      let mastered = 0;
      let started = 0;
      QUESTIONS.forEach((q) => {
        const p = progressOf(q.id);
        attempts += p.attempts;
        correct += p.correct;
        if (p.attempts) started += 1;
        if (p.streak >= 2) mastered += 1;
      });
      return {
        attempts,
        correct,
        accuracy: attempts ? Math.round((correct / attempts) * 100) : 0,
        mastered,
        started,
        total: QUESTIONS.length,
        untouched: QUESTIONS.length - started,
      };
    },
    byTopic() {
      return TOPICS.map((t) => {
        const qs = dataset.topicQuestions(t.id);
        let attempts = 0;
        let correct = 0;
        let started = 0;
        let mastered = 0;
        qs.forEach((q) => {
          const p = progressOf(q.id);
          attempts += p.attempts;
          correct += p.correct;
          if (p.attempts) started += 1;
          if (p.streak >= 2) mastered += 1;
        });
        return {
          topic: t,
          total: qs.length,
          attempts,
          correct,
          started,
          mastered,
          accuracy: attempts ? Math.round((correct / attempts) * 100) : 0,
          coverage: qs.length ? Math.round((started / qs.length) * 100) : 0,
          mastery: qs.length ? Math.round((mastered / qs.length) * 100) : 0,
          keyed: qs.filter((q) => keyApi.has(q)).length,
        };
      });
    },
    mistakes() {
      return QUESTIONS.filter((q) => {
        const p = progressOf(q.id);
        return p.wrong > 0 && p.streak < 2;
      });
    },
    weakestTopics(limit) {
      return analytics
        .byTopic()
        .filter((t) => t.attempts > 0)
        .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total)
        .slice(0, limit || 3);
    },
  };

  // Закладки и заметки привязаны к ID вопроса и не влияют на ответы или прогресс.
  const annotations = {
    isFavorite(qid) { return !!(state.favorites && state.favorites[qid]); },
    toggleFavorite(qid) {
      if (!byId.has(qid)) return false;
      if (!state.favorites || typeof state.favorites !== 'object' || Array.isArray(state.favorites)) state.favorites = {};
      if (state.favorites[qid]) delete state.favorites[qid];
      else state.favorites[qid] = true;
      return save(true);
    },
    comment(qid) {
      const value = state.comments && state.comments[qid];
      return typeof value === 'string' ? value : '';
    },
    setComment(qid, text) {
      if (!byId.has(qid) || typeof text !== 'string') return false;
      if (!state.comments || typeof state.comments !== 'object' || Array.isArray(state.comments)) state.comments = {};
      if (text) state.comments[qid] = text.slice(0, 5000);
      else delete state.comments[qid];
      return save(true);
    },
  };

  /* --------------------------------------------------------------- sessions */

  function pickQuestions(opts) {
    const topicIds = opts.topicIds && opts.topicIds.length ? opts.topicIds : ['all'];
    let pool = [];
    topicIds.forEach((id) => {
      pool = pool.concat(dataset.topicQuestions(id));
    });
    const uniq = new Map();
    pool.forEach((q) => uniq.set(q.id, q));
    pool = [...uniq.values()];

    const scope = opts.scope || 'smart';
    if (scope === 'favorites') {
      pool = pool.filter((q) => annotations.isFavorite(q.id));
    } else if (scope === 'wrong') {
      pool = pool.filter((q) => {
        const p = progressOf(q.id);
        return p.wrong > 0 && p.streak < 2;
      });
    } else if (scope === 'unseen') {
      pool = pool.filter((q) => progressOf(q.id).attempts === 0);
    } else if (scope === 'learning') {
      pool = pool.filter((q) => progressOf(q.id).streak < 2);
    }

    if (opts.shuffle) pool = utils.shuffle(pool);

    if (scope === 'smart' && !opts.shuffle) {
      pool = utils.shuffle(pool).sort((a, b) => {
        const pa = progressOf(a.id);
        const pb = progressOf(b.id);
        const wa = pa.last === 'wrong' ? 0 : pa.attempts === 0 ? 1 : pa.streak >= 2 ? 3 : 2;
        const wb = pb.last === 'wrong' ? 0 : pb.attempts === 0 ? 1 : pb.streak >= 2 ? 3 : 2;
        if (wa !== wb) return wa - wb;
        return pa.attempts - pb.attempts;
      });
    }

    if (opts.limit && opts.limit > 0) pool = pool.slice(0, opts.limit);
    return pool.map((q) => q.id);
  }

  // Внутренние номера вариантов всегда соответствуют исходной базе и ключу.
  // Только отображаемый порядок записывается в сессию и не меняется при возврате к вопросу.
  function optionOrder(session, q) {
    const count = q.options.length;
    const identity = Array.from({ length: count }, (_, i) => i + 1);
    const saved = session && session.optionOrders && session.optionOrders[q.id];
    if (!Array.isArray(saved) || saved.length !== count ||
        saved.some(i => !Number.isInteger(i) || i < 1 || i > count) || new Set(saved).size !== count) return identity;
    return saved.slice();
  }

  // Обобщающие варианты вроде «все перечисленное» оставляем в исходном порядке.
  function optionsAreOrderDependent(q) {
    return q.options.some(text => /(?:вс[её]|ничего|ни\s+один)[^.!?]{0,40}перечислен|вышеперечислен|нижеперечислен|предыдущ(?:ий|ие|их)\s+(?:вариант|ответ)|(?:вариант|ответ)[а-я]*\s*(?:№|номер)\s*\d/i.test(text));
  }

  function startSession(config) {
    const mode = config.mode === 'exam' ? 'exam' : 'train';
    const ids = config.ids || pickQuestions(config);
    if (!ids.length) return null;
    const limitSeconds = mode === 'exam' && config.timerMinutes ? Math.round(config.timerMinutes * 60) : 0;
    const optionOrders = {};
    if (state.settings.shuffleAnswers) ids.forEach(id => {
      const q = byId.get(id);
      if (q && !optionsAreOrderDependent(q)) optionOrders[id] = utils.shuffle(Array.from({ length: q.options.length }, (_, i) => i + 1));
    });
    const session = {
      id: 's' + Date.now(),
      mode,
      scope: config.scope || 'smart',
      topicIds: config.topicIds && config.topicIds.length ? config.topicIds : ['all'],
      ids,
      optionOrders,
      index: 0,
      results: {},
      startedAt: Date.now(),
      elapsed: 0,
      limitSeconds,
      finished: false,
      selfCheck: false,
      label: config.label || '',
      sectionOf: config.sectionOf || null,
    };
    state.session = session;
    save(true);
    return session;
  }

  function currentSession() {
    return state.session && !state.session.finished ? state.session : null;
  }

  function sessionQuestions(session) {
    return (session.ids || []).map((id) => byId.get(id)).filter(Boolean);
  }

  function sessionStats(session) {
    const qs = sessionQuestions(session);
    let answered = 0;
    let correct = 0;
    let self = 0;
    qs.forEach((q) => {
      const r = session.results[q.id];
      if (!r) return;
      if (r.self) self += 1;
      if (r.correct !== null && r.correct !== undefined) {
        answered += 1;
        if (r.correct) correct += 1;
      }
    });
    return {
      total: qs.length,
      answered,
      correct,
      wrong: answered - correct,
      accuracy: answered ? Math.round((correct / answered) * 100) : 0,
      self,
    };
  }

  /**
   * Проверяет ответы сессии перед подведением итогов.
   * В экзамене проверка отложенная: считаем всё сразу при завершении.
   */
  function gradeSession(session) {
    if (!session || session.graded) return 0;
    // В тренировке каждая попытка уже записана при проверке или пропуске.
    if (session.mode !== 'exam') {
      session.graded = true;
      save(true);
      return 0;
    }
    const qs = sessionQuestions(session);
    let graded = 0;
    qs.forEach((q) => {
      const answer = keyApi.forQuestion(q);
      if (!answer) return;                     // без ключа — остаётся самооценка
      let entry = session.results[q.id];
      const selected = entry && entry.selected ? entry.selected.slice() : [];
      const res = gradeQuestion(q, selected);
      if (!entry) {
        entry = session.results[q.id] = { selected: [], revealed: true, correct: null, self: false };
      }
      entry.gamePreviouslyMastered = (progressOf(q.id).streak || 0) >= 2;
      entry.correct = res.correct;
      entry.revealed = true;
      entry.self = false;
      entry.graded = true;
      recordAttempt(q, res.correct, selected);
      graded += 1;
    });
    if (window.AT.game) window.AT.game.awardExam(session, qs);
    session.graded = true;
    save(true);
    return graded;
  }

  function finishSession() {
    const session = state.session;
    if (!session) return null;
    session.finished = true;
    session.finishedAt = Date.now();
    const stats = sessionStats(session);
    const record = {
      id: session.id,
      mode: session.mode,
      scope: session.scope,
      label: session.label,
      date: session.finishedAt,
      startedAt: session.startedAt,
      total: stats.total,
      answered: stats.answered,
      correct: stats.correct,
      accuracy: stats.accuracy,
      duration: Math.round((session.finishedAt - session.startedAt) / 1000),
      topicIds: session.topicIds,
      selfCheck: stats.self > 0,
      assisted: !!(session.game && (session.game.hintsUsed || session.game.bonusUsed)),
    };
    state.sessions.unshift(record);
    state.sessions = state.sessions.slice(0, MAX_SESSIONS);
    if (window.AT.game) window.AT.game.syncAchievements();
    save(true);
    return record;
  }

  function discardSession() {
    state.session = null;
    save(true);
  }

  function resetProgress() {
    state.progress = {};
    state.sessions = [];
    state.session = null;
    delete state.game;
    if (window.AT.game) window.AT.game.ensure();
    save(true);
  }

  /* ------------------------------------------------------------------- api */

  window.AT = {
    utils,
    dataset,
    colloquium: COLLOQUIUM,
    keyApi,
    keyParser,
    gradeQuestion,
    recordAttempt,
    progressOf,
    analytics,
    annotations,
    pickQuestions,
    optionOrder,
    examPlan,
    buildExam,
    startSession,
    currentSession,
    sessionQuestions,
    sessionStats,
    gradeSession,
    finishSession,
    discardSession,
    resetProgress,
    getState: () => state,
    save,
    normalizeAnswers,
    lookupQuestion,
  };
})();
