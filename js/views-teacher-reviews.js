/* Отзывы о преподавателях: поиск, фильтр по кафедре, честное предупреждение,
   когда отзывов по преподавателю нет. */
(function () {
  'use strict';
  const AT = window.AT, esc = AT.utils.esc;
  const views = (AT.views = AT.views || {});
  const data = () => window.MedzoTeacherReviews || { teachers: [], sources: [] };
  const state = { search: '', department: 'all' };

  const plural = (n, one, few, many) => AT.utils.plural(n, one, few, many);
  function ratingOf(teacher) {
    const rated = (teacher.reviews || []).filter(r => Number(r.rating) >= 1 && Number(r.rating) <= 5);
    if (!rated.length) return null;
    return Math.round((rated.reduce((sum, r) => sum + Number(r.rating), 0) / rated.length) * 10) / 10;
  }
  function departments(list) {
    return [...new Set(list.map(t => t.department).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
  }
  function matches(teacher, query) {
    if (!query) return true;
    const haystack = [teacher.name, teacher.subject, teacher.department, ...(teacher.reviews || []).map(r => r.text)].join(' ').toLowerCase();
    return query.split(/\s+/).filter(Boolean).every(word => haystack.includes(word));
  }
  function stars(rating) {
    if (rating === null) return '<span class="tr-norating">без оценки</span>';
    const full = Math.round(rating);
    return '<span class="tr-stars" aria-label="Средняя оценка ' + rating + ' из 5">' + '★'.repeat(full) + '☆'.repeat(5 - full) + '</span><strong class="tr-score">' + rating.toFixed(1) + '</strong>';
  }
  function reviewHtml(review, teacherId, index) {
    const rating = Number(review.rating) >= 1 && Number(review.rating) <= 5 ? Number(review.rating) : null;
    return '<article class="tr-review" data-review="' + esc(review.id || index) + '">' +
      '<header class="tr-review__head"><strong>' + (rating ? rating + ' / 5' : 'Без оценки') + '</strong>' +
      (review.year ? '<span class="tr-review__year">' + esc(String(review.year)) + '</span>' : '') + '</header>' +
      '<p class="tr-review__text">' + esc(review.text || '').replace(/\n/g, '<br>') + '</p>' +
      '<footer class="tr-review__foot">' + (review.source ? '<span>' + esc(review.source) + '</span>' : '') +
      (review.url ? '<a href="' + esc(review.url) + '" target="_blank" rel="noopener">Источник ↗</a>' : '') + '</footer>' +
      '</article>';
  }
  function teacherHtml(teacher) {
    const reviews = Array.isArray(teacher.reviews) ? teacher.reviews : [];
    return '<details class="tr-teacher" data-teacher="' + esc(teacher.id || teacher.name) + '" data-department="' + esc(teacher.department || '') + '">' +
      '<summary class="tr-teacher__head">' +
        '<span class="tr-teacher__name"><strong>' + esc(teacher.name) + '</strong>' +
        '<small>' + esc([teacher.department, teacher.subject].filter(Boolean).join(' · ') || 'Кафедра не указана') + '</small></span>' +
        '<span class="tr-teacher__meta">' + (reviews.length ? stars(ratingOf(teacher)) + '<span class="tr-teacher__count">' + reviews.length + ' ' + plural(reviews.length, 'отзыв', 'отзыва', 'отзывов') + '</span>' : '<span class="tr-teacher__empty">отзывов пока нет</span>') + '</span>' +
      '</summary>' +
      '<div class="tr-teacher__body">' + (reviews.length
        ? reviews.map((review, index) => reviewHtml(review, teacher.id, index)).join('')
        : '<p class="tr-warning" role="note">По этому преподавателю отзывов пока нет — мы не придумываем оценки и не переносим чужие мнения. Если у вас есть что рассказать, пришлите отзыв: он появится здесь с указанием источника.</p>') +
      '</div></details>';
  }

  views.teacherReviews = function () {
    const model = data();
    const teachers = Array.isArray(model.teachers) ? model.teachers : [];
    const list = departments(teachers);
    if (state.department !== 'all' && !list.includes(state.department)) state.department = 'all';
    const query = state.search.trim().toLowerCase();
    const shown = teachers.filter(t => (state.department === 'all' || t.department === state.department) && matches(t, query));
    const totalReviews = teachers.reduce((sum, t) => sum + (Array.isArray(t.reviews) ? t.reviews.length : 0), 0);
    const sources = Array.isArray(model.sources) ? model.sources : [];

    let html = '<div class="view tr-view"><header class="tr-head"><span>АНАТОМИЯ · ПРЕПОДАВАТЕЛИ</span><h1>Отзывы о преподавателях</h1>' +
      '<p>Только перенесённые отзывы с указанием источника. Если отзывов по преподавателю нет, так и написано: оценка не выдумывается.</p></header>';

    if (!teachers.length) {
      html += '<section class="tr-empty"><h2>Список отзывов пока пуст</h2>' +
        '<p>Раздел готов принимать отзывы, но ни одного отзыва ещё не перенесено. Мы не заполняем его догадками и не берём оценки из воздуха — поэтому здесь честно сказано: отзывов нет.</p>' +
        (sources.length ? '<p class="tr-sources">Где мы собираем отзывы: ' + sources.map(s => '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + ' ↗</a>').join(', ') + '</p>' : '') +
        '</section></div>';
      return { title: 'Отзывы о преподавателях', html, mount() {} };
    }

    html += '<div class="tr-summary"><div><strong>' + teachers.length + '</strong><span>' + plural(teachers.length, 'преподаватель', 'преподавателя', 'преподавателей') + '</span></div>' +
      '<div><strong>' + totalReviews + '</strong><span>' + plural(totalReviews, 'отзыв', 'отзыва', 'отзывов') + '</span></div>' +
      '<div><strong>' + list.length + '</strong><span>' + plural(list.length, 'кафедра', 'кафедры', 'кафедр') + '</span></div></div>';

    html += '<section class="tr-controls"><label class="tr-search"><span>Найти преподавателя или слово в отзыве</span><input type="search" data-tr-search value="' + esc(state.search) + '" placeholder="Фамилия, предмет или текст отзыва"></label>' +
      '<label class="tr-filter"><span>Кафедра</span><select data-tr-department><option value="all">Все кафедры</option>' +
      list.map(name => '<option value="' + esc(name) + '"' + (state.department === name ? ' selected' : '') + '>' + esc(name) + '</option>').join('') +
      '</select></label></section>';

    html += '<div class="tr-list">' + shown.map(teacherHtml).join('') + '</div>';
    html += '<p class="tr-none" data-tr-none' + (shown.length ? ' hidden' : '') + '>По этому запросу преподавателей не найдено. Попробуйте другую фамилию или сбросьте фильтр кафедры.</p>';

    if (sources.length) {
      html += '<section class="tr-sources-block"><h2>Откуда отзывы</h2><p>Отзывы переносятся вручную, с сохранением смысла и указанием источника. Если по преподавателю отзывов нет, раздел прямо об этом предупреждает.</p><ul>' +
        sources.map(s => '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + ' ↗</a></li>').join('') +
        '</ul><p class="tr-updated">Обновлено: ' + esc(model.updated || '—') + '</p></section>';
    }
    html += '</div>';

    return { title: 'Отзывы о преподавателях', html, mount(root) {
      const view = root.querySelector('.tr-view');
      if (!view) return;
      const apply = () => {
        const query = state.search.trim().toLowerCase();
        let visible = 0;
        view.querySelectorAll('[data-teacher]').forEach(card => {
          const teacher = teachers.find(t => (t.id || t.name) === card.dataset.teacher);
          const ok = teacher && (state.department === 'all' || teacher.department === state.department) && matches(teacher, query);
          card.hidden = !ok;
          if (ok) visible += 1;
        });
        const none = view.querySelector('[data-tr-none]');
        if (none) none.hidden = visible > 0;
      };
      view.addEventListener('input', event => {
        if (!event.target.matches('[data-tr-search]')) return;
        state.search = event.target.value;
        apply();
      });
      view.addEventListener('change', event => {
        if (!event.target.matches('[data-tr-department]')) return;
        state.department = event.target.value;
        apply();
      });
    }};
  };
})();
