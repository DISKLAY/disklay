const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function makeTheme(systemDark, saved) {
  const values = new Map(saved ? [['anatomy-colloquium-theme', saved]] : []);
  const attrs = {};
  const meta = { setAttribute(name, value) { this[name] = value; } };
  let onChange;
  const media = { matches: systemDark, addEventListener(type, cb) { if (type === 'change') onChange = cb; } };
  const context = vm.createContext({
    window: { AT: { utils: { esc: String } }, matchMedia: () => media },
    document: { documentElement: { setAttribute(name, value) { attrs[name] = value; }, getAttribute(name) { return attrs[name]; } }, querySelector: () => meta },
    localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) },
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8'), context);
  return { ui: context.window.AT.ui, attrs, meta, setSystemDark(value) { media.matches = value; onChange(); } };
}

test('явно выбранная светлая тема сохраняется при тёмной системной теме', () => {
  const { ui, attrs, meta, setSystemDark } = makeTheme(true, 'light');
  assert.equal(ui.applyTheme(), 'light');
  assert.equal(attrs['data-theme'], 'light');
  assert.equal(meta.content, '#f5f6fb');
  setSystemDark(false); setSystemDark(true);
  assert.equal(attrs['data-theme'], 'light');
  assert.equal(ui.getThemePref(), 'light');
});

test('режим как в системе следует системной теме, явная тёмная не меняется', () => {
  const { ui, attrs, setSystemDark } = makeTheme(true);
  assert.equal(ui.applyTheme(), 'dark');
  setSystemDark(false); assert.equal(attrs['data-theme'], 'light');
  setSystemDark(true); assert.equal(attrs['data-theme'], 'dark');
  ui.applyTheme('dark'); setSystemDark(false);
  assert.equal(attrs['data-theme'], 'dark');
});

test('браузер знает о темах приложения и не должен перекрашивать флаг', () => {
  const css = fs.readFileSync(path.join(root, 'css/styles.css'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /<meta name="color-scheme" content="light dark">/);
  assert.match(css, /:root\s*\{[^}]*color-scheme:\s*only light;/);
  assert.match(css, /\[data-theme="dark"\]\s*\{[^}]*color-scheme:\s*dark;/);
  assert.match(css, /\.brand__flag\s*\{[^}]*color-scheme:\s*only light;/);
  assert.match(html, /<path fill="#0033a0" d="M0 6h30v6H0z"\/>/);
});
