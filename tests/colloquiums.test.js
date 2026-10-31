const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scripts = ['js/data/questions.js', 'js/data/answers.js', 'js/data/exam.js',
  'js/data/colloquium-2.js', 'js/data/colloquium-3.js', 'js/data/colloquium-4.js', 'js/data/colloquium-5.js', 'js/data/colloquium-6.js', 'js/data/colloquium-7.js', 'js/data/credit-1.js', 'js/data/credit-2.js', 'js/data/dental-2.js', 'js/data/dental-3.js', 'js/modules.js',
  'js/core.js', 'js/ui.js', 'js/views-study.js', 'js/views-pages.js'];

function app(storage, selected) {
  if (selected) storage['anatomy-colloquium-selected'] = selected;
  const context = vm.createContext({ window: {}, console, setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage: { getItem: (k) => storage[k] || null, setItem: (k, v) => { storage[k] = v; } } });
  for (const file of scripts) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  return context.window.AT;
}

test('во всех коллоквиумах загружены вопросы, темы и ключи', () => {
  const storage = {};
  for (const [id, count] of [['1', 211], ['2', 188], ['3', 254], ['4', 257], ['5', 161], ['6', 118], ['7', 209], ['credit-1', 245], ['credit-2', 297]]) {
    const AT = app(storage, id);
    assert.equal(AT.colloquium.id, id);
    assert.equal(AT.dataset.total, count);
    assert.equal(AT.keyApi.count(), count);
    assert.equal(new Set(AT.dataset.questions.map((q) => q.id)).size, count);
    for (const q of AT.dataset.questions) {
      assert.ok(q.text && q.options.length >= 2);
      assert.ok(AT.dataset.topics.some((t) => t.id === q.topic));
      const key = AT.keyApi.forQuestion(q).answers;
      assert.ok(key.length && key.every((value) => value >= 1 && value <= q.options.length));
      assert.equal(AT.gradeQuestion(q, key).correct, true);
    }
    for (const view of ['dashboard', 'trainSetup', 'examSetup', 'mistakes', 'stats', 'key', 'settings']) {
      assert.ok(AT.views[view]().html, view + ' for ' + id);
    }
  }
});

test('в первом коллоквиуме экзамен по схеме; в других пока недоступен', () => {
  const storage = {};
  let AT = app(storage, '1');
  assert.match(AT.views.examSetup().html, /20 вопросов за 20 минут/);
  assert.equal(AT.buildExam().ids.length, 20);
  for (const id of ['2', '3', '4', '5', '6', '7', 'credit-1', 'credit-2', 'stom-2', 'stom-3']) {
    AT = app(storage, id);
    const html = AT.views.examSetup().html;
    assert.match(html, /Скоро добавится/);
    assert.doesNotMatch(html, /data-action="start-exam"/);
  }
});

test('прогресс, ключи и незаконченные сессии раздельны, включая прежнее сохранение', () => {
  const storage = {};
  let AT = app(storage, '1');
  AT.recordAttempt(AT.dataset.questions[0], true, [1]);
  AT.startSession({ mode: 'train', ids: ['q1'] });
  AT.keyApi.set(AT.dataset.questions[0], [3]);
  AT.save(true);
  assert.ok(storage['anatomy-colloquium-v1']);
  AT = app(storage, '2');
  assert.equal(AT.progressOf('q1').attempts, 0);
  assert.equal(AT.currentSession(), null);
  assert.equal(AT.keyApi.forQuestion(AT.dataset.questions[0]).source, 'base');
  AT.recordAttempt(AT.dataset.questions[0], false, [1]);
  AT.startSession({ mode: 'train', ids: ['q2'] });
  AT.save(true);
  AT = app(storage, '3');
  assert.equal(AT.progressOf('q1').attempts, 0);
  assert.equal(AT.currentSession(), null);
  AT = app(storage, '1');
  assert.equal(AT.progressOf('q1').correct, 1);
  assert.equal(AT.currentSession().ids[0], 'q1');
  assert.deepEqual(Array.from(AT.keyApi.forQuestion(AT.dataset.questions[0]).answers), [3]);
  AT = app(storage, '2');
  assert.equal(AT.progressOf('q1').wrong, 1);
  assert.equal(AT.currentSession().ids[0], 'q2');
});

