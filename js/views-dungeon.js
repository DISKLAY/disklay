/* Интерфейс подземелья, загружается только при первом входе в режим. */
(function () {
  'use strict';
  const AT = window.AT, esc = AT.utils.esc;
  const { ITEMS, MONSTERS, IDS, monstersFor, adventureStats, rosterFor, intent, MAX_LEVEL, EVENTS, FINDS, MILESTONES, zone, price, dodgeChance, damageRange, heroDamage, heroMaxHp } = window.DungeonEngine;
  const storage = { getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value) };
  const game = window.DungeonEngine.create({ storage, bank: AT.colloquium.id, questions: AT.dataset.questions, byId: id => AT.dataset.byId.get(id), answer: q => AT.keyApi.forQuestion(q), random: Math.random, adventure: true, ownsAppearance: id => !!(AT.game && AT.game.profile().appearances[id]) });
  let section = 'camp';
  let selectedLevel = Math.min(MAX_LEVEL, game.state.unlocked), levelPage = Math.floor((selectedLevel - 1) / 10);
  const PIXELS = {
    hero: [
      '......kkkk......','.....kssssk.....','....kssssssk....','....kssssssk....','....kkttttkk....','.....kttttk.....','....kkttttkk....','..ckbbkkkkbbk...','..cckbbbbbbbk...','..c.ckbbg bbk...','..c..kbbggbbk...','..c..kbbggbbk...','..c..kkbkkbkk...','..c...kbbkbbk...','..c...kkk.kkk...','......ddd.ddd...'],
    skeleton: [
      '................','.....kkkkkk.....','....keeeeeek....','...keeeeeeeek...','...keeeeeeeek...','...kekkeekke k..','...kekkeekke k..','....kee k eek...','.....keeeek.....','.....kekek k....','...kkkeeeekkk...','..k..keeeek..k..','..k..kekek...k..','.....kekek......','....kke.ekk.....','....kk...kk.....'],
    slime: ['................','................','................','................','................','......mmmm......','....mmnnnnmm....','...mnnnnnnnnm...','..mnnwnnnnnnnm..','..mnnnnnnnnnnm..','.mnnkknnnkknnnm.','.mnnkknnnkknnnm.','.mnnnnnnnnnnnnm.','.mnnnnkkkk nnnm.','..mmmmmmmmmmmm..','................'],
    bat: ['................','..kk........kk..','.kppk......kppk.','kppppk.kk.kppppk','kpppppkppkpppppk','kppppppppppppppk','.kkpppprrppppkk.','...kkppppppkk...','.....kppppk.....','.....kprrpk.....','.....kppppk.....','......kkkk......','.......kk.......','................','................','................'],
    spider: ['................','................','..k..........k..','..k...kkkk...k..','...k.kkkkkk.k...','....kkkkkkkk....','.kkkkrkkrkkkkkk.','k..kkkrrkkkkk..k','...kkkkkkkkkk...','..k.kkkkkkkk.k..','.k...kkkkkk...k.','k....k....k....k','.....k....k.....','....k......k....','................','................'],
    wraith: ['......kkkk......','....kkppppkk....','...kppppppppk...','..kppppppppppk..','..kppwwppwwppk..','..kppwwppwwppk..','..kppppppppppk..','..kpppkkkkpppk..','..kppppppppppk..','.kppppppppppppk.','.kppppppppppppk.','.kppppppppppppk.','.kppkppkppkpppk.','..kk.kk.kk.kk...','................','................'],
    golem: ['................','.....kkkkkk.....','....kggggggk....','....kgrggrgk....','....kggggggk....','...kkggggggkk...','..kggkggggkggk..','.kgggkggggkgggk.','.kgggkggggkgggk.','.kgggkggggkgggk.','..kkkggggggkkk..','....kggggggk....','....kggkkggk....','....kggkkggk....','...kkggkkggkk...','...kkkk..kkkk...'],
    lich: ['...y..yy..y.....','...yyyyyyyy.....','....yyyyyy......','.....kkkkkk.....','....kppppppk....','....kpwppwpk....','....kppppppk....','.....kppppk.....','...kkkppppkkk...','..kppppppppppk..','.kppppppppppppk.','.kppppppppppppk.','.kppp kkkk pppk.','.kppp......pppk.','..kk........kk..','................']
  };
  const COLORS = { k:'#192932', s:'#a4c9b3', t:'#e8c89a', b:'#527d72', g:'#8b9a8a', c:'#ead59d', d:'#674e40', e:'#dac6a5', m:'#2b655d', n:'#71b9a1', w:'#e4f8dc', p:'#9a75ac', r:'#ef927a', y:'#e4c67e' };
  function sprite(id, locked) {
    const monster = MONSTERS[id], rows = PIXELS[(monster && monster.sprite) || id] || PIXELS.skeleton;
    let rects = '';
    rows.forEach((row,y) => Array.from(row.replace(/ /g,'.')).forEach((c,x) => {
      if (COLORS[c]) {
        const color = monster && monster.color && ['e','g','n','p','r'].includes(c) ? monster.color : COLORS[c];
        rects += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + (locked ? '#354849' : color) + '"/>';
      }
    }));
    // Знак в углу отличает даже родственные пиксельные силуэты разных разделов.
    if (monster && monster.bank) {
      const number = Array.from(id).reduce((sum, c) => sum + c.charCodeAt(0), 0);
      const color = locked ? '#354849' : monster.color;
      rects += '<path d="M1 1h3v1H1zm1 -1h1v3H2z' + (number % 2 ? 'M12 1h2v1h-2z' : 'M12 1h1v2h-1z') + '" fill="' + color + '"/>';
    }
    return '<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">' + rects + '</svg>';
  }
  const itemIcons = { sword: '⚔', armor: '♜', agility: '➶', heal: '✚', shield: '⬡', focus: '✧' };
  function rangeLabel(base, bonus = 0) { const range = damageRange(base); return (range.min + bonus) + '–' + (range.max + bonus); }
  function bar(value, max, kind, lost) {
    const label = kind === 'hero' ? 'Здоровье героя' : 'Здоровье монстра';
    return '<div class="dg-health-wrap"><div class="dg-bar dg-bar--' + kind + '" role="progressbar" aria-label="' + label + '" aria-valuemin="0" aria-valuemax="' + max + '" aria-valuenow="' + value + '"><span style="width:' + (100 * value / max) + '%"></span></div>' + (Number.isFinite(lost) && lost > 0 ? '<span class="dg-hp-loss" role="status" aria-label="' + (kind === 'hero' ? 'Герой потерял ' : 'Монстр потерял ') + lost + ' здоровья">−' + lost + '</span>' : '') + '</div>';
  }
  function tabs(active) { return '<nav class="dg-tabs" aria-label="Разделы подземелья">' + [['camp','Карта'],['shop','Мастерская'],['bestiary','Энциклопедия']].map(([id,name]) => '<button type="button" data-dg="section" data-id="' + id + '"' + (active === id ? ' aria-current="page"' : '') + '>' + name + '</button>').join('') + '<span class="dg-tab-gold">✦ ' + game.state.gold + '</span></nav>'; }
  function shop(s) {
    return '<div class="dg-section-banner dg-section-banner--forge"><span class="dg-eyebrow">КУЗНИЦА В ЛАГЕРЕ</span><h1>Мастерская героя</h1><p>Чем глубже поход, тем опаснее монстры. Подготовь снаряжение заранее.</p></div><section class="dg-shop"><div class="dg-section-head"><div><span class="dg-eyebrow">СНАРЯЖЕНИЕ И МАГИЯ</span><h2>Улучшения и способности</h2></div><span>Золото: <b>✦ ' + s.gold + '</b></span></div><div class="dg-shop-grid">' + Object.entries(ITEMS).map(([id, item]) => {
      const owned = s.upgrades[id], maxed = owned >= item.max, cost = price(item, owned);
      return '<article class="dg-item"><div class="dg-item-icon">' + itemIcons[id] + '</div><div class="dg-item-body"><h3>' + item.name + '</h3><p>' + item.description + '</p><span>' + (item.max > 1 ? 'Уровень ' + owned + ' / ' + item.max + (id === 'agility' ? ' · шанс ' + dodgeChance(owned) + '%' : id === 'armor' ? ' · ' + heroMaxHp(owned) + ' ♥' + (maxed ? '' : ' → ' + heroMaxHp(owned + 1) + ' ♥') : '') : (owned ? 'Изучено' : 'Не изучено')) + '</span></div><button type="button" class="dg-buy" data-dg="buy" data-id="' + id + '" ' + (maxed || s.gold < cost ? 'disabled' : '') + '>' + (maxed ? 'Куплено' : '✦ ' + cost) + '</button></article>';
    }).join('') + '</div></section>';
  }
  function bestiary(s) {
    const visible = [...new Set([...monstersFor(AT.colloquium.id), ...s.discovered])];
    return '<div class="dg-section-banner dg-section-banner--library"><span class="dg-eyebrow">АРХИВ ИССЛЕДОВАТЕЛЯ</span><h1>Энциклопедия монстров</h1><p>Узнавай сильные стороны врагов и готовься к следующему спуску.</p></div><section class="dg-bestiary"><div class="dg-section-head"><div><span class="dg-eyebrow">ЗАМЕТКИ ИЗ ПОХОДОВ</span><h2>Встреченные существа</h2></div><span>Открыто <b>' + s.discovered.length + ' / ' + IDS.length + '</b></span></div><div class="dg-bestiary-grid">' + visible.map(id => {
      const known = s.discovered.includes(id), m = MONSTERS[id];
      if (!known) return '<article class="dg-entry dg-entry--locked"><div class="dg-entry-sprite">' + sprite(id,true) + '</div><div><h3>???</h3><p>Существо ещё не встречено. Отправьтесь в поход в этой базе.</p></div></article>';
      return '<article class="dg-entry"><div class="dg-entry-sprite">' + sprite(id) + '</div><div>' + (m.bank ? '<span class="dg-entry-bank">' + esc((window.COLLOQUIUM_MODULES[m.bank] || {}).name || m.bank) + '</span>' : '') + '<span class="dg-eyebrow">' + esc(m.title) + '</span><h3>' + esc(m.name) + '</h3><p>' + esc(m.description) + '</p><div class="dg-tactic"><strong>Тактика</strong> ' + esc(m.tactic) + '</div></div></article>';
    }).join('') + '</div></section>';
  }
  function info(label, html) {
    return '<details class="dg-info"><summary aria-label="' + esc(label) + '" title="' + esc(label) + '">i</summary><div class="dg-info-panel" tabindex="0">' + html + '</div></details>';
  }
  function levelPath(s, count) {
    selectedLevel = Math.max(1, Math.min(MAX_LEVEL, s.unlocked, selectedLevel));
    levelPage = Math.max(0, Math.min(2, levelPage));
    const first = levelPage * 10 + 1, last = Math.min(MAX_LEVEL, first + 9), scores = s.stars[AT.colloquium.id] || {};
    let nodes = '';
    for (let i = first; i <= last; i++) {
      const offset = i - first, row = offset < 5 ? 1 : 2, col = row === 1 ? offset + 1 : 10 - offset;
      const locked = i > s.unlocked, score = scores[i] || 0;
      const label = 'Уровень ' + i + (i % 5 === 0 ? ', босс' : '') + (locked ? ', закрыт' : score ? ', звёзд: ' + score + ' из 3' : ', доступен, ещё не пройден');
      nodes += '<div class="dg-path-node" style="grid-column:' + col + ';grid-row:' + row + '"><button type="button" class="dg-level-node' + (i === selectedLevel ? ' is-selected' : '') + (locked ? ' is-locked' : '') + (i % 5 === 0 ? ' is-boss' : '') + '" data-dg="level" data-level="' + i + '" aria-label="' + esc(label) + '" aria-pressed="' + (i === selectedLevel) + '" ' + (locked ? 'disabled' : '') + '><span class="dg-level-number">' + (locked ? '⌑' : i) + '</span><span class="dg-level-stars" aria-hidden="true">' + (locked ? i : score ? '★'.repeat(score) + '☆'.repeat(3-score) : '···') + '</span></button></div>';
    }
    const opponents = rosterFor(selectedLevel, AT.colloquium.id).slice(1).map((id, index) => adventureStats(selectedLevel, id, index === 1 && selectedLevel % 5 === 0 ? 'boss' : 'normal'));
    ['skeleton','slime','bat','spider','wraith','golem','lich'].forEach(id => { opponents.push(adventureStats(selectedLevel, id, 'normal')); if (selectedLevel >= 2) opponents.push(adventureStats(selectedLevel, id, 'elite')); });
    const hp = opponents.map(d => d.hp), attacks = opponents.map(d => damageRange(d.damage));
    const spread = values => Math.min(...values) === Math.max(...values) ? String(values[0]) : Math.min(...values) + '–' + Math.max(...values);
    const score = scores[selectedLevel] || 0;
    const help = '<strong>Звёзды за прохождение</strong><p>Три звезды — без ошибок; две — за 1–2 ошибки; одна — за 3 и более. Лучший результат сохраняется для каждого уровня и базы.</p><p>У противников разные здоровье и урон: живучие обычно бьют слабее. На карте указан диапазон базовых характеристик; особые приёмы могут изменить урон.</p><p>За каждого монстра золото начисляется сразу, даже при поражении. За зачистку есть дополнительная награда. Босс ждёт на каждом пятом уровне.</p><strong>Оформления за победу</strong><p>Общий шанс на обычном уровне — 1%, на уровне босса — 3%. Океан: 0,30%; Гранат: 0,25%; Янтарь: 0,20%; Осень, Зима и Весна: по 0,05%; Атака титанов: 0,04%; Рик и Морти и Во все тяжкие: по 0,03%. Для боссов каждый шанс втрое выше. Если оформление уже открыто, вместо него вы получите 50 золота подземелья. Результаты независимы; гарантированного выпадения нет.</p>';
    return '<section class="dg-map" aria-labelledby="dg-map-title"><div class="dg-map-heading"><div><span class="dg-eyebrow">ПУТЬ ИССЛЕДОВАТЕЛЯ</span><h2 id="dg-map-title">Выбери глубину</h2></div>' + info('Как устроены уровни и звёзды', help) + '<span class="dg-map-progress">Открыто ' + Math.min(s.unlocked, MAX_LEVEL) + ' / ' + MAX_LEVEL + '</span></div><div class="dg-path-wrap"><div class="dg-path-nav"><button type="button" data-dg="map-page" data-dir="prev" data-page="' + (levelPage - 1) + '" ' + (levelPage === 0 ? 'disabled' : '') + ' aria-label="Предыдущие уровни">←</button><span>УРОВНИ ' + first + ' — ' + last + '</span><button type="button" data-dg="map-page" data-dir="next" data-page="' + (levelPage + 1) + '" ' + (levelPage === 2 ? 'disabled' : '') + ' aria-label="Следующие уровни">→</button></div><div class="dg-path-grid"><svg class="dg-path-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M10 25 H90 V75 H10" /></svg>' + nodes + '</div></div><div class="dg-map-selection"><div><span class="dg-eyebrow">ВЫБРАННЫЙ УРОВЕНЬ</span><strong>' + selectedLevel + ' <span>' + (score ? '★'.repeat(score) + '☆'.repeat(3-score) : '☆☆☆') + '</span></strong><small>Враги: ' + spread(hp) + ' ♥ · ' + Math.min(...attacks.map(d => d.min)) + '–' + Math.max(...attacks.map(d => d.max)) + ' ⚔</small><small>Герой: ' + heroMaxHp(s.upgrades.armor) + ' ♥</small></div><button type="button" class="dg-primary" data-dg="start" ' + (!count ? 'disabled' : '') + '>Войти в подземелье <span>→</span></button></div><p class="dg-map-note">' + (count ? '◈ Каждый пятый уровень — босс · База: ' + esc(AT.colloquium.name) + ' · вопросов с ключом: ' + count : 'В этой базе нет вопросов с ключом. Добавьте ключ или выберите другую базу.') + '</p></section>';
  }
  function intro(s) {
    const count = game.pool().length;
    return '<div class="dg-lobby"><div class="dg-lobby-copy"><span class="dg-eyebrow">ЭКСПЕРИМЕНТАЛЬНЫЙ РЕЖИМ · RPG</span><h1>Подземелья<br><em>анатомии</em></h1><p>Знания — твоё оружие. Спускайся глубже, открывай монстров и становись сильнее с каждым походом.</p></div><div class="dg-lobby-emblem" aria-hidden="true"><div class="dg-emblem-circle">' + sprite('hero') + '</div><span>ЗНАНИЕ · СИЛА · ПОБЕДА</span></div></div>' + levelPath(s, count) + '<section class="dg-milestones"><div><span class="dg-eyebrow">НЕБОЛЬШИЕ ЦЕЛИ</span><h2>Дневник исследователя</h2><p>По 30 золота подземелья за каждую цель — один раз.</p></div><ul>' + Object.entries(MILESTONES).map(([id, name]) => '<li class="' + (s.milestones[id] ? 'is-done' : '') + '">' + (s.milestones[id] ? '✓ ' : '◇ ') + esc(name) + '</li>').join('') + '</ul></section>';
  }
  function arsenal(s, r, monster, modern) {
    const abilityHelp = '<strong>Пассивное уклонение</strong><p>Шанс: ' + (modern ? dodgeChance(s.upgrades.agility) + '%' : 'нет в старом походе') + '. Уклонение проверяется до щита и не расходует его. Яд и шипы не блокируются.</p><strong>Активные способности</strong><p>Каждая используется один раз за поход. Лечение восстанавливает ' + (r.healthBalanceVersion === 2 ? 15 : modern ? 20 : 2) + ' здоровья; щит блокирует следующую атаку (кроме пробоя); фокус убирает до двух неверных вариантов.</p><p>Неоткрытые способности можно приобрести в мастерской.</p>';
    let html = '<aside class="dg-side dg-side--compact"><div class="dg-arsenal-heading"><strong>Способности</strong><span>↝ ' + (modern ? dodgeChance(s.upgrades.agility) + '%' : '—') + '</span>' + info('Подробнее о способностях и уклонении', abilityHelp) + '</div><div class="dg-abilities">';
    const names = {heal:'Лечение',shield:'Щит',focus:'Фокус'};
    ['heal','shield','focus'].forEach(id => {
      const locked = !s.upgrades[id], used = !!r.used[id], alreadyShielded = r.adventureVersion === 1 && id === 'shield' && r.shielded, suppressed = id === 'focus' && !r.legacy && monster.mechanic === 'chill', full = id === 'heal' && r.hp === r.maxHp;
      const unavailable = !!r.result || locked || used || alreadyShielded || suppressed || full;
      const status = locked ? 'Не открыто' : used ? 'Использовано' : alreadyShielded ? 'Щит активен' : suppressed ? 'Заблокировано' : full ? 'Здоровье полное' : r.result ? 'После ответа' : 'Готово';
      html += '<button type="button" class="dg-ability" data-dg="ability" data-id="' + id + '" aria-label="' + esc(names[id] + ': ' + status) + '" title="' + esc(status) + '" ' + (unavailable ? 'disabled' : '') + '><span class="dg-ability-icon">' + itemIcons[id] + '</span><span><strong>' + names[id] + '</strong><small>' + status + '</small></span></button>';
    });
    const statuses = [];
    if (r.poison) statuses.push('☣ Яд: ' + (modern ? 5 : 1) + ' урона');
    if (r.special.stunned) statuses.push('✦ Следующий удар ≤ ' + (modern ? 6 : 1));
    if (r.shielded) statuses.push('⬡ Щит активен');
    if (r.adventureVersion === 1 && r.bonusDamage) statuses.push('⚔ Клинок +' + r.bonusDamage);
    return html + '</div>' + (statuses.length ? '<div class="dg-active-status" role="status">' + statuses.join(' · ') + '</div>' : '') + '</aside>';
  }
  function eventScreen(r) {
    const event = EVENTS[r.event];
    if (!event) return '<div class="dg-panel"><p>Событие недоступно.</p><button data-dg="retreat">Вернуться в лагерь</button></div>';
    return '<section class="dg-event"><span class="dg-eyebrow">НАХОДКА МЕЖДУ БОЯМИ · УРОВЕНЬ ' + r.level + '</span><h1>' + esc(event.name) + '</h1><p>' + esc(event.text) + '</p><div class="dg-event-status">♥ ' + r.hp + ' / ' + r.maxHp + ' · Следующий враг: ' + esc((MONSTERS[r.roster[r.enemy]] || {}).name || 'неизвестен') + (r.kinds[r.enemy] === 'boss' ? ' · БОСС' : r.kinds[r.enemy] === 'elite' ? ' · редкий враг' : '') + '</div><div class="dg-event-choices">' + event.choices.map(id => {
      const find = FINDS[id], disabled = id === 'heal' && r.hp >= r.maxHp || id === 'shield' && r.shielded;
      return '<button type="button" data-dg="choose" data-id="' + id + '" ' + (disabled ? 'disabled' : '') + '><strong>' + esc(find.name) + '</strong><span>' + esc(id === 'heal' && r.healthBalanceVersion !== 2 ? 'Восстанавливает до 20 здоровья.' : find.text) + (disabled ? ' Сейчас не нужно.' : '') + '</span></button>';
    }).join('') + '</div><button type="button" class="dg-event-retreat" data-dg="retreat">Покинуть поход</button></section>';
  }
  function claimTheme(r) {
    if (!r || !r.themeDrop || r.themeDrop.duplicate || r.themeGranted || !game.saved || !AT.game) return;
    const outcome = AT.game.importAppearances({sharedRewards:{appearances:{[r.themeDrop.id]:true}}});
    if (outcome.ok) { r.themeGranted = true; game.save(); }
  }
  function battle(s, r) {
    const q = AT.dataset.byId.get(r.question), key = q && AT.keyApi.forQuestion(q);
    if (!q || (!key && !r.result)) return '<div class="dg-panel"><h2>Вопрос больше недоступен</h2><p>Ключ или база изменились. Вернитесь в лагерь и начните новый поход.</p><button class="dg-primary" data-dg="abandon">Вернуться в лагерь</button></div>';
    const result = r.result, id = r.roster[r.enemy], monster = MONSTERS[id] || MONSTERS.skeleton, modern = r.combatVersion === 2;
    const kind = r.adventureVersion === 1 && r.kinds ? r.kinds[r.enemy] : 'normal';
    const comboAnimation = r.adventureVersion === 1 && result && result.correct && r.combo && r.combo % 3 === 0 && result.damage ? ' dg-arena--combo' : '';
    const animation = result ? r.hp === 0 ? ' dg-arena--hero-dead' : result.correct ? (r.enemyHp === 0 ? ' dg-arena--enemy-dead' : ' dg-arena--hero-hit') : ' dg-arena--enemy-hit' : '';
    let html = '<div class="dg-battle-top"><div><span class="dg-eyebrow">ПОХОД · УРОВЕНЬ ' + r.level + '</span><h1>Зал ' + (r.enemy + 1) + ' <span>/ ' + r.roster.length + '</span></h1></div><div class="dg-battle-top-right"><span>✦ ' + s.gold + ' золота</span><span>Ошибок: ' + (r.mistakes === null ? 'неизвестно' : r.mistakes) + '</span><button type="button" data-dg="retreat">Покинуть поход</button></div></div>';
    html += '<div class="dg-battle-layout"><div class="dg-battle-scene"><div class="dg-arena dg-arena--' + zone(r.level) + animation + comboAnimation + '"><div class="dg-arena-vignette"></div><div class="dg-combatant dg-combatant--hero"><div class="dg-fighter-label"><b>ИССЛЕДОВАТЕЛЬ</b><span>' + r.hp + ' / ' + r.maxHp + ' ♥</span>' + bar(r.hp, r.maxHp, 'hero', result && result.heroHpLost) + '</div><div class="dg-hero-sprite">' + sprite('hero') + '</div></div><div class="dg-versus" aria-hidden="true">VS</div><div class="dg-combatant dg-combatant--enemy"><div class="dg-fighter-label"><b>' + (kind === 'boss' ? '♛ ' : kind === 'elite' ? '✦ ' : '') + esc(monster.name) + '</b><span>' + r.enemyHp + ' / ' + r.enemyMax + ' ♥ · ⚔ ' + (modern ? rangeLabel(r.enemyDamage || 10) : r.enemyDamage || 1) + '</span>' + bar(r.enemyHp, r.enemyMax, 'enemy', result && result.enemyHpLost) + '</div><div class="dg-monster" aria-hidden="true">' + sprite(id) + '</div></div><div class="dg-floor"></div></div>';
    const traitHelp = '<strong>' + esc(monster.title) + '</strong><p>Атака: ' + (modern ? rangeLabel(r.enemyDamage || 10) : r.enemyDamage || 1) + ' урона до особых эффектов.</p><p>' + (r.legacy ? 'Старый поход: особые умения врагов заработают в следующем походе.' : esc(modern ? monster.description : monster.oldDescription)) + '</p><p><strong>Тактика:</strong> ' + esc(monster.tactic) + '</p>';
    html += arsenal(s, r, monster, modern) + (r.adventureVersion === 1 ? '<div class="dg-intent"><strong>' + (kind === 'boss' ? '♛ БОСС' : kind === 'elite' ? '✦ РЕДКИЙ ВРАГ' : '⚑ НАМЕРЕНИЕ') + '</strong> ' + esc(intent(r)) + '<span>Комбо: ' + (r.combo || 0) + ' · каждый третий верный ответ ×1,5</span></div>' : '') + '<div class="dg-monster-trait dg-monster-trait--compact"><span>ОСОБЕННОСТЬ</span><strong>' + esc(monster.title) + '</strong>' + info('Подробнее об особенности противника', traitHelp) + '</div>';
    html += '</div><div class="dg-battle-grid"><section class="dg-question"><div class="dg-question-head"><span class="dg-eyebrow">ВОПРОС ' + esc(q.num) + ' · ' + esc(AT.dataset.topic(q.topic).title) + '</span><span>⚔ УРОН ' + (modern ? rangeLabel(heroDamage(s.upgrades.sword), r.adventureVersion === 1 ? r.bonusDamage || 0 : 0) : 1 + s.upgrades.sword) + '</span></div><h2>' + esc(q.text) + '</h2><p class="dg-hint">Выберите все правильные варианты ответа</p><div class="dg-options">';
    q.options.forEach((opt, i) => { const n = i + 1; if (r.hidden.includes(n)) return; const checked = r.selected.includes(n); let cls = checked ? ' is-selected' : ''; if (result && result.answers.includes(n)) cls += ' is-correct'; else if (result && checked) cls += ' is-wrong'; html += '<button type="button" class="dg-option' + cls + '" data-dg="option" data-index="' + n + '" aria-pressed="' + checked + '" ' + (result ? 'disabled' : '') + '><span class="dg-option-mark">' + (checked ? '✓' : n) + '</span><span>' + esc(opt) + '</span></button>'; });
    html += '</div>';
    if (result) {
      const feedback = result.correct ? (result.damage ? 'Верно! Удар на ' + result.damage + ' ⚔' : 'Верно! Завеса поглощает удар.') : result.dodged ? 'Ошибка, но герой уклонился!' : result.shielded ? 'Ошибка, но щит защитил тебя.' : 'Ошибка. Монстр атакует: −' + (result.incoming || result.damage || 1) + ' ♥';
      html += '<div class="dg-feedback ' + (result.correct ? 'is-good' : 'is-bad') + (comboAnimation ? ' is-combo' : '') + '" role="status"><strong>' + feedback + '</strong><span>' + (!result.correct ? 'Правильные варианты выделены зелёным. ' : '') + esc((result.notes || []).join(' ')) + (r.enemyHp === 0 ? ' Монстр повержен.' : '') + '</span></div><button type="button" class="dg-primary dg-submit" data-dg="next">' + (r.hp <= 0 ? 'Завершить поход' : r.enemyHp <= 0 && r.enemy === r.roster.length - 1 ? 'Забрать награду' : 'Продолжить') + ' →</button>';
    } else html += '<button type="button" class="dg-primary dg-submit" data-dg="attack" ' + (!r.selected.length ? 'disabled' : '') + '>Атаковать <span>⚔</span></button>';
    html += '</section></div></div>'; return html;
  }
  function finish(r) {
    const win = r.status === 'victory', loot = r.loot || 0, levelReward = win ? (r.reward || 0) : 0;
    const stars = win && r.stars ? '<div class="dg-stars" aria-label="' + r.stars + ' из 3 звёзд">' + '★'.repeat(r.stars) + '<span>' + '☆'.repeat(3 - r.stars) + '</span></div><p class="dg-stars-note">' + (r.mistakes === null ? 'Поход начат до появления оценок: засчитана одна звезда.' : 'Ошибок: ' + r.mistakes + '. Лучшая оценка сохранена для этой базы.') + '</p>' : '';
    const drop = r.themeDrop, title = drop && AT.game && AT.game.appearances[drop.id] ? AT.game.appearances[drop.id].title : '';
    const prize = drop ? '<div class="dg-theme-drop"><strong>✦ ' + (drop.duplicate ? 'Повторное оформление' : 'Найдено оформление') + ': ' + esc(title || drop.id) + '</strong><p>' + (drop.duplicate ? 'Уже открыто: +50 золота подземелья.' : r.themeGranted ? 'Открыто для всего сайта. Выберите его в разделе «Награды».' : 'Не удалось сохранить оформление. Попробуйте ещё раз, прежде чем выходить.') + '</p>' + (!drop.duplicate && !r.themeGranted ? '<button type="button" data-dg="claim">Повторить сохранение</button>' : '') + '</div>' : '';
    return '<div class="dg-finish"><div class="dg-finish-icon">' + (win ? '✦' : '☠') + '</div><span class="dg-eyebrow">' + (win ? 'ПОДЗЕМЕЛЬЕ ЗАЧИЩЕНО' : 'ПОХОД ОКОНЧЕН') + '</span><h1>' + (win ? 'Победа за тобой!' : r.status === 'no-questions' ? 'Нет вопросов с ключом' : 'Герой пал в бою') + '</h1><p>' + (win ? (r.adventureVersion === 1 && r.level === MAX_LEVEL ? 'Последний уровень пройден! Можно вернуться на карту и повторить любимые этапы.' : 'Все монстры побеждены. Потрать добычу в мастерской и отправляйся глубже.') : 'Не сдавайся: золото за поверженных врагов уже твоё. Улучши героя и попробуй ещё раз.') + '</p>' + stars + prize + '<div class="dg-reward">+ ' + (loot + levelReward + (r.eventGold || 0) + (r.duplicateGold || 0) + (r.goalGold || 0)) + ' <span>золота за поход</span></div><p class="dg-reward-detail">За монстров: ' + loot + (win ? ' · За зачистку: ' + levelReward : '') + (r.eventGold ? ' · Находки: ' + r.eventGold : '') + (r.duplicateGold ? ' · Повтор: ' + r.duplicateGold : '') + (r.goalGold ? ' · Цели: ' + r.goalGold : '') + '. Уже начислено в кошелёк подземелья.</p><button type="button" class="dg-primary" data-dg="abandon" ' + (drop && !drop.duplicate && !r.themeGranted ? 'disabled' : '') + '>Вернуться в лагерь →</button></div>';
  }
  AT.views.dungeon = function () {
    const s = game.state, r = s.run;
    if (r && r.status === 'victory') claimTheme(r);
    const content = !r ? tabs(section) + (section === 'shop' ? shop(s) : section === 'bestiary' ? bestiary(s) : intro(s)) : r.bank !== AT.colloquium.id ? '<div class="dg-panel"><span class="dg-eyebrow">НЕЗАВЕРШЁННЫЙ ПОХОД</span><h1>Герой ждёт в другой базе</h1><p>Этот поход начат в базе «' + esc((window.COLLOQUIUM_MODULES[r.bank] || {}).name || r.bank) + '». Вернитесь в неё, чтобы продолжить, или завершите поход. Золото за уже побеждённых монстров сохранится.</p>' + (r.themeDrop && !r.themeDrop.duplicate && !r.themeGranted ? '<p>Сначала сохраните найденное оформление.</p><button type="button" class="dg-primary" data-dg="claim">Повторить сохранение</button>' : '<button type="button" class="dg-primary" data-dg="retreat">Завершить поход</button>') + '</div>' : r.status === 'fight' ? battle(s,r) : r.status === 'event' ? eventScreen(r) : finish(r);
    return { title: 'Подземелья анатомии', html: '<div class="view dungeon"><p class="dg-experimental-notice"><strong>Экспериментальная версия</strong> · Подземелье лучше работает на ПК. На телефоне возможны недочёты.</p>' + (!game.saved ? '<div class="dg-storage-warning" role="alert">Не удалось сохранить игру. Проверьте доступ к хранилищу браузера; после закрытия страницы прогресс может потеряться.</div>' : '') + content + '<p class="dg-disclaimer">Экспериментальный режим · золото подземелья отдельно от основного кошелька. Выпавшие оформления доступны всему сайту.</p></div>', mount(root) {
      const view = root.querySelector('.dungeon');
      if (view.querySelector('.dg-battle-scene')) {
        // Шапка может менять высоту при изменении ширины окна.
        const positionScene = () => {
          const header = document.querySelector('.topbar');
          view.style.setProperty('--dg-sticky-top', ((header ? Math.ceil(header.getBoundingClientRect().height) : 0) + 12) + 'px');
        };
        positionScene();
        window.addEventListener('resize', positionScene);
        AT.onCleanup(() => window.removeEventListener('resize', positionScene));
      }
      view.addEventListener('click', e => {
        const el = e.target.closest('[data-dg]'); if (!el || el.disabled) return;
        const action = el.dataset.dg, id = el.dataset.id;
        if (action === 'retreat') { if (game.state.run && game.state.run.themeDrop && !game.state.run.themeDrop.duplicate && !game.state.run.themeGranted) return; AT.ui.confirmDialog({ title: 'Покинуть поход?', text: 'Бонус за зачистку не начислится. Золото за поверженных монстров и улучшения сохранятся.', confirm: 'Покинуть', danger: true }).then(ok => { if (ok && AT.route() === 'dungeon') { selectedLevel = Math.min(MAX_LEVEL, game.state.run ? game.state.run.level : game.state.unlocked); levelPage = Math.floor((selectedLevel - 1) / 10); game.abandon(); section = 'camp'; AT.rerender(); } }); return; }
        let changed = false;
        if (action === 'section' && ['camp','shop','bestiary'].includes(id)) { section = id; changed = true; }
        else if (action === 'level') { const level = Number(el.dataset.level); if (Number.isInteger(level) && level >= 1 && level <= Math.min(MAX_LEVEL, game.state.unlocked)) { selectedLevel = level; changed = true; } }
        else if (action === 'map-page') { const page = Number(el.dataset.page); if (Number.isInteger(page) && page >= 0 && page < 3) { levelPage = page; changed = true; } }
        else if (action === 'start') changed = game.start(selectedLevel);
        else if (action === 'option') {
          const index = Number(el.dataset.index);
          if (game.toggle(index)) {
            const selected = game.state.run.selected.includes(index);
            el.classList.toggle('is-selected', selected);
            el.setAttribute('aria-pressed', String(selected));
            const mark = el.querySelector('.dg-option-mark');
            if (mark) mark.textContent = selected ? '✓' : String(index);
            const attack = view.querySelector('[data-dg="attack"]');
            if (attack) attack.disabled = !game.state.run.selected.length;
            let warning = view.querySelector('.dg-storage-warning');
            if (!game.saved && !warning) {
              warning = document.createElement('div'); warning.className = 'dg-storage-warning'; warning.setAttribute('role','alert');
              warning.textContent = 'Не удалось сохранить игру. Проверьте доступ к хранилищу браузера; после закрытия страницы прогресс может потеряться.';
              view.prepend(warning);
            } else if (game.saved && warning) warning.remove();
          }
          return;
        }
        else if (action === 'ability') changed = game.ability(id);
        else if (action === 'choose') changed = game.choose(id);
        else if (action === 'claim') { game.save(); claimTheme(game.state.run); changed = true; }
        else if (action === 'attack') changed = game.attack();
        else if (action === 'next') changed = game.next();
        else if (action === 'buy') changed = game.buy(id);
        else if (action === 'abandon') { if (game.state.run && game.state.run.themeDrop && !game.state.run.themeDrop.duplicate && !game.state.run.themeGranted) return; const previous = game.state.run; selectedLevel = previous && previous.status === 'victory' ? game.state.unlocked : previous ? previous.level : game.state.unlocked; selectedLevel = Math.min(MAX_LEVEL, selectedLevel); levelPage = Math.floor((selectedLevel - 1) / 10); changed = game.abandon(); section = 'camp'; }
        if (changed) {
          AT.rerender();
          const selector = action === 'option' ? '[data-dg="option"][data-index="' + Number(el.dataset.index) + '"]' : action === 'attack' ? '[data-dg="next"]' : action === 'next' ? (game.state.run && game.state.run.status === 'event' ? '[data-dg="choose"]:not(:disabled)' : '[data-dg="option"]') : action === 'ability' || action === 'choose' ? '[data-dg="option"]' : action === 'section' ? '[data-dg="section"][data-id="' + id + '"]' : action === 'level' ? '[data-dg="level"][data-level="' + selectedLevel + '"]' : action === 'map-page' ? '[data-dg="map-page"][data-dir="' + ((el.dataset.dir === 'prev' && levelPage === 0) ? 'next' : (el.dataset.dir === 'next' && levelPage === 2) ? 'prev' : el.dataset.dir) + '"]' : null;
          const target = selector && root.querySelector(selector); if (target) target.focus({ preventScroll: true });
        }
      });
    } };
  };
})();
