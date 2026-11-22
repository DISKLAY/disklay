/* Переключатель коллоквиума в верхней панели.
   Скрытый <select id="colloquiumSelect"> остаётся единственным источником значения:
   кнопка открывает панель со всеми базами по семестрам, выбор передаётся в select
   (его обработчик сохраняет прогресс и переключает банк). */
(function () {
  'use strict';

  function textOf(option) {
    return String(option && option.textContent || '').trim();
  }
  /* В списке баз подписи короткие («1 · Остеология»). Полное название берём из
     загруженной базы, чтобы в шапке было видно, что открыто на самом деле. */
  function fullName(value) {
    const module = window.COLLOQUIUM_MODULES && window.COLLOQUIUM_MODULES[value];
    return module && module.name ? module.name : '';
  }
  function parts(option) {
    const raw = textOf(option).replace(/^Стом\s*·\s*/, '');
    const chunks = raw.split(' · ');
    const short = chunks.slice(1).join(' · ') || raw;
    return { badge: chunks[0] || '', title: fullName(option && option.value) || short, short, faculty: /^Стом\s*·/.test(textOf(option)) };
  }

  window.initColloquiumSwitch = function (select, button, panel) {
    if (!select || !button || !panel) return null;
    const badge = button.querySelector('[data-switch-badge]');
    const name = button.querySelector('[data-switch-name]');
    const semester = button.querySelector('[data-switch-semester]');
    let items = [];
    let open = false;

    function groupOf(option) {
      const group = option && option.parentElement;
      return group && group.tagName === 'OPTGROUP' ? group : null;
    }

    function build() {
      panel.textContent = '';
      items = [];
      Array.from(select.querySelectorAll('optgroup')).forEach((group) => {
        const wrap = document.createElement('section');
        wrap.className = 'course-switch__group';
        const heading = document.createElement('h3');
        heading.className = 'course-switch__group-title';
        heading.textContent = group.label;
        wrap.appendChild(heading);
        const list = document.createElement('div');
        list.className = 'course-switch__items';
        Array.from(group.children).forEach((option) => {
          const data = parts(option);
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'course-switch__item';
          item.dataset.value = option.value;
          const mark = document.createElement('span');
          mark.className = 'course-switch__item-badge';
          mark.setAttribute('aria-hidden', 'true');
          mark.textContent = data.badge;
          const body = document.createElement('span');
          body.className = 'course-switch__item-text';
          const title = document.createElement('strong');
          title.textContent = data.title;
          const sub = document.createElement('small');
          sub.dataset.default = data.faculty ? 'Стоматологический факультет' : group.label;
          sub.textContent = option.value === select.value ? 'Открыт сейчас' : sub.dataset.default;
          body.append(title, sub);
          const check = document.createElement('span');
          check.className = 'course-switch__item-check';
          check.setAttribute('aria-hidden', 'true');
          item.append(mark, body, check);
          item.addEventListener('click', () => {
            close(true);
            if (option.value === select.value) return;
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
          });
          list.appendChild(item);
          items.push(item);
        });
        wrap.appendChild(list);
        panel.appendChild(wrap);
      });
      sync();
    }

    function sync() {
      const option = select.options[select.selectedIndex];
      const data = parts(option);
      if (badge) badge.textContent = data.badge;
      if (name) name.textContent = data.title || 'Выберите коллоквиум';
      const group = groupOf(option);
      if (semester) semester.textContent = group ? group.label : 'Анатомия';
      const label = 'Коллоквиум: ' + data.title + '. Открыть список коллоквиумов';
      button.setAttribute('aria-label', label);
      button.title = data.title;
      items.forEach((item) => {
        const current = item.dataset.value === select.value;
        item.classList.toggle('is-current', current);
        if (current) item.setAttribute('aria-current', 'true');
        else item.removeAttribute('aria-current');
        const check = item.querySelector('.course-switch__item-check');
        if (check) check.textContent = current ? '✓' : '';
        const sub = item.querySelector('small');
        if (sub) sub.textContent = current ? 'Открыт сейчас' : (sub.dataset.default || sub.textContent);
      });
    }

    function openPanel() {
      if (open) return;
      open = true;
      panel.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      const current = items.find((item) => item.dataset.value === select.value) || items[0];
      if (current) current.focus();
    }

    function close(restoreFocus) {
      if (!open) return;
      open = false;
      panel.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      if (restoreFocus) button.focus();
    }

    button.addEventListener('click', () => (open ? close(false) : openPanel()));
    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const index = items.indexOf(document.activeElement);
      let next = index;
      if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = items.length - 1;
      else if (index < 0) next = 0;
      else next = (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next].focus();
    });
    panel.addEventListener('focusout', () => {
      setTimeout(() => { if (open && !panel.contains(document.activeElement) && document.activeElement !== button) close(false); }, 0);
    });
    const outside = (event) => { if (open && !panel.contains(event.target) && !button.contains(event.target)) close(false); };
    document.addEventListener('click', outside);
    window.addEventListener('resize', () => close(false));

    select.addEventListener('change', sync);
    build();
    return { sync, open: openPanel, close };
  };
})();