test('в спланхнологии шестой вариант отображается и проверяется', () => {
  const AT = app({}, '3');
  const q = AT.dataset.byNum.get('49');
  assert.equal(q.options.length, 6);
  assert.ok(AT.keyApi.forQuestion(q).answers.includes(6));
  const html = AT.views.questionCard({ mode: 'train' }, q, { selected: [], revealed: false });
  assert.match(html, /data-index="6"/);
  assert.match(html, /<kbd>6<\/kbd>/);
});

test('проверенная попытка в тренировке записывается только один раз', () => {
  const AT = app({}, '2');
  const q = AT.dataset.questions[0];
  const session = AT.startSession({ mode: 'train', ids: [q.id] });
  const selected = AT.keyApi.forQuestion(q).answers;
  session.results[q.id] = { selected, correct: true, revealed: true };
  AT.recordAttempt(q, true, selected);
  AT.gradeSession(session);
  AT.finishSession();
  assert.equal(AT.progressOf(q.id).attempts, 1);
  assert.equal(AT.progressOf(q.id).correct, 1);
  assert.equal(AT.sessionStats(session).correct, 1);
});

test('в шапке флаг, подпись АРМ РНИМУ и выбор коллоквиума', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /class="brand__flag"/);
  assert.match(html, /АРМ РНИМУ<\/strong>\s*<span>Анатомия<\/span>/);
  assert.match(html, /<select id="colloquiumSelect"/);
  for (const [id, name] of [['1', 'Остеология'], ['2', 'Миология'], ['3', 'Спланхнология']]) {
    assert.match(html, new RegExp('<option value="' + id + '">' + id + ' · ' + name + '</option>'));
  }
  assert.doesNotMatch(html, /class="colloquium-nav"/);
  assert.doesNotMatch(app({}, '1').views.dashboard().html, /colloquium-card/);
});


test('стоматологические базы загружены отдельно и без выдуманного ключа', () => {
  for (const [id, count, title] of [['stom-2', 102, 'Спланхнология'], ['stom-3', 132, 'Ангионеврология']]) {
    const AT = app({}, id);
    assert.equal(AT.colloquium.name, title);
    assert.equal(AT.colloquium.faculty, 'Стоматологический факультет');
    assert.equal(AT.dataset.total, count);
    assert.equal(AT.keyApi.count(), 0);
    assert.equal(new Set(AT.dataset.questions.map((q) => q.id)).size, count);
    for (const [i, q] of AT.dataset.questions.entries()) {
      assert.equal(q.num, i + 1);
      assert.equal(q.options.length, 5);
      assert.ok(q.text && q.sourcePage && q.sourceNumber);
      assert.ok(AT.dataset.topics.some((topic) => topic.id === q.topic));
      assert.equal(AT.keyApi.forQuestion(q), null);
    }
    assert.match(AT.views.dashboard().html, /Стоматологический факультет/);
    assert.match(AT.views.trainSetup().html, /без ключа/);
    assert.match(AT.views.key().html, /Ключ ответов пока не предоставлен/);
    assert.match(AT.views.settings().html, /предоставлена без ключа/);
    assert.doesNotMatch(AT.views.key().html, /Ключ уже заполнен по базе теста/);
    assert.match(AT.views.questionCard({ mode: 'train' }, AT.dataset.questions[0], {selected: [], revealed: false}), /PDF: стр\. 1, № 1/);
  }
  const AT = app({}, 'stom-3');
  assert.match(AT.dataset.byNum.get('28').options[1], /предсердно-желудочковое отверстие/);
  assert.match(AT.dataset.questions[131].text, /иннервацию сердца/);
});

test('ключи и прогресс стоматологической базы изолированы от основных баз', () => {
  const storage = {};
  let AT = app(storage, 'stom-2');
  const q = AT.dataset.questions[0];
  AT.keyApi.set(q, [1, 3]);
  AT.recordAttempt(q, true, [1, 3]);
  AT.startSession({mode: 'train', ids: ['q1']});
  AT.save(true);
  assert.ok(storage['anatomy-colloquium-v1-stom-2']);
  AT = app(storage, 'stom-3');
  assert.equal(AT.keyApi.count(), 0);
  assert.equal(AT.progressOf('q1').attempts, 0);
  assert.equal(AT.currentSession(), null);
  AT = app(storage, '2');
  assert.equal(AT.progressOf('q1').attempts, 0);
  assert.equal(AT.keyApi.forQuestion(AT.dataset.questions[0]).source, 'base');
  AT = app(storage, 'stom-2');
  assert.equal(AT.progressOf('q1').correct, 1);
  assert.deepEqual(Array.from(AT.keyApi.forQuestion(AT.dataset.questions[0]).answers), [1, 3]);
  assert.equal(AT.currentSession().ids[0], 'q1');
});

