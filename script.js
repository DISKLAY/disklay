document.addEventListener('DOMContentLoaded', () => {
    // --- ДАННЫЕ И КОНСТАНТЫ ---
    const DND_CLASSES = {
        'Варвар': { hitDie: 12, saves: ['str', 'con'] },
        'Бард': { hitDie: 8, saves: ['dex', 'cha'] },
        'Жрец': { hitDie: 8, saves: ['wis', 'cha'] },
        'Друид': { hitDie: 8, saves: ['int', 'wis'] },
        'Воин': { hitDie: 10, saves: ['str', 'con'] },
        'Монах': { hitDie: 8, saves: ['str', 'dex'] },
        'Паладин': { hitDie: 10, saves: ['wis', 'cha'] },
        'Следопыт': { hitDie: 10, saves: ['str', 'dex'] },
        'Плут': { hitDie: 8, saves: ['dex', 'int'] },
        'Чародей': { hitDie: 6, saves: ['con', 'cha'] },
        'Колдун': { hitDie: 8, saves: ['wis', 'cha'] },
        'Волшебник': { hitDie: 6, saves: ['int', 'wis'] },
    };
    
    const SKILLS = [
        { name: 'Акробатика', stat: 'dex' }, { name: 'Атлетика', stat: 'str' },
        { name: 'Анализ', stat: 'int' }, { name: 'Внимательность', stat: 'wis' },
        { name: 'Выживание', stat: 'wis' }, { name: 'Выступление', stat: 'cha' },
        { name: 'Запугивание', stat: 'cha' }, { name: 'История', stat: 'int' },
        { name: 'Ловкость рук', stat: 'dex' }, { name: 'Магия', stat: 'int' },
        { name: 'Медицина', stat: 'wis' }, { name: 'Обман', stat: 'cha' },
        { name: 'Природа', stat: 'int' }, { name: 'Проницательность', stat: 'wis' },
        { name: 'Религия', stat: 'int' }, { name: 'Скрытность', stat: 'dex' },
        { name: 'Убеждение', stat: 'cha' }, { name: 'Уход за животными', stat: 'wis' }
    ];

    const STATS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

    // --- ОБЪЕКТ ПЕРСОНАЖА (ЕДИНЫЙ ИСТОЧНИК ДАННЫХ) ---
    let characterData = {
        name: '', race: '', background: '', alignment: '',
        class: 'Варвар', level: 1,
        stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        proficiencies: { saves: [], skills: [] },
        hp: { max: 10, current: 10 },
        speed: 30,
        inventory: { weapons: [], items: [] },
        spells: [],
        spellSlots: {},
        features: '',
        notes: ''
    };

    // --- DOM ЭЛЕМЕНТЫ ---
    const allInputs = document.querySelectorAll('input, select, textarea');
    const classSelect = document.getElementById('charClass');

    // --- ИНИЦИАЛИЗАЦИЯ ---
    function init() {
        populateClassSelect();
        generateSavingThrows();
        generateSkills();
        setupEventListeners();
        loadFromLocalStorage(); // Загружаем данные при старте
        renderCharacterSheet();
    }

    // --- ЗАПОЛНЕНИЕ ДИНАМИЧЕСКИХ ЭЛЕМЕНТОВ ---
    function populateClassSelect() {
        for (const className in DND_CLASSES) {
            const option = document.createElement('option');
            option.value = className;
            option.textContent = className;
            classSelect.appendChild(option);
        }
    }

    function generateSavingThrows() {
        const list = document.getElementById('savingThrowsList');
        list.innerHTML = '';
        STATS.forEach(stat => {
            const li = document.createElement('li');
            li.innerHTML = `
                <input type="checkbox" data-type="save" data-stat="${stat}">
                <span class="bonus" id="${stat}SaveBonus">0</span>
                <label>${stat.toUpperCase()} (${{str:'Сил',dex:'Лов',con:'Тел',int:'Инт',wis:'Муд',cha:'Хар'}[stat]})</label>
            `;
            list.appendChild(li);
        });
    }

    function generateSkills() {
        const list = document.getElementById('skillsList');
        list.innerHTML = '';
        SKILLS.forEach(skill => {
            const li = document.createElement('li');
            li.innerHTML = `
                <input type="checkbox" data-type="skill" data-skill="${skill.name}">
                <span class="bonus" id="${skill.name.replace(/\s+/g, '')}Bonus">0</span>
                <label>${skill.name} (${skill.stat.slice(0,3)})</label>
            `;
            list.appendChild(li);
        });
    }

    // --- ОСНОВНЫЕ ФУНКЦИИ ОБНОВЛЕНИЯ И РАСЧЕТА ---
    function calculateModifier(score) {
        return Math.floor((score - 10) / 2);
    }

    function getProfBonus(level) {
        return Math.ceil(level / 4) + 1;
    }
    
    // ПРАВИЛЬНЫЙ РАСЧЕТ КЛАССА ДОСПЕХА
    function getArmorClass() {
        let dexMod = calculateModifier(characterData.stats.dex);
        let baseAC = 10 + dexMod; // КД без доспехов

        const equippedArmor = characterData.inventory.items.find(i => i.isArmor && i.equipped);
        const equippedShield = characterData.inventory.items.find(i => i.isShield && i.equipped);

        if (equippedArmor) {
            let armorAC = 0;
            const armorMatch = equippedArmor.effect.match(/КД\s*(\d+)/i);
            if (armorMatch) {
                armorAC = parseInt(armorMatch[1]);
                
                // Проверяем ограничение ловкости
                const maxDexMatch = equippedArmor.effect.match(/макс\.?\s*Ловк\s*\+?(\d+)/i);
                if (maxDexMatch) {
                    const maxDex = parseInt(maxDexMatch[1]);
                    armorAC += Math.min(dexMod, maxDex);
                } else if (!/без Ловк/i.test(equippedArmor.effect)) {
                    // Если нет ограничения и не написано "без Ловк", добавляем весь модификатор
                    armorAC += dexMod;
                }
            }
            baseAC = armorAC;
        }

        if (equippedShield) {
            const shieldMatch = equippedShield.effect.match(/\+(\d+)/);
            if (shieldMatch) {
                baseAC += parseInt(shieldMatch[1]);
            } else {
                baseAC += 2; // По умолчанию щит дает +2 к КД
            }
        }
        return baseAC;
    }

    // ГЛАВНАЯ ФУНКЦИЯ ОБНОВЛЕНИЯ СТРАНИЦЫ
    function renderCharacterSheet() {
        // Базовая информация
        document.getElementById('charName').value = characterData.name;
        document.getElementById('charClass').value = characterData.class;
        document.getElementById('charLevel').value = characterData.level;
        document.getElementById('charRace').value = characterData.race;
        document.getElementById('charBackground').value = characterData.background;
        document.getElementById('charAlignment').value = characterData.alignment;
        
        // Статы и модификаторы
        const profBonus = getProfBonus(characterData.level);
        document.getElementById('profBonus').textContent = `+${profBonus}`;

        STATS.forEach(stat => {
            const score = characterData.stats[stat];
            const mod = calculateModifier(score);
            document.getElementById(`${stat}Score`).value = score;
            document.getElementById(`${stat}Mod`).textContent = (mod >= 0 ? '+' : '') + mod;
        });

        // Спасброски
        document.querySelectorAll('input[data-type="save"]').forEach(chk => {
            const stat = chk.dataset.stat;
            const mod = calculateModifier(characterData.stats[stat]);
            const isProficient = characterData.proficiencies.saves.includes(stat);
            chk.checked = isProficient;
            const bonus = mod + (isProficient ? profBonus : 0);
            document.getElementById(`${stat}SaveBonus`).textContent = (bonus >= 0 ? '+' : '') + bonus;
        });

        // Навыки
        document.querySelectorAll('input[data-type="skill"]').forEach(chk => {
            const skillName = chk.dataset.skill;
            const skillInfo = SKILLS.find(s => s.name === skillName);
            const mod = calculateModifier(characterData.stats[skillInfo.stat]);
            const isProficient = characterData.proficiencies.skills.includes(skillName);
            chk.checked = isProficient;
            const bonus = mod + (isProficient ? profBonus : 0);
            document.getElementById(`${skillName.replace(/\s+/g, '')}Bonus`).textContent = (bonus >= 0 ? '+' : '') + bonus;
        });
        
        // Боевые характеристики (ИСПРАВЛЕНО)
        document.getElementById('armorClass').textContent = getArmorClass(); // Используем новую функцию
        document.getElementById('initiative').textContent = (calculateModifier(characterData.stats.dex) >= 0 ? '+' : '') + calculateModifier(characterData.stats.dex);
        document.getElementById('speed').value = characterData.speed;
        
        // Здоровье и кости хитов
        document.getElementById('maxHP').value = characterData.hp.max;
        document.getElementById('currentHP').value = characterData.hp.current;
        const hitDie = DND_CLASSES[characterData.class].hitDie;
        document.getElementById('totalHitDice').textContent = `${characterData.level}d${hitDie}`;

        // Рендер инвентаря и заклинаний
        renderInventory();
        renderSpells();
        renderSpellSlots();

        // Прочее
        document.getElementById('featuresAndTraits').value = characterData.features;
        document.getElementById('notes').value = characterData.notes;

        saveToLocalStorage();
    }

    function handleInputChange(e) {
        const id = e.target.id;
        const value = e.target.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value;

        switch (id) {
            case 'charName': characterData.name = value; break;
            case 'charClass': 
                characterData.class = value; 
                characterData.proficiencies.saves = DND_CLASSES[value].saves; // Авто-выбор спасбросков класса
                break;
            case 'charLevel': characterData.level = value; break;
            case 'charRace': characterData.race = value; break;
            case 'charBackground': characterData.background = value; break;
            case 'charAlignment': characterData.alignment = value; break;
            case 'strScore': case 'dexScore': case 'conScore': case 'intScore': case 'wisScore': case 'chaScore':
                characterData.stats[id.slice(0,3)] = value;
                break;
            case 'maxHP': characterData.hp.max = value; break;
            case 'currentHP': characterData.hp.current = Math.min(value, characterData.hp.max); break;
            case 'speed': characterData.speed = value; break;
            case 'featuresAndTraits': characterData.features = value; break;
            case 'notes': characterData.notes = value; break;
        }
        
        if (e.target.dataset.type === 'save' || e.target.dataset.type === 'skill') {
            handleProficiencyChange(e.target);
        }

        renderCharacterSheet();
    }

    function handleProficiencyChange(checkbox) {
        const { type, stat, skill } = checkbox.dataset;
        const list = type === 'save' ? characterData.proficiencies.saves : characterData.proficiencies.skills;
        const value = type === 'save' ? stat : skill;
        
        if (checkbox.checked) {
            if (!list.includes(value)) list.push(value);
        } else {
            const index = list.indexOf(value);
            if (index > -1) list.splice(index, 1);
        }
    }

    // --- УПРАВЛЕНИЕ ИНВЕНТАРЕМ ---
    function renderInventory() {
        // Оружие
        const weaponsTbody = document.querySelector('#weaponsTable tbody');
        weaponsTbody.innerHTML = '';
        characterData.inventory.weapons.forEach((weapon, index) => {
            const row = weaponsTbody.insertRow();
            row.innerHTML = `
                <td>${weapon.name}</td>
                <td>${weapon.bonus}</td>
                <td>${weapon.damage}</td>
                <td><button class="remove-btn" data-type="weapon" data-index="${index}">X</button></td>
            `;
        });
        
        // Броня и предметы (ИСПРАВЛЕНО)
        const itemsTbody = document.querySelector('#itemsTable tbody');
        itemsTbody.innerHTML = '';
        characterData.inventory.items.forEach((item, index) => {
            let equipBtn = '';
            if (item.isArmor || item.isShield) {
                equipBtn = `<button class="equip-btn" data-index="${index}">${item.equipped ? 'Снять' : 'Надеть'}</button>`;
            }
            const type = item.isArmor ? ' (Броня)' : item.isShield ? ' (Щит)' : '';
            const row = itemsTbody.insertRow();
            row.innerHTML = `
                <td>${item.name}${type}</td>
                <td>${item.effect}</td>
                <td>${item.props}</td>
                <td class="controls-cell">
                    ${equipBtn}
                    <button class="remove-btn" data-type="item" data-index="${index}">X</button>
                </td>
            `;
        });
    }

    function addWeapon(e) {
        e.preventDefault();
        const name = document.getElementById('weaponName').value;
        const damage = document.getElementById('weaponDamage').value;
        if (!name || !damage) return;
        
        const isFinesse = damage.toLowerCase().includes('фехтовальное');
        const attackStat = (isFinesse && characterData.stats.dex > characterData.stats.str) ? 'dex' : 'str';
        const mod = calculateModifier(characterData.stats[attackStat]);
        const profBonus = getProfBonus(characterData.level);
        const bonus = (mod + profBonus >= 0 ? '+' : '') + (mod + profBonus);

        characterData.inventory.weapons.push({ name, damage, bonus });
        document.getElementById('addWeaponForm').reset();
        renderCharacterSheet();
    }
    
    function addItem(e) {
        e.preventDefault();
        const name = document.getElementById('itemName').value;
        const effect = document.getElementById('itemEffect').value;
        const props = document.getElementById('itemProps').value;
        const isArmor = document.getElementById('itemIsArmor').checked;
        const isShield = document.getElementById('itemIsShield').checked;
        if (!name) return;
        characterData.inventory.items.push({ name, effect, props, isArmor, isShield, equipped: false });
        document.getElementById('addItemForm').reset();
        renderCharacterSheet();
    }
    
    // --- УПРАВЛЕНИЕ ЗАКЛИНАНИЯМИ ---
    function renderSpells() {
        const spellsTbody = document.querySelector('#spellsTable tbody');
        spellsTbody.innerHTML = '';
        const sortedSpells = [...characterData.spells].sort((a,b) => a.level - b.level);
        sortedSpells.forEach((spell, index) => {
            const row = spellsTbody.insertRow();
            row.innerHTML = `
                <td>${spell.level}</td>
                <td>${spell.name}</td>
                <td>${spell.desc}</td>
                <td><button class="remove-btn" data-type="spell" data-index="${index}">X</button></td>
            `;
        });
    }

    function addSpell(e) {
        e.preventDefault();
        const level = parseInt(document.getElementById('spellLevel').value);
        const name = document.getElementById('spellName').value;
        const desc = document.getElementById('spellDesc').value;
        if (name === '' || isNaN(level)) return;
        characterData.spells.push({ level, name, desc });
        document.getElementById('addSpellForm').reset();
        renderCharacterSheet();
    }

    function removeSpell(e) {
        if (!e.target.classList.contains('remove-btn') || e.target.dataset.type !== 'spell') return;
        const originalIndex = e.target.dataset.index;
        const sortedSpells = [...characterData.spells].sort((a,b) => a.level - b.level);
        const spellToRemove = sortedSpells[originalIndex];
        const actualIndex = characterData.spells.findIndex(s => s === spellToRemove);
        
        if (actualIndex > -1) {
            characterData.spells.splice(actualIndex, 1);
        }
        renderCharacterSheet();
    }

    // --- ЯЧЕЙКИ ЗАКЛИНАНИЙ ---
    const SPELL_SLOTS_BY_LEVEL = [ // Примерная таблица для Волшебника/Жреца
        [2,0,0,0,0,0,0,0,0], [3,0,0,0,0,0,0,0,0], [4,2,0,0,0,0,0,0,0], [4,3,0,0,0,0,0,0,0],
        [4,3,2,0,0,0,0,0,0], [4,3,3,0,0,0,0,0,0], [4,3,3,1,0,0,0,0,0], [4,3,3,2,0,0,0,0,0],
        [4,3,3,3,1,0,0,0,0], [4,3,3,3,2,0,0,0,0], [4,3,3,3,2,1,0,0,0], [4,3,3,3,2,1,0,0,0],
        [4,3,3,3,2,1,1,0,0], [4,3,3,3,2,1,1,0,0], [4,3,3,3,2,1,1,1,0], [4,3,3,3,2,1,1,1,0],
        [4,3,3,3,2,1,1,1,1], [4,3,3,3,3,1,1,1,1], [4,3,3,3,3,2,1,1,1], [4,3,3,3,3,2,2,1,1]
    ];
    
    function renderSpellSlots() {
        const container = document.getElementById('spellSlotsContainer');
        container.innerHTML = '';
        
        const level = characterData.level;
        if (level < 1) return;
        const slotsForLevel = SPELL_SLOTS_BY_LEVEL[level - 1];

        slotsForLevel.forEach((totalSlots, i) => {
            if (totalSlots === 0) return;
            const level = i + 1;
            
            if (!characterData.spellSlots[level]) {
                characterData.spellSlots[level] = { total: totalSlots, used: 0 };
            } else {
                 characterData.spellSlots[level].total = totalSlots;
            }
            
            const usedSlots = characterData.spellSlots[level].used;

            const div = document.createElement('div');
            div.className = 'spell-slot-level';
            div.innerHTML = `<h5>${level} уровень (${usedSlots}/${totalSlots})</h5>`;
            const trackersDiv = document.createElement('div');
            trackersDiv.className = 'slot-trackers';
            
            for(let j = 0; j < totalSlots; j++) {
                const chk = document.createElement('input');
                chk.type = 'checkbox';
                chk.className = 'slot-checkbox';
                chk.checked = j < usedSlots;
                chk.dataset.level = level;
                trackersDiv.appendChild(chk);
            }
            div.appendChild(trackersDiv);
            container.appendChild(div);
        });
    }

    function handleSlotChange(e) {
        if (!e.target.classList.contains('slot-checkbox')) return;
        const level = e.target.dataset.level;
        const checkboxes = document.querySelectorAll(`.slot-checkbox[data-level="${level}"]`);
        let usedCount = 0;
        checkboxes.forEach(chk => { if (chk.checked) usedCount++; });
        
        characterData.spellSlots[level].used = usedCount;
        renderCharacterSheet();
    }

    // --- УПРАВЛЕНИЕ ЗДОРОВЬЕМ И КОСТЯМИ ХИТОВ ---
    function handleHpChange(amount) {
        let current = characterData.hp.current;
        const max = characterData.hp.max;
        current += amount;
        if (current > max) current = max;
        if (current < 0) current = 0;
        characterData.hp.current = current;
        renderCharacterSheet();
    }
    
    function rollHitDice() {
        const resultEl = document.getElementById('hitDiceResult');
        if (characterData.level === 0) {
            resultEl.textContent = "Нельзя использовать на 0 уровне.";
            return;
        }

        const hitDie = DND_CLASSES[characterData.class].hitDie;
        const conMod = calculateModifier(characterData.stats.con);
        const roll = Math.floor(Math.random() * hitDie) + 1;
        const totalHeal = roll + conMod;

        resultEl.textContent = `Бросок: ${roll} + ${conMod} (Тел) = ${totalHeal} восстановлено.`;
        handleHpChange(totalHeal > 0 ? totalHeal : 1);
    }

    // --- ЭКСПОРТ/ИМПОРТ И ЛОКАЛЬНОЕ ХРАНИЛИЩЕ ---
    function exportCharacter() {
        const dataStr = JSON.stringify(characterData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = characterData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'character';
        a.download = `${safeName}_dnd.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    function importCharacter(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                if (importedData.stats && importedData.inventory) {
                    characterData = importedData;
                    renderCharacterSheet();
                    alert('Персонаж успешно импортирован!');
                } else {
                    alert('Ошибка: файл не является корректным листом персонажа.');
                }
            } catch (error) {
                alert('Ошибка при чтении файла. Убедитесь, что это корректный JSON.');
                console.error(error);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    function saveToLocalStorage() {
        localStorage.setItem('dndCharacterSheet', JSON.stringify(characterData));
    }
    
    function loadFromLocalStorage() {
        const savedData = localStorage.getItem('dndCharacterSheet');
        if (savedData) {
            characterData = JSON.parse(savedData);
        }
    }

    // --- УСТАНОВКА ОБРАБОТЧИКОВ СОБЫТИЙ ---
    function setupEventListeners() {
        document.body.addEventListener('input', e => {
            if(e.target.matches('input, select, textarea')) {
                handleInputChange(e);
            }
        });

        document.querySelector('.skills-saves-container').addEventListener('change', e => {
            if (e.target.type === 'checkbox') handleInputChange(e);
        });
        
        document.getElementById('healBtn').addEventListener('click', () => {
            const amount = parseInt(document.getElementById('hpChange').value);
            if (!isNaN(amount)) handleHpChange(amount);
        });
        document.getElementById('damageBtn').addEventListener('click', () => {
            const amount = parseInt(document.getElementById('hpChange').value);
            if (!isNaN(amount)) handleHpChange(-amount);
        });
        
        document.getElementById('rollHitDice').addEventListener('click', rollHitDice);
        
        document.querySelector('.tabs').addEventListener('click', e => {
            if (e.target.classList.contains('tab-link')) {
                document.querySelectorAll('.tab-link').forEach(tab => tab.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById(e.target.dataset.tab).classList.add('active');
            }
        });

        // Формы добавления (ИСПРАВЛЕНО)
        document.getElementById('addWeaponForm').addEventListener('submit', addWeapon);
        document.getElementById('addItemForm').addEventListener('submit', addItem);
        document.getElementById('addSpellForm').addEventListener('submit', addSpell);

        // Умный обработчик для вкладки инвентаря (ИСПРАВЛЕНО)
        document.getElementById('tab-inventory').addEventListener('click', e => {
            const target = e.target;
            
            // Кнопка "Надеть/Снять"
            if (target.classList.contains('equip-btn')) {
                const index = parseInt(target.dataset.index);
                const item = characterData.inventory.items[index];

                if (item.isArmor) {
                    characterData.inventory.items.forEach((otherItem, otherIndex) => {
                        if (otherItem.isArmor && otherIndex !== index) {
                            otherItem.equipped = false;
                        }
                    });
                }
                 if (item.isShield) {
                    characterData.inventory.items.forEach((otherItem, otherIndex) => {
                        if (otherItem.isShield && otherIndex !== index) {
                            otherItem.equipped = false;
                        }
                    });
                }
                item.equipped = !item.equipped;
                renderCharacterSheet();
            }

            // Кнопка удаления
            if (target.classList.contains('remove-btn')) {
                const { type, index } = target.dataset;
                if (type === 'item') {
                    characterData.inventory.items.splice(index, 1);
                } else if (type === 'weapon') {
                    characterData.inventory.weapons.splice(index, 1);
                }
                renderCharacterSheet();
            }
        });
        
        document.getElementById('tab-spells').addEventListener('click', removeSpell);
        document.getElementById('spellSlotsContainer').addEventListener('click', handleSlotChange);
        document.getElementById('exportBtn').addEventListener('click', exportCharacter);
        document.getElementById('importFile').addEventListener('change', importCharacter);
    }
    
    init();
});