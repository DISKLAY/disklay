const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Минимальная DOM-модель для проверки выбора базы в панели без зависимостей.
function makePicker(selected = '1') {
  const document = {};
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.attrs = {}; this.listeners = {}; this.open = false; }
    setAttribute(name, value) { this.attrs[name] = value; }
    getAttribute(name) { return this.attrs[name]; }
    removeAttribute(name) { delete this.attrs[name]; }
    appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
    append(...children) { children.forEach(child => this.appendChild(child)); }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    dispatchEvent(event) { event.target ||= this; (this.listeners[event.type] || []).forEach(fn => fn(event)); }
    set innerHTML(value) { this._html = value; }
  }
  document.createElement = (tag) => new Element(tag);
  const select = new Element('select');
  const groups = [
    { label: '1 семестр', choices: [['1', '1 · Остеология'], ['2', '2 · Миология'], ['credit-1', 'Зачёт · Остеология и миология']] },
    { label: '2 семестр', choices: [['3', '3 · Спланхнология'], ['4', '4 · Центральная нервная система'], ['credit-2', 'Зачёт · Спланхнология и ЦНС']] },
    { label: '3 семестр', choices: [['5', '5 · Эстезиология и черепные нервы'], ['6', '6 · Периферическая нервная система']] },
    { label: 'Стоматологический факультет', choices: [['stom-2', 'Стом · 2 · Спланхнология'], ['stom-3', 'Стом · 3 · Ангионеврология']] },
  ].map(({label, choices}) => {
    const group = new Element('optgroup'); group.label = label;
    choices.forEach(([value, text]) => { const option = new Element('option'); option.value = value; option.textContent = text; group.appendChild(option); });
    return group;
  });
  select.querySelectorAll = () => groups;
  select.options = groups.flatMap(group => group.children);
  select.value = selected;
  Object.defineProperty(select, 'selectedIndex', { get() { return this.options.findIndex(option => option.value === this.value); } });
  class Event { constructor(type, options) { this.type = type; Object.assign(this, options); } }
  const context = vm.createContext({ window: {}, document, Event });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js/module-picker.js'), 'utf8'), context);
  const sidebarNav = new Element('nav');
  context.window.initModulePicker(select, sidebarNav);
  const click = target => target.dispatchEvent({ type: 'click', target });
  return { select, sidebarNav, click };
}

test('выбор базы находится только в панели, актуальная группа раскрыта', () => {
  const { sidebarNav } = makePicker('stom-2');
  const groups = sidebarNav.children;
  assert.deepEqual(groups.map(group => group.children[0].textContent), ['1 семестр', '2 семестр', '3 семестр', 'Стоматологический факультет']);
  assert.deepEqual(groups.map(group => group.open), [false, false, false, true]);
  assert.equal(groups.flatMap(group => group.children.slice(1)).length, 10);
  assert.equal(groups[3].children[1].getAttribute('aria-current'), 'true');
  assert.equal(groups[3].children[1].children[2].textContent, 'Выбрана');
});

test('выбор базы переключает исходное значение и выделяет новую группу', () => {
  const { sidebarNav, select, click } = makePicker();
  const groups = sidebarNav.children;
  let changes = 0;
  select.addEventListener('change', () => changes++);
  const credit = groups[1].children[3];
  click(credit);
  assert.equal(select.value, 'credit-2');
  assert.equal(changes, 1);
  assert.equal(credit.getAttribute('aria-current'), 'true');
  assert.equal(groups[0].children[1].getAttribute('aria-current'), undefined);
  assert.deepEqual(groups.map(group => group.open), [false, true, false, false]);
  click(credit);
  assert.equal(changes, 1);
});

test('в боковой панели зачёты обозначены значком, а номера коллоквиумов сохранены', () => {
  const { sidebarNav } = makePicker();
  for (const group of sidebarNav.children.slice(0, 2)) {
    const badge = group.children[3].children[0];
    assert.match(badge._html, /<svg/);
    assert.equal(badge.getAttribute('aria-hidden'), 'true');
    assert.equal(group.children[3].children[1].children[0].textContent, 'Зачёт');
  }
  assert.equal(sidebarNav.children[1].children[1].children[0].textContent, '3');
});

test('в шапке нет второго выпадающего списка и мобильного дублирования ссылок', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css/styles.css'), 'utf8');
  assert.match(html, /<select id="colloquiumSelect" hidden/);
  assert.doesNotMatch(html, /id="modulePicker"/);
  assert.match(html, /course-toggle__text"><span>Меню<\/span>/);
  assert.match(html, /id="courseSidebarNav"/);
  assert.match(css, /@media \(max-width: 760px\)\s*\{\s*\.nav\s*\{\s*display:\s*none/);
  assert.doesNotMatch(css, /\.course-toggle span\s*\{\s*display:\s*none/);
});

test('третий семестр показывает коллоквиумы 5 и 6 и раскрывается при выборе', () => {
  const { sidebarNav, select, click } = makePicker('5');
  const semester = sidebarNav.children[2];
  assert.equal(semester.children[0].textContent, '3 семестр');
  assert.equal(semester.open, true);
  assert.equal(semester.children[1].children[0].textContent, '5');
  assert.equal(semester.children[1].getAttribute('aria-current'), 'true');
  click(semester.children[2]);
  assert.equal(select.value, '6');
  assert.equal(semester.open, true);
  assert.equal(semester.children[2].getAttribute('aria-current'), 'true');
});
