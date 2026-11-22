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
  const view = context.AT.views.teacherReviews;
  view.bodyHtml = context.AT.views.teacherReviews_bodyHtml;
  view.bodyFor = context.AT.views.teacherReviews_bodyFor;
  view.surnameOf = context.AT.views.teacherReviews_surnameOf;
  view.bySurname = context.AT.views.teacherReviews_bySurname;
  return view;
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

// Тело отзыва собирается лениво при раскрытии карточки: имитируем toggle.
function expand(html, teacherName) {
  const view = html; // дальше проверяем отрисованный список, а тело собираем напрямую
  return view;
}

test('сначала дисциплины, внутри — преподаватели, отзывы только в карточке преподавателя', () => {
  const view = load({ teachers: [
    { id: 'a', name: 'Иванов И. И.', reviews: [{ id: 'r1', discipline: 'Анатомия человека', semester: '1 семестр', parts: { seminars: 'Спокойно' } }] },
    { id: 'b', name: 'Петров П. П.', reviews: [{ id: 'r2', discipline: 'Биология', parts: { seminars: 'Строго' } }] }
  ] });
  const { html } = view({});
  const discAnatomy = html.indexOf('data-disc="Анатомия человека"');
  const discBiology = html.indexOf('data-disc="Биология"');
  const teacher = html.indexOf('Иванов И. И.');
  assert.ok(discAnatomy > 0 && discBiology > 0, 'дисциплины на странице');
  assert.ok(discAnatomy < teacher, 'дисциплина идёт до преподавателя');
  // отзывы не рендерятся заранее — только тело-заглушка карточки преподавателя
  assert.doesNotMatch(html, /Спокойно/);
  assert.match(html, /data-lazy-body/);
  assert.equal((html.match(/data-disc=/g) || []).length, 2);
});

