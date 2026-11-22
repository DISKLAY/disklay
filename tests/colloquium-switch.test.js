/* Переключатель коллоквиума в шапке: один список вместо двух выпадающих меню.
   Проверяется на минимальной DOM-модели, чтобы тесты не требовали зависимостей. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

/* ---------------------------------------------------------------- мини-DOM */
class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.attrs = {};
    this.listeners = {};
    this.classes = new Set();
    // dataset ведёт себя как в браузере: запись в dataset.value меняет data-value
    const self0 = this;
    this.dataset = new Proxy({}, {
      set(target, key, value) {
        target[key] = value;
        self0.attrs['data-' + String(key).replace(/[A-Z]/g, c => '-' + c.toLowerCase())] = String(value);
        return true;
      }
    });
    this._text = '';
    this.hidden = false;
    this.className = '';
  }
  get classList() {
    const self = this;
    return {
      add: (...names) => names.forEach(n => self.classes.add(n)),
      remove: (...names) => names.forEach(n => self.classes.delete(n)),
      contains: name => self.classes.has(name),
      toggle: (name, force) => {
        const on = force === undefined ? !self.classes.has(name) : !!force;
        if (on) self.classes.add(name); else self.classes.delete(name);
        return on;
      }
    };
  }
  setAttribute(name, value) {
    this.attrs[name] = String(value);
    if (name === 'class') this.className = String(value);
    if (name === 'hidden') this.hidden = true;
  }
  getAttribute(name) { return name in this.attrs ? this.attrs[name] : null; }
  removeAttribute(name) { delete this.attrs[name]; if (name === 'hidden') this.hidden = false; }
  appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
  append(...nodes) { nodes.forEach(node => this.appendChild(node)); }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set textContent(value) { this._text = String(value); this.children = []; }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter(x => x !== fn); }
  dispatchEvent(event) {
    event.target = event.target || this;
    (this.listeners[event.type] || []).forEach(fn => fn(event));
    return true;
  }
  focus() { this.focused = true; }
  contains(node) {
    if (node === this) return true;
    return this.children.some(child => child.contains(node));
  }
  /* Поддержка простых селекторов: tag, .class, [attr], [attr="value"] и их
     комбинации через пробел (потомок). */
  static matchSimple(node, part) {
    const attrRe = /\[([a-zA-Z-]+)(?:="([^"]*)")?\]/g;
    let rest = part;
    let m;
    while ((m = attrRe.exec(part))) {
      const value = node.attrs[m[1]];
      if (value === undefined) return false;
      if (m[2] !== undefined && value !== m[2]) return false;
      rest = rest.replace(m[0], '');
    }
    rest = rest.replace(/:[a-z-]+(\([^)]*\))?/g, '');
    if (!rest) {
      // «[attr]» без тега и класса — совпадение уже проверено
      return part.includes('[');
    }
    const tag = rest.match(/^[a-zA-Z]+/);
    if (tag && node.tagName !== tag[0].toUpperCase()) return false;
    const classes = [...rest.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(x => x[1]);
    return classes.every(name => node.classes.has(name) || (node.className || '').split(/\s+/).includes(name));
  }
  queryAll(selector, out = []) {
    const parts = selector.trim().split(/\s+(?![^\[]*\])/);
    const walk = (node, index) => {
      node.children.forEach(child => {
        if (index === parts.length - 1) {
          if (El.matchSimple(child, parts[index])) out.push(child);
        } else if (El.matchSimple(child, parts[index])) {
          walk(child, index + 1);
        }
        if (index === parts.length - 1) walk(child, index);
        else walk(child, index);
      });
    };
    // простой обход: потомки проверяются по последнему фрагменту селектора
    const check = (node) => {
      node.children.forEach(child => {
        const ok = parts.every((part, i) => {
          if (i === parts.length - 1) return El.matchSimple(child, part);
          let node2 = child.parentElement;
          while (node2) { if (El.matchSimple(node2, part)) return true; node2 = node2.parentElement; }
          return false;
        });
        if (ok) out.push(child);
        check(child);
      });
    };
    check(this);
    void walk;
    return out;
  }
  querySelectorAll(selector) { return this.queryAll(selector); }
  querySelector(selector) { return this.queryAll(selector)[0] || null; }
}

