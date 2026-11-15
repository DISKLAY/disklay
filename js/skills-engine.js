/* Практические навыки: общий движок для всех коллоквиумов.
   Состояние, подборки, оценки, избранное и заметки одинаковы для любой базы,
   поэтому тренажёр один, а различия задаёт только описание предмета. */
(function () {
  'use strict';

  // Описание предмета: ключ хранения, данные и подписи.
  function normalize(descriptor) {
    const data = descriptor.data;
    const items = data.items || data.skills || [];
    const groups = data.groups || [];
    // Если разделов нет, тема и раздел совпадают: у миологии так и есть.
    const sections = data.sections && data.sections.length ? data.sections : groups;
    const byId = Object.fromEntries(items.map((item) => [item.id, item]));
    const groupIds = new Set(groups.map((group) => group.id));
    const maxItems = items.length;
    return {
      key: descriptor.key,
      data,
      items,
      groups,
      sections,
      byId,
      groupIds,
      maxItems,
      mirror: descriptor.mirror || null,
      labels: Object.assign({
        eyebrow: 'АНАТОМИЯ',
        title: 'Практические навыки',
        subtitle: 'Переведите термин и найдите структуру в атласе или на препарате.',
        catalogTitle: 'Список навыков',
        catalogEyebrow: 'СПРАВОЧНИК',
        unit: 'навык',
        note: 'Навыки и оценки сохраняются в этом браузере. Подсказки — ориентир, сверяйтесь с атласом. Самооценка не начисляет очки.',
        termLabel: 'НАВЫК',
        groupLabel: 'Темы',
        allGroupsLabel: 'Все темы',
        extraTabs: [],
      }, descriptor.labels || {}),
    };
  }

  // Кол-во с правильным склонением: 1 навык, 2 навыка, 5 навыков.
  function countLabel(n, one, few, many) {
    const abs = Math.abs(n) % 100, last = abs % 10;
    if (abs > 10 && abs < 20) return n + ' ' + many;
    if (last > 1 && last < 5) return n + ' ' + few;
    if (last === 1) return n + ' ' + one;
    return n + ' ' + many;
  }

  function create(spec, store, random) {
    random = random || Math.random;
    const { key, items, groupIds, byId, maxItems } = spec;
    const scopes = ['all', 'unseen', 'again', 'favorites'];
    const state = { group: 'all', scope: 'all', limit: 10, sequence: 'random', favorites: {}, stats: {}, notes: {}, session: null };
    let failed = false;

    // Оценки миологии уже синхронизируются отдельным снимком в формате
    // { skills: { «номер»: 'known' | 'again' } }. Чтобы не ломать сервер и старые
    // клиенты, движок переносит такие оценки к себе и продолжает писать проекцию
    // обратно в тот же ключ, сохраняя вопросы, сессию и настройки.
    function projection() {
      const skills = {};
      Object.entries(state.stats).forEach(([id, stat]) => { if (stat && stat.last) skills[id] = stat.last; });
      return skills;
    }
    function writeMirror() {
      if (!spec.mirror) return;
      try {
        const raw = store.getItem(spec.mirror.key);
        const current = raw ? JSON.parse(raw) : {};
        const next = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
        next.skills = projection();
        store.setItem(spec.mirror.key, JSON.stringify(next));
      } catch (e) { /* зеркало не критично: основные оценки уже сохранены */ }
    }
    function readLegacy() {
      if (!spec.mirror) return {};
      try {
        const raw = store.getItem(spec.mirror.key);
        const legacy = raw ? JSON.parse(raw) : null;
        const skills = legacy && legacy.skills;
        if (!skills || typeof skills !== 'object' || Array.isArray(skills)) return {};
        const stats = {};
        for (const [id, value] of Object.entries(skills)) {
          const n = Number(id);
          if (Number.isInteger(n) && byId[n] && ['known', 'again'].includes(value)) stats[n] = { attempts: 1, known: value === 'known' ? 1 : 0, last: value };
        }
        return stats;
      } catch (e) { return {}; }
    }

    try {
      const saved = JSON.parse(store.getItem(key) || '{}');
      if (saved && typeof saved === 'object') {
        if (saved.group === 'all' || groupIds.has(saved.group)) state.group = saved.group;
        else if (Array.isArray(saved.group)) {
          const valid = [...new Set(saved.group.filter((id) => groupIds.has(id)))];
          if (valid.length) state.group = valid.length === 1 ? valid[0] : valid;
        }
        if (scopes.includes(saved.scope)) state.scope = saved.scope;
        if ([0, 10, 20, 50].includes(saved.limit)) state.limit = saved.limit;
        if (['random', 'ordered'].includes(saved.sequence)) state.sequence = saved.sequence;
        for (const item of items) {
          const id = item.id;
          const favorite = saved.favorites && saved.favorites[id];
          const stat = saved.stats && saved.stats[id];
          const note = saved.notes && saved.notes[id];
          if (favorite === true) state.favorites[id] = true;
          if (stat && Number.isSafeInteger(stat.attempts) && stat.attempts > 0 && Number.isSafeInteger(stat.known) && stat.known >= 0 && stat.known <= stat.attempts && ['known', 'again'].includes(stat.last)) {
            state.stats[id] = { attempts: stat.attempts, known: stat.known, last: stat.last };
          }
          if (typeof note === 'string') state.notes[id] = note.slice(0, 2000);
        }
        const s = saved.session;
        if (s && Array.isArray(s.order) && s.order.length && s.order.length <= maxItems && s.order.every((id) => Number.isInteger(id) && byId[id]) && new Set(s.order).size === s.order.length && Number.isInteger(s.index) && s.index >= 0 && s.index < s.order.length) {
          const answers = {}, hints = {};
          s.order.forEach((id) => {
            if (s.answers && ['known', 'again'].includes(s.answers[id])) answers[id] = s.answers[id];
            if (s.hints && s.hints[id] === true) hints[id] = true;
          });
          state.session = { order: s.order.slice(), index: s.index, answers, hints, finished: s.finished === true };
        }
      }
    } catch (e) { /* повреждённое или недоступное хранилище: безопасные значения */ }
    // Первый запуск на новой версии: переносим оценки из старого ключа.
    if (!Object.keys(state.stats).length) {
      const migrated = readLegacy();
      if (Object.keys(migrated).length) state.stats = migrated;
    }

    function save() {
      try { store.setItem(key, JSON.stringify(state)); failed = false; }
      catch (e) { failed = true; }
      writeMirror();
    }

    /** Перечитывает оценки после синхронизации с другого устройства. */
    function reload() {
      if (!spec.mirror) return false;
      const legacy = readLegacy();
      const changed = JSON.stringify(legacy) !== JSON.stringify(state.stats);
      if (changed) state.stats = legacy;
      return changed;
    }

    function setOptions(group, scope, limit, sequence) {
      if (group === 'all' || groupIds.has(group)) state.group = group;
      else if (Array.isArray(group)) {
        const valid = [...new Set(group.filter((id) => groupIds.has(id)))];
        state.group = valid.length === 0 ? 'all' : valid.length === 1 ? valid[0] : valid;
      }
      if (scopes.includes(scope)) state.scope = scope;
      if ([0, 10, 20, 50].includes(Number(limit))) state.limit = Number(limit);
      if (['random', 'ordered'].includes(sequence)) state.sequence = sequence;
      save();
    }

    function pool() {
      return items.filter((item) => (state.group === 'all' || (Array.isArray(state.group) ? state.group.includes(item.group) : item.group === state.group)) &&
        (state.scope === 'all' || (state.scope === 'favorites' && state.favorites[item.id]) ||
          (state.scope === 'again' && state.stats[item.id] && state.stats[item.id].last === 'again') ||
          (state.scope === 'unseen' && !state.stats[item.id])));
    }

    function begin(ids, limit) {
      if (!ids.length) return false;
      if (state.sequence === 'ordered') ids.sort((a, b) => a - b);
      else for (let i = ids.length - 1; i > 0; i--) { const j = Math.max(0, Math.min(i, Math.floor(random() * (i + 1)))); [ids[i], ids[j]] = [ids[j], ids[i]]; }
      if (limit) ids = ids.slice(0, limit);
      state.session = { order: ids, index: 0, answers: {}, hints: {}, finished: false };
      save();
      return true;
    }

    function start() { return begin(pool().map((item) => item.id), state.limit); }
    // Раздел справочника — это весь раздел целиком, независимо от фильтров настройки.
    function startSection(id) {
      const section = spec.sections.find((s) => s.id === id);
      return section ? begin(items.filter((item) => item.id >= section.from && item.id <= section.to).map((item) => item.id), 0) : false;
    }
    function current() { const s = state.session; return s ? byId[s.order[s.index]] : null; }

    function mark(status) {
      const s = state.session, item = current();
      if (!s || !item || s.finished || !['known', 'again'].includes(status)) return false;
      const previous = state.stats[item.id] ? s.answers[item.id] : null;
      const old = state.stats[item.id] || { attempts: 0, known: 0, last: status };
      if (!previous) { old.attempts++; if (status === 'known') old.known++; }
      else if (previous !== status) old.known += status === 'known' ? 1 : -1;
      s.answers[item.id] = status;
      old.last = status;
      state.stats[item.id] = old;
      save();
      return true;
    }

    function navigate(delta) {
      const s = state.session;
      if (!s) return false;
      const i = s.index + delta;
      if (!Number.isInteger(i) || i < 0 || i >= s.order.length) return false;
      s.index = i; s.finished = false; save();
      return true;
    }
    function finish() { if (!state.session) return false; state.session.finished = true; save(); return true; }
    function resume() { if (!state.session) return false; state.session.finished = false; save(); return true; }
    function hint() { const s = state.session, item = current(); if (!s || !item) return; s.hints[item.id] = true; save(); }
    function favorite(id) { if (!byId[id]) return; if (state.favorites[id]) delete state.favorites[id]; else state.favorites[id] = true; save(); }
    function note(id, text) { if (!byId[id]) return; state.notes[id] = String(text).slice(0, 2000); if (!state.notes[id]) delete state.notes[id]; save(); }
    // Избранное и заметки переживают сброс оценок.
    function reset() { state.stats = {}; state.session = null; save(); }

    return { spec, state, pool, setOptions, start, startSection, current, mark, navigate, finish, resume, hint, favorite, note, reset, reload, storageFailed: () => failed };
  }

  window.MedzoSkills = { normalize, create, countLabel };
})();
