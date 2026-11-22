/* Service worker: предзагружаемые файлы существуют, метка ?v= единая. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const swSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

function precacheEntries() {
  const block = swSource.match(/const PRECACHE = \[([\s\S]*?)\];/);
  assert.ok(block, 'sw.js должен содержать PRECACHE');
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function stampedFiles() {
  const files = ['index.html', 'sw.js'];
  for (const dir of ['js', 'js/data', 'css']) {
    for (const name of fs.readdirSync(path.join(root, dir))) {
      if (/\.(js|css)$/.test(name)) files.push(path.join(dir, name));
    }
  }
  return files;
}

test('все файлы из PRECACHE существуют в репозитории', () => {
  const entries = precacheEntries();
  assert.ok(entries.length > 0, 'PRECACHE пуст');
  for (const entry of entries) {
    const rel = entry.replace(/^\.\//, '').split('?')[0];
    const target = rel === '' ? 'index.html' : rel;
    assert.ok(
      fs.existsSync(path.join(root, target)) && fs.statSync(path.join(root, target)).isFile(),
      `нет файла для PRECACHE: ${entry}`
    );
  }
});

test('все пометки ?v= в html/css/js/sw совпадают между собой', () => {
  const stamps = new Map();
  for (const file of stampedFiles()) {
    const src = fs.readFileSync(path.join(root, file), 'utf8');
    for (const match of src.matchAll(/\?v=([A-Za-z0-9._-]+)/g)) {
      if (!stamps.has(match[1])) stamps.set(match[1], []);
      stamps.get(match[1]).push(file);
    }
  }
  assert.ok(stamps.size > 0, 'пометки ?v= не найдены');
  assert.equal(
    stamps.size,
    1,
    `ожидалась единая метка, найдено несколько: ${[...stamps].map(([v, f]) => `${v} (${f.length} файл(ов))`).join(', ')}`
  );
});
