/* Эксперимент: микробы выбирают неверные варианты, но не отправляют ответ. */
(function () {
  'use strict';
  const AT = window.AT;
  // Вероятность для каждого подходящего вопроса в сессии — 0,2%.
  const APPEARANCE_CHANCE = 0.002;
  const REACTION_TIME = 12000;
  const MOVE_TIME = 1800;

  const virus = '<svg viewBox="0 0 64 64" aria-hidden="true"><g stroke="#9150be" stroke-width="4" stroke-linecap="round"><path d="M32 3v8M32 53v8M3 32h8M53 32h8M11 11l6 6M47 47l6 6M53 11l-6 6M17 47l-6 6"/></g><circle cx="32" cy="32" r="21" fill="#c982e4" stroke="#783e9d" stroke-width="3"/><circle cx="25" cy="29" r="3" fill="#382144"/><circle cx="39" cy="29" r="3" fill="#382144"/><path d="M26 39q6 5 12 0" fill="none" stroke="#382144" stroke-width="2.5" stroke-linecap="round"/></svg>';
  const bacterium = '<svg viewBox="0 0 64 64" aria-hidden="true"><g stroke="#3b9e78" stroke-width="3" stroke-linecap="round"><path d="M15 17 9 12M49 17l6-5M12 31H5M52 31h7M15 46l-6 5M49 46l6 5"/></g><rect x="13" y="11" width="38" height="42" rx="19" fill="#75d7a2" stroke="#218a68" stroke-width="3"/><circle cx="25" cy="28" r="3" fill="#174332"/><circle cx="39" cy="28" r="3" fill="#174332"/><path d="M26 38q6 5 12 0" fill="none" stroke="#174332" stroke-width="2.5" stroke-linecap="round"/></svg>';
  const germImages = [virus, bacterium, virus];

  function mount(options) {
    const { host, session, questions, onChooseWrong } = options;
    let encounter = null;
    let timer = null;
    let disposed = false;
    let overlay = null;
    let frame = null;
    function clearTimer() { if (timer) clearTimeout(timer); timer = null; }
    function removeOverlay() {
      if (frame !== null && window.cancelAnimationFrame) window.cancelAnimationFrame(frame);
      frame = null;
      if (overlay) overlay.remove();
      overlay = null;
    }
    function leave() { clearTimer(); removeOverlay(); encounter = null; }
    function valid() {
      return !disposed && host.isConnected && AT.currentSession() === session && encounter &&
        questions[session.index] && questions[session.index].id === encounter.qid &&
        session.results[encounter.qid] && !session.results[encounter.qid].revealed;
    }
    function refresh() {
      if (!valid() || encounter.phase !== 'mischief') return;
      const target = host.querySelector('[data-action="toggle-option"][data-index="' + encounter.wrong + '"]');
      if (target) target.classList.add('option--germ-target');
    }

    // Отдельный слой не пересоздаётся при выборе ответа: полёт и клики не сбрасываются.
    function createOverlay() {
      overlay = document.createElement('div');
      overlay.className = 'germ-squad-flight';
      overlay.setAttribute('aria-label', 'Микробы, которых можно лопнуть');
      overlay.innerHTML = '<span class="germ-squad__status" role="status" aria-live="polite">Появились три микроба. Лопните каждого.</span>' + germImages.map((image, i) =>
        '<button type="button" class="germ-squad__germ germ-squad__germ--' + i + '" data-action="pop-germ" data-germ="' + i + '" aria-label="Лопнуть ' + (i === 1 ? 'бактерию' : 'вирус') + '">' + image + '</button>'
      ).join('');
      overlay.addEventListener('click', pop);
      document.body.appendChild(overlay);
      if (window.requestAnimationFrame) frame = window.requestAnimationFrame(moveGerms);
    }
    function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
    function moveGerms(time) {
      frame = null;
      if (!valid() || !overlay) return;
      const card = host.querySelector('.question');
      if (!card) return;
      const bounds = card.getBoundingClientRect();
      const width = window.innerWidth, height = window.innerHeight;
      // Цель остаётся на экране при прокрутке и на узких телефонах.
      const centerX = clamp(bounds.left + bounds.width / 2, 60, width - 60);
      const centerY = clamp(bounds.top + Math.min(bounds.height * .38, 360), 100, height - 95);
      const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (encounter.startedAt === null) encounter.startedAt = time;
      const elapsed = Math.max(0, time - encounter.startedAt);
      const progress = reduced ? 1 : Math.min(1, elapsed / 8500);
      const delta = encounter.lastFrameAt === null ? 16 : clamp(time - encounter.lastFrameAt, 0, 100);
      encounter.lastFrameAt = time;
      const eased = 1 - Math.pow(1 - progress, 1.4);
      const attackTarget = encounter.phase === 'mischief' && host.querySelector('[data-action="toggle-option"][data-index="' + encounter.wrong + '"]');
      const attackBounds = attackTarget && attackTarget.getBoundingClientRect();
      const destinations = [
        [clamp(centerX - Math.min(110, width * .25), 28, width - 28), clamp(centerY - 45, 78, height - 65)],
        [clamp(centerX + Math.min(110, width * .25), 28, width - 28), clamp(centerY + 30, 78, height - 65)],
        [centerX, clamp(centerY + 95, 78, height - 65)],
      ];
      const origins = [[-40, height * .36], [width + 40, height * .66], [width * .55, -40]];
      overlay.querySelectorAll('.germ-squad__germ').forEach((button) => {
        const index = Number(button.getAttribute('data-germ'));
        if (!encounter.alive[index]) return;
        let [destX, destY] = destinations[index];
        if (attackBounds && index === encounter.alive.findIndex(Boolean)) {
          destX = clamp(attackBounds.left + attackBounds.width * .5, 28, width - 28);
          destY = clamp(attackBounds.top + attackBounds.height * .5, 78, height - 65);
        }
        const origin = origins[index], motion = encounter.motion[index];
        const sway = reduced ? 0 : Math.min(1, elapsed / 1800) * (1 - progress * .6);
        let x = origin[0] + (destX - origin[0]) * eased + Math.sin(elapsed / motion.xPeriod + motion.phase) * 26 * sway;
        let y = origin[1] + (destY - origin[1]) * eased + Math.cos(elapsed / motion.yPeriod + motion.phase * 1.3) * 22 * sway;
        // В финале один из оставшихся микробов плавно подползает к неверному ответу.
        const previous = encounter.positions[index];
        const hovered = button.matches && button.matches(':hover');
        // При наведении микроб замирает, чтобы по нему можно было попасть.
        const held = hovered;
        if (previous && held) {
          x = previous[0]; y = previous[1];
        } else if (previous && !reduced && attackBounds && index === encounter.alive.findIndex(Boolean)) {
          const alpha = 1 - Math.exp(-delta / 480);
          x = previous[0] + (x - previous[0]) * alpha;
          y = previous[1] + (y - previous[1]) * alpha;
        }
        encounter.positions[index] = [x, y];
        const rotation = held && encounter.rotations[index] !== undefined
          ? encounter.rotations[index] : reduced ? 0 : Math.sin(elapsed / 240 + motion.phase) * 22;
        encounter.rotations[index] = rotation;
        button.style.transform = 'translate3d(' + (x - 26) + 'px,' + (y - 26) + 'px,0) rotate(' + rotation + 'deg)';
      });
      frame = window.requestAnimationFrame(moveGerms);
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
      const wrong = key && q.options.map((_, i) => i + 1).filter(i => !key.answers.includes(i) && !(entry.hiddenOptions || []).includes(i) && !entry.selected.includes(i));
      if (!wrong || !wrong.length) { timer = setTimeout(beginMischief, REACTION_TIME); return; }
      encounter.phase = 'mischief';
      encounter.wrong = wrong[Math.floor(Math.random() * wrong.length)];
      refresh();
      timer = setTimeout(completeMischief, MOVE_TIME);
    }
    function completeMischief() {
      if (!valid()) return leave();
      if (blocked()) { timer = setTimeout(completeMischief, 1500); return; }
      const q = questions[session.index], entry = session.results[q.id], key = AT.keyApi.forQuestion(q);
      const wrong = encounter.wrong;
      const available = key && !key.answers.includes(wrong) && !(entry.hiddenOptions || []).includes(wrong) && !entry.selected.includes(wrong);
      encounter.phase = 'approach';
      encounter.wrong = null;
      const target = host.querySelector('.option--germ-target');
      if (target) target.classList.remove('option--germ-target');
      // Выбор меняется, но ни проверка, ни статистика, ни переход не запускаются.
      if (available && onChooseWrong && onChooseWrong(wrong)) AT.ui.toast('Микроб выбрал неверный вариант — его можно снять');
      if (valid() && encounter.alive.some(Boolean)) timer = setTimeout(beginMischief, REACTION_TIME);
    }
    function enter() {
      leave();
      if (disposed || session.mode !== 'train') return;
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
      encounter = {
        qid: q.id, alive: [true, true, true], phase: 'approach', wrong: null,
        startedAt: null, lastFrameAt: null, positions: [], rotations: [],
        motion: germImages.map(() => ({phase: Math.random() * Math.PI * 2, xPeriod: 340 + Math.random() * 160, yPeriod: 260 + Math.random() * 180})),
      };
      refresh();
      createOverlay();
      timer = setTimeout(beginMischief, REACTION_TIME);
    }
    function pop(event) {
      const button = event.target.closest('[data-action="pop-germ"]');
      if (!button || !overlay || !overlay.contains(button) || !valid()) return;
      const index = Number(button.getAttribute('data-germ'));
      if (!Number.isInteger(index) || !encounter.alive[index]) return;
      const q = questions[session.index];
      const reward = AT.game && AT.game.awardMicrobe(session, q, index);
      if (!reward || !reward.ok) { AT.ui.toast(reward ? reward.message : 'Не удалось начислить валюту', 'warn'); return; }
      encounter.alive[index] = false;
      button.insertAdjacentHTML('beforeend', '<span class="germ-squad__reward" aria-hidden="true">+50</span>');
      button.classList.add('is-popping');
      button.disabled = true;
      button.setAttribute('aria-label', 'Микроб лопнул');
      const status = overlay.querySelector('.germ-squad__status');
      const remaining = encounter.alive.filter(Boolean).length;
      if (status) status.textContent = remaining ? 'В живых: ' + remaining + ' из 3' : 'Все микробы лопнули! Вопрос спасён.';
      AT.ui.toast(remaining ? 'Микроб лопнул: +50 валюты' : 'Все микробы лопнули! +50 валюты');
      if (!remaining) {
        clearTimer(); encounter.phase = 'saved';
        if (frame !== null && window.cancelAnimationFrame) window.cancelAnimationFrame(frame);
        frame = null;
        // Даём анимации лопания закончиться, после чего убираем слой.
        timer = setTimeout(removeOverlay, 400);
        const target = host.querySelector('.option--germ-target');
        if (target) target.classList.remove('option--germ-target');
      }
    }
    function dispose() { disposed = true; leave(); }
    return { enter, leave, refresh, dispose };
  }
  AT.germSquad = { mount, APPEARANCE_CHANCE };
})();