test('самооценка: неоценённые вопросы не считаются ошибками', () => {
  const AT = app({}, 'stom-2');
  const session = AT.startSession({mode: 'train', ids: ['q1', 'q2']});
  session.results.q1 = {selected: [1], correct: null, revealed: true, self: false};
  session.results.q2 = {selected: [2], correct: true, revealed: true, self: true};
  AT.recordAttempt(AT.dataset.byId.get('q2'), true, [2]);
  AT.gradeSession(session);
  AT.finishSession();
  const html = AT.views.summary().html;
  assert.match(html, /1 из 1 оценённых вопросов верно/);
  assert.match(html, /без оценки: 1/);
  assert.match(html, /Ошибки<\/span><strong class="stat-card__value">0<\/strong>/);
  assert.equal(AT.sessionStats(session).wrong, 0);
});

test('в подвале есть контакты для сообщения об ошибке', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /Нашли ошибку\?/);
  assert.match(html, /href="https:\/\/t\.me\/D1sklay">@D1sklay<\/a>/);
  assert.match(html, /href="mailto:davidka\.khachatryan\.00@gmail\.com">davidka\.khachatryan\.00@gmail\.com<\/a>/);
});


test('семестры, зачёты и четвёртый коллоквиум сохраняют отдельные базы', () => {
  const storage = {};
  for (const [id, semester, kind] of [['1', 1, undefined], ['2', 1, undefined], ['credit-1', 1, 'credit'], ['3', 2, undefined], ['4', 2, undefined], ['credit-2', 2, 'credit']]) {
    const AT = app(storage, id);
    assert.equal(AT.colloquium.semester, semester);
    assert.equal(AT.colloquium.kind, kind);
    assert.match(AT.views.dashboard().html, new RegExp(semester + ' семестр'));
    if (kind === 'credit') {
      assert.match(AT.views.dashboard().html, /Тренажёр к зачёту/);
      assert.match(AT.views.examSetup().html, /Формат пробного зачёта пока не определён/);
      assert.match(AT.views.settings().html, /Зачёт/);
    }
    if (['4', 'credit-1', 'credit-2'].includes(id)) {
      AT.recordAttempt(AT.dataset.questions[0], true, [1]);
      AT.save(true);
      assert.ok(storage['anatomy-colloquium-v1-' + id]);
    }
  }
  assert.equal(app(storage, '3').progressOf('q1').attempts, 0);
  for (const id of ['4', 'credit-1', 'credit-2']) assert.equal(app(storage, id).progressOf('q1').attempts, 1);
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /optgroup label="1 семестр"[\s\S]*value="1"[\s\S]*value="2"[\s\S]*value="credit-1"/);
  assert.match(html, /optgroup label="2 семестр"[\s\S]*value="3"[\s\S]*value="4"[\s\S]*value="credit-2"/);
  assert.match(html, /id="courseSidebar"/);
});

test('новые PDF перенесены целиком с подсветкой и исходной нумерацией', () => {
  for (const [id, count, firstText, key] of [
    ['4', 257, 'Верхняя граница спинного мозга', [1, 3]],
    ['credit-1', 245, 'В строении тела человека', [1, 2]],
    ['credit-2', 297, 'Нижняя стенка ротовой полости', [4, 5]],
  ]) {
    const AT = app({}, id);
    assert.equal(AT.dataset.total, count);
    assert.ok(AT.dataset.questions[0].text.startsWith(firstText));
    assert.deepEqual(Array.from(AT.keyApi.forQuestion(AT.dataset.questions[0]).answers), key);
    for (const [index, question] of AT.dataset.questions.entries()) {
      assert.equal(question.num, index + 1);
      assert.equal(question.options.length, 5);
      assert.ok(AT.keyApi.forQuestion(question).answers.length);
    }
    assert.ok(AT.dataset.topics.every(topic => AT.dataset.topicQuestions(topic.id).length));
  }
});