function makeDom(selected = '1') {
  const document = {
    createElement: tag => new El(tag),
    listeners: {},
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    dispatchEvent(event) { (this.listeners[event.type] || []).forEach(fn => fn(event)); },
    activeElement: null
  };
  // select с четырьмя группами и одиннадцатью базами — как в index.html
  const select = new El('select');
  const groups = [
    ['1 семестр', [['1', '1 · Остеология'], ['2', '2 · Миология'], ['credit-1', 'Зачёт · Остеология и миология']]],
    ['2 семестр', [['3', '3 · Спланхнология'], ['4', '4 · Центральная нервная система'], ['credit-2', 'Зачёт · Спланхнология и ЦНС']]],
    ['3 семестр', [['5', '5 · Эстезиология'], ['6', '6 · ПНС'], ['7', '7 · ССС']]],
    ['Стоматологический факультет', [['stom-2', 'Стом · 2 · Спланхнология'], ['stom-3', 'Стом · 3 · Ангионеврология']]]
  ].map(([label, items]) => {
    const group = new El('optgroup');
    group.label = label;
    items.forEach(([value, text]) => {
      const option = new El('option');
      option.value = value;
      option.textContent = text;
      group.appendChild(option);
    });
    select.appendChild(group);
    return group;
  });
  select.querySelectorAll = selector => (selector === 'optgroup' ? groups : El.prototype.queryAll.call(select, selector));
  select.options = groups.flatMap(group => group.children);
  select.value = selected;
  Object.defineProperty(select, 'selectedIndex', { get() { return this.options.findIndex(o => o.value === this.value); } });
  Object.defineProperty(select, 'selectedOptions', { get() { return [this.options[this.selectedIndex]]; } });

  const button = new El('button');
  button.setAttribute('aria-expanded', 'false');
  for (const [tag, attr] of [['span', 'data-switch-badge'], ['span', 'data-switch-semester'], ['strong', 'data-switch-name']]) {
    const node = new El(tag);
    node.setAttribute(attr, '');
    button.appendChild(node);
  }
  const panel = new El('div');
  panel.hidden = true;

  class Event {
    constructor(type, options) { this.type = type; Object.assign(this, options); }
    preventDefault() { this.defaultPrevented = true; }
  }
  const windowListeners = {};
  const window = {
    COLLOQUIUM_MODULES: { '1': { name: 'Остеология и артросиндесмология' }, '2': { name: 'Миология' } },
    addEventListener(type, fn) { (windowListeners[type] = windowListeners[type] || []).push(fn); }
  };
  const context = vm.createContext({ window, document, Event, setTimeout, clearTimeout });
  vm.runInContext(fs.readFileSync(path.join(root, 'js/colloquium-switch.js'), 'utf8'), context);
  const api = context.window.initColloquiumSwitch(select, button, panel);
  const click = el => el.dispatchEvent(new Event('click', { bubbles: true }));
  return { select, button, panel, api, click, Event, window };
}

test('в шапке одна кнопка выбора коллоквиума, второго списка в крошках нет', () => {
  assert.match(html, /id="colloquiumSelect" hidden/);
  assert.match(html, /id="courseSwitchTrigger"/);
  assert.match(html, /id="courseSwitchPanel"/);
  assert.doesNotMatch(html, /id="contextBase"/);
  assert.match(html, /js\/colloquium-switch\.js\?v=/);
});

test('кнопка показывает выбранный коллоквиум, панель открывается и закрывается', () => {
  const { button, panel, click } = makeDom();
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  assert.equal(panel.hidden, true);
  assert.match(button.textContent, /Остеология и артросиндесмология/);
  assert.match(button.getAttribute('aria-label'), /Коллоквиум: Остеология и артросиндесмология/);
  click(button);
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(panel.hidden, false);
  assert.equal(panel.querySelectorAll('.course-switch__item').length, 11);
  assert.equal(panel.querySelectorAll('.course-switch__group').length, 4);
  const current = panel.querySelector('[data-value="1"]');
  assert.equal(current.getAttribute('aria-current'), 'true');
  assert.match(current.textContent, /Открыт сейчас/);
  click(button);
  assert.equal(panel.hidden, true);
});

test('выбор пункта передаётся в скрытый select как событие change', () => {
  const { button, panel, select, click } = makeDom();
  click(button);
  let changed = 0;
  select.addEventListener('change', () => { changed += 1; });
  click(panel.querySelector('[data-value="2"]'));
  assert.equal(select.value, '2');
  assert.equal(changed, 1);
  assert.equal(panel.hidden, true);
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  assert.match(button.textContent, /Миология/);
  assert.equal(button.querySelector('[data-switch-badge]').textContent, '2');
  click(button);
  click(panel.querySelector('[data-value="2"]'));
  assert.equal(changed, 1, 'повторный выбор текущей базы не переключает её заново');
});

test('подписи пунктов остаются верными после смены базы', () => {
  const { select, panel, button, Event } = makeDom();
  select.value = '3';
  select.dispatchEvent(new Event('change'));
  assert.equal(button.querySelector('[data-switch-badge]').textContent, '3');
  assert.match(button.querySelector('[data-switch-semester]').textContent, /2 семестр/);
  assert.match(panel.querySelector('[data-value="3"]').textContent, /Открыт сейчас/);
  assert.match(panel.querySelector('[data-value="1"]').textContent, /1 семестр/);
  select.value = '1';
  select.dispatchEvent(new Event('change'));
  assert.match(panel.querySelector('[data-value="3"]').textContent, /2 семестр/, 'группа пункта не должна теряться');
});

test('панель закрывается по Escape', () => {
  const { button, panel, click, Event } = makeDom();
  click(button);
  assert.equal(panel.hidden, false);
  panel.dispatchEvent(new Event('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(panel.hidden, true);
  assert.equal(button.getAttribute('aria-expanded'), 'false');
});

test('навигация тренировки собирается из данных и масштабируется на все коллоквиумы', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  assert.match(app, /function trainingSections\(\)/);
  assert.match(app, /label: 'Навыки',/);
  assert.match(app, /label: 'Билеты',/);
  // Теория живёт в отдельном разделе и не дублируется пунктами «Теория · 1/2».
  assert.doesNotMatch(app, /label: 'Теория · [12]'/);
  assert.doesNotMatch(app, /label: 'Навыки · [12]'/);
  assert.doesNotMatch(app, /label: 'Карточки · 1'/);
  assert.match(app, /Number\(AT\.colloquium\.semester\) === 1/, 'пункты с материалами только у первого семестра');
  assert.match(app, /function trainingRoute\(route\)/);
});
