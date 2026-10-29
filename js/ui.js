/* ============================================================================
   ui.js — иконки, тосты, тема оформления, переиспользуемые элементы
   ========================================================================== */
(function () {
  'use strict';

  const esc = window.AT.utils.esc;

  const ICON_PATHS = {
    home: '<path d="M3.5 10.6 12 3.5l8.5 7.1"/><path d="M5.6 9.6V20a1 1 0 0 0 1 1h10.8a1 1 0 0 0 1-1V9.6"/>',
    train: '<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="3.1"/><path d="M12 3.8v2M12 18.2v2M3.8 12h2M18.2 12h2"/>',
    exam: '<circle cx="12" cy="13" r="8.2"/><path d="M12 9.2V13l2.6 2"/><path d="M9.4 2.4h5.2"/><path d="M12 2.4v2.4"/>',
    mistakes: '<path d="M12 3.4 2.9 19.6h18.2L12 3.4Z"/><path d="M12 9.4v4.6"/><path d="M12 17.2h.01"/>',
    stats: '<path d="M4 20V11"/><path d="M10 20V4.5"/><path d="M16 20v-6"/><path d="M22 20H2"/>',
    key: '<circle cx="8.2" cy="8.2" r="4.6"/><path d="m11.6 11.6 8.6 8.6"/><path d="m16.6 16.6 2.1-2.1 2.2 2.2-2.1 2.1"/>',
    settings: '<path d="M4 6.5h8M17 6.5h3M4 12h3M12 12h8M4 17.5h7M16 17.5h4"/><circle cx="14.5" cy="6.5" r="2.2"/><circle cx="9.5" cy="12" r="2.2"/><circle cx="13.5" cy="17.5" r="2.2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/>',
    moon: '<path d="M20.5 14.3A8.6 8.6 0 0 1 9.7 3.5a8.6 8.6 0 1 0 10.8 10.8Z"/>',
    check: '<path d="m4.5 12.6 4.7 4.7L19.5 7"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    arrowRight: '<path d="M4.5 12h15"/><path d="m13.5 6 6 6-6 6"/>',
    arrowLeft: '<path d="M19.5 12h-15"/><path d="m10.5 6-6 6 6 6"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    download: '<path d="M12 3.5v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M4 19.5h16"/>',
    upload: '<path d="M12 15.5v-11"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M4 19.5h16"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7"/><path d="M6.5 7 7.4 19a1.4 1.4 0 0 0 1.4 1.3h6.4A1.4 1.4 0 0 0 16.6 19L17.5 7"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 4v5h-5"/>',
    play: '<path d="M7.5 4.8v14.4L19.5 12 7.5 4.8Z"/>',
    book: '<path d="M4 5.2A1.7 1.7 0 0 1 5.7 3.5H19v17H5.7A1.7 1.7 0 0 1 4 18.8V5.2Z"/><path d="M8 3.5v17"/>',
    clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.5V12l3.2 2"/>',
    target: '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1"/>',
    sparkles: '<path d="m12 3 1.7 4.6L18.5 9l-4.8 1.6L12 15l-1.7-4.4L5.5 9l4.8-1.4L12 3Z"/><path d="M18 15.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3Z"/>',
    chevronRight: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
    chevronDown: '<path d="m5.5 9.5 6.5 6.5 6.5-6.5"/>',
    flag: '<path d="M5.5 21V4.2"/><path d="M5.5 5h11.3l-2.1 4.2 2.1 4.2H5.5"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3.2"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.2"/><path d="M15.5 8.5V5.7A2.2 2.2 0 0 0 13.3 3.5H5.7A2.2 2.2 0 0 0 3.5 5.7v7.6a2.2 2.2 0 0 0 2.2 2.2h2.8"/>',
    info: '<circle cx="12" cy="12" r="8.4"/><path d="M12 11v5.5"/><path d="M12 7.6h.01"/>',
    pause: '<path d="M9 4v16M15 4v16"/>',
    edit: '<path d="M4 20h4l10-10-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  };

  function icon(name, cls) {
    const path = ICON_PATHS[name] || ICON_PATHS.info;
    return '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  }

  /* ------------------------------------------------------------------ toast */

  let toastTimer = null;
  function toast(message, kind) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.className = 'toast is-visible' + (kind ? ' toast--' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.className = 'toast';
    }, 2600);
  }

  /* ------------------------------------------------------------------ theme */

  const THEME_KEY = 'anatomy-colloquium-theme';

  function getThemePref() {
    try {
      return localStorage.getItem(THEME_KEY) || 'auto';
    } catch (e) {
      return 'auto';
    }
  }

  function resolvedTheme(pref) {
    if (pref === 'light' || pref === 'dark') return pref;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(pref) {
    const value = pref || getThemePref();
    const resolved = resolvedTheme(value);
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.setAttribute('data-theme-pref', value);
    try {
      localStorage.setItem(THEME_KEY, value);
    } catch (e) { /* ignore */ }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0b0f1a' : '#f5f6fb');
    return resolved;
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    return next;
  }

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getThemePref() === 'auto') applyTheme('auto');
    });
  }

  /* ------------------------------------------------------------ components */

  function progressBar(percent, variant) {
    const p = Math.max(0, Math.min(100, percent || 0));
    return '<div class="progress ' + (variant ? 'progress--' + variant : '') + '" role="progressbar" aria-valuenow="' +
      Math.round(p) + '" aria-valuemin="0" aria-valuemax="100"><span style="width:' + p + '%"></span></div>';
  }

  function ring(percent, size, label, sublabel) {
    const s = size || 132;
    const stroke = s >= 120 ? 11 : 9;
    const r = (s - stroke) / 2;
    const c = 2 * Math.PI * r;
    const p = Math.max(0, Math.min(100, percent || 0));
    const offset = c - (p / 100) * c;
    return (
      '<div class="ring" style="width:' + s + 'px;height:' + s + 'px">' +
      '<svg viewBox="0 0 ' + s + ' ' + s + '" width="' + s + '" height="' + s + '">' +
      '<circle class="ring__track" cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + r + '" fill="none" stroke-width="' + stroke + '"/>' +
      '<circle class="ring__value" cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + r + '" fill="none" stroke-width="' + stroke +
      '" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + offset.toFixed(1) +
      '" transform="rotate(-90 ' + s / 2 + ' ' + s / 2 + ')"/>' +
      '</svg>' +
      '<div class="ring__label"><strong>' + (label != null ? esc(label) : p + '%') + '</strong>' +
      (sublabel ? '<span>' + esc(sublabel) + '</span>' : '') + '</div>' +
      '</div>'
    );
  }

  function emptyState(iconName, title, text, actionHtml) {
    return '<div class="empty">' + '<div class="empty__icon">' + icon(iconName) + '</div>' +
      '<h3>' + esc(title) + '</h3>' +
      (text ? '<p>' + esc(text) + '</p>' : '') +
      (actionHtml || '') + '</div>';
  }

  function plural(n, one, few, many) {
    return window.AT.utils.plural(n, one, few, many);
  }

  /* ------------------------------------------------------------------ modal */

  function confirmDialog(opts) {
    const o = Object.assign({
      title: 'Подтвердите действие',
      text: '',
      confirm: 'Подтвердить',
      cancel: 'Отмена',
      danger: false,
      hideCancel: false,
    }, opts || {});

    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'modal';
      wrap.innerHTML =
        '<div class="modal__backdrop" data-modal="cancel"></div>' +
        '<div class="modal__card" role="dialog" aria-modal="true" aria-labelledby="modalTitle">' +
        '<h3 id="modalTitle">' + esc(o.title) + '</h3>' +
        (o.text ? '<p>' + esc(o.text) + '</p>' : '') +
        '<div class="modal__actions">' +
        (o.hideCancel ? '' : '<button class="btn btn--ghost" data-modal="cancel">' + esc(o.cancel) + '</button>') +
        '<button class="btn ' + (o.danger ? 'btn--danger' : 'btn--primary') + '" data-modal="ok">' + esc(o.confirm) + '</button>' +
        '</div></div>';
      document.body.appendChild(wrap);
      requestAnimationFrame(() => wrap.classList.add('is-open'));

      const close = (value) => {
        wrap.classList.remove('is-open');
        document.removeEventListener('keydown', onKey);
        setTimeout(() => wrap.remove(), 180);
        resolve(value);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') close(false);
        if (e.key === 'Enter') close(true);
      };
      document.addEventListener('keydown', onKey);
      wrap.addEventListener('click', (e) => {
        const target = e.target.closest('[data-modal]');
        if (!target) return;
        close(target.getAttribute('data-modal') === 'ok');
      });
      setTimeout(() => {
        const btn = wrap.querySelector('[data-modal="ok"]');
        if (btn) btn.focus();
      }, 60);
    });
  }

  window.AT.ui = {
    icon,
    toast,
    applyTheme,
    getThemePref,
    toggleTheme,
    resolvedTheme,
    progressBar,
    ring,
    emptyState,
    confirmDialog,
    plural,
  };
})();