test('кнопка тренировки на главной зачёта выделена отдельным цветом', () => {
  for (const id of ['credit-1', 'credit-2']) {
    const html = app({}, id).views.dashboard().html;
    assert.match(html, /href="#\/train" class="btn btn--primary btn--lg btn--credit"/);
    assert.match(html, /href="#\/exam" class="btn btn--ghost btn--lg"/);
  }
  for (const id of ['1', '2', '3', '4', 'stom-2', 'stom-3']) {
    assert.doesNotMatch(app({}, id).views.dashboard().html, /btn--credit/);
  }
});

test('сине-индиговое оформление блока применяется только к зачётам', () => {
  for (const id of ['credit-1', 'credit-2']) {
    assert.match(app({}, id).views.dashboard().html, /<section class="hero hero--credit">/);
  }
  for (const id of ['1', '2', '3', '4', 'stom-2', 'stom-3']) {
    assert.doesNotMatch(app({}, id).views.dashboard().html, /hero--credit/);
  }
});

test('ПНС — шестой коллоквиум третьего семестра, ЦНС остаётся во втором', () => {
  const AT = app({}, '6');
  assert.equal(AT.colloquium.semester, 3); assert.equal(AT.colloquium.id, '6');
  assert.equal(AT.colloquium.name, 'Периферическая нервная система');
  assert.equal(AT.colloquium.examAvailable, false);
  assert.equal(AT.dataset.total, 118); assert.equal(AT.keyApi.count(), 118);
  assert.match(AT.views.dashboard().html, /3 семестр · Коллоквиум 6/);
  assert.match(AT.views.examSetup().html, /Скоро добавится/);
  assert.match(AT.views.key().html, /отмечены в PDF галочками/);
  assert.match(AT.views.settings().html, /отмеченные в PDF галочками/);
  assert.equal(app({}, '4').colloquium.semester, 2);
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(index, /optgroup label="3 семестр"\s*>\s*<option value="5"[^>]*>[\s\S]*?<option value="6"/);
  assert.doesNotMatch(index, /Первый курс/i);
});

test('ПНС: все варианты и отмеченные ключи перенесены по порядку колонок и страниц', () => {
  const AT = app({}, '6');
  for (const [i, q] of AT.dataset.questions.entries()) {
    assert.equal(q.num, i + 1); assert.equal(q.id, 'q' + (i + 1));
    assert.equal(q.options.length, 5); assert.ok(q.text.length > 8);
    assert.equal(q.sourceNumber, q.num);
    assert.equal(q.sourcePage, q.num <= 32 ? 1 : q.num <= 62 ? 2 : q.num <= 87 ? 3 : q.num <= 113 ? 4 : 5);
    assert.ok(q.options.every(o => o.length && !o.includes('✓') && !o.includes('|')));
    assert.ok(AT.keyApi.has(q));
  }
  for (const [num, key] of [[1,[1,2,3,4]], [6,[2]], [16,[1,2,3]], [17,[1]], [32,[1,2]], [47,[1,2,3,4]], [62,[1,2]], [71,[1,2,3]], [74,[1,2,3,4]], [88,[1,2]], [100,[1,2]], [113,[1,2,3,4]], [118,[1]]]) {
    assert.deepEqual(Array.from(AT.keyApi.forQuestion(AT.dataset.byNum.get(String(num))).answers), key, '№' + num);
  }
  assert.ok(AT.dataset.topics.every(t => AT.dataset.topicQuestions(t.id).length));
  assert.equal(AT.pickQuestions({topicIds:['autonomic-general'],scope:'all',limit:0}).length, 17);
});