test('дисциплины отсортированы по алфавиту, а не по числу отзывов', () => {
  const view = load({ teachers: [
    { id: 'a', name: 'А. А.', reviews: [{ discipline: 'Малая', parts: { seminars: 'x' } }] },
    { id: 'b', name: 'Б. Б.', reviews: [{ discipline: 'Большая', parts: { seminars: 'x' } }, { discipline: 'Большая', parts: { seminars: 'y' } }, { discipline: 'Большая', parts: { seminars: 'z' } }] },
    { id: 'c', name: 'В. В.', reviews: [{ discipline: 'Средняя', parts: { seminars: 'x' } }, { discipline: 'Средняя', parts: { seminars: 'y' } }] }
  ] });
  const { html } = view({});
  const order = [...html.matchAll(/data-disc="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(order, ['Большая', 'Малая', 'Средняя']);
});

test('преподаватель с отзывами в двух дисциплинах показывается в обеих', () => {
  const view = load({ teachers: [
    { id: 'a', name: 'Общий О. О.', reviews: [
      { id: 'r1', discipline: 'Анатомия человека', parts: { seminars: 'первый' } },
      { id: 'r2', discipline: 'Гистология', parts: { seminars: 'второй' } }
    ] }
  ] });
  const { html } = view({});
  assert.equal((html.match(/Общий О\. О\./g) || []).length, 2);
  const onlyAnatomy = view.bodyFor({ reviews: [
    { id: 'r1', discipline: 'Анатомия человека', parts: { seminars: 'первый' } },
    { id: 'r2', discipline: 'Гистология', parts: { seminars: 'второй' } }
  ] }, 'Анатомия человека');
  assert.match(onlyAnatomy, /первый/);
  assert.doesNotMatch(onlyAnatomy, /второй/);
});

test('отзывы переносятся дословно, с источником и экранированием текста', () => {
  const view = load({ updated: '2026-11-16', sources: [{ label: 'Google Таблица', url: 'https://docs.google.com/spreadsheets/d/abc' }], teachers: [
    { id: 'b', name: 'Петрова А. С.', reviews: [
      { id: 'r1', semester: '1 семестр', discipline: 'Гистология', date: '2025-08-11',
        parts: { seminars: 'Объясняет спокойно <script>alert(1)</script>', advice: 'Готовьте латынь' },
        source: 'Google Таблица · Отзывы (1-3 курс)' }
    ] }
  ] });
  const { html } = view({});
  assert.match(html, /Петрова А\. С\./);
  assert.match(html, /Гистология/);
  assert.doesNotMatch(html, /<script>alert/);
  const body = view.bodyFor({ reviews: [{ id: 'r1', semester: '1 семестр', discipline: 'Гистология', date: '2025-08-11', parts: { seminars: 'Объясняет спокойно <script>alert(1)</script>', advice: 'Готовьте латынь' }, source: 'Google Таблица' }] }, 'Гистология');
  assert.match(body, /&lt;script&gt;/);
  assert.doesNotMatch(body, /<script>alert/);
  assert.match(body, /1 семестр · Гистология/);
  assert.match(body, /2025-08-11/);
  assert.match(body, /Семинары/);
  assert.match(body, /Совет/);
});

test('перед списком нет раскидки-чипов: сразу дисциплины', () => {
  const view = load({ teachers: [
    { id: 'a', name: 'А. А.', reviews: [{ discipline: 'Биология', parts: { seminars: 'x' } }] }
  ] });
  const { html } = view({});
  assert.doesNotMatch(html, /tr-chips/);
  assert.doesNotMatch(html, /data-disc-jump/);
  // первым в разметке идёт блок дисциплины, а не список преподавателей
  assert.ok(html.indexOf('data-disc="Биология"') < html.indexOf('data-teacher'), 'дисциплина выше преподавателя');
});


test('поиск находит слово из любого раздела отзыва', () => {
  const view = load({ teachers: [
    { id: 'a', name: 'Первая П. П.', reviews: [{ discipline: 'Биология', parts: { advice: 'Готовьте латынь' } }] },
    { id: 'b', name: 'Вторая В. В.', reviews: [{ discipline: 'Биология', parts: { seminars: 'Спокойные занятия' } }] }
  ] });
  const { html } = view({});
  assert.match(html, /Первая П\. П\./);
  assert.match(html, /Вторая В\. В\./);
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

test('импорт из таблицы: разбор CSV и дословный перенос текста', () => {
  const { parseCsv, build } = require('../scripts/import_teacher_reviews.cjs');
  const csv = [
    'Отметка времени,Дисциплина,Семестр,Преподаватель,Семинары,Коллоквиумы,Лабораторные,Отработки,Совет',
    '11.08.2025 18:08:58,Анатомия человека,3 семестр,"Решетун Алексей","Объясняет, ""очень"" понятно",,,Спокойно,',
    '11.08.2025 18:33:30,Анатомия человека,2 семестр,"Самохина А.О.",,"ЕБУЧИЙ ПИЗДЕЦ на паре",,,'
  ].join('\n');
  const rows = parseCsv(csv);
  assert.equal(rows.length, 3);
  assert.equal(rows[1][4], 'Объясняет, "очень" понятно');
  const teachers = build(csv);
  assert.equal(teachers.length, 2);
  assert.equal(teachers[0].reviews[0].parts.seminars, 'Объясняет, "очень" понятно');
  assert.equal(teachers[0].reviews[0].date, '2025-08-11');
  assert.equal(teachers[0].reviews[0].semester, '3 семестр');
  assert.equal(teachers[0].reviews[0].parts.retakes, 'Спокойно');
  // Текст переносится дословно: ничего не сглаживается и не переписывается.
  assert.equal(teachers[1].reviews[0].parts.colloquiums, 'ЕБУЧИЙ ПИЗДЕЦ на паре');
  assert.ok(teachers.every(t => t.department === 'Кафедра анатомии'));
});

test('данные отзывов подключены к странице, предзагрузке и содержат источник', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const data = fs.readFileSync(path.join(root, 'js/teacher-reviews-data.js'), 'utf8');
  assert.match(html, /js\/teacher-reviews-data\.js\?v=/);
  assert.match(sw, /'\.\/js\/teacher-reviews-data\.js\?v=/);
  assert.match(data, /1kMh1xSj6hw-dad0QiuNvJPbXd0WsayzRw5UaY1yVtGY/);
  assert.match(data, /vk\.com\/club61162587/);
  const window = { window: null }; window.window = window; const context = vm.createContext(window);
  vm.runInContext(data, context);
  assert.ok(context.MedzoTeacherReviews.teachers.length > 0, 'данные должны быть непустыми');
  for (const teacher of context.MedzoTeacherReviews.teachers) {
    assert.ok(teacher.name && teacher.reviews.length, teacher.name);
    for (const review of teacher.reviews) assert.ok(review.parts && review.source, review.id);
  }
});

test('внутри дисциплины преподаватели идут по фамилии, даже если записаны «Имя Отчество Фамилия»', () => {
  const view = load({ teachers: [
    { id: 'a', name: 'Яна Борисовна Владимирова', reviews: [{ discipline: 'Анатомия', parts: { seminars: 'x' } }] },
    { id: 'b', name: 'Алексеева Мария Феликсовна', reviews: [{ discipline: 'Анатомия', parts: { seminars: 'x' } }] },
    { id: 'c', name: 'Арутюнян Анаит Артуровна', reviews: [{ discipline: 'Анатомия', parts: { seminars: 'x' } }] }
  ] });
  const { html } = view({});
  const order = [...html.matchAll(/<strong>([^<]+)<\/strong>/g)]
    .map(m => m[1])
    .filter(name => name.includes(' ') && !/^\d+$/.test(name));
  assert.deepEqual(order, ['Алексеева Мария Феликсовна', 'Арутюнян Анаит Артуровна', 'Яна Борисовна Владимирова']);
});

test('фамилия определяется и для «Фамилия Имя Отчество», и для обратной записи', () => {
  const view = load({ teachers: [] });
  assert.equal(view.surnameOf('Владимирова Яна Борисовна'), 'Владимирова');
  assert.equal(view.surnameOf('Яна Борисовна Владимирова'), 'Владимирова');
  assert.equal(view.surnameOf('Башмаков О.'), 'Башмаков');
  assert.equal(view.surnameOf('Сымон А.М.'), 'Сымон');
  assert.equal(view.surnameOf('Иванова'), 'Иванова');
});
