/* Общие достижения и оформления, усиления выбранной базы. */
(function () {
  'use strict';
  const AT = window.AT;
  const { esc } = AT.utils;
  const { icon, toast } = AT.ui;

  function openCheckout(game, id, trigger) {
    const style = game.appearances[id];
    if (!style) return;
    const wallets = game.walletBalances().filter(w => w.balance > 0);
    const price = style.price;
    const wrap = document.createElement('div');
    wrap.className = 'modal checkout-modal';
    wrap.innerHTML = '<div class="modal__backdrop" data-checkout="cancel"></div>' +
      '<form class="modal__card checkout-card" role="dialog" aria-modal="true" aria-labelledby="checkoutTitle" aria-describedby="checkoutHint">' +
      '<div class="checkout-head"><div><span class="checkout-overline">ОФОРМЛЕНИЕ</span><h3 id="checkoutTitle">' + esc(style.title) + ' · ' + price + ' валюты</h3></div>' +
      '<button type="button" class="course-sidebar__close" data-checkout="cancel" aria-label="Закрыть">×</button></div>' +
      '<p id="checkoutHint">Выберите суммы для списания. Неизменённые суммы подберём автоматически.</p>' +
      '<div class="checkout-wallets">' + wallets.map(w => '<label class="checkout-wallet"><span class="checkout-wallet__text"><strong>' + esc(w.label) + (w.current ? ' · текущая' : '') + '</strong>' +
        '<small>Доступно: ' + w.balance + '</small></span><input type="number" inputmode="numeric" min="0" step="1" max="' + w.balance + '" value="0" data-wallet="' + esc(w.id) + '" aria-label="Списать из ' + esc(w.label) + '"></label>').join('') + '</div>' +
      '<div class="checkout-total" aria-live="polite"><strong data-checkout-total></strong><span data-checkout-status></span></div>' +
      '<div class="checkout-actions"><button type="button" class="btn btn--ghost btn--sm" data-checkout="auto">Распределить автоматически</button>' +
      '<button type="submit" class="btn btn--primary" data-checkout="confirm">Купить за ' + price + '</button></div></form>';
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('is-open'));
    const form = wrap.querySelector('form');
    const confirm = wrap.querySelector('[data-checkout="confirm"]');
    const totalEl = wrap.querySelector('[data-checkout-total]');
    const status = wrap.querySelector('[data-checkout-status]');
    const inputs = Array.from(wrap.querySelectorAll('[data-wallet]'));
    const touched = new Set();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    let closed = false, busy = false;

    function update() {
      let remaining = price, invalid = false;
      inputs.forEach(input => {
        if (!touched.has(input.dataset.wallet)) return;
        const text = input.value.trim();
        const value = text === '' ? 0 : Number(text);
        const valid = /^\d*$/.test(text) && Number.isSafeInteger(value) && value >= 0 && value <= Number(input.max);
        input.setAttribute('aria-invalid', String(!valid));
        if (!valid) invalid = true;
        else remaining -= value;
      });
      inputs.forEach(input => {
        if (touched.has(input.dataset.wallet)) return;
        const value = Math.min(Number(input.max), Math.max(0, remaining));
        input.value = String(value); remaining -= value;
        input.setAttribute('aria-invalid', 'false');
      });
      const allocated = inputs.reduce((sum, input) => sum + (Number(input.value) || 0), 0);
      totalEl.textContent = 'Итого: ' + allocated + ' / ' + price;
      status.textContent = invalid ? 'Введите целое число не больше доступного остатка.'
        : remaining > 0 ? 'Не хватает: ' + remaining
        : remaining < 0 ? 'Лишнее списание: ' + (-remaining) : 'Распределено полностью';
      confirm.disabled = busy || invalid || remaining !== 0;
      return !invalid && remaining === 0;
    }
    function close(restore) {
      if (closed || busy) return;
      closed = true;
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      wrap.remove();
      if (restore && trigger.isConnected) trigger.focus();
    }
    function onKey(event) {
      if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
      if (event.key !== 'Tab') return;
      const items = Array.from(wrap.querySelectorAll('button:not([disabled]), input:not([disabled])'));
      const index = items.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); items[items.length - 1].focus(); }
      else if (!event.shiftKey && (index === -1 || index === items.length - 1)) { event.preventDefault(); items[0].focus(); }
    }
    document.addEventListener('keydown', onKey);
    inputs.forEach(input => input.addEventListener('input', () => { touched.add(input.dataset.wallet); update(); }));
    wrap.addEventListener('click', event => {
      const action = event.target.closest('[data-checkout]');
      if (!action) return;
      if (action.dataset.checkout === 'cancel') close(true);
      if (action.dataset.checkout === 'auto') { touched.clear(); update(); }
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy || !update()) return;
      const allocation = Object.fromEntries(inputs.map(input => [input.dataset.wallet, Number(input.value) || 0]));
      busy = true; confirm.disabled = true;
      let result;
      try {
        // Сериализуем покупки в соседних вкладках там, где поддерживаются Web Locks.
        result = navigator.locks && navigator.locks.request
          ? await navigator.locks.request('anatomy-cosmetic-purchase', () => closed ? { ok: false, message: 'Покупка отменена' } : game.buyAppearance(id, allocation))
          : game.buyAppearance(id, allocation);
      } catch (e) { result = { ok: false, message: 'Не удалось завершить покупку' }; }
      busy = false;
      if (closed) return;
      if (result.ok) {
        close(false);
        toast(result.message);
        AT.rerender();
        const heading = document.getElementById('appearanceTitle');
        if (heading) heading.focus();
      } else {
        // Баланс мог измениться в другой вкладке, пока окно было открыто.
        const latest = game.walletBalances();
        inputs.forEach(input => {
          const wallet = latest.find(w => w.id === input.dataset.wallet);
          const balance = wallet ? wallet.balance : 0;
          input.max = String(balance);
          input.closest('.checkout-wallet').querySelector('small').textContent = 'Доступно: ' + balance;
        });
        update();
        status.textContent = result.message;
        toast(result.message, 'warn');
      }
    });
    if (typeof AT.onCleanup === 'function') AT.onCleanup(() => { busy = false; close(false); });
    update();
    confirm.focus();
  }

  AT.views.rewards = function () {
    const game = AT.game, wallet = game.ensure(), achievements = game.achievements(), profile = game.profile();
    const totalCoins = game.walletBalances().reduce((sum, item) => sum + item.balance, 0);
    const unlocked = achievements.filter(a => a.unlocked).length;
    const bankName = AT.colloquium.kind === 'credit'
      ? 'Зачёт · ' + AT.colloquium.semester + ' семестр'
      : 'Коллоквиум ' + (AT.colloquium.number || AT.colloquium.id);
    const bankContext = bankName + ' · ' + AT.colloquium.name + (AT.colloquium.faculty ? ' · ' + AT.colloquium.faculty : '');
    let html = '<div class="view rewards-view">' +
      '<section class="rewards-hero"><div class="rewards-hero__content"><span class="rewards-hero__eyebrow">ВАШ ПРОГРЕСС · ' + esc(bankContext) + '</span>' +
      '<h1>Учитесь и открывайте больше</h1><p>Отвечайте по ключу, получайте валюту и открывайте усиления и оформление.</p></div>' +
      '<div class="rewards-hero__metrics"><div><span>Валюта этой базы</span><strong>' + wallet.coins + '</strong><small>для покупок</small></div>' +
      '<div><span>Общий рейтинг</span><strong>' + game.totalRating() + '</strong><small>сумма всех баз</small></div></div></section>' +
      '<div class="rewards-context">' + icon('info') + '<span>Валюта и усиления принадлежат выбранной базе. Достижения, оформление и личный рейтинг общие для всех баз на этом устройстве. Самооценка без ключа не начисляет очки.</span></div>';

    function appearanceCard([id, style]) {
      const owned = id === 'default' || !!profile.appearances[id];
      const active = profile.appearance === id;
      const action = owned ? 'select-appearance' : 'buy-appearance';
      const label = active ? 'Выбрано' : owned ? 'Применить' : style.price + ' валюты';
      const disabled = active || (!owned && totalCoins < style.price);
      return '<article class="appearance-card' + (style.premium ? ' appearance-card--premium' : '') + (active ? ' is-active' : '') + '">' +
        '<div class="appearance-preview appearance-preview--' + esc(id) + '" aria-hidden="true" style="--preview-color:' + esc(style.color) + '"><span></span><span></span><span></span></div>' +
        '<div class="appearance-card__body"><h3>' + esc(style.title) + '</h3><p>' + esc(style.description) + '</p>' +
        '<div class="appearance-card__footer"><span>' + (active ? 'Используется' : owned ? 'Куплено' : style.premium ? 'Особое · навсегда' : 'Навсегда') + '</span>' +
        '<button class="btn ' + (owned ? 'btn--ghost' : 'btn--primary') + ' btn--sm" data-action="' + action + '" data-appearance="' + esc(id) + '"' + (disabled ? ' disabled' : '') + '>' + label + '</button></div></div></article>';
    }
    const styles = Object.entries(game.appearances);
    html += '<section class="section"><div class="section__head"><div><span class="overline">ВАШ СТИЛЬ</span><h2 id="appearanceTitle" tabindex="-1">Оформление</h2></div><span class="section__hint">Во всех базах: ' + totalCoins + '</span></div>' +
      '<p class="rewards-intro">Оплатите оформление валютой из одной или нескольких баз. Перед покупкой можно выбрать суммы; оформление будет доступно везде и работает со светлой и тёмной темой.</p><div class="appearance-grid">' +
      styles.filter(([, style]) => !style.premium).map(appearanceCard).join('') + '</div>' +
      '<h3 class="appearance-special-heading">Особые оформления</h3><p class="rewards-intro">Яркие иллюстрации и уникальная атмосфера для тех, кто любит выделяться.</p>' +
      '<div class="appearance-premium-grid">' + styles.filter(([, style]) => style.premium).map(appearanceCard).join('') + '</div></section>';

    function achievementCard(a) {
      return '<article class="achievement' + (a.unlocked ? ' is-unlocked' : '') + (a.absolute ? ' achievement--absolute' : '') + '"><div class="achievement__icon">' + icon(a.unlocked ? 'check' : 'target') + '</div>' +
        '<div class="achievement__content"><span class="achievement__status">' + (a.absolute ? 'Абсолютное · ' : '') + (a.unlocked ? 'Получено' : 'В процессе') + '</span><strong>' + esc(a.title) + '</strong><p>' + esc(a.description) + '</p>' +
        '<div class="achievement__progress"><span style="width:' + Math.round(a.current / a.goal * 100) + '%"></span></div><small>' + a.current + ' / ' + a.goal + '</small></div></article>';
    }
    html += '<section class="section"><div class="section__head"><div><span class="overline">ВАША КОЛЛЕКЦИЯ</span><h2>Достижения</h2></div><span class="section__hint">' + unlocked + ' из ' + achievements.length + '</span></div>' +
      '<div class="achievement-grid">' + achievements.filter(a => !a.absolute && !a.discipline).map(achievementCard).join('') + '</div>' +
      '<h3 class="achievement-absolute-heading">По направлениям</h3><p class="rewards-intro">Осваивайте вопросы по отдельным разделам анатомии.</p>' +
      '<div class="achievement-grid">' + achievements.filter(a => a.discipline).map(achievementCard).join('') + '</div>' +
      '<h3 class="achievement-absolute-heading">Абсолютные достижения</h3><p class="rewards-intro">Особые цели за освоение, экзамен, рейтинг и коллекцию оформлений.</p>' +
      '<div class="achievement-grid">' + achievements.filter(a => a.absolute).map(achievementCard).join('') + '</div>' +
      '<p class="rewards-footnote">Все достижения общие. Вопросы учитываются отдельно в каждой базе, даже если совпадают. Прежний прогресс, включая самооценку, засчитывается без начисления валюты и рейтинга.</p></section>';

    html += '<section class="section"><div class="section__head"><div><span class="overline">ПОДГОТОВКА</span><h2>Магазин усилений</h2></div><span class="section__hint">Баланс: ' + wallet.coins + '</span></div>' +
      '<p class="rewards-intro">Купите заранее, затем активируйте во время прохождения. Каждое усиление расходуется один раз.</p><div class="shop-grid">' +
      Object.entries(game.products).map(([id, product]) => {
        const locked = product.mode === 'exam' && !AT.colloquium.examAvailable;
        return '<article class="shop-card"><div class="shop-card__top"><span class="shop-card__icon">' + icon(product.kind === 'hint' ? 'sparkles' : 'target') + '</span>' +
          '<span class="shop-card__tag">' + (product.mode === 'exam' ? 'Экзамен' : 'Тренировка') + '</span></div>' +
          '<h3>' + esc(product.title) + '</h3><p>' + esc(product.description) + '</p>' +
          '<div class="shop-card__footer"><span>В запасе: ' + game.count(id) + '</span>' +
          '<button class="btn btn--primary btn--sm" data-action="buy-boost" data-product="' + esc(id) + '"' + (locked || wallet.coins < product.price || game.count(id) >= 99 ? ' disabled' : '') + '>' + (locked ? 'Скоро' : product.price + ' валюты') + '</button></div></article>';
      }).join('') + '</div></section>';

    html += '<section class="section rewards-rules"><div class="section__head"><div><span class="overline">КАК ЭТО РАБОТАЕТ</span><h2>Правила начисления</h2></div></div>' +
      '<div class="rules-grid"><div><strong>Тренировка</strong><p>Верный ответ по ключу: +10 валюты и +5 рейтинга. Если вопрос уже освоен до ответа — +2 и +1.</p></div>' +
      '<div><strong>Пробный экзамен</strong><p>Верный ответ: +25 валюты и +15 рейтинга; для освоенного вопроса — +5 и +3. Ошибка или пропуск: −5 валюты и −3 рейтинга.</p></div>' +
      '<div><strong>Усиления</strong><p>Подсказка убирает один неверный вариант. ×2 удваивает рейтинг, но не валюту, за 20 верных ответов в текущей сессии. На экзамене усиления дороже, а их использование отмечается в итогах.</p></div>' +
      '<div><strong>Важно</strong><p>Баланс и рейтинг базы не уходят ниже нуля. Начисления зависят от используемого ключа и настроек проверки; их можно получить и за повторный ответ. Это личный рейтинг, не таблица лидеров.</p></div></div></section></div>';

    function mount(root) {
      const view = root.querySelector('.rewards-view');
      view.addEventListener('click', (event) => {
        const button = event.target.closest('[data-action="buy-boost"], [data-action="buy-appearance"], [data-action="select-appearance"]');
        if (!button || button.disabled) return;
        const action = button.getAttribute('data-action');
        if (action === 'buy-appearance') {
          openCheckout(game, button.getAttribute('data-appearance'), button);
          return;
        }
        const result = action === 'buy-boost' ? game.buy(button.getAttribute('data-product'))
          : game.selectAppearance(button.getAttribute('data-appearance'));
        toast(result.message, result.ok ? undefined : 'warn');
        AT.rerender();
      });
    }
    return { title: 'Награды', html, mount };
  };
})();