test('ПНС сохраняет свой прогресс, избранное и ключ отдельно от остальных баз', () => {
  const storage = {};
  let AT = app(storage, '4');
  AT.recordAttempt(AT.dataset.questions[0], true, [1]); AT.save(true);
  AT = app(storage, '6'); const q = AT.dataset.questions[0];
  assert.equal(AT.progressOf(q.id).attempts, 0);
  AT.recordAttempt(q, false, [5]); AT.keyApi.set(q, [2]);
  AT.annotations.toggleFavorite(q.id); AT.annotations.setComment(q.id, 'ПНС');
  AT.startSession({mode:'train', ids:[q.id]}); AT.save(true);
  AT = app(storage, '4'); assert.equal(AT.progressOf('q1').correct, 1);
  assert.equal(AT.keyApi.forQuestion(AT.dataset.questions[0]).source, 'base');
  assert.equal(AT.portfolio.allFavorites().some(g => g.module.id === '6' && g.questions.some(i => i.question.id === 'q1' && i.comment === 'ПНС')), true);
  AT = app(storage, '6');
  assert.equal(AT.progressOf('q1').wrong, 1);
  assert.deepEqual(Array.from(AT.keyApi.forQuestion(AT.dataset.questions[0]).answers), [2]);
  assert.equal(AT.currentSession().ids[0], 'q1');
  assert.ok(storage['anatomy-colloquium-v1-6']);
});

test('эстезиология и черепные нервы — пятый коллоквиум третьего семестра', () => {
  const AT = app({}, '5');
  assert.equal(AT.colloquium.semester, 3); assert.equal(AT.colloquium.id, '5');
  assert.equal(AT.colloquium.name, 'Эстезиология и черепные нервы');
  assert.equal(AT.dataset.total, 161); assert.equal(AT.keyApi.count(), 161);
  assert.match(AT.views.dashboard().html, /3 семестр · Коллоквиум 5/);
  assert.match(AT.views.examSetup().html, /Скоро добавится/);
  assert.match(AT.views.key().html, /в вопросе № 15 второй вариант выделен зелёным/i);
  assert.ok(AT.dataset.topics.every(t => AT.dataset.topicQuestions(t.id).length));
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(index, /optgroup label="3 семестр"[\s\S]*?value="5"[\s\S]*?value="6"/);
});

test('пятый коллоквиум: 161 вопрос с пятью вариантами, исходными номерами и ключом по зелёным отметкам', () => {
  const AT = app({}, '5');
  for (const [i, q] of AT.dataset.questions.entries()) {
    assert.equal(q.num, i + 1); assert.equal(q.id, 'q' + (i + 1));
    assert.equal(q.sourceNumber, i + 1); assert.ok(q.sourcePage >= 2 && q.sourcePage <= 64);
    assert.ok(q.text && q.options.length === 5 && q.options.every(Boolean));
    const key = AT.keyApi.forQuestion(q).answers;
    assert.ok(key.length && key.every(n => n >= 1 && n <= 5));
    assert.equal(AT.gradeQuestion(q, key).correct, true);
  }
  for (const [num, key] of [[1,[1]], [2,[1,2]], [3,[1,2]], [15,[1,2,3,4]], [16,[1]], [18,[1,2]], [25,[1]], [47,[1,2,3]], [63,[1,2,3]], [79,[1,2]], [86,[3]], [133,[1,2,3]], [160,[1,2,3]], [161,[1,2,3,5]]]) {
    assert.deepEqual(Array.from(AT.keyApi.forQuestion(AT.dataset.byNum.get(String(num))).answers), key, '№ ' + num);
  }
  const q25 = AT.dataset.byNum.get('25');
  assert.equal(q25.options[0], 'глазодвигательным нервом (n. oculomotorius)');
  assert.equal(AT.dataset.byNum.get('16').sourcePage, 7); // варианты на следующей странице
  assert.equal(AT.dataset.byNum.get('161').sourcePage, 64);
});

test('эстезиология и ПНС: разные сохранения, заметки, ключи и незавершённые тренировки', () => {
  const storage = {}; let AT = app(storage, '6');
  AT.recordAttempt(AT.dataset.questions[0], true, [1]); AT.save(true);
  AT = app(storage, '5'); const q = AT.dataset.questions[0];
  assert.equal(AT.progressOf(q.id).attempts, 0);
  AT.recordAttempt(q, false, [5]); AT.keyApi.set(q, [2]);
  AT.annotations.toggleFavorite(q.id); AT.annotations.setComment(q.id, 'Заметка');
  AT.startSession({mode:'train', ids:[q.id]}); AT.save(true);
  AT = app(storage, '6'); assert.equal(AT.progressOf('q1').correct, 1);
  const group = AT.portfolio.allFavorites().find(g => g.module.id === '5');
  assert.equal(group.questions[0].question.id, 'q1'); assert.equal(group.questions[0].comment, 'Заметка');
  AT = app(storage, '5'); assert.equal(AT.progressOf('q1').wrong, 1);
  assert.deepEqual(Array.from(AT.keyApi.forQuestion(AT.dataset.questions[0]).answers), [2]);
  assert.equal(AT.currentSession().ids[0], 'q1');
  assert.ok(storage['anatomy-colloquium-v1-5']);
});

