/* Общие достижения и оформления, усиления выбранной базы. */
(function () {
  'use strict';
  const AT = window.AT;
  const { esc } = AT.utils;
  const { icon, toast } = AT.ui;

  AT.views.rewards = function () {
    const game = AT.game, wallet = game.ensure(), achievements = game.achievements(), profile = game.profile();
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

    html += '<section class="section"><div class="section__head"><div><span class="overline">ВАШ СТИЛЬ</span><h2>Оформление</h2></div><span class="section__hint">Баланс: ' + wallet.coins + '</span></div>' +
      '<p class="rewards-intro">Покупайте понравившиеся цвета за валюту выбранной базы. Оформление останется доступным во всех базах и работает со светлой и тёмной темой.</p><div class="appearance-grid">' +
      Object.entries(game.appearances).map(([id, style]) => {
        const owned = id === 'default' || !!profile.appearances[id];
        const active = profile.appearance === id;
        const action = owned ? 'select-appearance' : 'buy-appearance';
        const label = active ? 'Выбрано' : owned ? 'Применить' : style.price + ' валюты';
        const disabled = active || (!owned && wallet.coins < style.price);
        return '<article class="appearance-card' + (active ? ' is-active' : '') + '">' +
          '<div class="appearance-preview appearance-preview--' + esc(id) + '" aria-hidden="true" style="--preview-color:' + esc(style.color) + '"><span></span><span></span><span></span></div>' +
          '<div class="appearance-card__body"><h3>' + esc(style.title) + '</h3><p>' + esc(style.description) + '</p>' +
          '<div class="appearance-card__footer"><span>' + (active ? 'Используется' : owned ? 'Куплено' : 'Навсегда') + '</span>' +
          '<button class="btn ' + (owned ? 'btn--ghost' : 'btn--primary') + ' btn--sm" data-action="' + action + '" data-appearance="' + esc(id) + '"' + (disabled ? ' disabled' : '') + '>' + label + '</button></div></div></article>';
      }).join('') + '</div></section>';

    function achievementCard(a) {
      return '<article class="achievement' + (a.unlocked ? ' is-unlocked' : '') + (a.absolute ? ' achievement--absolute' : '') + '"><div class="achievement__icon">' + icon(a.unlocked ? 'check' : 'target') + '</div>' +
        '<div class="achievement__content"><span class="achievement__status">' + (a.absolute ? 'Абсолютное · ' : '') + (a.unlocked ? 'Получено' : 'В процессе') + '</span><strong>' + esc(a.title) + '</strong><p>' + esc(a.description) + '</p>' +
        '<div class="achievement__progress"><span style="width:' + Math.round(a.current / a.goal * 100) + '%"></span></div><small>' + a.current + ' / ' + a.goal + '</small></div></article>';
    }
    html += '<section class="section"><div class="section__head"><div><span class="overline">ВАША КОЛЛЕКЦИЯ</span><h2>Достижения</h2></div><span class="section__hint">' + unlocked + ' из ' + achievements.length + '</span></div>' +
      '<div class="achievement-grid">' + achievements.filter(a => !a.absolute && !a.discipline).map(achievementCard).join('') + '</div>' +
      '<h3 class="achievement-absolute-heading">По направлениям</h3><p class="rewards-intro">Осваивайте вопросы по отдельным разделам анатомии.</p>' +
      '<div class="achievement-grid">' + achievements.filter(a => a.discipline).map(achievementCard).join('') + '</div>' +
      '<h3 class="achievement-absolute-heading">Абсолютные достижения</h3><p class="rewards-intro">Особые цели за освоение, экзамен и общий рейтинг.</p>' +
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
        const result = action === 'buy-boost' ? game.buy(button.getAttribute('data-product'))
          : action === 'buy-appearance' ? game.buyAppearance(button.getAttribute('data-appearance'))
          : game.selectAppearance(button.getAttribute('data-appearance'));
        toast(result.message, result.ok ? undefined : 'warn');
        AT.rerender();
      });
    }
    return { title: 'Награды', html, mount };
  };
})();
