const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function makeDrawer() {
  const document = { activeElement: null, body: {style: {overflow: 'auto'}}, listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; } };
  class Element {
    constructor() { this.hidden = true; this.attrs = {}; this.listeners = {}; }
    setAttribute(k, v) { this.attrs[k] = v; }
    addEventListener(k, fn) { this.listeners[k] = fn; }
    focus() { document.activeElement = this; }
    getClientRects() { return [1]; }
    click(target = this) { this.listeners.click({target}); }
  }
  const panel = new Element(), toggle = new Element(), close = new Element(), backdrop = new Element(), link = new Element();
  panel.querySelectorAll = () => [close, link];
  const context = vm.createContext({document, window: {}});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js/course-drawer.js'), 'utf8'), context);
  context.window.initCourseDrawer(panel, toggle, close, backdrop);
  const key = (key, shiftKey = false) => { let prevented = false; document.listeners.keydown({key, shiftKey, preventDefault() { prevented = true; }}); return prevented; };
  return {document, panel, toggle, close, backdrop, link, key};
}

test('панель открывается, закрывается по Escape и возвращает фокус', () => {
  const {document, panel, toggle, close, backdrop, key} = makeDrawer();
  assert.equal(toggle.hidden, false);
  toggle.click();
  assert.equal(panel.hidden, false); assert.equal(backdrop.hidden, false);
  assert.equal(toggle.attrs['aria-expanded'], 'true');
  assert.equal(document.activeElement, close); assert.equal(document.body.style.overflow, 'hidden');
  assert.equal(key('Escape'), true);
  assert.equal(panel.hidden, true); assert.equal(backdrop.hidden, true);
  assert.equal(document.activeElement, toggle); assert.equal(document.body.style.overflow, 'auto');
  assert.equal(toggle.attrs['aria-expanded'], 'false');
});

test('фокус удерживается в панели и фон закрывает её', () => {
  const {document, panel, toggle, close, backdrop, link, key} = makeDrawer();
  toggle.click();
  assert.equal(key('Tab', true), true); assert.equal(document.activeElement, link);
  assert.equal(key('Tab'), true); assert.equal(document.activeElement, close);
  backdrop.click(); assert.equal(panel.hidden, true); assert.equal(document.activeElement, toggle);
});

test('выбор пункта закрывает панель и возвращает фокус', () => {
  const {document, panel, toggle} = makeDrawer();
  toggle.click();
  panel.click({closest: () => ({})});
  assert.equal(panel.hidden, true); assert.equal(document.activeElement, toggle);
});
