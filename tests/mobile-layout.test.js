const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('адаптивная шапка сохраняет доступ к меню, теме и флагу на узких экранах', () => {
  const css = read('css/styles.css'), html = read('index.html');
  assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/);
  assert.doesNotMatch(html, /user-scalable=no|maximum-scale=/);
  assert.match(html, /class="brand__flag"/);
  assert.match(html, /id="courseToggle"/);
  assert.match(html, /data-action="toggle-theme"/);
  assert.match(css, /\.course-sidebar:not\(\[hidden\]\).*width: min\(340px, 90%\); height: 100%/);
  assert.match(css, /\.course-sidebar__pages \{[^}]*repeat\(auto-fit, minmax\(min\(115px, 100%\), 1fr\)\)/);
  assert.match(css, /\.course-sidebar:not\(\[hidden\]\) \{ overflow-wrap: anywhere/);
});

test('мобильные сетки и длинный текст могут сжиматься без горизонтального переполнения', () => {
  const css = read('css/styles.css'), dungeon = read('css/dungeon.css');
  assert.match(css, /\.choice-grid \{ grid-template-columns: repeat\(auto-fit, minmax\(min\(160px, 100%\), 1fr\)\)/);
  assert.match(css, /\.btn, \.badge, \.answer-pill \{ max-width: 100%; white-space: normal; overflow-wrap: anywhere/);
  assert.match(css, /\.hero, \.rewards-hero, \.feedback__grid, \.review__cols \{ grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(dungeon, /\.dg-tabs \{ flex-wrap:wrap; overflow:visible/);
  assert.match(dungeon, /\.dg-item \{ flex-wrap:wrap/);
  assert.match(dungeon, /\.dg-entry \{ grid-template-columns:minmax\(0,1fr\)/);
});

test('в верхней строке только основные разделы, остальные доступны в меню', () => {
  const html = read('index.html'), css = read('css/styles.css');
  const nav = html.match(/<nav class="nav" id="mainNav"[\s\S]*?<\/nav>/)[0];
  const sidebar = html.match(/<nav class="course-sidebar__pages"[\s\S]*?<\/nav>/)[0];
  for (const name of ['dashboard', 'train', 'exam', 'mistakes', 'stats', 'rewards']) {
    assert.match(nav, new RegExp(`data-route="${name}"`));
  }
  for (const name of ['dungeon', 'key', 'settings']) {
    assert.doesNotMatch(nav, new RegExp(`data-route="${name}"`));
    assert.match(sidebar, new RegExp(`data-sidebar-route="${name}"`));
  }
  assert.match(css, /\.nav \{[^}]*flex-wrap: wrap/s);
  assert.match(css, /@media \(max-width: 1100px\) \{\s*\.topbar__inner \{ flex-wrap: wrap/s);
});
