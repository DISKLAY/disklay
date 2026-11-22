/* Отзывы о преподавателях: дословные отзывы из таблицы, поиск, фильтр по
   дисциплине, честное предупреждение, когда отзывов по преподавателю нет.
   Карточки отрисовываются порциями, тело отзыва — при раскрытии. */
(function () {
  'use strict';
  const AT = window.AT, esc = AT.utils.esc;
  const views = (AT.views = AT.views || {});
  const data = () => window.MedzoTeacherReviews || { teachers: [], sources: [] };
  const state = { search: '', department: 'all', limit: 30 };

  const plural = (n, one, few, many) => AT.utils.plural(n, one, few, many);
  function matches(teacher, query) {
    if (!query) return true;
    const haystack = [teacher.name, teacher.subject, teacher.department, ...(teacher.subjects || []),
      ...(teacher.reviews || []).flatMap(r => [r.text, r.advice, r.discipline, r.semester, ...Object.values(r.parts || {})])].filter(Boolean).join(' ').toLowerCase();
    return query.split(/\s+/).filter(Boolean).every(word => haystack.includes(word));
  }
  // Отзыв из анкеты состоит из разделов: семинары, коллоквиумы, лабораторные,
  // отработки и совет. Пустые разделы не показываются, чтобы не плодить заголовки.
  const PARTS = [
    ['seminars', 'Семинары'],
    ['colloquiums', 'Коллоквиумы'],
    ['labs', 'Лабораторные'],
    ['retakes', 'Отработки'],
    ['advice', 'Совет']
  ];
  function partsHtml(review) {
    const parts = review.parts && typeof review.parts === 'object' ? review.parts : null;
    if (parts) {
      return '<dl class="tr-review__parts">' + PARTS.filter(([key]) => typeof parts[key] === 'string' && parts[key].trim()).map(([key, label]) =>
        '<div><dt>' + esc(label) + '</dt><dd>' + esc(parts[key].trim()).replace(/\n/g, '<br>') + '</dd></div>').join('') + '</dl>';
    }
    return '<p class="tr-review__text">' + esc(review.text || '').replace(/\n/g, '<br>') + '</p>';
  }
  function reviewHtml(review, index) {
    const where = [review.semester, review.discipline].filter(Boolean).join(' · ');
    return '<article class="tr-review" data-review="' + esc(review.id || index) + '">' +
      '<header class="tr-review__head"><strong>Отзыв</strong>' +
      (where ? '<span class="tr-review__year">' + esc(where) + '</span>' : '') +
      (review.date ? '<span class="tr-review__date">' + esc(review.date) + '</span>' : '') + '</header>' +
      partsHtml(review) +
      '<footer class="tr-review__foot">' + (review.source ? '<span>' + esc(review.source) + '</span>' : '') +
      (review.url ? '<a href="' + esc(review.url) + '" target="_blank" rel="noopener">Источник ↗</a>' : '') + '</footer>' +
      '</article>';
  }
  function bodyHtml(teacher) {
    const reviews = Array.isArray(teacher.reviews) ? teacher.reviews : [];
    return reviews.length
      ? reviews.map(reviewHtml).join('')
      : '<p class="tr-warning" role="note">По этому преподавателю отзывов пока нет — мы не придумываем оценки и не переносим чужие мнения.</p>';
  }
  // Отзывов сотни и они длинные: тело карточки собирается при первом раскрытии,
  // иначе страница весит мегабайты ещё до того, как что-то прочитано.
  function teacherHtml(teacher, open) {
    const reviews = Array.isArray(teacher.reviews) ? teacher.reviews : [];
    const subjects = teacher.subjects && teacher.subjects.length ? teacher.subjects : (teacher.subject ? [teacher.subject] : []);
    return '<details class="tr-teacher" data-teacher="' + esc(teacher.id || teacher.name) + '" data-subjects="' + esc(subjects.join('|')) + '"' + (open ? ' open' : '') + '>' +
      '<summary class="tr-teacher__head">' +
        '<span class="tr-teacher__name"><strong>' + esc(teacher.name) + '</strong>' +
        '<small>' + esc(subjects.join(', ') || 'Дисциплина не указана') + (teacher.department ? ' · ' + esc(teacher.department) : '') + '</small></span>' +
        '<span class="tr-teacher__meta">' + (reviews.length
          ? '<span class="tr-teacher__count">' + reviews.length + ' ' + plural(reviews.length, 'отзыв', 'отзыва', 'отзывов') + '</span>'
          : '<span class="tr-teacher__empty">отзывов пока нет</span>') + '</span>' +
      '</summary>' +
      '<div class="tr-teacher__body" data-lazy-body>' + (open ? bodyHtml(teacher) : '') + '</div>' +
      '</details>';
  }
  const PAGE = 30;

  // В анкете встречаются обе записи: «Фамилия Имя Отчество» и «Имя Отчество
  // Фамилия», а бывает и без отчества вовсе. Сортируем по фамилии, иначе такие
  // преподаватели встают не на своё место в алфавите.
  const PATRONYMIC = /(вич|вна|чна|инична|овна|евна|кызы|оглы)$/i;
  const INITIALS = /^(?:[А-ЯЁ]\.?)+$/;            // «О.», «А.М.»
  const SURNAME_END = /(ов|ев|ёв|ин|ын|ова|ева|ёва|ина|ына|ский|ская|цкий|цкая|ко|ук|юк|ич|ян|дзе|швили|их|ых)$/i;
  const looksSurname = word => !!word && SURNAME_END.test(word);
  function surnameOf(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '';
    if (parts.length === 1) return parts[0];
    const first = parts[0], last = parts[parts.length - 1];
    // Отчество в конце — обычная запись «Фамилия Имя Отчество».
    if (PATRONYMIC.test(last)) return first;
    // Инициалы в конце — «Фамилия И.О.» или «Фамилия О.».
    if (INITIALS.test(last)) return first;
    // Отчество в середине — обратная запись «Имя Отчество Фамилия».
    if (parts.length >= 3 && PATRONYMIC.test(parts[parts.length - 2])) return last;
    // Отчества нет вовсе: фамилию узнаём по типичному окончанию.
    if (looksSurname(first) && !looksSurname(last)) return first;
    if (looksSurname(last) && !looksSurname(first)) return last;
    return first;
  }
  function bySurname(a, b) {
    return surnameOf(a).localeCompare(surnameOf(b), 'ru') || String(a).localeCompare(String(b), 'ru');
  }
  // Дисциплина → преподаватель → отзывы. Дисциплины отсортированы по числу
  // отзывов (сначала самые наполненные), внутри — по фамилии в алфавитном порядке.
  function disciplinesOf(teachers) {
    const map = new Map();
    for (const teacher of teachers) for (const review of teacher.reviews || []) {
      const name = review.discipline || 'Без дисциплины';
      if (!map.has(name)) map.set(name, { name, teachers: new Map() });
      const bucket = map.get(name);
      const key = teacher.id || teacher.name;
      if (!bucket.teachers.has(key)) bucket.teachers.set(key, { teacher, semesters: new Set() });
      if (review.semester) bucket.teachers.get(key).semesters.add(review.semester);
    }
    return [...map.values()].map(group => ({
      name: group.name,
      teachers: [...group.teachers.values()]
        .map(x => Object.assign({}, x, { semesters: [...x.semesters] }))
        .sort((a, b) => bySurname(a.teacher.name, b.teacher.name)),
      reviews: [...group.teachers.values()].reduce((n, x) => n + ((x.teacher.reviews || []).filter(r => (r.discipline || 'Без дисциплины') === group.name).length), 0)
    })).sort((a, b) => b.reviews - a.reviews || a.name.localeCompare(b.name, 'ru'));
  }
  // Отзывы именно по выбранной дисциплине: у преподавателя их может быть
  // несколько в разных дисциплинах, чужие в карточке не показываем.
  function bodyFor(teacher, discipline) {
    const reviews = (teacher.reviews || []).filter(r => !discipline || (r.discipline || 'Без дисциплины') === discipline);
    return reviews.length ? reviews.map(reviewHtml).join('') : bodyHtml(teacher);
  }
  const teacherLine = (teacher, discipline, semesters) =>
    '<details class="tr-teacher" data-teacher="' + esc(teacher.id || teacher.name) + '" data-discipline="' + esc(discipline) + '">' +
      '<summary class="tr-teacher__head">' +
        '<span class="tr-teacher__name"><strong>' + esc(teacher.name) + '</strong>' +
        (semesters.length ? '<small>' + esc(semesters.join(', ')) + '</small>' : '') + '</span>' +
        '<span class="tr-teacher__meta"><span class="tr-teacher__count">' +
          (teacher.reviews || []).filter(r => (r.discipline || 'Без дисциплины') === discipline).length + ' ' +
          plural((teacher.reviews || []).filter(r => (r.discipline || 'Без дисциплины') === discipline).length, 'отзыв', 'отзыва', 'отзывов') +
        '</span></span>' +
      '</summary>' +
      '<div class="tr-teacher__body" data-lazy-body></div>' +
    '</details>';

  function disciplineCard(group) {
    return '<details class="tr-disc" data-disc="' + esc(group.name) + '">' +
      '<summary class="tr-disc__head"><span class="tr-disc__name">' + esc(group.name) + '</span>' +
        '<span class="tr-disc__meta">' + group.teachers.length + ' ' + plural(group.teachers.length, 'преподаватель', 'преподавателя', 'преподавателей') +
        ' · ' + group.reviews + ' ' + plural(group.reviews, 'отзыв', 'отзыва', 'отзывов') + '</span></summary>' +
      '<div class="tr-disc__body"><ul class="tr-disc__teachers">' +
        group.teachers.map(item => '<li>' + teacherLine(item.teacher, group.name, item.semesters) + '</li>').join('') +
      '</ul></div></details>';
  }

  // Тело карточки отдельным методом: его же дёргает ленивая отрисовка при раскрытии,
  // поэтому тесты могут проверить разметку отзыва без имитации DOM.
  views.teacherReviews_surnameOf = surnameOf;
  views.teacherReviews_bySurname = bySurname;
  views.teacherReviews_bodyHtml = bodyHtml;
  views.teacherReviews_bodyFor = bodyFor;

  views.teacherReviews = function () {
    const model = data();
    const teachers = Array.isArray(model.teachers) ? model.teachers : [];
    const groups = disciplinesOf(teachers);
    const totalReviews = teachers.reduce((sum, t) => sum + (Array.isArray(t.reviews) ? t.reviews.length : 0), 0);
    const sources = Array.isArray(model.sources) ? model.sources : [];
    const query = state.search.trim().toLowerCase();

    let html = '<div class="view tr-view"><header class="tr-head"><span>АНАТОМИЯ · ПРЕПОДАВАТЕЛИ</span><h1>Отзывы о преподавателях</h1>' +
      '<p>Сначала выберите дисциплину, затем преподавателя — отзывы раскрываются под ним. Тексты перенесены дословно, с указанием источника.</p></header>';

    if (!teachers.length) {
      html += '<section class="tr-empty"><h2>Список отзывов пока пуст</h2>' +
        '<p>Раздел готов принимать отзывы, но ни одного отзыва ещё не перенесено. Мы не заполняем его догадками и не берём оценки из воздуха — поэтому здесь честно сказано: отзывов нет.</p>' +
        (sources.length ? '<p class="tr-sources">Где мы собираем отзывы: ' + sources.map(s => '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + ' ↗</a>').join(', ') + '</p>' : '') +
        '</section></div>';
      return { title: 'Отзывы о преподавателях', html, mount() {} };
    }

    html += '<div class="tr-summary"><div><strong>' + groups.length + '</strong><span>' + plural(groups.length, 'дисциплина', 'дисциплины', 'дисциплин') + '</span></div>' +
      '<div><strong>' + teachers.length + '</strong><span>' + plural(teachers.length, 'преподаватель', 'преподавателя', 'преподавателей') + '</span></div>' +
      '<div><strong>' + totalReviews + '</strong><span>' + plural(totalReviews, 'отзыв', 'отзыва', 'отзывов') + '</span></div></div>';

    // Быстрый доступ: чипы дисциплин, чтобы не разворачивать список целиком.
    html += '<nav class="tr-chips" aria-label="Дисциплины">' +
      groups.map(g => '<button type="button" class="tr-chip" data-disc-jump="' + esc(g.name) + '">' + esc(g.name) +
        '<span>' + g.reviews + '</span></button>').join('') + '</nav>';

    html += '<label class="tr-search"><span>Или найдите сразу преподавателя или слово в отзыве</span>' +
      '<input type="search" data-tr-search value="' + esc(state.search) + '" placeholder="Фамилия или текст отзыва"></label>';

    html += '<p class="tr-count" data-tr-count aria-live="polite"></p>';
    html += '<div class="tr-list" data-tr-list>' + groups.map(disciplineCard).join('') + '</div>';
    html += '<p class="tr-none" data-tr-none hidden>Ничего не найдено. Попробуйте другую фамилию или другое слово.</p>';

    if (sources.length) {
      html += '<section class="tr-sources-block"><h2>Откуда отзывы</h2><p>Отзывы переносятся без правок смысла и лексики, с указанием источника и даты. Если по преподавателю отзывов нет, раздел прямо об этом предупреждает.</p><ul>' +
        sources.map(s => '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + ' ↗</a></li>').join('') +
        '</ul><p class="tr-updated">Обновлено: ' + esc(model.updated || '—') + '</p></section>';
    }
    html += '</div>';

    return { title: 'Отзывы о преподавателях', html, mount(root) {
      const view = root.querySelector('.tr-view');
      if (!view) return;
      const countNode = view.querySelector('[data-tr-count]');
      const noneNode = view.querySelector('[data-tr-none]');
      const cards = () => [...view.querySelectorAll('[data-disc]')];
      const setCount = () => {
        const open = cards().filter(c => !c.hidden).length;
        const search = state.search.trim();
        countNode.textContent = search ? 'Найдено дисциплин: ' + open : 'Дисциплин: ' + open + '. Нажмите на дисциплину, чтобы увидеть преподавателей.';
      };
      // Поиск: показываем только дисциплины и преподавателей, где встретилось слово.
      const apply = () => {
        const q = state.search.trim().toLowerCase();
        let visible = 0;
        for (const card of cards()) {
          const group = groups.find(g => g.name === card.dataset.disc);
          if (!group) continue;
          const listNode = card.querySelector('.tr-disc__teachers');
          let matched = 0;
          for (const li of listNode.children) {
            const details = li.querySelector('[data-teacher]');
            const teacher = teachers.find(t => (t.id || t.name) === details.dataset.teacher);
            const ok = !q || (teacher && matches(teacher, q));
            li.hidden = !ok;
            if (ok) matched += 1;
          }
          const show = matched > 0;
          card.hidden = !show;
          if (show) visible += 1;
          if (q && show) card.open = true;
          else if (q && !show) card.open = false;
        }
        noneNode.hidden = visible > 0;
        setCount();
      };
      apply();
      // Тело отзыва собирается по первому раскрытию: toggle не всплывает, слушаем в фазе перехвата.
      view.addEventListener('toggle', event => {
        const card = event.target;
        if (!card.matches || !card.matches('[data-teacher]') || !card.open) return;
        const body = card.querySelector('[data-lazy-body]');
        if (!body || body.dataset.filled === '1') return;
        const teacher = teachers.find(t => (t.id || t.name) === card.dataset.teacher);
        if (!teacher) return;
        body.innerHTML = bodyFor(teacher, card.dataset.discipline);
        body.dataset.filled = '1';
      }, true);
      view.addEventListener('input', event => {
        if (!event.target.matches('[data-tr-search]')) return;
        state.search = event.target.value;
        apply();
      });
      view.addEventListener('click', event => {
        const chip = event.target.closest('[data-disc-jump]');
        if (!chip) return;
        const card = view.querySelector('[data-disc="' + CSS.escape(chip.dataset.discJump) + '"]');
        if (!card) return;
        event.preventDefault();
        card.open = true;
        card.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    }};
  };
})();
