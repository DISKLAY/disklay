/* A short, optional tour, remembered only in this browser. */
(function () {
  'use strict';
  const KEY = 'medzo-tour-seen-v1';
  const steps = [
    {
      eyebrow: 'НАЧНЁМ С НАВИГАЦИИ', icon: 'home', title: 'Добро пожаловать в Medzo',
      text: 'Выберите анатомию или гистологию в боковом меню. На телефоне меню открывается стрелкой, а основные разделы доступны внизу экрана.',
      tags: ['Анатомия', 'Гистология', 'Боковое меню'],
      tip: 'В анатомии коллоквиум или зачёт можно сменить в верхней строке.'
    },
    {
      eyebrow: 'АНАТОМИЯ', icon: 'train', title: 'Тесты и устная подготовка',
      text: 'В «Тренировке» выбирайте базу и темы, повторяйте ошибки и изучайте навыки, карточки и билеты первого коллоквиума. Экзамен доступен там, где известен его формат.',
      tags: ['Тесты', 'Экзамен', 'Навыки и билеты'],
      tip: 'Конспект первого коллоквиума находится в разделе «Теория».'
    },
    {
      eyebrow: 'ГИСТОЛОГИЯ', icon: 'microscope', title: 'Изучайте препараты',
      text: 'Тренируйтесь узнавать препараты и структуры, изучайте атлас и отвечайте на вопросы по теории. Ошибки и статистика гистологии ведутся отдельно.',
      tags: ['Препараты', 'Атлас', 'Структуры и теория'],
      tip: 'Выбирайте нужный раздел в боковом меню или на главной гистологии.'
    },
    {
      eyebrow: 'ПРОГРЕСС И ПРОФИЛЬ', icon: 'profile', title: 'Сохраняйте свой прогресс',
      text: 'Отмечайте избранное, возвращайтесь к ошибкам и следите за результатами в статистике. В профиле можно войти или создать аккаунт для синхронизации между устройствами.',
      tags: ['Избранное', 'Ошибки', 'Профиль'],
      tip: 'Участие в общем рейтинге добровольное. В нём учитываются очки анатомии.'
    },
    {
      eyebrow: 'ВСЁ ГОТОВО', icon: 'sparkles', title: 'Настройте Medzo под себя',
      text: 'В разделе «Награды и оформление» находятся достижения и темы. Правила проверки и другие параметры можно изменить в настройках.',
      tags: ['Достижения', 'Оформления', 'Настройки'],
      tip: 'Вернуться к этой экскурсии можно в настройках. Удачной подготовки!'
    }
  ];
  const root = document.getElementById('app');
  let dialog, fallbackBackdrop, step = 0, previouslyFocused = null, observer, shownThisPage = false;

  function hasSeen() {
    try { if (localStorage.getItem(KEY) === '1') return true; } catch (_) { /* storage can be blocked */ }
    try { return sessionStorage.getItem(KEY) === '1'; } catch (_) { return false; }
  }
  function remember() {
    try { localStorage.setItem(KEY, '1'); return; } catch (_) { /* use session storage if available */ }
    try { sessionStorage.setItem(KEY, '1'); } catch (_) { /* keep the app usable without storage */ }
  }
  function updateScrollNote() {
    if (!dialog || !dialog.open) return;
    const content = dialog.querySelector('.tour__content'), note = dialog.querySelector('[data-tour-scroll-note]');
    note.hidden = true;
    note.hidden = content.scrollHeight <= content.clientHeight + 1;
  }
  function render() {
    const s = steps[step];
    dialog.querySelector('.tour__content').scrollTop = 0;
    dialog.querySelector('[data-tour-count]').textContent = (step + 1) + ' / ' + steps.length;
    dialog.querySelector('[data-tour-eyebrow]').textContent = s.eyebrow;
    dialog.querySelector('[data-tour-title]').textContent = s.title;
    dialog.querySelector('[data-tour-text]').textContent = s.text;
    dialog.querySelector('[data-tour-tip]').textContent = s.tip;
    dialog.querySelector('[data-tour-icon]').innerHTML = window.AT.ui.icon(s.icon);
    const tags = dialog.querySelector('[data-tour-tags]');
    tags.replaceChildren(...s.tags.map(tag => { const el = document.createElement('span'); el.textContent = tag; return el; }));
    dialog.querySelectorAll('[data-tour-dot]').forEach((dot, i) => dot.classList.toggle('is-active', i === step));
    dialog.querySelector('[data-tour-back]').hidden = step === 0;
    dialog.querySelector('[data-tour-next]').textContent = step === steps.length - 1 ? 'Начать' : 'Далее';
    requestAnimationFrame(updateScrollNote);
  }
  function finish() {
    remember();
    shownThisPage = true;
    if (observer) observer.disconnect();
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
    if (fallbackBackdrop) fallbackBackdrop.hidden = true;
    if (previouslyFocused && previouslyFocused.isConnected && typeof previouslyFocused.focus === 'function') previouslyFocused.focus({preventScroll:true});
  }
  function makeDialog() {
    dialog = document.createElement('dialog');
    dialog.className = 'tour';
    dialog.setAttribute('aria-labelledby', 'tour-label tour-title');
    dialog.setAttribute('aria-describedby', 'tour-text');
    dialog.setAttribute('aria-modal', 'true');
    dialog.innerHTML = '<div class="tour__header"><span id="tour-label">Знакомство с Medzo</span><button type="button" class="tour__skip" data-tour-skip>Пропустить</button></div>' +
      '<div class="tour__progress"><span data-tour-count></span><div class="tour__dots" aria-hidden="true">' + steps.map(() => '<span data-tour-dot></span>').join('') + '</div></div>' +
      '<div class="tour__content" aria-live="polite" aria-atomic="true"><div class="tour__icon" data-tour-icon aria-hidden="true"></div><p class="tour__eyebrow" data-tour-eyebrow></p><h2 id="tour-title" data-tour-title></h2><p class="tour__text" id="tour-text" data-tour-text></p><div class="tour__tags" data-tour-tags aria-hidden="true"></div><p class="tour__tip" data-tour-tip></p></div>' +
      '<div class="tour__actions"><small class="tour__scroll-note" data-tour-scroll-note hidden>Текст можно прокрутить ↑↓</small><button type="button" class="btn btn--ghost" data-tour-back hidden>Назад</button><button type="button" class="btn btn--primary" data-tour-next>Далее</button></div>';
    document.body.appendChild(dialog);
    dialog.addEventListener('click', e => {
      if (e.target.closest('[data-tour-skip]')) finish();
      else if (e.target.closest('[data-tour-back]')) { step = Math.max(0, step - 1); render(); if (step === 0) dialog.querySelector('[data-tour-next]').focus({preventScroll:true}); }
      else if (e.target.closest('[data-tour-next]')) { if (step === steps.length - 1) finish(); else { step++; render(); } }
    });
    dialog.addEventListener('cancel', e => { e.preventDefault(); finish(); });
    // Native dialogs trap focus; this also covers browsers without showModal().
    dialog.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); return; }
      if (e.key !== 'Tab') return;
      e.stopPropagation();
      const buttons = Array.from(dialog.querySelectorAll('button')).filter(button => !button.hidden && !button.disabled);
      if (!buttons.length) return;
      if (e.shiftKey && document.activeElement === buttons[0]) { e.preventDefault(); buttons[buttons.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === buttons[buttons.length - 1]) { e.preventDefault(); buttons[0].focus(); }
    });
  }
  function open() {
    if (!dialog) makeDialog();
    if (dialog.open) return;
    previouslyFocused = document.activeElement;
    step = 0;
    render();
    try {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else {
        if (!fallbackBackdrop) { fallbackBackdrop = document.createElement('div'); fallbackBackdrop.className = 'tour-backdrop'; document.body.appendChild(fallbackBackdrop); }
        fallbackBackdrop.hidden = false; dialog.classList.add('tour--fallback'); dialog.setAttribute('open', '');
      }
    }
    catch (_) { return; }
    dialog.querySelector('[data-tour-next]').focus({preventScroll:true});
  }
  // Defer the automatic tour until a home screen is visible. Deep links and
  // active timed/practical sessions must not be interrupted by a modal.
  function maybeOpen() {
    if (shownThisPage || hasSeen()) { if (observer) observer.disconnect(); return; }
    const hash = location.hash || '#/';
    const anatomyHome = (hash === '#/' || hash === '#') && root.querySelector('.hero');
    const histologyHome = /^#\/histology(?:\?|$)/.test(hash) && root.querySelector('.histo-hero');
    if (anatomyHome || histologyHome) { shownThisPage = true; if (observer) observer.disconnect(); open(); }
  }
  window.MedzoTour = { open };
  observer = new MutationObserver(maybeOpen);
  observer.observe(root, {childList:true});
  window.addEventListener('hashchange', maybeOpen);
  window.addEventListener('resize', updateScrollNote);
  maybeOpen();
})();
