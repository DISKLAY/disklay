/* Красивый раскрывающийся список поверх обычного select: исходный select
   остаётся источником значений и обработчиком переключения банка. */
(function () {
  'use strict';

  window.initModulePicker = function (select, container) {
    if (!select || !container) return;

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'module-picker__trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', 'modulePickerList');
    trigger.title = select.title;
    trigger.innerHTML = '<span class="module-picker__trigger-text"><span class="module-picker__caption"></span><span class="module-picker__current"></span></span>' +
      '<svg class="module-picker__chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7.5 5 5 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    const list = document.createElement('div');
    list.id = 'modulePickerList';
    list.className = 'module-picker__list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Коллоквиумы');
    list.hidden = true;
    const items = [];

    Array.from(select.querySelectorAll('optgroup')).forEach((optgroup) => {
      const group = document.createElement('div');
      group.className = 'module-picker__group';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', optgroup.label);
      const heading = document.createElement('div');
      heading.className = 'module-picker__group-title';
      heading.setAttribute('aria-hidden', 'true');
      heading.textContent = optgroup.label;
      group.appendChild(heading);

      Array.from(optgroup.children).forEach((option) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'module-picker__option';
        item.setAttribute('role', 'option');
        item.setAttribute('tabindex', '-1');
        item.dataset.value = option.value;
        const parts = option.textContent.replace(/^Стом\s*·\s*/, '').split(' · ');
        const number = document.createElement('span');
        number.className = 'module-picker__number';
        number.setAttribute('aria-hidden', 'true');
        number.textContent = parts[0];
        const name = document.createElement('span');
        name.className = 'module-picker__option-name';
        name.textContent = parts.slice(1).join(' · ');
        const check = document.createElement('span');
        check.className = 'module-picker__check';
        check.setAttribute('aria-hidden', 'true');
        check.innerHTML = '<svg viewBox="0 0 20 20" fill="none"><path d="m4 10 4 4 8-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        item.setAttribute('aria-label', 'Коллоквиум ' + parts[0] + ' · ' + name.textContent);
        item.append(number, name, check);
        group.appendChild(item);
        items.push(item);
      });
      list.appendChild(group);
    });

    function sync() {
      const option = select.options[select.selectedIndex];
      if (!option) return;
      const group = option.parentElement.label;
      const title = option.textContent.replace(/^Стом\s*·\s*/, '');
      trigger.querySelector('.module-picker__caption').textContent = group;
      trigger.querySelector('.module-picker__current').textContent = title;
      trigger.setAttribute('aria-label', 'Выбрать коллоквиум: ' + group + ', ' + title);
      items.forEach((item) => item.setAttribute('aria-selected', String(item.dataset.value === select.value)));
    }

    function close(restoreFocus) {
      list.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      if (restoreFocus) trigger.focus();
    }

    function open(focusLast) {
      list.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      const selected = items.find((item) => item.dataset.value === select.value);
      (focusLast ? items[items.length - 1] : selected || items[0]).focus();
    }

    trigger.addEventListener('click', () => {
      if (list.hidden) open(false);
      else close(false);
    });
    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        open(event.key === 'ArrowUp');
      }
    });
    list.addEventListener('keydown', (event) => {
      const index = items.indexOf(document.activeElement);
      let next = index;
      if (event.key === 'ArrowDown') next = Math.min(index + 1, items.length - 1);
      else if (event.key === 'ArrowUp') next = Math.max(index - 1, 0);
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = items.length - 1;
      else if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
      else if (event.key === 'Tab') { close(false); return; }
      else return;
      event.preventDefault();
      items[next].focus();
    });
    list.addEventListener('click', (event) => {
      const item = event.target.closest('[role="option"]');
      if (!item || !list.contains(item)) return;
      close(true);
      if (item.dataset.value !== select.value) {
        select.value = item.dataset.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      sync();
    });
    document.addEventListener('click', (event) => {
      if (!container.contains(event.target)) close(false);
    });
    select.addEventListener('change', sync);
    sync();
    container.append(trigger, list);
    select.hidden = true;
    container.classList.add('module-picker--enhanced');
  };
})();
