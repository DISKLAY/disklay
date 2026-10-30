/* Эксперимент: микробы шалят, но не отправляют ответы и не меняют статистику. */
(function () {
  'use strict';
  const AT = window.AT;
  // Тестовый режим по просьбе пользователя; после проверки заменить на 0.005.
  const APPEARANCE_CHANCE = 1;
  const REACTION_TIME = 12000;
  const MOVE_TIME = 1800;

  const virus = '<svg viewBox="0 0 64 64" aria-hidden="true"><g stroke="#9150be" stroke-width="4" stroke-linecap="round"><path d="M32 3v8M32 53v8M3 32h8M53 32h8M11 11l6 6M47 47l6 6M53 11l-6 6M17 47l-6 6"/></g><circle cx="32" cy="32" r="21" fill="#c982e4" stroke="#783e9d" stroke-width="3"/><circle cx="25" cy="29" r="3" fill="#382144"/><circle cx="39" cy="29" r="3" fill="#382144"/><path d="M26 39q6 5 12 0" fill="none" stroke="#382144" stroke-width="2.5" stroke-linecap="round"/></svg>';
  const bacterium = '<svg viewBox="0 0 64 64" aria-hidden="true"><g stroke="#3b9e78" stroke-width="3" stroke-linecap="round"><path d="M15 17 9 12M49 17l6-5M12 31H5M52 31h7M15 46l-6 5M49 46l6 5"/></g><rect x="13" y="11" width="38" height="42" rx="19" fill="#75d7a2" stroke="#218a68" stroke-width="3"/><circle cx="25" cy="28" r="3" fill="#174332"/><circle cx="39" cy="28" r="3" fill="#174332"/><path d="M26 38q6 5 12 0" fill="none" stroke="#174332" stroke-width="2.5" stroke-linecap="round"/></svg>';
  const germImages = [virus, bacterium, virus];

  function mount(options) {
    const { host, session, questions, onAdvance } = options;
    let encounter = null;
    let timer = null;
    let disposed = false;
    function clearTimer() { if (timer) clearTimeout(timer); timer = null; }
    function leave() { clearTimer(); encounter = null; }
    function valid() {
      return !disposed && host.isConnected && AT.currentSession() === session && encounter &&
        questions[session.index] && questions[session.index].id === encounter.qid &&
        session.results[encounter.qid] && !session.results[encounter.qid].revealed;
    }
    function refresh() {
      if (!valid()) return;
      const card = host.querySelector('.question');
      if (!card) return;
      const panel = document.createElement('div');
      panel.className = 'germ-squad';
      panel.innerHTML = '<div class="germ-squad__head"><strong>Бригада микробов!</strong><span>Лопните каждого, пока они не нашалили</span></div>' +
        '<div class="germ-squad__crew">' + germImages.map((image, i) => encounter.alive[i]
          ? '<button type="button" class="germ-squad__germ germ-squad__germ--' + i + '" data-action="pop-germ" data-germ="' + i + '" aria-label="Лопнуть ' + (i === 1 ? 'бактерию' : 'вирус') + '">' + image + '</button>'
          : '<span class="germ-squad__popped" aria-hidden="true">✦</span>').join('') + '</div>' +
        '<p class="germ-squad__status" role="status">' + (encounter.phase === 'mischief' ? 'Микробы выбирают неверный вариант…' : encounter.phase === 'saved' ? 'Все микробы лопнули! Вопрос спасён.' : 'В живых: ' + encounter.alive.filter(Boolean).length + ' из 3') + '</p>';
      const hint = card.querySelector('.question__hint');
      if (hint) hint.insertAdjacentElement('afterend', panel);
      if (encounter.phase === 'mischief') {
        const target = host.querySelector('[data-action="toggle-option"][data-index="' + encounter.wrong + '"]');
        if (target) {
          target.classList.add('option--germ-target');
          const attacker = panel.querySelector('.germ-squad__germ:not([disabled])');
          if (attacker && attacker.animate && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
            const from = attacker.getBoundingClientRect(), to = target.getBoundingClientRect();
            attacker.classList.add('is-attacking');
            attacker.animate([{transform: 'translate(0, 0)'}, {transform: 'translate(' + (to.left + 20 - from.left) + 'px, ' + (to.top + 5 - from.top) + 'px)'}], {duration: MOVE_TIME - 200, easing: 'ease-in-out', fill: 'forwards'});
          }
        }
      }
    }
    function blocked() {
      return document.hidden || !!document.querySelector('.modal, #courseSidebar:not([hidden])') ||
        !!(document.activeElement && document.activeElement.matches('textarea, input'));
    }
    function beginMischief() {
      if (!valid()) return leave();
      // В фоновой вкладке, диалоге и во время ввода заметки не мешаем пользователю.
      if (blocked()) {
        timer = setTimeout(beginMischief, 1500); return;
      }
      const q = questions[session.index], entry = session.results[q.id], key = AT.keyApi.forQuestion(q);
      const wrong = key && q.options.map((_, i) => i + 1).filter(i => !key.answers.includes(i) && !(entry.hiddenOptions || []).includes(i));
      if (!wrong || !wrong.length) { leave(); const panel = host.querySelector('.germ-squad'); if (panel) panel.remove(); return; }
      encounter.phase = 'mischief';
      encounter.wrong = wrong[Math.floor(Math.random() * wrong.length)];
      const panel = host.querySelector('.germ-squad');
      if (panel) panel.remove();
      refresh();
      timer = setTimeout(completeMischief, MOVE_TIME);
    }
    function completeMischief() {
        if (!valid()) return leave();
        if (blocked()) { timer = setTimeout(completeMischief, 1500); return; }
        const q = questions[session.index], entry = session.results[q.id], key = AT.keyApi.forQuestion(q);
        if (!key || key.answers.includes(encounter.wrong) || (entry.hiddenOptions || []).includes(encounter.wrong)) {
          leave();
          const panel = host.querySelector('.germ-squad');
          if (panel) panel.remove();
          return;
        }
        // Это только визуальная шалость: не трогаем выбор, попытки, рейтинг и валюту.
        const hasNext = session.index < questions.length - 1;
        leave();
        if (hasNext) {
          AT.ui.toast('Микробы отвлекли вас и перелистнули вопрос — ответ не отправлен');
          onAdvance();
        } else {
          const target = host.querySelector('.option--germ-target');
          if (target) target.classList.remove('option--germ-target');
          const panel = host.querySelector('.germ-squad');
          if (panel) panel.remove();
          AT.ui.toast('Микробы нашалили, но последний вопрос не завершён');
        }
    }
    function enter() {
      leave();
      if (disposed || session.mode !== 'train' || !AT.getState().settings.germSquad) return;
      const q = questions[session.index];
      if (!q) return;
      const entry = session.results[q.id];
      const key = AT.keyApi.forQuestion(q);
      if (!entry || entry.revealed || !key || !q.options.some((_, i) => !key.answers.includes(i + 1) && !(entry.hiddenOptions || []).includes(i + 1))) return;
      if (!session.germSeen || typeof session.germSeen !== 'object') session.germSeen = {};
      if (session.germSeen[q.id]) return;
      session.germSeen[q.id] = true;
      AT.save(true);
      if (Math.random() >= APPEARANCE_CHANCE) return;
      encounter = { qid: q.id, alive: [true, true, true], phase: 'approach', wrong: null };
      refresh();
      timer = setTimeout(beginMischief, REACTION_TIME);
    }
    function pop(event) {
      const button = event.target.closest('[data-action="pop-germ"]');
      if (!button || !host.contains(button) || !valid()) return;
      const index = Number(button.getAttribute('data-germ'));
      if (!Number.isInteger(index) || !encounter.alive[index]) return;
      encounter.alive[index] = false;
      if (button.getAnimations) button.getAnimations().forEach(animation => animation.cancel());
      button.classList.add('is-popping');
      button.disabled = true;
      button.setAttribute('aria-label', 'Микроб лопнул');
      const status = host.querySelector('.germ-squad__status');
      const remaining = encounter.alive.filter(Boolean).length;
      if (status) status.textContent = remaining ? 'В живых: ' + remaining + ' из 3' : 'Все микробы лопнули! Вопрос спасён.';
      if (!remaining) {
        clearTimer(); encounter.phase = 'saved';
        const target = host.querySelector('.option--germ-target');
        if (target) target.classList.remove('option--germ-target');
      }
    }
    host.addEventListener('click', pop);
    function dispose() { disposed = true; leave(); host.removeEventListener('click', pop); }
    return { enter, leave, refresh, dispose };
  }
  AT.germSquad = { mount, APPEARANCE_CHANCE };
})();
