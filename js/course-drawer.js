/* Компактная боковая навигация: раскрытие в потоке на ПК и поверх контента на телефоне. */
(function () {
  'use strict';
  window.initCourseDrawer = function (panel, toggle, backdrop) {
    if (!panel || !toggle || !backdrop) return;
    const mobile = window.matchMedia('(max-width: 1100px)');
    let expanded = false, previousOverflow = '', locked = false;
    function updateHeaderHeight() {
      const header = document.querySelector('.topbar');
      if (header) document.documentElement.style.setProperty('--sidebar-top', header.offsetHeight + 'px');
    }
    updateHeaderHeight();
    if (window.ResizeObserver) new ResizeObserver(updateHeaderHeight).observe(document.querySelector('.topbar'));
    else window.addEventListener('resize', updateHeaderHeight);
    function sync() {
      panel.classList.toggle('is-expanded', expanded);
      const modal = expanded && mobile.matches;
      backdrop.hidden = !modal;
      if (modal) { panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); }
      else { panel.removeAttribute('role'); panel.removeAttribute('aria-modal'); }
      toggle.setAttribute('aria-expanded', String(expanded));
      toggle.setAttribute('aria-label', expanded ? 'Свернуть навигацию' : 'Развернуть навигацию');
      toggle.title = expanded ? 'Свернуть навигацию' : 'Развернуть навигацию';
    }
    function open() {
      if (expanded) return;
      expanded = true;
      if (mobile.matches) { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; locked = true; }
      sync();
    }
    function close(restoreFocus) {
      if (!expanded) return;
      if (locked) { document.body.style.overflow = previousOverflow; locked = false; }
      expanded = false; sync();
      if (restoreFocus) toggle.focus();
    }
    toggle.addEventListener('click', () => expanded ? close(false) : open());
    backdrop.addEventListener('click', () => close(true));
    panel.addEventListener('click', event => {
      const histologyLink = event.target.closest('[data-histo-sidebar]');
      if (histologyLink && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0 && location.hash === histologyLink.getAttribute('href') && window.AT && AT.views.histology && AT.views.histology.openSection) {
        event.preventDefault(); AT.views.histology.openSection(histologyLink.dataset.histoSidebar);
      }
      if (expanded && mobile.matches && event.target.closest('a[href^="#/"]')) close(false);
    });
    document.addEventListener('keydown', event => {
      if (!expanded) return;
      if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
      if (!mobile.matches || event.key !== 'Tab') return;
      const focusable = Array.from(panel.querySelectorAll('button:not([disabled]), a[href]')).filter(el => el.getClientRects().length);
      if (!focusable.length) { event.preventDefault(); return; }
      const index = focusable.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); focusable[focusable.length - 1].focus(); }
      else if (!event.shiftKey && (index === -1 || index === focusable.length - 1)) { event.preventDefault(); focusable[0].focus(); }
    });
    const changed = () => {
      if (expanded) { if (locked) { document.body.style.overflow = previousOverflow; locked = false; } expanded = false; }
      sync();
    };
    if (mobile.addEventListener) mobile.addEventListener('change', changed);
    else if (mobile.addListener) mobile.addListener(changed);
    sync();
    return {open, close};
  };
})();
