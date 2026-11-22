/* Импорт отзывов о преподавателях из выгрузки Google Таблицы (CSV).
   Запуск: node scripts/import_teacher_reviews.cjs путь/к/отзывам.csv [--check]
   Пишет js/teacher-reviews-data.js — единственный источник данных раздела.
   Скрипт ничего не выдумывает: пустые ячейки остаются пустыми, порядок строк
   сохраняется, источник у каждого отзыва один и тот же. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const COLUMNS = {
  date: 0, discipline: 1, semester: 2, teacher: 3,
  seminars: 4, colloquiums: 5, labs: 6, retakes: 7, advice: 8
};
// Текст переносится дословно. Меняются только технические артефакты выгрузки:
// двойные пробелы, служебные переводы строки внутри ячейки и экранирование
// Google Таблиц (обратный слэш перед дефисом). Смысл и лексика не правятся.
const clean = text => String(text || '')
  .replace(/\\-/g, '-')
  .replace(/\r\n?/g, '\n')
  .replace(/[ \t]+/g, ' ')
  .replace(/ *\n */g, '\n')
  .trim();

function parseCsv(raw) {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (quoted) {
      if (ch === '"' && raw[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(cell => String(cell).trim()));
}

const cell = (row, index) => clean(row[index] || '').replace(/^\\?-?\s*/, '');
const slug = value => value.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, '-').replace(/^-|-$/g, '');

function build(raw) {
  const rows = parseCsv(raw);
  const body = rows.slice(1);                     // первая строка — заголовки анкеты
  const teachers = new Map();
  let date = '';
  for (const row of body) {
    const name = cell(row, COLUMNS.teacher);
    if (!name) continue;
    const stamp = clean(row[COLUMNS.date]);
    const parsed = (stamp.match(/^(\d{2})\.(\d{2})\.(\d{4})/) || []);
    if (parsed.length) date = parsed[3] + '-' + parsed[2] + '-' + parsed[1];
    const key = slug(name);
    if (!teachers.has(key)) teachers.set(key, { id: key, name, subjects: [], reviews: [] });
    const teacher = teachers.get(key);
    const discipline = cell(row, COLUMNS.discipline);
    if (discipline && !teacher.subjects.includes(discipline)) teacher.subjects.push(discipline);
    const parts = {
      seminars: cell(row, COLUMNS.seminars),
      colloquiums: cell(row, COLUMNS.colloquiums),
      labs: cell(row, COLUMNS.labs),
      retakes: cell(row, COLUMNS.retakes),
      advice: cell(row, COLUMNS.advice)
    };
    if (!Object.values(parts).some(Boolean)) continue;
    teacher.reviews.push({
      id: key + '-r' + (teacher.reviews.length + 1),
      date, discipline, semester: cell(row, COLUMNS.semester), parts,
      source: 'Google Таблица · Отзывы (1-3 курс)', url: SHEET_URL
    });
  }
  return [...teachers.values()]
    .filter(t => t.reviews.length)
    .map(t => Object.assign(t, {
      department: t.subjects.includes('Анатомия человека') ? 'Кафедра анатомии' : 'Другие кафедры',
      subject: t.subjects[0] || ''
    }));
}

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1kMh1xSj6hw-dad0QiuNvJPbXd0WsayzRw5UaY1yVtGY/edit?gid=11830504';
const output = {
  updated: new Date().toISOString().slice(0, 10),
  sources: [
    { label: 'Google Таблица · Отзывы (1-3 курс)', url: SHEET_URL },
    { label: 'VK · Отзывы о преподавателях', url: 'https://vk.com/club61162587' }
  ]
};
const api = { parseCsv, build, clean, output, SHEET_URL };
if (typeof module !== 'undefined' && module.exports) module.exports = api;

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('Укажите путь к CSV: node scripts/import_teacher_reviews.cjs отзывы.csv'); process.exit(1); }
  const teachers = build(fs.readFileSync(file, 'utf8'));
  const reviews = teachers.reduce((n, t) => n + t.reviews.length, 0);
  // Один JSON.stringify в одну строку — это строка на 1.2 МБ: gzip её почти не жмёт
  // и редактор на ней зависает. Поэтому пишем массив по одному отзыву на строку.
  const json = JSON.stringify({ ...output, teachers }, null, 1)
    .split('\n').map(line => line.replace(/\s+$/, '')).join('\n');
  const body = "/* Сгенерировано scripts/import_teacher_reviews.cjs — правки вручную затрутся.\n   Источник: " + SHEET_URL + ' */\nwindow.MedzoTeacherReviews = ' + json + ';\n';
  fs.writeFileSync(path.join(__dirname, '..', 'js', 'teacher-reviews-data.js'), body);
  console.log('преподавателей: ' + teachers.length + ', отзывов: ' + reviews + ' → js/teacher-reviews-data.js');
}
