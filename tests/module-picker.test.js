const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Минимальная DOM-модель, чтобы проверить управление списком без зависимостей.
function makePicker() {
  const document = { activeElement: null, documentElement: { classList: { add() {} } }, listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; } };
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.attrs = {}; this.listeners = {}; this.hidden = false; this.classList = { add() {} }; }
    setAttribute(name, value) { this.attrs[name] = value; }
    getAttribute(name) { return this.attrs[name]; }
    removeAttribute(name) { delete this.attrs[name]; }
    appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
    append(...children) { children.forEach(child => this.appendChild(child)); }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    dispatchEvent(event) { event.target ||= this; (this.listeners[event.type] || []).forEach(fn => fn(event)); }
    focus() { document.activeElement = this; }
    contains(child) { return child === this || this.children.some(c => c.contains(child)); }
    closest(query) { return query === '[role="option"]' && this.attrs.role === 'option' ? this : this.parentElement?.closest(query); }
    set innerHTML(value) {
      this._html = value;
      if (value.includes('module-picker__caption')) {
        this.caption = new Element('span');
        this.current = new Element('span');
      }
    }
    querySelector(selector) { return selector === '.module-picker__caption' ? this.caption : this.current; }
  }
  document.createElement = (tag) => new Element(tag);
  const container = new Element('div');
  const select = new Element('select');
  select.title = 'Прогресс сохраняется отдельно';
  const groups = [
    { label: '1 семестр', choices: [['1', '1 · Остеология'], ['2', '2 · Миология'], ['credit-1', 'Зачёт · Остеология и миология']] },
    { label: '2 семестр', choices: [['3', '3 · Спланхнология'], ['4', '4 · Центральная нервная система'], ['credit-2', 'Зачёт · Спланхнология и ЦНС']] },
    { label: 'Стоматологический факультет', choices: [['stom-2', 'Стом · 2 · Спланхнология'], ['stom-3', 'Стом · 3 · Ангионеврология']] },
  ].map(({label, choices}) => {
    const group = new Element('optgroup'); group.label = label;
    choices.forEach(([value, text]) => { const option = new Element('option'); option.value = value; option.textContent = text; group.appendChild(option); });
    return group;
  });
  select.querySelectorAll = () => groups;
  select.options = groups.flatMap(group => group.children);
  select.value = '1';
  Object.defineProperty(select, 'selectedIndex', { get() { return this.options.findIndex(option => option.value === this.value); } });
  class Event { constructor(type, options) { this.type = type; Object.assign(this, options); } }
  const context = vm.createContext({ window: {}, document, Event });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js/module-picker.js'), 'utf8'), context);
  const sidebar = new Element('aside');
  sidebar.hidden = true;
  const sidebarNav = new Element('nav');
  context.window.initModulePicker(select, container, sidebar, sidebarNav);
  const [trigger, list] = container.children;
  const items = list.children.flatMap(group => group.children.filter(child => child.getAttribute('role') === 'option'));
  const key = (target, key) => target.dispatchEvent({ type: 'keydown', key, preventDefault() {} });
  const click = (target, eventTarget = target) => target.dispatchEvent({ type: 'click', target: eventTarget });
  return { document, select, trigger, list, items, key, click, sidebar, sidebarNav };
}

test('список показывает группы и выбранную базу, открывается и закрывается', () => {
  const {document, select, trigger, list, items, click} = makePicker();
  assert.equal(select.hidden, true);
  assert.equal(trigger.current.textContent, '1 · Остеология');
  assert.equal(items.length, 8);
  assert.equal(items[0].getAttribute('aria-selected'), 'true');
  assert.equal(list.hidden, true);
  click(trigger);
  assert.equal(list.hidden, false);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(document.activeElement, items[0]);
  document.listeners.click({target: document.createElement('div')});
  assert.equal(list.hidden, true);
});

test('клавиатура и выбор пункта работают через исходный select', () => {
  const {document, select, trigger, list, items, click, key} = makePicker();
  let changes = 0;
  select.addEventListener('change', () => changes++);
  key(trigger, 'ArrowDown');
  key(list, 'ArrowDown');
  assert.equal(document.activeElement, items[1]);
  key(list, 'End');
  assert.equal(document.activeElement, items[7]);
  key(list, 'Escape');
  assert.equal(document.activeElement, trigger);
  assert.equal(list.hidden, true);
  click(trigger);
  click(list, items[7]);
  assert.equal(select.value, 'stom-3');
  assert.equal(changes, 1);
  assert.equal(trigger.caption.textContent, 'Стоматологический факультет');
  assert.equal(trigger.current.textContent, '3 · Ангионеврология');
  assert.equal(items[7].getAttribute('aria-selected'), 'true');
});


test('боковая панель показывает семестры и использует то же переключение', () => {
  const { sidebar, sidebarNav, select, trigger, click } = makePicker();
  const groups = sidebarNav.children;
  assert.equal(sidebar.hidden, true);
  assert.deepEqual(groups.map(group => group.children[0].textContent), ['1 семестр', '2 семестр', 'Стоматологический факультет']);
  assert.equal(groups[0].children[1].getAttribute('aria-current'), 'page');
  let changes = 0;
  select.addEventListener('change', () => changes++);
  const credit = groups[1].children[3];
  click(credit);
  assert.equal(select.value, 'credit-2');
  assert.equal(changes, 1);
  assert.equal(credit.getAttribute('aria-current'), 'page');
  assert.equal(groups[0].children[1].getAttribute('aria-current'), undefined);
  assert.equal(trigger.caption.textContent, '2 семестр');
  assert.equal(trigger.current.textContent, 'Зачёт · Спланхнология и ЦНС');
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
