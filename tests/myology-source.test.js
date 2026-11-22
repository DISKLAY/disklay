/* Перенесённая теория по миологии: полнота страниц, якоря вопросов, файлы рисунков. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(root, 'js/myology-source.js'), 'utf8'), context);
const pages = context.window.MedzoMyologySource;
const dataContext = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(root, 'js/myology-data.js'), 'utf8'), dataContext);
const questions = dataContext.window.MedzoMyologyData.questions;

test('все страницы конспекта с материалом перенесены (2–24)', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(pages.map(p => p.page))), Array.from({ length: 23 }, (_, i) => i + 2));
});

test('у каждого из 66 вопросов ровно один якорь в теории', () => {
  const anchors = pages.flatMap(p => p.blocks.filter(b => b.type === 'heading').map(b => b.anchor));
  assert.equal(anchors.length, 66);
  assert.deepEqual(JSON.parse(JSON.stringify([...new Set(anchors)].sort((a, b) => a - b))), JSON.parse(JSON.stringify(questions.map(q => q.id))));
});

test('перенесены все рисунки, ссылки на оригинальные PDF отсутствуют', () => {
  const figures = pages.flatMap(p => p.blocks.filter(b => b.type === 'figure'));
  assert.equal(figures.length, 16);
  for (const figure of figures) {
    assert.ok(fs.statSync(path.join(root, figure.file)).size > 0, `нет файла: ${figure.file}`);
    assert.ok(figure.alt && figure.alt.length > 10, 'у рисунка должен быть содержательный alt');
  }
  const raw = fs.readFileSync(path.join(root, 'js/myology-source.js'), 'utf8');
  assert.ok(!/\.pdf/i.test(raw), 'в перенесённой теории не должно быть ссылок на PDF');
});

test('ссылки на оригинальные файлы удалены из представлений', () => {
  const view = fs.readFileSync(path.join(root, 'js/views-myology.js'), 'utf8');
  assert.ok(!/myo-tabs/.test(view), 'вкладки заменены общей лентой тренировки');
  assert.ok(!/← Теория 1 коллоквиума/.test(view), 'лишние ссылки на странице не нужны');
  assert.ok(!/questions-source\.pdf|colloquium-1-oral-theory\.pdf/.test(view));
  for (const banned of ['myo-warning', 'questionStatus', 'myo-preview', 'section=sources']) {
    assert.ok(!view.includes(banned), `устаревший фрагмент остался в представлении: ${banned}`);
  }
});
