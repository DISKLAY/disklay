/* Отзывы о преподавателях: честное предупреждение вместо выдуманных оценок. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function load(reviews) {
  const window = {
    AT: { utils: { esc, plural: (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; if (a > 10 && a < 20) return many; if (b > 1 && b < 5) return few; if (b === 1) return one; return many; } }, views: {} },
    MedzoTeacherReviews: reviews
  };
  window.window = window;
  const context = vm.createContext(window);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/views-teacher-reviews.js'), 'utf8'), context);
  return context.AT.views.teacherReviews;
}

test('без перенесённых отзывов раздел честно предупреждает, а не выдумывает оценки', () => {
  const view = load({ updated: '2026-11-16', sources: [{ label: 'VK', url: 'https://vk.com/club61162587' }], teachers: [] });
  const { html } = view({});
  assert.match(html, /Список отзывов пока пуст/);
  assert.match(html, /ни одного отзыва ещё не перенесено/);
  assert.match(html, /vk\.com\/club61162587/);
  assert.doesNotMatch(html, /tr-teacher/);
  assert.doesNotMatch(html, /★/);
});

test('преподаватель без отзывов показывается с предупреждением, а не с пустой карточкой', () => {
  const view = load({ teachers: [
    { id: 'a', name: 'Иванов И. И.', department: 'Кафедра анатомии', reviews: [] }
  ] });
  const { html } = view({});
  assert.match(html, /Иванов И\. И\./);
  assert.match(html, /отзывов пока нет/);
  assert.match(html, /По этому преподавателю отзывов пока нет/);
  assert.doesNotMatch(html, /tr-stars/);
});

test('отзывы переносятся с источником, оценкой и экранированием текста', () => {
  const view = load({ updated: '2026-11-16', sources: [{ label: 'VK · отзывы', url: 'https://vk.com/club61162587' }], teachers: [
    { id: 'b', name: 'Петрова А. С.', department: 'Кафедра гистологии', subject: 'Гистология',
      reviews: [
        { id: 'r1', year: 2025, rating: 5, text: 'Объясняет спокойно <script>alert(1)</script>', source: 'VK', url: 'https://vk.com/wall-1_2' },
        { id: 'r2', year: 2026, rating: null, text: 'Требует много практики.', source: 'VK' }
      ] }
  ] });
  const { html } = view({});
  assert.match(html, /Петрова А\. С\./);
  assert.match(html, /5\.0/);
  assert.match(html, /Объясняет спокойно &lt;script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /Источник ↗/);
  assert.match(html, /Без оценки/);
  assert.match(html, /2 отзыва/);
});

test('страница подключена к маршруту, меню, предзагрузке и стилям', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(app, /teachers: 'teacherReviews'/);
  assert.match(html, /data-sidebar-route="teachers"/);
  assert.match(html, /js\/views-teacher-reviews\.js\?v=/);
  assert.match(html, /css\/teacher-reviews\.css\?v=/);
  assert.match(sw, /'\.\/js\/teacher-reviews\.js\?v=/);
  assert.match(sw, /'\.\/js\/views-teacher-reviews\.js\?v=/);
  assert.match(sw, /'\.\/css\/teacher-reviews\.css\?v=/);
});
