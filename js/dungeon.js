/* Боевая модель подземелья. Сохранение намеренно отделено от учебного прогресса. */
(function () {
  'use strict';
  const STORAGE = 'anatomy-dungeon-v1';
  const ITEMS = {
    sword: { name: 'Клинок исследователя', cost: 100, description: 'Базовый урон за верный ответ +8.', max: 5 },
    armor: { name: 'Крепкая броня', cost: 100, description: 'Максимальное здоровье в новом походе +10 за уровень.', max: 6 },
    agility: { name: 'Ловкость', cost: 120, description: 'Пассивно повышает шанс уклонения на 5 п.п.', max: 6 },
    heal: { name: 'Исцеление', cost: 120, description: 'Раз за новый поход восстановить до 15 здоровья.', max: 1 },
    shield: { name: 'Магический щит', cost: 140, description: 'Раз за поход защититься от следующей атаки за ошибку.', max: 1 },
    focus: { name: 'Проницательность', cost: 160, description: 'Раз за поход убрать до двух неверных вариантов.', max: 1 },
  };
  const MONSTERS = {
    skeleton: { name: 'Костяной страж', title: 'Костяная стойка', description: 'Первый верный удар ослабляется на 1, но не ниже 1.', tactic: 'Мощный клинок помогает пробить его защиту.' },
    slime: { name: 'Пещерный слизень', title: 'Регенерация', description: 'После ошибки восстанавливает 1 здоровье, даже если удар защитит щит.', tactic: 'Старайтесь отвечать без ошибок, чтобы не затягивать бой.' },
    bat: { name: 'Кровокрылая летучая мышь', title: 'Быстрый выпад', description: 'Каждая вторая ошибка в этом бою усиливает атаку на 1.', tactic: 'Берегите щит для опасного второго промаха.' },
    spider: { name: 'Ядовитый паук', title: 'Ядовитый укус', description: 'Незаблокированная ошибка отравляет героя: после следующего ответа он теряет 1 здоровье.', tactic: 'Щит предотвращает укус. Учитывайте яд даже при победном ударе.' },
    wraith: { name: 'Туманный призрак', title: 'Призрачная завеса', description: 'Первый верный ответ рассеивает завесу вместо нанесения урона.', tactic: 'Первый удар — подготовка; усиления пригодятся после неё.' },
    golem: { name: 'Каменный голем', title: 'Каменная броня', description: 'Каждый верный удар ослабляется на 1, но не ниже 1.', tactic: 'Прокачайте клинок, чтобы пробить броню быстрее.' },
    lich: { name: 'Хранитель глубин', title: 'Тёмное заклинание', description: 'За ошибку наносит дополнительный 1 урон.', tactic: 'Запас здоровья и щит помогут пережить заклинание.' },
  };
  // У каждой учебной базы два собственных противника. ID стабильны в сохранении.
  const BANK_MONSTERS = {
    '1': [
      ['bone_drake','Костяной дракон','Ломающий удар','stun','Незаблокированная ошибка ослабляет следующий верный удар до 1 урона.','Держите щит для опасного промаха, чтобы сохранить силу клинка.','skeleton','#dfb894'],
      ['joint_golem','Голем суставов','Подвижный панцирь','pulse','Первый, третий и каждый следующий нечётный верный удар ослабляется на 1, но не ниже 1.','Прокачайте клинок и используйте более сильные чётные удары.','golem','#b8c591'],
    ],
    '2': [
      ['tendon_keeper','Хранитель сухожилий','Упругие шипы','thorns','После верного удара, если монстр выжил, герой теряет 1 здоровье. Щит от шипов не защищает.','Сильный клинок уменьшит число ответных уколов.','golem','#da997a'],
      ['muscle_beast','Миофибровый зверь','Мышечный спазм','fury','За каждую ошибку подряд после первой наносит на 1 больше урона, максимум +2. Верный ответ снимает усиление.','Не допускайте серии ошибок и берегите щит.','bat','#e5938b'],
    ],
    '3': [
      ['bile_slime','Желчный слизень','Едкая желчь','venom','Незаблокированная ошибка отравляет: после следующего ответа герой теряет 1 здоровье.','Щит предотвращает отравление; следите за здоровьем перед ответом.','slime','#d2c875'],
      ['bronch_guard','Страж бронхов','Удушающий туман','chill','Во время боя способность «Проницательность» недоступна, но её заряд не тратится.','Сохраните подсказку для следующего врага и внимательно проверяйте варианты.','wraith','#85c7aa'],
    ],
    '4': [
      ['cortex_ghost','Кортикальный призрак','Торможение коры','veil','Первый верный ответ снимает завесу вместо нанесения урона.','Первый ответ только открывает путь для следующих ударов.','wraith','#a49ce0'],
      ['synapse_spark','Синаптический разрядник','Повторный импульс','counter','Каждая вторая ошибка в этом бою усиливает атаку на 1.','Приберегите щит ко второй ошибке.','bat','#e3ca78'],
    ],
    '5': [
      ['light_devourer','Пожиратель света','Ослепляющая вспышка','stun','Незаблокированная ошибка ослабляет следующий верный удар до 1 урона.','Щит помогает не потерять силу следующей атаки.','lich','#c0a0df'],
      ['labyrinth_bell','Звонарь лабиринта','Эхо защиты','pulse','Первый, третий и каждый следующий нечётный верный удар ослабляется на 1, но не ниже 1.','Используйте сильные чётные удары и улучшайте клинок.','golem','#b2a4df'],
    ],
    '6': [
      ['axon_spider','Аксонный паук','Нейротоксин','venom','Незаблокированная ошибка отравляет: после следующего ответа герой теряет 1 здоровье.','Щит останавливает укус; яд сработает даже после верного ответа.','spider','#eeb37b'],
      ['plexus_keeper','Хранитель сплетений','Нервное возбуждение','fury','За каждую ошибку подряд после первой наносит на 1 больше урона, максимум +2. Верный ответ снимает усиление.','Не давайте противнику накопить серию ударов.','golem','#d6a9c4'],
    ],
    '7': [
      ['thrombus','Пульсирующий тромб','Сгусток','regen','После ошибки восстанавливает 1 здоровье, даже если герой защищён щитом.','Старайтесь отвечать без ошибок, чтобы не затягивать бой.','slime','#d77f82'],
      ['valve_lord','Владыка клапанов','Последний выброс','laststand','Первый смертельный верный удар оставляет монстру 1 здоровье.','Запланируйте дополнительный вопрос, даже если клинок очень силён.','lich','#d68b87'],
    ],
    'credit-1': [
      ['osteomyo_titan','Титан костей и мышц','Двойная броня','armor','Каждый верный удар ослабляется на 1, но не ниже 1.','Сильный клинок помогает быстрее пробить броню.','golem','#d9b88f'],
      ['ligament_guard','Страж связок','Ответное натяжение','thorns','После верного удара, если монстр выжил, герой теряет 1 здоровье. Щит от шипов не защищает.','Копите здоровье и усиливайте клинок.','skeleton','#cfac84'],
    ],
    'credit-2': [
      ['neuron_wanderer','Странник нейронов','Пробой щита','pierce','Первую ошибку под щитом проводит сквозь него; щит остаётся активным для следующей ошибки.','Не полагайтесь на щит против первого пробоя; запасите здоровье.','wraith','#92c7e3'],
      ['organ_chimera','Химера органов','Поглощение','drain','Незаблокированная ошибка наносит на 1 больше урона и восстанавливает монстру 1 здоровье.','Щит останавливает оба эффекта; тщательно сверяйте выбор.','bat','#b9cc82'],
    ],
    'stom-2': [
      ['alveoli_ghost','Призрак альвеол','Дыхательная завеса','veil','Первый верный ответ снимает завесу вместо нанесения урона.','Приготовьтесь ответить дополнительно, прежде чем нанести удар.','wraith','#9dc7c3'],
      ['acid_morph','Кислотный морф','Кислотное поглощение','drain','Незаблокированная ошибка наносит на 1 больше урона и восстанавливает монстру 1 здоровье.','Щит останавливает оба эффекта, поэтому берегите его для промаха.','slime','#c6c97d'],
    ],
    'stom-3': [
      ['vessel_fang','Зубчатый сосудник','Последний пульс','laststand','Первый смертельный верный удар оставляет монстру 1 здоровье.','Держите запас здоровья для дополнительного вопроса.','lich','#dc8c9c'],
      ['nerve_fang','Невральный клыкастик','Онемение','stun','Незаблокированная ошибка ослабляет следующий верный удар до 1 урона.','Используйте щит, чтобы не потерять преимущество прокачанного клинка.','spider','#aac1df'],
    ],
  };
  Object.entries(BANK_MONSTERS).forEach(([bank, monsters]) => monsters.forEach(([id,name,title,mechanic,description,tactic,sprite,color], index) => {
    MONSTERS[id] = { name, title, mechanic, description, tactic, sprite, color, bank, statAdjustment: index === 0 ? .1 : -.05 };
  }));
  // Описания предыдущей версии сохраняем для уже идущих походов.
  Object.values(MONSTERS).forEach(monster => {
    monster.oldDescription = monster.description;
    monster.description = monster.description
      .replace(/на 1, но не ниже 1/g, 'на 5, но не ниже 1')
      .replace(/до 1 урона/g, 'до 6 урона')
      .replace(/восстанавливает 1 здоровье/g, 'восстанавливает до 5 здоровья')
      .replace(/восстанавливает монстру 1 здоровье/g, 'восстанавливает монстру до 5 здоровья')
      .replace(/теряет 1 здоровье/g, 'теряет 5 здоровья')
      .replace(/на 1 больше урона, максимум \+2/g, 'на 5 больше урона, максимум +10')
      .replace(/усиливает атаку на 1/g, 'усиливает атаку на 5')
      .replace(/дополнительный 1 урон/g, 'дополнительные 5 урона')
      .replace(/наносит на 1 больше урона/g, 'наносит на 5 больше урона')
      .replace(/оставляет монстру 1 здоровье/g, 'оставляет монстру 5 здоровья')
      .replace(/Незаблокированная ошибка/g, 'Атака после ошибки, от которой не уклонились и которую не заблокировали,')
      .replace(/Незаблокированная ошибка/g, 'Попавшая атака после ошибки');
    if (monster.mechanic === 'pierce') monster.description += ' При уклонении пробой не срабатывает.';
    if (monster.mechanic === 'thorns') monster.description += ' Уклонение также не спасает от шипов.';
    if (monster.mechanic === 'regen' || monster.name === 'Пещерный слизень') monster.description += ' Срабатывает и при уклонении.';
  });
  const IDS = Object.keys(MONSTERS);
  function monstersFor(bank) { return IDS.filter(id => !MONSTERS[id].bank || MONSTERS[id].bank === bank); }

  const ROSTERS = [
    ['skeleton','slime','bat'], ['slime','bat','spider'], ['bat','spider','wraith'],
    ['spider','wraith','golem'], ['wraith','golem','lich'],
    ['golem','spider','lich'], ['bat','golem','lich'],
  ];
  // После пятого уровня ротация сохраняет разнообразие боёв.
  function rosterFor(level, bank) {
    const common = level <= 5 ? ROSTERS[level - 1] : ROSTERS[5 + ((level - 6) % 2)];
    const unique = BANK_MONSTERS[bank];
    return unique ? [common[0], unique[0][0], unique[1][0]] : common.slice();
  }
  function stats(level) { return { hp: 25 + level * 15, damage: 10 + Math.min(12, Math.floor((level - 1) / 4) * 2) }; }
  // Телосложение задаёт обратный компромисс: выносливые враги бьют слабее.
  const PROFILES = {
    skeleton: { hp: 1, damage: 1 }, slime: { hp: 1.25, damage: .8 },
    golem: { hp: 1.35, damage: .75 }, bat: { hp: .8, damage: 1.25 },
    spider: { hp: .9, damage: 1.1 }, wraith: { hp: .85, damage: 1.2 },
    lich: { hp: .9, damage: 1.1 }
  };
  function monsterStats(level, id) {
    const base = stats(level), monster = MONSTERS[id], profile = PROFILES[monster?.sprite || id] || PROFILES.skeleton;
    const adjustment = monster?.statAdjustment || 0;
    return { hp: Math.max(1, Math.round(base.hp * (profile.hp + adjustment))), damage: Math.max(1, Math.round(base.damage * (profile.damage - adjustment))) };
  }
  const MAX_LEVEL = 30;
  // Длительность боёв растёт плавно и не превращается в десятки вопросов на монстра.
  function adventureStats(level, id, kind, damageVersion = 2) {
    const monster = MONSTERS[id], profile = PROFILES[monster?.sprite || id] || PROFILES.skeleton;
    const adjustment = monster?.statAdjustment || 0;
    const baseHp = 32 + 2 * (level - 1), baseDamage = 10 + Math.floor((level - 1) / (damageVersion === 2 ? 2 : 5));
    const scale = kind === 'boss' ? 1.45 : kind === 'elite' ? 1.2 : 1;
    return { hp: Math.max(1, Math.round(baseHp * (profile.hp + adjustment) * scale)), damage: Math.max(1, Math.round(baseDamage * (profile.damage - adjustment) * (kind === 'boss' ? 1.1 : 1))) };
  }
  const MILESTONES = {
    combo: 'Серия из трёх верных ответов', first: 'Первая зачистка',
    elite: 'Победа над редким врагом', boss: 'Первая победа над боссом', finale: 'Покорить 30-й уровень'
  };
  const EVENTS = {
    altar: { name:'Алтарь исследователя', text:'На древнем алтаре остались три дара. Можно взять только один.', choices:['blade','shield','heal'] },
    camp: { name:'Тихий привал', text:'Есть время подготовиться к следующей встрече.', choices:['heal','shield','gold'] },
    chest: { name:'Забытый сундук', text:'Внутри — полезные припасы и опасная реликвия.', choices:['blade','gold','risk'] }
  };
  const FINDS = {
    blade: { name:'Острый клинок', text:'+6 к каждому удару до конца похода.' },
    shield: { name:'Защитный оберег', text:'Блокирует следующую атаку после ошибки; не суммируется с активным щитом.' },
    heal: { name:'Целебный настой', text:'Восстанавливает до 10 здоровья.' },
    gold: { name:'Кошелёк странника', text:'+25 золота подземелья сразу.' },
    risk: { name:'Опасная реликвия', text:'+55 золота, но герой теряет до 12 здоровья (не смертельно).' }
  };
  // Шанс на победу: обычный уровень 1%, босс 3%; веса не перераспределяются при дубликатах.
  const THEME_WEIGHTS = [['ocean',30],['ruby',25],['amber',20],['autumn',5],['winter',5],['spring',5],['anime',4],['rickmorty',3],['breakingbad',3]];
  function themeRoll(random, boss) {
    let roll = Math.floor(random() * 10000), multiplier = boss ? 3 : 1;
    for (const [id, weight] of THEME_WEIGHTS) { roll -= weight * multiplier; if (roll < 0) return id; }
    return null;
  }
  function adventureKinds(level, random) { return [level >= 2 && random() < .2 ? 'elite' : 'normal', 'normal', level % 5 === 0 ? 'boss' : 'normal']; }
  function intent(run) {
    const id = run.roster[run.enemy], monster = MONSTERS[id] || {}, m = monster.mechanic || ({skeleton:'firstArmor',slime:'regen',bat:'counter',spider:'venom',wraith:'veil',golem:'armor',lich:'power'})[id];
    const alerts = [];
    if (run.kinds && run.kinds[run.enemy] === 'boss') alerts.push((run.special.bossMisses || 0) % 2 ? 'Босс готовит усиленную атаку при ошибке (+5).' : 'Босс усилит каждую вторую атаку при ошибке (+5).');
    if (m === 'counter' && (run.special.misses || 0) % 2) alerts.push('Следующая ошибка вызовет усиленный выпад (+5).');
    else if (m === 'regen') alerts.push('При ошибке противник восстанавливает до 5 HP.');
    else if (m === 'venom') alerts.push('Попавшая атака при ошибке наложит яд на следующий ответ.');
    else if (m === 'stun') alerts.push('Попавшая атака при ошибке ослабит следующий удар.');
    else if (m === 'thorns') alerts.push('Если враг выживет, верный удар вызовет ответные шипы.');
    else if (m === 'veil' && !run.special.veil) alerts.push('Первый верный ответ рассеивает завесу без урона.');
    else if (m === 'pierce' && run.shielded && !run.special.pierced) alerts.push('Первая ошибка под щитом может пробить его.');
    else if (m === 'fury' && run.special.streak) alerts.push('Следующая ошибка подряд усилит атаку.');
    else if (m === 'laststand' && !run.special.laststand) alerts.push('Первый смертельный удар оставит противнику 5 HP.');
    return alerts.join(' ') || 'При ошибке противник атакует. Проверь ответ или подготовь защиту.';
  }
  function dodgeChance(agility) { return 5 + Math.min(6, Math.max(0, agility || 0)) * 5; }
  function damageRange(base) { return { min: Math.max(1, Math.floor(base * 0.8)), max: Math.max(1, Math.ceil(base * 1.2)) }; }
  function heroDamage(sword) { return 12 + 8 * sword; }
  function heroMaxHp(armor) { return 40 + 10 * Math.min(ITEMS.armor.max, Math.max(0, armor || 0)); }
  function rollDamage(base, random) { const range = damageRange(base); return range.min + Math.min(range.max - range.min, Math.floor(random() * (range.max - range.min + 1))); }

  function zone(level) { return level <= 2 ? 'crypt' : level <= 4 ? 'grove' : 'abyss'; }
  function price(item, owned) { return item.cost * (owned + 1); }
  function monsterReward(level, index) { return 12 + level * 3 + index * 3; }
  function starsFor(mistakes) { return mistakes === 0 ? 3 : mistakes !== null && mistakes <= 2 ? 2 : 1; }
  function initial() { return { version: 1, gold: 0, unlocked: 1, stars: Object.create(null), milestones: {}, upgrades: { sword: 0, armor: 0, agility: 0, heal: 0, shield: 0, focus: 0 }, discovered: [], run: null }; }
  function create(env) {
    let state = initial(), saved = true;
    try {
      const old = JSON.parse(env.storage.getItem(STORAGE));
      if (old && old.version === 1) {
        state.gold = Number.isSafeInteger(old.gold) && old.gold >= 0 ? old.gold : 0;
        state.unlocked = Number.isSafeInteger(old.unlocked) && old.unlocked > 0 ? Math.min(old.unlocked, 100) : 1;
        for (const id of Object.keys(ITEMS)) state.upgrades[id] = Math.min(ITEMS[id].max, Math.max(0, Number.isInteger(old.upgrades && old.upgrades[id]) ? old.upgrades[id] : 0));
        if (old.stars && typeof old.stars === 'object') {
          for (const [bank, levels] of Object.entries(old.stars)) {
            if (!/^[a-z0-9-]+$/.test(bank) || !levels || typeof levels !== 'object') continue;
            const clean = Object.create(null);
            for (const [level, count] of Object.entries(levels)) if (/^(?:[1-9]|[1-9][0-9]|100)$/.test(level) && Number.isInteger(count) && count >= 1 && count <= 3) clean[level] = count;
            state.stars[bank] = clean;
          }
        }
        if (old.milestones && typeof old.milestones === 'object') for (const id of Object.keys(MILESTONES)) if (old.milestones[id] === true) state.milestones[id] = true;
        state.discovered = Array.isArray(old.discovered) ? [...new Set(old.discovered.filter(id => MONSTERS[id]))] : [];
        if (old.run && typeof old.run === 'object') {
          state.run = old.run;
          // Походы прошлой версии продолжаются с прежним здоровьем врагов и наградой.
          if (!Array.isArray(state.run.roster)) {
            state.run.roster = ['skeleton','slime','lich']; state.run.legacy = true;
            state.run.enemyDamage = 1; state.run.special = {};
            for (let i = 0; i <= Math.min(2, state.run.enemy || 0); i++) if (!state.discovered.includes(state.run.roster[i])) state.discovered.push(state.run.roster[i]);
          }
          if (!state.run.special || typeof state.run.special !== 'object') state.run.special = {};
          // Старые походы не содержат историю ошибок: при победе им даётся одна звезда.
          if (!Number.isInteger(state.run.mistakes) || state.run.mistakes < 0) state.run.mistakes = null;
          if (!Number.isSafeInteger(state.run.loot) || state.run.loot < 0) state.run.loot = 0;
          if (!Array.isArray(state.run.rewarded)) state.run.rewarded = Array.from({length: Math.max(0, Math.min(3, state.run.enemy || 0))}, (_, i) => i);

        }
        if (!Array.isArray(old.discovered) && state.unlocked > 1) ['skeleton','slime','lich'].forEach(id => { if (!state.discovered.includes(id)) state.discovered.push(id); });
      }
    } catch (e) { /* первое посещение или повреждённое сохранение */ }
    function save() { try { env.storage.setItem(STORAGE, JSON.stringify(state)); saved = true; } catch (e) { saved = false; } return saved; }
    function pool() { return env.questions.filter(q => q && Array.isArray(q.options) && env.answer(q)); }
    function nextQuestion(run) {
      const eligible = pool();
      if (!eligible.length) { run.question = null; return false; }
      let remaining = eligible.filter(q => !run.seen.includes(q.id));
      if (!remaining.length) { run.seen = []; remaining = eligible; }
      const q = remaining[Math.floor(env.random() * remaining.length)];
      run.seen.push(q.id); run.question = q.id; run.selected = []; run.hidden = []; run.result = null;
      return true;
    }
    function reveal(run) { const id = run.roster[run.enemy]; if (MONSTERS[id] && !state.discovered.includes(id)) state.discovered.push(id); }
    function start(level) {
      if (state.run || !Number.isInteger(level) || level < 1 || level > state.unlocked || (env.adventure && level > MAX_LEVEL) || !pool().length) return false;
      const maxHp = env.adventure ? heroMaxHp(state.upgrades.armor) : 100 + state.upgrades.armor * 30, roster = rosterFor(level, env.bank), difficulty = monsterStats(level, roster[0]);
      const run = { combatVersion: 2, monsterStatsVersion: 1, bank: env.bank, level, hp: maxHp, maxHp, enemy: 0, enemyHp: difficulty.hp, enemyMax: difficulty.hp, enemyDamage: difficulty.damage, roster, special: {}, poison: false, seen: [], question: null, selected: [], hidden: [], result: null, used: {}, shielded: false, status: 'fight' };
      if (env.adventure) {
        run.adventureVersion = 1; run.healthBalanceVersion = 2; run.enemyBalanceVersion = 2; run.combo = 0; run.bonusDamage = 0; run.eventGold = 0; run.goalGold = 0;
        const common = ['skeleton','slime','bat','spider','wraith','golem','lich'];
        run.roster[0] = common[Math.floor(env.random() * common.length)];
        run.kinds = adventureKinds(level, env.random);
        const first = adventureStats(level, run.roster[0], run.kinds[0]);
        run.enemyHp = run.enemyMax = first.hp; run.enemyDamage = first.damage;
      }
      run.mistakes = 0; run.loot = 0; run.rewarded = [];
      nextQuestion(run); state.run = run; reveal(run); save(); return true;
    }
    function active() { return state.run && state.run.bank === env.bank && state.run.status === 'fight' ? state.run : null; }
    function toggle(index) {
      const r = active(), q = r && env.byId(r.question);
      if (!r || r.result || !q || !Number.isInteger(index) || index < 1 || index > q.options.length || r.hidden.includes(index)) return false;
      r.selected = r.selected.includes(index) ? r.selected.filter(i => i !== index) : r.selected.concat(index); save(); return true;
    }
    function ability(id) {
      const r = active(), q = r && env.byId(r.question);
      if (!r || r.result || !q || !state.upgrades[id] || r.used[id]) return false;
      if (!r.legacy && id === 'focus' && MONSTERS[r.roster[r.enemy]]?.mechanic === 'chill') return false;
      if (id === 'heal') { if (r.hp >= r.maxHp) return false; r.hp = Math.min(r.maxHp, r.hp + (r.healthBalanceVersion === 2 ? 15 : r.combatVersion === 2 ? 20 : 2)); }
      else if (id === 'shield') { if (r.adventureVersion === 1 && r.shielded) return false; r.shielded = true; }
      else if (id === 'focus') {
        const key = env.answer(q); if (!key) return false;
        const wrong = q.options.map((_, i) => i + 1).filter(i => !key.answers.includes(i));
        if (!wrong.length) return false;
        r.hidden = wrong.slice(0, 2); r.selected = r.selected.filter(i => !r.hidden.includes(i));
      } else return false;
      r.used[id] = true; save(); return true;
    }
    function milestone(r, id) {
      if (r.adventureVersion !== 1 || state.milestones[id] || !MILESTONES[id]) return false;
      state.milestones[id] = true; state.gold += 30; r.goalGold = (r.goalGold || 0) + 30; return true;
    }
    function awardMonster(r) {
      if (r.enemyHp > 0 || r.rewarded.includes(r.enemy)) return 0;
      const amount = monsterReward(r.level, r.enemy) * (r.adventureVersion === 1 && r.kinds[r.enemy] === 'boss' ? 2 : r.adventureVersion === 1 && r.kinds[r.enemy] === 'elite' ? 2 : 1);
      r.rewarded.push(r.enemy); r.loot += amount; state.gold += amount;
      if (r.adventureVersion === 1 && r.kinds[r.enemy] === 'boss') milestone(r, 'boss');
      if (r.adventureVersion === 1 && r.kinds[r.enemy] === 'elite') milestone(r, 'elite');
      return amount;
    }
    function attack() {
      const r = active(), q = r && env.byId(r.question), key = q && env.answer(q);
      if (!r || r.result || !key || !r.selected.length) return false;
      const answers = key.answers.slice().sort((a,b) => a-b), selected = r.selected.slice().sort((a,b) => a-b);
      const correct = answers.length === selected.length && answers.every((n,i) => n === selected[i]);
      if (!correct && r.mistakes !== null) r.mistakes++;
      const hpBefore = r.hp, enemyHpBefore = r.enemyHp;
      const monster = r.roster[r.enemy], notes = [];
      const generic = { skeleton: 'firstArmor', slime: 'regen', bat: 'counter', spider: 'venom', wraith: 'veil', golem: 'armor', lich: 'power' };
      const mechanic = r.legacy ? '' : (MONSTERS[monster]?.mechanic || generic[monster] || '');
      const modern = r.combatVersion === 2, specialDamage = modern ? 5 : 1;
      let shielded = false, dodged = false, damage = 0, incoming = 0;
      // Отложенный яд срабатывает даже на победном ответе и может убить героя.
      if (r.poison) { r.hp = Math.max(0, r.hp - specialDamage); r.poison = false; notes.push('Яд наносит ' + specialDamage + ' урона.'); }
      if (correct) {
        r.special.streak = 0;
        damage = modern ? rollDamage(heroDamage(state.upgrades.sword), env.random) : 1 + state.upgrades.sword;
        if (r.adventureVersion === 1) {
          r.combo = (r.combo || 0) + 1; damage += r.bonusDamage || 0;
          if (r.combo % 3 === 0) { damage = Math.ceil(damage * 1.5); notes.push('Комбо: усиленный удар за три верных ответа подряд!'); if (milestone(r, 'combo')) notes.push('Цель выполнена: +30 золота.'); }
        }
        if (mechanic === 'veil' && !r.special.veil) { r.special.veil = true; damage = 0; notes.push('Завеса рассеяна.'); }
        else if (mechanic === 'armor' || (mechanic === 'firstArmor' && !r.special.armor)) {
          damage = Math.max(1, damage - specialDamage); r.special.armor = true; notes.push('Броня ослабила удар.');
        } else if (mechanic === 'pulse') {
          r.special.hits = (r.special.hits || 0) + 1;
          if (r.special.hits % 2) { damage = Math.max(1, damage - specialDamage); notes.push('Панцирь ослабил нечётный удар.'); }
        }
        if (r.special.stunned) { damage = Math.min(damage, modern ? 6 : 1); r.special.stunned = false; notes.push('Онемение ограничило урон.'); }
        r.enemyHp = Math.max(0, r.enemyHp - damage);
        if (mechanic === 'laststand' && r.enemyHp === 0 && !r.special.laststand) { r.special.laststand = true; r.enemyHp = specialDamage; notes.push('Последняя сила оставила противнику ' + specialDamage + ' здоровья.'); }
        if (mechanic === 'thorns' && r.enemyHp > 0) { r.hp = Math.max(0, r.hp - specialDamage); notes.push('Ответные шипы наносят ' + specialDamage + ' урона.'); }
      } else {
        if (r.adventureVersion === 1) r.combo = 0;
        incoming = modern ? rollDamage(r.enemyDamage || 10, env.random) : (r.enemyDamage || 1);
        if (mechanic === 'counter') { r.special.misses = (r.special.misses || 0) + 1; if (r.special.misses % 2 === 0) { incoming += specialDamage; notes.push('Усиленный выпад: +' + specialDamage + ' урона.'); } }
        if (mechanic === 'power' || mechanic === 'drain') { incoming += specialDamage; notes.push('Сильная атака: +' + specialDamage + ' урона.'); }
        if (mechanic === 'fury') { r.special.streak = (r.special.streak || 0) + 1; const bonus = Math.min(2, r.special.streak - 1) * specialDamage; incoming += bonus; if (bonus) notes.push('Серия ошибок усиливает удар на ' + bonus + '.'); }
        if (r.adventureVersion === 1 && r.kinds[r.enemy] === 'boss') {
          r.special.bossMisses = (r.special.bossMisses || 0) + 1;
          if (r.special.bossMisses % 2 === 0) { incoming += 5; notes.push('Босс наносит усиленный удар: +5.'); }
        }
        // Уклонение проверяется раньше щита: удачный бросок сохраняет щит и не запускает эффекты попадания.
        dodged = modern && env.random() * 100 < dodgeChance(state.upgrades.agility);
        const pierced = !dodged && mechanic === 'pierce' && r.shielded && !r.special.pierced;
        if (pierced) { r.special.pierced = true; notes.push('Атака прошла сквозь щит; сам щит сохранён.'); }
        if (dodged) { incoming = 0; notes.push('Герой уклонился от атаки.' + (r.shielded ? ' Щит сохранён.' : '')); }
        else if (r.shielded && !pierced) { shielded = true; r.shielded = false; incoming = 0; }
        else {
          r.hp = Math.max(0, r.hp - incoming);
          if (mechanic === 'venom') { r.poison = true; notes.push('Герой отравлен на следующий ответ.'); }
          if (mechanic === 'stun') { r.special.stunned = true; notes.push('Следующий верный удар ограничен ' + (modern ? 6 : 1) + ' уроном.'); }
        }
        if (mechanic === 'regen' || (mechanic === 'drain' && !shielded && !dodged)) {
          const oldHp = r.enemyHp; r.enemyHp = Math.min(r.enemyMax, r.enemyHp + specialDamage);
          if (r.enemyHp > oldHp) notes.push('Монстр восстанавливает до ' + specialDamage + ' здоровья.');
        }
      }
      const goalsBefore = r.goalGold || 0;
      const loot = awardMonster(r);
      if ((r.goalGold || 0) > goalsBefore) notes.push('Цель выполнена: +30 золота.');
      if (loot) notes.push('Добыто ' + loot + ' золота за монстра.');
      r.result = { correct, answers, selected, damage, incoming, shielded, dodged, notes, loot, heroHpLost: Math.max(0, hpBefore - r.hp), enemyHpLost: Math.max(0, enemyHpBefore - r.enemyHp) }; save(); return true;
    }
    function next() {
      const r = active(); if (!r || !r.result) return false;
      // На переходе досчитываем только победный удар из старой версии, без повторной выплаты.
      awardMonster(r);
      if (r.hp <= 0) { r.status = 'defeat'; save(); return true; }
      if (r.enemyHp <= 0) {
        r.enemy++;
        if (r.enemy >= r.roster.length) {
          r.status = 'victory'; r.reward = 70 + r.level * 30;
          r.stars = starsFor(r.mistakes);
          const ratings = state.stars[r.bank] || (state.stars[r.bank] = Object.create(null));
          ratings[r.level] = Math.max(ratings[r.level] || 0, r.stars);
          state.gold += r.reward; state.unlocked = Math.max(state.unlocked, Math.min(r.adventureVersion === 1 ? MAX_LEVEL : 100, r.level + 1));
          if (r.adventureVersion === 1) {
            milestone(r, 'first'); if (r.level === MAX_LEVEL) milestone(r, 'finale');
            const theme = themeRoll(env.random, r.level % 5 === 0);
            if (theme) {
              const duplicate = !!(env.ownsAppearance && env.ownsAppearance(theme));
              r.themeDrop = { id:theme, duplicate };
              if (duplicate) { r.duplicateGold = 50; state.gold += 50; }
            }
          }
          save(); return true;
        }
        if (r.monsterStatsVersion === 1) {
          const difficulty = r.adventureVersion === 1 ? adventureStats(r.level, r.roster[r.enemy], r.kinds[r.enemy], r.enemyBalanceVersion === 2 ? 2 : 1) : monsterStats(r.level, r.roster[r.enemy]);
          r.enemyMax = difficulty.hp; r.enemyDamage = difficulty.damage;
        }
        r.enemyHp = r.enemyMax; r.special = {}; reveal(r);
        if (r.adventureVersion === 1) {
          const eventIds = Object.keys(EVENTS).filter(id => id !== r.lastEvent);
          r.event = eventIds[Math.floor(env.random() * eventIds.length)]; r.lastEvent = r.event;
          r.status = 'event'; r.result = null; r.question = null; r.selected = []; r.hidden = []; save(); return true;
        }
      }
      if (!nextQuestion(r)) r.status = 'no-questions';
      save(); return true;
    }
    function choose(id) {
      const r = state.run, event = r && EVENTS[r.event];
      if (!r || r.bank !== env.bank || r.adventureVersion !== 1 || r.status !== 'event' || !event || !event.choices.includes(id)) return false;
      if (id === 'heal' && r.hp >= r.maxHp || id === 'shield' && r.shielded) return false;
      if (id === 'blade') r.bonusDamage = (r.bonusDamage || 0) + 6;
      else if (id === 'shield') { if (r.adventureVersion === 1 && r.shielded) return false; r.shielded = true; }
      else if (id === 'heal') r.hp = Math.min(r.maxHp, r.hp + (r.healthBalanceVersion === 2 ? 10 : 20));
      else if (id === 'gold' || id === 'risk') {
        const amount = id === 'gold' ? 25 : 55;
        state.gold += amount; r.eventGold = (r.eventGold || 0) + amount;
        if (id === 'risk') r.hp = Math.max(1, r.hp - 12);
      }
      r.event = null; r.status = 'fight'; if (!nextQuestion(r)) r.status = 'no-questions'; save(); return true;
    }
    function buy(id) {
      const item = ITEMS[id], cost = item && price(item, state.upgrades[id]);
      if (state.run || !item || state.upgrades[id] >= item.max || state.gold < cost) return false;
      state.gold -= cost; state.upgrades[id]++; save(); return true;
    }
    function abandon() { if (!state.run) return false; state.run = null; save(); return true; }
    return { state, start, toggle, ability, attack, next, choose, buy, abandon, pool, save, get saved() { return saved; } };
  }
  window.DungeonEngine = { create, ITEMS, MONSTERS, IDS, BANK_MONSTERS, monstersFor, rosterFor, stats, monsterStats, adventureStats, adventureKinds, intent, themeRoll, THEME_WEIGHTS, MAX_LEVEL, EVENTS, FINDS, MILESTONES, PROFILES, zone, price, monsterReward, starsFor, dodgeChance, damageRange, heroDamage, heroMaxHp, rollDamage, STORAGE };
})();
