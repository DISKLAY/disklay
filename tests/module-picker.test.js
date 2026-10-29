const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Минимальная DOM-модель, чтобы проверить управление списком без зависимостей.
function makePicker() {
  const document = { activeElement: null, listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; } };
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.attrs = {}; this.listeners = {}; this.hidden = false; this.classList = { add() {} }; }
    setAttribute(name, value) { this.attrs[name] = value; }
    getAttribute(name) { return this.attrs[name]; }
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
    { label: 'Основные базы', choices: [['1', '1 · Остеология'], ['2', '2 · Миология'], ['3', '3 · Спланхнология']] },
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
  context.window.initModulePicker(select, container);
  const [trigger, list] = container.children;
  const items = list.children.flatMap(group => group.children.filter(child => child.getAttribute('role') === 'option'));
  const key = (target, key) => target.dispatchEvent({ type: 'keydown', key, preventDefault() {} });
  const click = (target, eventTarget = target) => target.dispatchEvent({ type: 'click', target: eventTarget });
  return { document, select, trigger, list, items, key, click };
}

test('список показывает группы и выбранную базу, открывается и закрывается', () => {
  const {document, select, trigger, list, items, click} = makePicker();
  assert.equal(select.hidden, true);
  assert.equal(trigger.current.textContent, '1 · Остеология');
  assert.equal(items.length, 5);
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
  assert.equal(document.activeElement, items[4]);
  key(list, 'Escape');
  assert.equal(document.activeElement, trigger);
  assert.equal(list.hidden, true);
  click(trigger);
  click(list, items[4]);
  assert.equal(select.value, 'stom-3');
  assert.equal(changes, 1);
  assert.equal(trigger.caption.textContent, 'Стоматологический факультет');
  assert.equal(trigger.current.textContent, '3 · Ангионеврология');
  assert.equal(items[4].getAttribute('aria-selected'), 'true');
});
