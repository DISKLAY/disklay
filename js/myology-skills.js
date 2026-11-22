/* Практические навыки второго коллоквиума (миология) — независимая самооценка.
   Локальное состояние: medzo-myology-skills-v1 (избранное, заметки, шаги, сессия).
   Совместимость: medzo-myology-practice-v1 сохраняет формат { skills, questions,
   preferences, session:{order,index} }, его читают синхронизация и старые клиенты:
   {skills:{id:'known'|'again'}, questions:{id:...}} — только эти две карты уезжают
   на сервер. Остальное живёт только в этом браузере. */
(function () {
  'use strict';
  const data = window.MedzoMyologyData;
  const KEY = 'medzo-myology-skills-v1';
  const SYNC_KEY = 'medzo-myology-practice-v1';
  const byId = Object.fromEntries(data.skills.map(item => [item.id, item]));
  const groups = new Set(data.groups.map(g => g.id));
  const scopes = ['all', 'unseen', 'again', 'favorites'];
  const isMark = value => value === 'known' || value === 'again';

  function emptyState() {
    return { group: 'all', scope: 'all', limit: 10, sequence: 'random', favorites: {}, stats: {}, notes: {}, session: null, questions: {} };
  }
  function readJSON(store, key, fallback) {
    try { const raw = store.getItem(key); if (raw === null) return fallback; const value = JSON.parse(raw); return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback; } catch (_) { return fallback; }
  }
  function create(store, random) {
    random = random || Math.random;
    const state = emptyState();
    let failed = false, lastSync = null;
    // --- чтение локального состояния и миграция с предыдущей версии
    const local = readJSON(store, KEY, null);
    let rawSync = null;
    try { rawSync = store.getItem(SYNC_KEY); } catch (_) { rawSync = null; }
    const legacy = readJSON(store, SYNC_KEY, {});
    if (typeof rawSync === 'string') lastSync = rawSync;
    const legacyPrefs = legacy.preferences && typeof legacy.preferences === 'object' ? legacy.preferences : {};
    if (local) {
      Object.assign(state, {
        group: local.group === 'all' || groups.has(local.group) || (Array.isArray(local.group) && local.group.length && local.group.every(id => groups.has(id))) ? local.group : 'all',
        scope: scopes.includes(local.scope) ? local.scope : 'all',
        limit: [0, 10, 20, 50].includes(local.limit) ? local.limit : 10,
        sequence: ['random', 'ordered'].includes(local.sequence) ? local.sequence : 'random',
        favorites: local.favorites && typeof local.favorites === 'object' ? { ...local.favorites } : {},
        stats: local.stats && typeof local.stats === 'object' ? { ...local.stats } : {},
        notes: local.notes && typeof local.notes === 'object' ? { ...local.notes } : {},
        questions: local.questions && typeof local.questions === 'object' ? Object.fromEntries(Object.entries(local.questions).filter(([id, mark]) => { const n = Number(id); return n >= 1 && n <= 66 && isMark(mark); })) : {},
      });
      const s = local.session;
      if (s && Array.isArray(s.order) && s.order.length && s.order.length <= data.skills.length && s.order.every(id => byId[id]) && new Set(s.order).size === s.order.length && Number.isInteger(s.index) && s.index >= 0 && s.index < s.order.length) {
        const answers = {}, hints = {};
        s.order.forEach(id => { if (s.answers && isMark(s.answers[id])) answers[id] = s.answers[id]; if (s.hints && s.hints[id] === true) hints[id] = true; });
        state.session = { order: s.order.slice(), index: s.index, answers, hints, finished: s.finished === true };
      }
    } else {
      // первый запуск после обновления: переносим настройки и оценки из старого формата
      if (Array.isArray(legacyPrefs.groups)) {
        const valid = [...new Set(legacyPrefs.groups.filter(id => groups.has(id)))];
        if (valid.length) state.group = valid.length === 1 ? valid[0] : valid;
      }
      if (scopes.includes(legacyPrefs.scope)) state.scope = legacyPrefs.scope;
      if ([0, 10, 20, 50].includes(legacyPrefs.limit)) state.limit = legacyPrefs.limit;
      if (['random', 'ordered'].includes(legacyPrefs.order)) state.sequence = legacyPrefs.order;
      const skills = legacy.skills && typeof legacy.skills === 'object' ? legacy.skills : {};
      for (const [id, value] of Object.entries(skills)) {
        const n = Number(id);
        if (byId[n] && isMark(value)) state.stats[n] = { attempts: 1, known: value === 'known' ? 1 : 0, last: value };
      }
      const s = legacy.session;
      if (s && Array.isArray(s.order) && s.order.length && s.order.length <= data.skills.length && s.order.every(id => byId[id]) && new Set(s.order).size === s.order.length && Number.isInteger(s.index) && s.index >= 0 && s.index < s.order.length) {
        state.session = { order: s.order.slice(), index: s.index, answers: {}, hints: {}, finished: false };
      }
    }
    // карта оценок вопросов (66) сохраняется как есть: она уезжает в синхронизацию
    const legacyQuestions = legacy.questions && typeof legacy.questions === 'object' ? legacy.questions : {};
    for (const [id, value] of Object.entries(legacyQuestions)) {
      const n = Number(id);
      if (n >= 1 && n <= 66 && isMark(value)) state.questions[n] = value;
    }
    // статистика, пришедшая из синхронизации, но отсутствующая локально
    const syncSkills = legacy.skills && typeof legacy.skills === 'object' ? legacy.skills : {};
    for (const [id, value] of Object.entries(syncSkills)) {
      const n = Number(id);
      if (byId[n] && isMark(value) && !state.stats[n]) state.stats[n] = { attempts: 1, known: value === 'known' ? 1 : 0, last: value };
    }
    const persistQuestions = () => {
      const out = {};
      for (const id of Object.keys(state.questions)) out[id] = state.questions[id];
      return out;
    };
    function skillsProjection() {
      const out = {};
      for (const [id, stat] of Object.entries(state.stats)) if (stat && isMark(stat.last)) out[id] = stat.last;
      return out;
    }
    function sessionProjection() {
      const s = state.session;
      return s ? { order: s.order.slice(), index: s.index } : undefined;
    }
    function groupProjection() {
      if (state.group === 'all') return [];
      return Array.isArray(state.group) ? state.group.slice() : [state.group];
    }
    function save() {
      failed = false;
      const localPayload = { group: state.group, scope: state.scope, limit: state.limit, sequence: state.sequence, favorites: state.favorites, stats: state.stats, notes: state.notes, session: state.session, questions: state.questions };
      const syncPayload = { skills: skillsProjection(), questions: persistQuestions(), preferences: { groups: groupProjection(), scope: state.scope, order: state.sequence, limit: state.limit } };
      const sp = sessionProjection(); if (sp) syncPayload.session = sp;
      try { store.setItem(KEY, JSON.stringify(localPayload)); } catch (_) { failed = true; }
      try { lastSync = JSON.stringify(syncPayload); store.setItem(SYNC_KEY, lastSync); } catch (_) { failed = true; }
    }
    /* Синхронизация применила чужую версию: подхватываем оценки, но только если
       файл синхронизации изменился не нами (иначе вернули бы устаревшее). */
    function adopt() {
      let raw;
      try { raw = store.getItem(SYNC_KEY); } catch (_) { return false; }
      if (raw === null || raw === lastSync) return false;
      let value;
      try { value = JSON.parse(raw); } catch (_) { return false; }
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
      const skillsMap = value.skills && typeof value.skills === 'object' ? value.skills : {};
      const nextStats = {};
      for (const [id, mark] of Object.entries(skillsMap)) {
        const n = Number(id);
        if (!byId[n] || !isMark(mark)) continue;
        const previous = state.stats[n];
        nextStats[n] = { attempts: previous ? previous.attempts : 1, known: mark === 'known' ? Math.max(1, previous ? previous.known : 0) : 0, last: mark };
      }
      state.stats = nextStats;
      const nextQuestions = {};
      const questionsMap = value.questions && typeof value.questions === 'object' ? value.questions : {};
      for (const [id, mark] of Object.entries(questionsMap)) {
        const n = Number(id);
        if (n >= 1 && n <= 66 && isMark(mark)) nextQuestions[n] = mark;
      }
      state.questions = nextQuestions;
      save();
      return true;
    }
    function trySave() { save(); }
    function setOptions(group, scope, limit, sequence) {
      if (group === 'all' || groups.has(group)) state.group = group;
      else if (Array.isArray(group)) { const valid = [...new Set(group.filter(id => groups.has(id)))]; state.group = valid.length === 0 ? 'all' : valid.length === 1 ? valid[0] : valid; }
      if (scopes.includes(scope)) state.scope = scope;
      if ([0, 10, 20, 50].includes(Number(limit))) state.limit = Number(limit);
      if (['random', 'ordered'].includes(sequence)) state.sequence = sequence;
      trySave();
    }
    function pool() {
      return data.skills.filter(item => (state.group === 'all' || (Array.isArray(state.group) ? state.group.includes(item.group) : item.group === state.group))
        && (state.scope === 'all' || (state.scope === 'favorites' && state.favorites[item.id]) || (state.scope === 'again' && state.stats[item.id] && state.stats[item.id].last === 'again') || (state.scope === 'unseen' && !state.stats[item.id])));
    }
    function begin(ids, limit) {
      if (!ids.length) return false;
      if (state.sequence === 'ordered') ids.sort((a, b) => a - b);
      else for (let i = ids.length - 1; i > 0; i--) { let j = Math.floor(random() * (i + 1)); j = Math.max(0, Math.min(i, j)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
      if (limit) ids = ids.slice(0, limit);
      state.session = { order: ids, index: 0, answers: {}, hints: {}, finished: false };
      trySave(); return true;
    }
    function start() { return begin(pool().map(item => item.id), state.limit); }
    // Раздел-каталог = все навыки темы, независимо от настроек подборки.
    function startSection(id) {
      const section = data.groups.find(group => group.id === id);
      return section ? begin(data.skills.filter(item => item.id >= section.from && item.id <= section.to).map(item => item.id), 0) : false;
    }
    function current() { const s = state.session; return s ? byId[s.order[s.index]] : null; }
    function mark(status) {
      const s = state.session, item = current();
      if (!s || !item || s.finished || !isMark(status)) return false;
      const previous = s.answers[item.id];
      const old = state.stats[item.id] || { attempts: 0, known: 0, last: status };
      if (!previous) { old.attempts++; if (status === 'known') old.known++; }
      else if (previous !== status) old.known += status === 'known' ? 1 : -1;
      s.answers[item.id] = status; old.last = status; state.stats[item.id] = old;
      trySave(); return true;
    }
    function navigate(delta) {
      const s = state.session; if (!s) return false;
      const i = s.index + delta;
      if (!Number.isInteger(i) || i < 0 || i >= s.order.length) return false;
      s.index = i; s.finished = false; trySave(); return true;
    }
    function finish() { if (!state.session) return false; state.session.finished = true; trySave(); return true; }
    function resume() { if (!state.session) return false; state.session.finished = false; trySave(); return true; }
    function hint() { const s = state.session, item = current(); if (!s || !item) return; s.hints[item.id] = true; trySave(); }
    function favorite(id) { if (!byId[id]) return; if (state.favorites[id]) delete state.favorites[id]; else state.favorites[id] = true; trySave(); }
    function note(id, text) { if (!byId[id]) return; state.notes[id] = String(text).slice(0, 2000); if (!state.notes[id]) delete state.notes[id]; trySave(); }
    function reset() { state.stats = {}; state.session = null; trySave(); }
    function markQuestion(id, value) {
      const n = Number(id);
      if (!Number.isInteger(n) || n < 1 || n > 66) return false;
      if (value === '' || value === null || state.questions[n] === value) delete state.questions[n];
      else if (isMark(value)) state.questions[n] = value;
      else return false;
      trySave(); return true;
    }
    return { state, pool, setOptions, start, startSection, current, mark, navigate, finish, resume, hint, favorite, note, reset, markQuestion, adopt, storageFailed: () => failed };
  }
  window.MedzoMyologySkills = { data, byId, KEY, SYNC_KEY, create };
})();
