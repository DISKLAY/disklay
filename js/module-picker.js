/* Список баз в единой панели. Скрытый select хранит общий источник значений. */
(function () {
  'use strict';

  window.initModulePicker = function (select, sidebarNav) {
    if (!select || !sidebarNav) return;
    const sidebarItems = [];
    const groups = [];
    Array.from(select.querySelectorAll('optgroup')).forEach((optgroup) => {
      const group = document.createElement('details');
      group.className = 'course-sidebar__group';
      const heading = document.createElement('summary');
      heading.className = 'course-sidebar__group-title';
      heading.textContent = optgroup.label;
      group.appendChild(heading);
      Array.from(optgroup.children).forEach((option) => {
        const parts = option.textContent.replace(/^Стом\s*·\s*/, '').split(' · ');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'course-sidebar__item';
        button.dataset.value = option.value;
        const badge = document.createElement('span');
        badge.className = 'course-sidebar__badge';
        badge.setAttribute('aria-hidden', 'true');
        if (/^\d+$/.test(parts[0])) {
          badge.textContent = parts[0];
        } else {
          // Зачёт обозначаем чек-листом, чтобы буква «З» не читалась как цифра 3.
          badge.innerHTML = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false"><rect x="4.5" y="3.5" width="11" height="13" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M8 3.5h4M7.3 10.1l1.7 1.7 3.7-3.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        }
        const text = document.createElement('span');
        text.className = 'course-sidebar__item-text';
        const label = document.createElement('strong');
        label.textContent = /^\d+$/.test(parts[0]) ? 'Коллоквиум ' + parts[0] : parts[0];
        const subject = document.createElement('span');
        subject.textContent = parts.slice(1).join(' · ');
        const current = document.createElement('span');
        current.className = 'course-sidebar__selected';
        current.textContent = 'Выбрана';
        current.setAttribute('aria-hidden', 'true');
        text.append(label, subject);
        button.append(badge, text, current);
        button.addEventListener('click', () => {
          if (option.value !== select.value) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
        group.appendChild(button);
        sidebarItems.push(button);
      });
      sidebarNav.appendChild(group);
      groups.push({ group, optgroup });
    });

    function sync() {
      const option = select.options[select.selectedIndex];
      if (!option) return;
      sidebarItems.forEach((item) => {
        if (item.dataset.value === select.value) item.setAttribute('aria-current', 'true');
        else item.removeAttribute('aria-current');
      });
      // Текущая база сразу видна, остальные группы можно открыть при необходимости.
      groups.forEach(({ group, optgroup }) => { group.open = optgroup === option.parentElement; });
    }
    select.addEventListener('change', sync);
    sync();
  };
})();
