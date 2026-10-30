/* Выдвижная панель: общая навигация и выбор базы на любом экране. */
(function () {
  'use strict';
  window.initCourseDrawer = function (panel, toggle, closeButton, backdrop) {
    if (!panel || !toggle || !closeButton || !backdrop) return;
    let previouslyFocused = null;
    let previousOverflow = '';

    function close(restoreFocus) {
      if (panel.hidden) return;
      panel.hidden = true;
      backdrop.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = previousOverflow;
      if (restoreFocus && previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
    }
    function open() {
      if (!panel.hidden) return;
      previouslyFocused = toggle;
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      panel.hidden = false;
      backdrop.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      closeButton.focus();
    }
    toggle.hidden = false;
    toggle.addEventListener('click', () => panel.hidden ? open() : close(true));
    closeButton.addEventListener('click', () => close(true));
    backdrop.addEventListener('click', () => close(true));
    panel.addEventListener('click', (event) => {
      if (event.target.closest('[data-sidebar-route], .course-sidebar__item')) close(true);
    });
    document.addEventListener('keydown', (event) => {
      if (panel.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(panel.querySelectorAll('button:not([disabled]), a[href], summary'))
        .filter(el => el.getClientRects().length);
      if (!focusable.length) { event.preventDefault(); return; }
      const index = focusable.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); focusable[focusable.length - 1].focus(); }
      else if (!event.shiftKey && (index === -1 || index === focusable.length - 1)) { event.preventDefault(); focusable[0].focus(); }
    });
  };
})();
