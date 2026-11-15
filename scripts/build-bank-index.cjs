/* Генерирует js/data/bank-index.js и js/data/bank-questions.js.
   Запуск: node scripts/build-bank-index.cjs
   Запускать после правки любой базы: по этим файлам приложение узнаёт
   число вопросов и существующие номера, пока сама база ещё не загружена. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const DATA = path.join(root, 'js', 'data');

// Какая база из каких файлов собирается и где лежит её объект.
const BANKS = {
  '1': { files: ['questions.js', 'answers.js'], pick: 'window' },
  '2': { files: ['colloquium-2.js'], pick: 'COLLOQUIUM_2' },
  '3': { files: ['colloquium-3.js'], pick: 'COLLOQUIUM_3' },
  '4': { files: ['colloquium-4.js'], pick: 'COLLOQUIUM_4' },
  '5': { files: ['colloquium-5.js'], pick: 'COLLOQUIUM_5' },
  '6': { files: ['colloquium-6.js'], pick: 'COLLOQUIUM_6' },
  '7': { files: ['colloquium-7.js'], pick: 'COLLOQUIUM_7' },
  'credit-1': { files: ['credit-1.js'], pick: 'CREDIT_1' },
  'credit-2': { files: ['credit-2.js'], pick: 'CREDIT_2' },
  'stom-2': { files: ['dental-2.js'], pick: 'DENTAL_2' },
  'stom-3': { files: ['dental-3.js'], pick: 'DENTAL_3' },
};

function readBank(id) {
  const bank = BANKS[id];
  const context = vm.createContext({ window: {}, console });
  for (const file of bank.files) {
    const full = path.join(DATA, file);
    if (!fs.existsSync(full)) throw new Error('нет файла ' + file);
    vm.runInContext(fs.readFileSync(full, 'utf8'), context, { filename: file });
  }
  const data = bank.pick === 'window'
    ? { questions: context.window.QUESTIONS, answers: context.window.ANSWER_KEY, topics: context.window.TOPICS }
    : context.window[bank.pick];
  if (!data || !Array.isArray(data.questions)) throw new Error('в базе ' + id + ' нет вопросов');
  return data;
}

const index = {};
const questions = {};
for (const id of Object.keys(BANKS)) {
  const data = readBank(id);
  index[id] = {
    questions: data.questions.length,
    keyed: data.answers ? Object.keys(data.answers).length : 0,
    topics: [...new Set(data.questions.map((q) => String(q.topic)))],
    // Заголовки тем: портфель показывает их, пока база ещё не загружена.
    topicTitles: Object.fromEntries((data.topics || []).map((t) => [t.id, t.title])),
  };
  // Номера по порядку и номера, сгруппированные по темам: компактно и без повторов.
  // Номер может быть строкой («58а»), поэтому он остаётся как есть.
  const byTopic = {};
  data.questions.forEach((q) => {
    const topic = String(q.topic);
    (byTopic[topic] = byTopic[topic] || []).push(q.num);
  });
  questions[id] = { nums: data.questions.map((q) => q.num), topics: byTopic };
}

const header = (title, note) =>
  '/* ' + title + '\n' +
  '   ' + note + '\n' +
  '   Файл генерируется: node scripts/build-bank-index.cjs */\n';
const body = (name, value) => 'window.' + name + ' = ' + JSON.stringify(value, null, 2) + ';\n';

fs.writeFileSync(
  path.join(DATA, 'bank-index.js'),
  header('Метаданные баз для ленивой загрузки.',
    'questions — число вопросов, keyed — сколько пришло с ключом, topics — темы базы.') +
  body('MEDZO_BANK_INDEX', index)
);
fs.writeFileSync(
  path.join(DATA, 'bank-questions.js'),
  header('Номера и темы вопросов каждой базы.',
    'Нужны портфелю и достижениям, когда сама база ещё не загружена.') +
  'window.MEDZO_BANK_QUESTIONS = ' + JSON.stringify(questions) + ';\n'
);

console.log('bank-index.js и bank-questions.js обновлены:');
for (const id of Object.keys(index)) {
  console.log('  ' + id.padEnd(9) + index[id].questions + ' вопросов, ключей ' + index[id].keyed);
}
