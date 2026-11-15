/* Практические навыки первого коллоквиума: описание предмета для общего движка.
   Реестр предметов (js/skills-registry.js) читает этот файл, поэтому здесь нет
   ни DOM, ни загрузки других скриптов — только данные и подписи. */
(function () {
  'use strict';
  const data = window.AnatomySkillsData;
  const KEY = 'anatomy-practical-skills-1-v1';
  const descriptor = {
    key: KEY,
    data,
    labels: {
      eyebrow: 'АНАТОМИЯ / 1 КОЛЛОКВИУМ',
      title: 'Практические навыки',
      subtitle: 'Переведите термин и найдите структуру в атласе или на препарате.',
    },
  };
  // Удобные ссылки для тестов и старого кода: интерфейс работает через реестр.
  window.AnatomySkills = {
    data,
    KEY,
    descriptor,
    get items() { return (data.items || []).length; },
    get sections() { return (data.sections || []).length; },
    get byId() {
      const fromRegistry = window.MedzoSkillsRegistry && window.MedzoSkillsRegistry.get('anatomySkills');
      if (fromRegistry) return fromRegistry.byId;
      return Object.fromEntries((data.items || []).map((item) => [item.id, item]));
    },
    create(store, random) {
      const spec = window.MedzoSkillsRegistry ? window.MedzoSkillsRegistry.get('anatomySkills') : null;
      if (!spec) throw new Error('Данные навыков не готовы: подключите js/skills-engine.js и js/skills-registry.js');
      return window.MedzoSkills.create(spec, store, random);
    },
  };
})();