test('ССС — седьмой коллоквиум третьего семестра, все вопросы и отмеченные ответы на месте', () => {
  const AT = app({}, '7');
  assert.equal(AT.colloquium.semester, 3); assert.equal(AT.colloquium.id, '7');
  assert.equal(AT.colloquium.name, 'Сердечно-сосудистая система');
  assert.equal(AT.dataset.total, 209); assert.equal(AT.keyApi.count(), 209);
  assert.match(AT.views.dashboard().html, /3 семестр · Коллоквиум 7/);
  assert.match(AT.views.examSetup().html, /Скоро добавится/);
  assert.match(AT.views.key().html, /отмечены в PDF подсветкой/);
  assert.ok(AT.dataset.topics.every(t => AT.dataset.topicQuestions(t.id).length));
  for (const [i,q] of AT.dataset.questions.entries()) {
    assert.equal(q.id, 'q' + (i + 1)); assert.equal(q.num, i + 1);
    assert.equal(q.sourceNumber, q.num); assert.ok(q.sourcePage >= 1 && q.sourcePage <= 60);
    assert.ok(q.text && q.options.length === 5 && q.options.every(Boolean));
    const key = AT.keyApi.forQuestion(q).answers;
    assert.ok(key.length && key.every(n => n >= 1 && n <= 5));
    assert.equal(AT.gradeQuestion(q, key).correct, true);
  }
  for (const [num,key] of [[1,[1,2,3]], [2,[1,2,3,4]], [7,[1,2,3]], [36,[3,5]], [49,[1,2]], [57,[2,4]], [60,[1,2]], [94,[1,2,3,4]], [130,[1]], [131,[2,3,4]], [136,[1]], [170,[1,2]], [171,[1,3]], [198,[1]], [199,[1,4]], [208,[2,4,5]], [209,[2,3,4]]]) {
    assert.deepEqual(Array.from(AT.keyApi.forQuestion(AT.dataset.byNum.get(String(num))).answers), key, '№ ' + num);
  }
  assert.equal(AT.dataset.byNum.get('7').sourcePage, 2); // варианты продолжаются на следующей странице
  assert.equal(AT.dataset.byNum.get('209').sourcePage, 60);
  const index = fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert.match(index, /optgroup label="3 семестр"[\s\S]*?value="5"[\s\S]*?value="6"[\s\S]*?value="7"/);
});

test('ССС изолирует прогресс, ключ, сессию и избранное от других коллоквиумов', () => {
  const storage = {}; let AT = app(storage, '6');
  AT.recordAttempt(AT.dataset.questions[0], true, [1]); AT.save(true);
  AT = app(storage, '7'); const q = AT.dataset.questions[0];
  assert.equal(AT.progressOf(q.id).attempts, 0);
  AT.recordAttempt(q, false, [5]); AT.keyApi.set(q, [2]);
  AT.annotations.toggleFavorite(q.id); AT.annotations.setComment(q.id, 'ССС');
  AT.startSession({mode:'train', ids:[q.id]}); AT.save(true);
  AT = app(storage, '6'); assert.equal(AT.progressOf('q1').correct, 1);
  const group = AT.portfolio.allFavorites().find(g => g.module.id === '7');
  assert.equal(group.questions[0].question.id, 'q1'); assert.equal(group.questions[0].comment, 'ССС');
  AT = app(storage, '7'); assert.equal(AT.progressOf('q1').wrong, 1);
  assert.deepEqual(Array.from(AT.keyApi.forQuestion(AT.dataset.questions[0]).answers), [2]);
  assert.equal(AT.currentSession().ids[0], 'q1'); assert.ok(storage['anatomy-colloquium-v1-7']);
});
