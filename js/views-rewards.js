/* Общий кошелёк, достижения и оформления. */
(function () {
  'use strict';
  const AT = window.AT;
  const { esc } = AT.utils;
  const { icon, toast, confirmDialog } = AT.ui;

  AT.views.rewards = function () {
    const game = AT.game, achievements = game.achievements(), profile = game.profile();
    const totalCoins = game.walletBalance();
    const unlocked = achievements.filter(a => a.unlocked).length;
    const bankName = AT.colloquium.kind === 'credit'
      ? 'Зачёт · ' + AT.colloquium.semester + ' семестр'
      : 'Коллоквиум ' + (AT.colloquium.number || AT.colloquium.id);
    const bankContext = bankName + ' · ' + AT.colloquium.name + (AT.colloquium.faculty ? ' · ' + AT.colloquium.faculty : '');
    let html = '<div class="view rewards-view">' +
      '<section class="rewards-hero"><div class="rewards-hero__content"><span class="rewards-hero__eyebrow">ВАШ ПРОГРЕСС · ' + esc(bankContext) + '</span>' +
      '<h1>Учитесь и открывайте больше</h1><p>Отвечайте по ключу, получайте валюту и открывайте оформление.</p></div>' +
      '<div class="rewards-hero__metrics"><div><span>Общий кошелёк</span><strong>' + totalCoins + '</strong><small>для покупок</small></div>' +
      '<div><span>Общий рейтинг</span><strong>' + game.totalRating() + '</strong><small>сумма всех баз</small></div></div></section>' +
      '<div class="rewards-context">' + icon('info') + '<span>Валюта, достижения, оформление и личный рейтинг общие для всех баз на этом устройстве. Самооценка без ключа не начисляет очки. Неиспользованные усиления возвращены в кошелёк по последним ценам магазина, остаток активного бонуса — пропорционально.</span></div>';

    function appearanceCard([id, style]) {
      const owned = id === 'default' || !!profile.appearances[id];
      const active = profile.appearance === id;
      const action = owned ? 'select-appearance' : 'buy-appearance';
      const label = active ? 'Выбрано' : owned ? 'Применить' : style.price + ' валюты';
      const disabled = active || (!owned && totalCoins < style.price);
      return '<article class="appearance-card' + (style.premium ? ' appearance-card--premium' : '') + (active ? ' is-active' : '') + '">' +
        '<div class="appearance-preview appearance-preview--' + esc(id) + '" aria-hidden="true" style="--preview-color:' + esc(style.color) + '"><span></span><span></span><span></span></div>' +
        '<div class="appearance-card__body"><h3>' + esc(style.title) + '</h3><p>' + esc(style.description) + '</p>' +
        '<div class="appearance-card__footer"><span>' + (active ? 'Используется' : owned ? 'Открыто' : style.premium ? 'Особое · навсегда' : 'Навсегда') + '</span>' +
        '<button class="btn ' + (owned ? 'btn--ghost' : 'btn--primary') + ' btn--sm" data-action="' + action + '" data-appearance="' + esc(id) + '"' + (disabled ? ' disabled' : '') + '>' + label + '</button></div></div></article>';
    }
    const styles = Object.entries(game.appearances);
    html += '<section class="section"><div class="section__head"><div><span class="overline">ВАШ СТИЛЬ</span><h2 id="appearanceTitle" tabindex="-1">Оформление</h2></div><span class="section__hint">Баланс: ' + totalCoins + '</span></div>' +
      '<p class="rewards-intro">Оплатите оформление из общего кошелька. Оно будет доступно во всех базах и работает со светлой и тёмной темой.</p><div class="appearance-grid">' +
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

    html += '<section class="section rewards-rules"><div class="section__head"><div><span class="overline">КАК ЭТО РАБОТАЕТ</span><h2>Правила начисления</h2></div></div>' +
      '<div class="rules-grid"><div><strong>Тренировка</strong><p>Верный ответ по ключу: +10 валюты и +5 рейтинга. Если вопрос уже освоен до ответа — +2 и +1.</p></div>' +
      '<div><strong>Пробный экзамен</strong><p>Верный ответ: +25 валюты и +15 рейтинга; для освоенного вопроса — +5 и +3. Ошибка или пропуск: −5 валюты и −3 рейтинга.</p></div>' +
      '<div><strong>Важно</strong><p>Общий баланс и рейтинг базы не уходят ниже нуля. Начисления зависят от используемого ключа и настроек проверки; их можно получить и за повторный ответ. Это личный рейтинг, не таблица лидеров.</p></div></div></section></div>';

    function mount(root) {
      const view = root.querySelector('.rewards-view');
      let busy = false;
      view.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-action="buy-appearance"], [data-action="select-appearance"]');
        if (!button || button.disabled || busy) return;
        const action = button.getAttribute('data-action'), id = button.getAttribute('data-appearance');
        if (action === 'select-appearance') {
          const result = game.selectAppearance(id);
          toast(result.message, result.ok ? undefined : 'warn'); AT.rerender(); return;
        }
        const style = game.appearances[id];
        if (!style) return;
        busy = true;
        const ok = await confirmDialog({ title: 'Купить оформление?', text: '«' + style.title + '» за ' + style.price + ' валюты из общего кошелька.', confirm: 'Купить' });
        if (!ok) { busy = false; return; }
        let result;
        try {
          result = navigator.locks && navigator.locks.request
            ? await navigator.locks.request('anatomy-cosmetic-purchase', () => game.buyAppearance(id))
            : game.buyAppearance(id);
        } catch (e) { result = {ok: false, message: 'Не удалось завершить покупку'}; }
        busy = false;
        toast(result.message, result.ok ? undefined : 'warn');
        AT.rerender();
      });
    }
    return { title: 'Награды', html, mount };
  };
})();
