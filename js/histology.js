/* Изолированная модель тренажёра препаратов. */
(function () {
  'use strict';
  const STORAGE_KEY = 'histology-prototype-v1';
  // Идентификатор и путь не раскрывают название до проверки ответа.
  const slides = [
    { id:'h01', name:'Мазок крови', number:'53', stain:'Азур II — эозин', aliases:['мазок крови', 'мазок крови человека', 'кровь человека'], image:'assets/histology/01-image.webp', review:null, source:'часть 1, страницы 11–13', note:'Обратите внимание на многочисленные эритроциты и встречающиеся среди них лейкоциты.' },
    { id:'h02', name:'Гиалиновая хрящевая ткань', number:'63', stain:'Гематоксилин — эозин', aliases:['гиалиновая хрящевая ткань', 'гиалиновый хрящ', 'гиалиновый хрящ ребра', 'гиалиновая хрящевая ткань поперечный срез ребра'], image:'assets/histology/02-image.webp', review:'assets/histology/02-review.webp', source:'часть 1, страницы 37–38', note:'Ищите хондроциты и их группы в межклеточном веществе; снаружи находится надхрящница.' },
    { id:'h03', name:'Эластическая хрящевая ткань', number:'64', stain:'Орсеин', aliases:['эластическая хрящевая ткань', 'эластический хрящ', 'эластический хрящ ушной раковины', 'эластическая хрящевая ткань срез ушной раковины'], image:'assets/histology/03-image.webp', review:'assets/histology/03-review.webp', source:'часть 1, страницы 45–46', note:'В хряще видны клетки в лакунах; обратите внимание на межклеточное вещество и окраску.' },
    { id:'h04', name:'Пластинчатая костная ткань', number:'67', stain:'По методу Шморля', aliases:['пластинчатая костная ткань', 'тонковолокнистая костная ткань', 'тонковолокнистая пластинчатая костная ткань', 'компактная костная ткань', 'пластинчатая кость'], image:'assets/histology/04-image.webp', review:'assets/histology/04-review.webp', source:'часть 1, страницы 60–63', note:'На поперечном срезе диафиза ищите остеоны и костные пластинки.' },
    { id:'h05', name:'Мозжечок', number:'90', stain:'Гематоксилин — эозин', aliases:['мозжечок', 'кора мозжечка', 'мозжечок окраска гематоксилин эозин'], image:'assets/histology/05-image.webp', review:'assets/histology/05-review.webp', source:'часть 2, страницы 5–6', note:'Обратите внимание на извилины и различимые слои коры мозжечка.' },
    { id:'h06', name:'Пищевод', number:'126', stain:'Гематоксилин — эозин', aliases:['пищевод', 'поперечный срез пищевода', 'пищевод поперечный срез', 'пищевод срез'], image:'assets/histology/06-image.webp', review:'assets/histology/06-review.webp', source:'часть 3, страницы 14–15', note:'Обратите внимание на складки слизистой, эпителий и железы в подслизистой основе.' },
  ];
  // Новые позиции вручную сопоставлены с заголовками и снимками исходного сборника.
  slides.push(...[
  {
    "id": "p40",
    "name": "Туловищная и амниотическая складки зародыша курицы",
    "number": "40",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "зародыш курицы поперечный срез",
      "туловищная и амниотическая складка зародыша курицы"
    ],
    "image": "assets/histology/p40-image.webp",
    "review": "assets/histology/p40-review.webp",
    "source": "часть 1, страницы 8–9",
    "note": "Поперечный срез зародыша; обратите внимание на нервную трубку и зародышевые оболочки."
  },
  {
    "id": "p62",
    "name": "Сухожилие: продольный срез",
    "number": "62",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "сухожилие продольный срез",
      "продольный срез сухожилия",
      "плотная оформленная соединительная ткань продольный срез"
    ],
    "image": "assets/histology/p62-image.webp",
    "review": null,
    "source": "часть 1, страницы 28–29",
    "note": "Пучки коллагеновых волокон расположены преимущественно параллельно."
  },
  {
    "id": "p65",
    "name": "Волокнистая хрящевая ткань",
    "number": "65",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "волокнистый хрящ",
      "волокнистая хрящевая ткань",
      "хрящ межпозвоночного диска"
    ],
    "image": "assets/histology/p65-image.webp",
    "review": "assets/histology/p65-review.webp",
    "source": "часть 1, страницы 55–57",
    "note": "В срезе межпозвоночного диска видны волокнистые пучки и хрящевые клетки."
  },
  {
    "id": "p68",
    "name": "Развитие кости: прямой остеогенез",
    "number": "68",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "прямой остеогенез",
      "развитие кости из мезенхимы",
      "развитие кости прямой остеогенез"
    ],
    "image": "assets/histology/p68-image.webp",
    "review": "assets/histology/p68-review.webp",
    "source": "часть 1, страницы 72–75",
    "note": "Обратите внимание на формирующиеся костные балки и окружающие их клетки."
  },
  {
    "id": "p85",
    "name": "Спинномозговой узел",
    "number": "85",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "спинномозговой узел",
      "спинальный ганглий",
      "спинальный узел",
      "сенсорный узел"
    ],
    "image": "assets/histology/p85-image.webp",
    "review": "assets/histology/p85-review.webp",
    "source": "часть 1, страницы 86–90",
    "note": "Ищите крупные тела нейронов и окружающие их клетки."
  },
  {
    "id": "p86a",
    "name": "Спинной мозг: поперечный срез",
    "number": "86а",
    "stain": "Импрегнация солями серебра",
    "aliases": [
      "спинной мозг",
      "поперечный срез спинного мозга",
      "спинной мозг поперечный срез"
    ],
    "image": "assets/histology/p86a-image.webp",
    "review": "assets/histology/p86a-review.webp",
    "source": "часть 1, страницы 91–94",
    "note": "Сопоставьте центральное серое вещество и окружающее белое вещество."
  },
  {
    "id": "p92",
    "name": "Кора большого мозга",
    "number": "92а (в указателе — 92)",
    "stain": "Импрегнация солями серебра",
    "aliases": [
      "кора большого мозга",
      "неокортекс",
      "кора больших полушарий",
      "кора головного мозга"
    ],
    "image": "assets/histology/p92-image.webp",
    "review": null,
    "source": "часть 2, страницы 9–10",
    "note": "Окраска позволяет рассмотреть нервную ткань коры."
  },
  {
    "id": "p93",
    "name": "Роговица глаза",
    "number": "93",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "роговица",
      "роговица глаза"
    ],
    "image": "assets/histology/p93-image.webp",
    "review": null,
    "source": "часть 2, страницы 13–14",
    "note": "Обратите внимание на эпителий и собственное вещество роговицы."
  },
  {
    "id": "p95",
    "name": "Задняя стенка глаза",
    "number": "95",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "задняя стенка глаза",
      "задняя стенка глазного яблока"
    ],
    "image": "assets/histology/p95-image.webp",
    "review": null,
    "source": "часть 2, страницы 16–18",
    "note": "Сопоставьте оболочки глаза и слоистую сетчатку."
  },
  {
    "id": "p96",
    "name": "Улитка внутреннего уха",
    "number": "96",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "улитка внутреннего уха",
      "улитка",
      "улитка аксиальный срез",
      "улитка внутреннего уха осевой срез"
    ],
    "image": "assets/histology/p96-image.webp",
    "review": null,
    "source": "часть 2, страницы 22–23",
    "note": "На осевом срезе видны витки улитки."
  },
  {
    "id": "p102",
    "name": "Сосудисто-нервный пучок",
    "number": "102",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "сосудисто нервный пучок",
      "артерия вена и нерв",
      "сосудисто нервный пучок поперечный срез"
    ],
    "image": "assets/histology/p102-image.webp",
    "review": "assets/histology/p102-review.webp",
    "source": "часть 2, страницы 33–34",
    "note": "Сопоставьте просвет и толщину стенок сосудов с расположенным рядом нервом."
  },
  {
    "id": "p107",
    "name": "Стенка сердца",
    "number": "107",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "стенка сердца",
      "сердце",
      "поперечный срез стенки сердца"
    ],
    "image": "assets/histology/p107-image.webp",
    "review": null,
    "source": "часть 2, страницы 40–41",
    "note": "Ищите эндокард и мышечную ткань миокарда."
  },
  {
    "id": "p109",
    "name": "Гипофиз",
    "number": "109",
    "stain": "По Маллори",
    "aliases": [
      "гипофиз",
      "гипофиз человека"
    ],
    "image": "assets/histology/p109-image.webp",
    "review": null,
    "source": "часть 2, страницы 51–55",
    "note": "Сопоставьте участки аденогипофиза и нейрогипофиза."
  },
  {
    "id": "p110",
    "name": "Щитовидная железа",
    "number": "110",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "щитовидная железа",
      "щитовидка"
    ],
    "image": "assets/histology/p110-image.webp",
    "review": null,
    "source": "часть 2, страницы 60–62",
    "note": "Обратите внимание на фолликулы и содержащийся в них коллоид."
  },
  {
    "id": "p111",
    "name": "Щитовидная и паращитовидная железы",
    "number": "111",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "щитовидная и паращитовидная железы",
      "щитовидная и околощитовидная железы",
      "паращитовидная железа",
      "околощитовидная железа"
    ],
    "image": "assets/histology/p111-image.webp",
    "review": null,
    "source": "часть 2, страница 61",
    "note": "На снимке виден участок паращитовидной железы рядом с фолликулами щитовидной железы."
  },
  {
    "id": "p117",
    "name": "Тимус",
    "number": "117",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "тимус",
      "вилочковая железа",
      "зобная железа"
    ],
    "image": "assets/histology/p117-image.webp",
    "review": "assets/histology/p117-review.webp",
    "source": "часть 2, страницы 80–82",
    "note": "Обратите внимание на дольки и различие коркового и мозгового вещества."
  },
  {
    "id": "p118",
    "name": "Лимфатический узел",
    "number": "118",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "лимфатический узел",
      "лимфоузел"
    ],
    "image": "assets/histology/p118-image.webp",
    "review": "assets/histology/p118-review.webp",
    "source": "часть 2, страницы 90–92",
    "note": "Сопоставьте периферические фолликулы и более светлые участки в центре."
  },
  {
    "id": "p119",
    "name": "Селезёнка",
    "number": "119",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "селезенка"
    ],
    "image": "assets/histology/p119-image.webp",
    "review": "assets/histology/p119-review.webp",
    "source": "часть 2, страницы 101–103",
    "note": "Ищите белую и красную пульпу."
  },
  {
    "id": "p120",
    "name": "Язык: нитевидные сосочки",
    "number": "120",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "язык нитевидные сосочки",
      "нитевидные сосочки языка",
      "нитевидные сосочки"
    ],
    "image": "assets/histology/p120-image.webp",
    "review": null,
    "source": "часть 3, страницы 9–10",
    "note": "Срез кончика языка; обратите внимание на форму сосочков."
  },
  {
    "id": "p121",
    "name": "Язык: листовидные сосочки",
    "number": "121",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "язык листовидные сосочки",
      "листовидные сосочки языка",
      "листовидные сосочки"
    ],
    "image": "assets/histology/p121-image.webp",
    "review": "assets/histology/p121-review.webp",
    "source": "часть 3, страницы 12–13",
    "note": "На срезе языка кролика сопоставьте складки и расположенные между ними углубления."
  },
  {
    "id": "p128",
    "name": "Фундальный отдел желудка",
    "number": "128",
    "stain": "Конгорот — железный гематоксилин",
    "aliases": [
      "фундальный отдел желудка",
      "дно желудка",
      "фундальная часть желудка"
    ],
    "image": "assets/histology/p128-image.webp",
    "review": null,
    "source": "часть 3, страницы 19–20",
    "note": "На изображении сохранено обозначение складки стенки из исходного PDF."
  },
  {
    "id": "p129",
    "name": "Пилорический отдел желудка",
    "number": "129",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "пилорический отдел желудка",
      "пилорическая часть желудка",
      "привратниковая часть желудка"
    ],
    "image": "assets/histology/p129-image.webp",
    "review": "assets/histology/p129-review.webp",
    "source": "часть 3, страницы 23–24",
    "note": "Обратите внимание на слизистую и мышечную оболочки."
  },
  {
    "id": "p130",
    "name": "Двенадцатиперстная кишка",
    "number": "130",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "двенадцатиперстная кишка",
      "12 перстная кишка",
      "дуоденум"
    ],
    "image": "assets/histology/p130-image.webp",
    "review": "assets/histology/p130-review.webp",
    "source": "часть 3, страницы 27–28",
    "note": "На срезе тонкой кишки ищите ворсинки и особенности подслизистой основы."
  },
  {
    "id": "p131",
    "name": "Тощая кишка",
    "number": "131",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "тощая кишка",
      "jejunum"
    ],
    "image": "assets/histology/p131-image.webp",
    "review": "assets/histology/p131-review.webp",
    "source": "часть 3, страницы 32–33",
    "note": "Обратите внимание на складки слизистой оболочки и ворсинки."
  },
  {
    "id": "p132",
    "name": "Толстая кишка",
    "number": "132",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "толстая кишка",
      "ободочная кишка"
    ],
    "image": "assets/histology/p132-image.webp",
    "review": "assets/histology/p132-review.webp",
    "source": "часть 3, страницы 36–38",
    "note": "Сопоставьте складки слизистой оболочки и кишечные железы."
  },
  {
    "id": "p133",
    "name": "Червеобразный отросток",
    "number": "133",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "червеобразный отросток",
      "аппендикс",
      "червеобразный отросток поперечный срез"
    ],
    "image": "assets/histology/p133-image.webp",
    "review": null,
    "source": "часть 3, страницы 42–43",
    "note": "На изображении из PDF сохранены обозначения структур на английском языке."
  },
  {
    "id": "p137",
    "name": "Поджелудочная железа",
    "number": "137",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "поджелудочная железа",
      "панкреас"
    ],
    "image": "assets/histology/p137-image.webp",
    "review": "assets/histology/p137-review.webp",
    "source": "часть 3, страницы 54–56",
    "note": "Сопоставьте дольчатую экзокринную часть и эндокринные островки."
  },
  {
    "id": "p139",
    "name": "Печень",
    "number": "139",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "печень",
      "печень человека"
    ],
    "image": "assets/histology/p139-image.webp",
    "review": "assets/histology/p139-review.webp",
    "source": "часть 3, страницы 65–66",
    "note": "Сопоставьте печёночную паренхиму и сосуды."
  },
  {
    "id": "p141",
    "name": "Трахея",
    "number": "141",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "трахея",
      "поперечный срез трахеи",
      "трахея поперечный срез"
    ],
    "image": "assets/histology/p141-image.webp",
    "review": "assets/histology/p141-review.webp",
    "source": "часть 3, страницы 70–72",
    "note": "Ищите слизистую оболочку и гиалиновый хрящ."
  },
  {
    "id": "p142",
    "name": "Лёгкое",
    "number": "142",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "легкое",
      "легкие",
      "ткань легкого"
    ],
    "image": "assets/histology/p142-image.webp",
    "review": "assets/histology/p142-review.webp",
    "source": "часть 3, страницы 75–79",
    "note": "Обратите внимание на альвеолы и воздухоносные пути."
  },
  {
    "id": "p143",
    "name": "Толстая кожа пальца",
    "number": "143",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "кожа пальца",
      "толстая кожа",
      "кожа ладонной поверхности пальца",
      "кожа ладони"
    ],
    "image": "assets/histology/p143-image.webp",
    "review": "assets/histology/p143-review.webp",
    "source": "часть 3, страницы 87–89",
    "note": "Сопоставьте толстый эпидермис и подлежащую дерму."
  },
  {
    "id": "p144",
    "name": "Кожа с волосом",
    "number": "144",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "кожа с волосом",
      "тонкая кожа с волосом",
      "волосистая кожа"
    ],
    "image": "assets/histology/p144-image.webp",
    "review": "assets/histology/p144-review.webp",
    "source": "часть 3, страницы 91–92",
    "note": "На срезе видны волосяные фолликулы и кожа вокруг них."
  },
  {
    "id": "p146",
    "name": "Почка",
    "number": "146",
    "stain": "По Маллори",
    "aliases": [
      "почка",
      "почка человека"
    ],
    "image": "assets/histology/p146-image.webp",
    "review": "assets/histology/p146-review.webp",
    "source": "часть 4, страницы 12–13",
    "note": "Сопоставьте корковое и мозговое вещество почки."
  },
  {
    "id": "p147",
    "name": "Мочевой пузырь",
    "number": "147",
    "stain": "Гематоксилин — эозин",
    "aliases": [
      "мочевой пузырь",
      "стенка мочевого пузыря"
    ],
    "image": "assets/histology/p147-image.webp",
    "review": "assets/histology/p147-review.webp",
    "source": "часть 4, страницы 24–26",
    "note": "Обратите внимание на слизистую оболочку с переходным эпителием и мышечные слои."
  }
]);
  slides.push({ id:'p62a', name:'Сухожилие: поперечный срез', number:'62а', stain:'Гематоксилин — эозин', aliases:['сухожилие поперечный срез','поперечный срез сухожилия','плотная оформленная соединительная ткань поперечный срез'], image:'assets/histology/p62a-image.webp', review:null, source:'часть 1, страница 34', note:'Подпись и окраска приведены по исходному PDF; сравните расположение пучков с продольным срезом.' });
  // Остальные снимки из указателя. Закрыты только подписи, без реконструкции ткани.
  slides.push(...[
  {
    "id": "p69",
    "name": "Развитие кости: непрямой остеогенез",
    "number": "69",
    "aliases": [
      "непрямой остеогенез",
      "развитие кости на месте хряща",
      "развитие костной ткани на месте хряща",
      "развитие кости непрямой остеогенез"
    ],
    "image": "assets/histology/p69-image.webp",
    "review": "assets/histology/p69-review.webp",
    "source": "часть 1, страницы 82–83",
    "stain": "Гематоксилин — эозин",
    "note": "Сопоставьте хрящевую модель и участки формирующейся кости.",
    "masked": true
  },
  {
    "id": "p89",
    "name": "Нервный ствол: поперечный срез",
    "number": "89",
    "aliases": [
      "нервный ствол",
      "периферический нерв",
      "нервный ствол поперечный срез",
      "поперечный срез периферического нерва"
    ],
    "image": "assets/histology/p89-image.webp",
    "review": "assets/histology/p89-review.webp",
    "source": "часть 1, страницы 101–103",
    "stain": "Гематоксилин — эозин",
    "note": "Обратите внимание на пучки нервных волокон и соединительнотканные оболочки.",
    "masked": true
  },
  {
    "id": "p101",
    "name": "Сосуды микроциркуляторного русла",
    "number": "101",
    "aliases": [
      "сосуды микроциркуляторного русла",
      "микроциркуляторное русло",
      "артериолы капилляры венулы"
    ],
    "image": "assets/histology/p101-image.webp",
    "review": "assets/histology/p101-review.webp",
    "source": "часть 2, страницы 27–29",
    "stain": "Гематоксилин — эозин",
    "note": "В плёночном препарате сравните артериолу, капилляры и венулу.",
    "masked": true
  },
  {
    "id": "p103a",
    "name": "Артерия эластического типа: аорта",
    "number": "103а",
    "aliases": [
      "аорта",
      "артерия эластического типа",
      "аорта поперечный срез",
      "артерия эластического типа поперечный срез"
    ],
    "image": "assets/histology/p103a-image.webp",
    "review": "assets/histology/p103a-review.webp",
    "source": "часть 2, страницы 37–39",
    "stain": "Орсеин",
    "note": "Обратите внимание на эластические структуры средней оболочки.",
    "masked": true
  },
  {
    "id": "p112",
    "name": "Надпочечник",
    "number": "112",
    "aliases": [
      "надпочечник",
      "надпочечная железа"
    ],
    "image": "assets/histology/p112-image.webp",
    "review": "assets/histology/p112-review.webp",
    "source": "часть 2, страницы 71–72",
    "stain": "Гематоксилин — эозин",
    "note": "Сопоставьте корковое и мозговое вещество.",
    "masked": true
  },
  {
    "id": "p115",
    "name": "Красный костный мозг",
    "number": "115",
    "aliases": [
      "красный костный мозг",
      "срез красного костного мозга",
      "костный мозг"
    ],
    "image": "assets/histology/p115-image.webp",
    "review": "assets/histology/p115-review.webp",
    "source": "часть 2, страницы 76–77",
    "stain": "Гематоксилин — эозин",
    "note": "Ищите кроветворные клетки, жировые клетки и сосуды.",
    "masked": true
  },
  {
    "id": "p125",
    "name": "Нёбная миндалина",
    "number": "125",
    "aliases": [
      "небная миндалина",
      "миндалина"
    ],
    "image": "assets/histology/p125-image.webp",
    "review": "assets/histology/p125-review.webp",
    "source": "часть 3, страницы 5–6",
    "stain": "Гематоксилин — эозин",
    "note": "Сопоставьте эпителий, крипты и лимфоидные фолликулы.",
    "masked": true
  },
  {
    "id": "p135",
    "name": "Околоушная железа",
    "number": "135",
    "aliases": [
      "околоушная железа",
      "околоушная слюнная железа"
    ],
    "image": "assets/histology/p135-image.webp",
    "review": "assets/histology/p135-review.webp",
    "source": "часть 3, страницы 45–46",
    "stain": "Гематоксилин — эозин",
    "note": "Сравните дольки железы и выводные протоки.",
    "masked": true
  },
  {
    "id": "p136",
    "name": "Подчелюстная железа",
    "number": "136",
    "aliases": [
      "подчелюстная железа",
      "подчелюстная слюнная железа"
    ],
    "image": "assets/histology/p136-image.webp",
    "review": "assets/histology/p136-review.webp",
    "source": "часть 3, страницы 48–49",
    "stain": "Гематоксилин — эозин",
    "note": "Ищите дольчатую структуру и выводные протоки.",
    "masked": true
  },
  {
    "id": "p149",
    "name": "Семенник (яичко)",
    "number": "149",
    "aliases": [
      "семенник",
      "яичко",
      "семенник человека",
      "яичко человека"
    ],
    "image": "assets/histology/p149-image.webp",
    "review": "assets/histology/p149-review.webp",
    "source": "часть 4, страницы 31–32",
    "stain": "Гематоксилин — эозин",
    "note": "Обратите внимание на извитые семенные канальцы и ткань между ними.",
    "masked": true
  },
  {
    "id": "p150",
    "name": "Придаток семенника",
    "number": "150",
    "aliases": [
      "придаток семенника",
      "придаток яичка",
      "эпидидимис"
    ],
    "image": "assets/histology/p150-image.webp",
    "review": "assets/histology/p150-review.webp",
    "source": "часть 4, страницы 37–38",
    "stain": "Гематоксилин — эозин",
    "note": "Сопоставьте просветы и эпителий протоков придатка.",
    "masked": true
  },
  {
    "id": "p151",
    "name": "Предстательная железа",
    "number": "151",
    "aliases": [
      "предстательная железа",
      "простата"
    ],
    "image": "assets/histology/p151-image.webp",
    "review": "assets/histology/p151-review.webp",
    "source": "часть 4, страницы 41–42",
    "stain": "Гематоксилин — эозин",
    "note": "На исходном изображении показаны структуры железы и мочеиспускательного канала.",
    "masked": true
  },
  {
    "id": "p152",
    "name": "Яичник",
    "number": "152",
    "aliases": [
      "яичник",
      "яичник кошки",
      "срез яичника кошки"
    ],
    "image": "assets/histology/p152-image.webp",
    "review": "assets/histology/p152-review.webp",
    "source": "часть 4, страницы 45–46",
    "stain": "Гематоксилин — эозин",
    "note": "Обратите внимание на фолликулы и окружающую строму.",
    "masked": true
  },
  {
    "id": "p153",
    "name": "Жёлтое тело яичника",
    "number": "153",
    "aliases": [
      "желтое тело",
      "желтое тело яичника"
    ],
    "image": "assets/histology/p153-image.webp",
    "review": "assets/histology/p153-review.webp",
    "source": "часть 4, страницы 49–50",
    "stain": "Гематоксилин — эозин",
    "note": "Сопоставьте жёлтое тело и окружающие фолликулы.",
    "masked": true
  },
  {
    "id": "p154",
    "name": "Матка: поперечный срез",
    "number": "154",
    "aliases": [
      "матка",
      "матка поперечный срез",
      "поперечный срез матки",
      "матка кошки"
    ],
    "image": "assets/histology/p154-image.webp",
    "review": "assets/histology/p154-review.webp",
    "source": "часть 4, страницы 53–54",
    "stain": "Гематоксилин — эозин",
    "note": "В исходном PDF изображён срез матки кошки; сопоставьте эндометрий и миометрий.",
    "masked": true
  },
  {
    "id": "p157",
    "name": "Лактирующая молочная железа",
    "number": "157",
    "aliases": [
      "лактирующая молочная железа",
      "молочная железа в период лактации",
      "молочная железа"
    ],
    "image": "assets/histology/p157-image.webp",
    "review": "assets/histology/p157-review.webp",
    "source": "часть 4, страницы 58–59",
    "stain": "Гематоксилин — эозин",
    "note": "Обратите внимание на развитые секреторные отделы и протоки.",
    "masked": true
  },
  {
    "id": "p158",
    "name": "Плацента: плодная часть",
    "number": "158",
    "aliases": [
      "плацента плодная часть",
      "плодная часть плаценты",
      "зародышевая часть плаценты",
      "плацента зародышевая часть"
    ],
    "image": "assets/histology/p158-image.webp",
    "review": "assets/histology/p158-review.webp",
    "source": "часть 4, страницы 62–65",
    "stain": "Гематоксилин — эозин",
    "note": "Сопоставьте хориальную пластинку и ворсины в исходном размеченном изображении.",
    "masked": true
  },
  {
    "id": "p159",
    "name": "Плацента: материнская часть",
    "number": "159",
    "aliases": [
      "плацента материнская часть",
      "материнская часть плаценты"
    ],
    "image": "assets/histology/p159-image.webp",
    "review": "assets/histology/p159-review.webp",
    "source": "часть 4, страницы 62–67",
    "stain": "Гематоксилин — эозин",
    "note": "Сопоставьте ткани материнской части плаценты на исходном изображении.",
    "masked": true
  },
  {
    "id": "p113",
    "name": "Эпифиз",
    "number": "113",
    "aliases": [
      "эпифиз",
      "эпифиз человека",
      "шишковидная железа"
    ],
    "image": "assets/histology/p113-image.webp",
    "review": "assets/histology/p113-review.webp",
    "source": "часть 4, страницы 69–70",
    "stain": "Гематоксилин — эозин",
    "note": "Ищите скопления мозгового песка и окружающую ткань.",
    "masked": true
  },
  {
    "id": "p122",
    "name": "Развитие зуба: ранняя стадия",
    "number": "122 (на снимке — 124)",
    "aliases": [
      "развитие зуба ранняя стадия",
      "ранняя стадия развития зуба",
      "эмалевый орган"
    ],
    "image": "assets/histology/p122-image.webp",
    "review": "assets/histology/p122-review.webp",
    "source": "часть 4, страницы 71–72",
    "stain": "Гематоксилин — эозин",
    "note": "В указателе стоит № 122, а на выбранном снимке — № 124; оба обозначения приведены по сборнику.",
    "masked": false
  },
  {
    "id": "p123",
    "name": "Развитие зуба: поздняя стадия",
    "number": "123 (на снимке — 125)",
    "aliases": [
      "развитие зуба поздняя стадия",
      "поздняя стадия развития зуба",
      "гистогенез зуба"
    ],
    "image": "assets/histology/p123-image.webp",
    "review": "assets/histology/p123-review.webp",
    "source": "часть 4, страницы 73–74",
    "stain": "Гематоксилин — эозин",
    "note": "В указателе стоит № 123, а на выбранном снимке — № 125; оба обозначения приведены по сборнику.",
    "masked": false
  },
  {
    "id": "p127",
    "name": "Переход пищевода в желудок",
    "number": "127",
    "aliases": [
      "переход пищевода в желудок",
      "пищеводно желудочный переход",
      "переход пищевода в желудок препарат"
    ],
    "image": "assets/histology/p127-image.webp",
    "review": "assets/histology/p127-review.webp",
    "source": "часть 4, страницы 76–78",
    "stain": "Гематоксилин — эозин",
    "note": "По подписи сборника показана граница эпителиев; на снимке сохранены исходные цветные пометки.",
    "masked": false
  },
  {
    "id": "p129a",
    "name": "Переход желудка в двенадцатиперстную кишку",
    "number": "129а",
    "aliases": [
      "переход желудка в двенадцатиперстную кишку",
      "переход желудка в 12 перстную кишку",
      "пилородуоденальный переход"
    ],
    "image": "assets/histology/p129a-image.webp",
    "review": "assets/histology/p129a-review.webp",
    "source": "часть 4, страницы 94–95",
    "stain": "Гематоксилин — эозин",
    "note": "Сравните части слизистой по обе стороны перехода.",
    "masked": true
  },
  {
    "id": "p140",
    "name": "Жёлчный пузырь",
    "number": "140",
    "aliases": [
      "желчный пузырь",
      "стенка желчного пузыря"
    ],
    "image": "assets/histology/p140-image.webp",
    "review": "assets/histology/p140-review.webp",
    "source": "часть 4, страницы 81–83",
    "stain": "Гематоксилин — эозин",
    "note": "Сопоставьте слизистую и мышечную оболочки на исходном размеченном снимке.",
    "masked": true
  },
  {
    "id": "p148",
    "name": "Мочеточник: поперечный срез",
    "number": "148",
    "aliases": [
      "мочеточник",
      "мочеточник поперечный срез",
      "поперечный срез мочеточника"
    ],
    "image": "assets/histology/p148-image.webp",
    "review": "assets/histology/p148-review.webp",
    "source": "часть 4, страницы 85–87",
    "stain": "Гематоксилин — эозин",
    "note": "Обратите внимание на складки слизистой и мышечную оболочку.",
    "masked": true
  },
  {
    "id": "p155",
    "name": "Яйцевод (маточная труба)",
    "number": "155 (на снимке — 154)",
    "aliases": [
      "яйцевод",
      "маточная труба",
      "фаллопиева труба"
    ],
    "image": "assets/histology/p155-image.webp",
    "review": "assets/histology/p155-review.webp",
    "source": "часть 4, страницы 89–90",
    "stain": "Гематоксилин — эозин",
    "note": "В указателе стоит № 155, а на выбранном снимке — № 154; оба обозначения приведены по сборнику.",
    "masked": true
  }
]);
  const additionalVariants = {
  "h05": [
    {
      "number": "91",
      "stain": "Импрегнация солями серебра",
      "image": "assets/histology/p91-image.webp",
      "review": "assets/histology/p91-review.webp",
      "source": "часть 1, страница 106",
      "note": "Сравните рисунок коры мозжечка при импрегнации серебром."
    }
  ],
  "p139": [
    {
      "number": "138",
      "aliases": ["печень", "печень свиньи"],
      "stain": "Пикрофуксин — железный гематоксилин",
      "image": "assets/histology/p138-image.webp",
      "review": "assets/histology/p138-review.webp",
      "source": "часть 3, страницы 60–61",
      "note": "Печень свиньи: обратите внимание на хорошо выраженные границы долек."
    }
  ]
};
  Object.assign(additionalVariants, {
  "p86a": [
    {
      "number": "86",
      "stain": "Гематоксилин — эозин",
      "image": "assets/histology/p86-image.webp",
      "review": "assets/histology/p86-review.webp",
      "source": "часть 1, страница 100",
      "note": "Спинной мозг при окраске гематоксилином и эозином. Для вопроса восстановлены исходные полосы изображения без подписей."
    }
  ],
  "p107": [
    {
      "number": "107а",
      "stain": "Гематоксилин — эозин",
      "image": "assets/histology/p107a-image.webp",
      "review": "assets/histology/p107a-review.webp",
      "source": "часть 2, страницы 49–50",
      "note": "На срезе показаны волокна Пуркинье; исходные обозначения доступны в разборе.",
      "masked": true
    }
  ],
  "p146": [
    {
      "number": "146в",
      "stain": "Гематоксилин — эозин",
      "image": "assets/histology/p146v-image.webp",
      "review": "assets/histology/p146v-review.webp",
      "source": "часть 4, страницы 8–9",
      "note": "Почка крысы: в данном срезе представлен почечный сосочек.",
      "aliases": [
        "почка",
        "почка крысы"
      ]
    }
  ],
  "p149": [
    {
      "number": "149а",
      "stain": "Гематоксилин — эозин",
      "image": "assets/histology/p149a-image.webp",
      "review": "assets/histology/p149a-review.webp",
      "source": "часть 4, страница 33",
      "note": "Семенник крысы; исходные обозначения доступны в разборе.",
      "aliases": [
        "семенник",
        "яичко",
        "семенник крысы",
        "яичко крысы"
      ],
      "masked": true
    }
  ]
});
  for (const slide of slides) slide.variants = [null, ...(additionalVariants[slide.id] || [])];
  const byId = Object.fromEntries(slides.map(s => [s.id,s]));
  // Для каждого препарата вручную задан пул похожих изображений/органов.
  // Направленные списки позволяют исключить неоднозначные пары.
  const distractors = {
  "h01": [
    "p117",
    "p118",
    "p119"
  ],
  "h02": [
    "h03",
    "p65",
    "p62",
    "h04"
  ],
  "h03": [
    "h02",
    "p65",
    "p62",
    "h04"
  ],
  "h04": [
    "p68",
    "h02",
    "p65",
    "p62"
  ],
  "h05": [
    "p92",
    "p85",
    "p86a",
    "p95"
  ],
  "h06": [
    "p129",
    "p130",
    "p132",
    "p147",
    "p128"
  ],
  "p40": [
    "p86a",
    "p96",
    "p133"
  ],
  "p62": [
    "p62a",
    "p65",
    "h02",
    "h03",
    "p68"
  ],
  "p62a": ["p62", "p65", "h02", "p68"],
  "p65": [
    "h02",
    "h03",
    "p62",
    "h04"
  ],
  "p68": [
    "h04",
    "p65",
    "h02",
    "p62"
  ],
  "p85": [
    "p92",
    "h05",
    "p86a",
    "p95"
  ],
  "p86a": [
    "h05",
    "p92",
    "p85",
    "p96"
  ],
  "p92": [
    "h05",
    "p85",
    "p86a",
    "p95"
  ],
  "p93": [
    "p95",
    "p143",
    "p144",
    "p121"
  ],
  "p95": [
    "p93",
    "p92",
    "h05",
    "p121"
  ],
  "p96": [
    "p86a",
    "p40",
    "p133",
    "p102"
  ],
  "p102": [
    "p133",
    "p147",
    "p86a",
    "p96"
  ],
  "p107": [
    "p129",
    "p147",
    "h06",
    "p132"
  ],
  "p109": [
    "p117",
    "p118",
    "p139",
    "p137"
  ],
  "p110": [
    "p109",
    "p137",
    "p139",
    "p146"
  ],
  "p111": [
    "p109",
    "p137",
    "p139",
    "p146"
  ],
  "p117": [
    "p118",
    "p119",
    "p109",
    "p137"
  ],
  "p118": [
    "p117",
    "p119",
    "p133",
    "p109"
  ],
  "p119": [
    "p118",
    "p117",
    "p109",
    "p139"
  ],
  "p120": [
    "p121",
    "p143",
    "p144",
    "p93"
  ],
  "p121": [
    "p120",
    "p143",
    "p144",
    "p93"
  ],
  "p128": [
    "p129",
    "p130",
    "p131",
    "p132",
    "h06"
  ],
  "p129": [
    "p128",
    "p130",
    "p132",
    "h06",
    "p131"
  ],
  "p130": [
    "p131",
    "p132",
    "p129",
    "p133"
  ],
  "p131": [
    "p130",
    "p132",
    "p129",
    "p133"
  ],
  "p132": [
    "p130",
    "p131",
    "p129",
    "p133"
  ],
  "p133": [
    "p132",
    "p131",
    "p147",
    "h06"
  ],
  "p137": [
    "p109",
    "p139",
    "p146",
    "p117"
  ],
  "p139": [
    "p137",
    "p146",
    "p109",
    "p119"
  ],
  "p141": [
    "h06",
    "p147",
    "p129",
    "p93"
  ],
  "p142": [
    "p146",
    "p139",
    "p137",
    "p117"
  ],
  "p143": [
    "p144",
    "p120",
    "p121",
    "p93"
  ],
  "p144": [
    "p143",
    "p120",
    "p121",
    "p93"
  ],
  "p146": [
    "p139",
    "p137",
    "p109",
    "p142"
  ],
  "p147": [
    "h06",
    "p133",
    "p129",
    "p107"
  ]
};
  Object.assign(distractors, {
  "p69": [
    "p68",
    "h04",
    "h02",
    "p65"
  ],
  "p89": [
    "p85",
    "p86a",
    "p102",
    "p101"
  ],
  "p101": [
    "p102",
    "p103a",
    "p89",
    "p115"
  ],
  "p103a": [
    "p102",
    "p101",
    "p107",
    "p89"
  ],
  "p112": [
    "p109",
    "p113",
    "p117",
    "p139"
  ],
  "p115": [
    "h01",
    "p117",
    "p118",
    "p119"
  ],
  "p125": [
    "p118",
    "p117",
    "p119",
    "p133"
  ],
  "p135": [
    "p136",
    "p137",
    "p157",
    "p109"
  ],
  "p136": [
    "p135",
    "p137",
    "p157",
    "p109"
  ],
  "p149": [
    "p150",
    "p151",
    "p152",
    "p157"
  ],
  "p150": [
    "p149",
    "p151",
    "p155",
    "p148"
  ],
  "p151": [
    "p150",
    "p157",
    "p136",
    "p135"
  ],
  "p152": [
    "p149",
    "p150",
    "p112",
    "p157"
  ],
  "p153": [
    "p112",
    "p117",
    "p149",
    "p157"
  ],
  "p154": [
    "p148",
    "p155",
    "p147",
    "p129"
  ],
  "p157": [
    "p135",
    "p136",
    "p137",
    "p151"
  ],
  "p158": [
    "p152",
    "p157",
    "p153",
    "p151"
  ],
  "p159": [
    "p152",
    "p157",
    "p153",
    "p151"
  ],
  "p113": [
    "p109",
    "p112",
    "p117",
    "p118"
  ],
  "p122": [
    "p123",
    "p40",
    "p143",
    "p121"
  ],
  "p123": [
    "p122",
    "p40",
    "p143",
    "p121"
  ],
  "p127": [
    "p129a",
    "h06",
    "p128",
    "p129"
  ],
  "p129a": [
    "p127",
    "p129",
    "p130",
    "p131"
  ],
  "p140": [
    "p147",
    "p129",
    "p132",
    "p148"
  ],
  "p148": [
    "p155",
    "p147",
    "p154",
    "p133"
  ],
  "p155": [
    "p148",
    "p154",
    "p147",
    "p133"
  ]
});
  for (const [id, similar] of Object.entries({"h04": ["p69"], "h02": ["p69"], "p68": ["p69"], "p117": ["p125", "p112"], "p118": ["p125"], "p119": ["p125"], "p137": ["p135", "p136", "p157"], "p129": ["p127", "p129a"], "p130": ["p129a"], "h06": ["p127"], "p147": ["p148", "p154"], "p102": ["p101", "p103a", "p89"]})) distractors[id].push(...similar);
  function normalize(value) {
    return String(value || '').normalize('NFKC').toLowerCase().replace(/ё/g,'е').replace(/[^а-яa-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  }
  function matches(slide, input) { const text = normalize(input); return !!text && slide.aliases.some(a => normalize(a) === text); }
  function shuffle(values, random) {
    const out = values.slice();
    for (let i=out.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [out[i],out[j]]=[out[j],out[i]]; }
    return out;
  }
  function create(storage, random) {
    random = random || Math.random;
    let data = {};
    try { const parsed=JSON.parse(storage.getItem(STORAGE_KEY) || '{}'); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data=parsed; } catch (_) { /* испорченное или недоступное хранилище */ }
    const state = { stats:{}, favorites:{}, mode: data.mode === 'text' ? 'text' : 'choice', scope: ['all','mistakes','favorites'].includes(data.scope) ? data.scope : 'all', session:null };
    for (const s of slides) {
      const stat = data.stats && data.stats[s.id];
      if (stat && typeof stat === 'object') state.stats[s.id] = { attempts: Number.isSafeInteger(stat.attempts) && stat.attempts > 0 ? stat.attempts : 0, correct: Number.isSafeInteger(stat.correct) && stat.correct > 0 ? stat.correct : 0, last: typeof stat.last === 'boolean' ? stat.last : null };
      if (data.favorites && data.favorites[s.id] === true) state.favorites[s.id] = true;
    }
    const saved=data.session;
    if (saved && Array.isArray(saved.order) && saved.order.length && new Set(saved.order).size === saved.order.length && saved.order.every(id => byId[id]) && Number.isInteger(saved.index) && saved.index >= 0 && saved.index < saved.order.length && ['choice','text'].includes(saved.mode) && saved.entries && typeof saved.entries === 'object') {
      // Не доверять произвольной форме данных из localStorage.
      const entries={}; let valid=true;
      for (const id of saved.order) {
        const e=saved.entries[id];
        if (!e || !Array.isArray(e.options) || e.options.length !== 4 || new Set(e.options).size !== 4 || !e.options.includes(id) || !e.options.every(x=>byId[x]) || !['unanswered','review','correct','wrong'].includes(e.status) || (e.selected != null && !e.options.includes(e.selected))) {valid=false; break;}
        const variant = e.variant === undefined ? 0 : e.variant;
        if (!Number.isInteger(variant) || variant < 0 || variant >= byId[id].variants.length) {valid=false; break;}
        entries[id]={options:e.options.slice(), selected:e.selected || null, text:typeof e.text === 'string' ? e.text.slice(0,300) : '', status:e.status, variant};
      }
      if (valid) state.session={order:saved.order.slice(),index:saved.index,mode:saved.mode,entries};
    }
    let storageFailed=false;
    function save() { try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); storageFailed=false; return true; } catch (_) {storageFailed=true; return false;} }
    function current() { const s=state.session; if (!s) return null; const slide=byId[s.order[s.index]], variant=slide.variants[s.entries[slide.id].variant]; return variant ? Object.assign({},slide,variant) : slide; }
    function entry() { const s=state.session; return s && s.entries[s.order[s.index]]; }
    function setMode(mode) { if (!['choice','text'].includes(mode)) return; state.mode=mode; save(); }
    function setScope(scope) { if (!['all','mistakes','favorites'].includes(scope)) return; state.scope=scope; save(); }
    function pool() { return slides.filter(s=>state.scope === 'all' || (state.scope === 'favorites' ? !!state.favorites[s.id] : state.stats[s.id] && state.stats[s.id].last === false)); }
    function start() {
      const order=shuffle(pool().map(s=>s.id),random); if (!order.length) return false;
      const entries={}; order.forEach(id => { const wrong=shuffle(distractors[id],random).slice(0,3); const variant=Math.floor(random()*byId[id].variants.length); entries[id]={options:shuffle([id,...wrong],random),selected:null,text:'',status:'unanswered',variant}; });
      state.session={order,index:0,mode:state.mode,entries}; save(); return true;
    }
    function select(id) { const e=entry(); if (!e || e.status!=='unanswered' || !e.options.includes(id) || state.session.mode!=='choice') return false; e.selected=id; save(); return true; }
    function setText(value) { const e=entry(); if (!e || e.status!=='unanswered' || state.session.mode!=='text') return; e.text=String(value || '').slice(0,300); save(); }
    function record(correct) { const s=current(), e=entry(); if (!s || !e || !['unanswered','review'].includes(e.status)) return false; e.status=correct?'correct':'wrong'; const p=state.stats[s.id] || {attempts:0,correct:0,last:null}; p.attempts++; if(correct)p.correct++; p.last=correct; state.stats[s.id]=p; save(); return true; }
    function check(value) {
      const s=current(), e=entry(); if (!e || e.status!=='unanswered') return false;
      if (state.session.mode==='choice') { if (!e.selected) return false; return record(e.selected===s.id); }
      const text=String(value || '').trim().slice(0,300); if (!text) return false; e.text=text;
      if (matches(s,text)) return record(true);
      e.status='review'; save(); return true;
    }
    function self(correct) { const e=entry(); if (!e || e.status!=='review' || typeof correct!=='boolean') return false; return record(correct); }
    function dontKnow() { const e=entry(); return !!e && e.status==='unanswered' && record(false); }
    function navigate(delta) { const s=state.session; if (!s) return; const index=s.index+delta; if (index>=0 && index<s.order.length) {s.index=index; save();} }
    function finish() {state.session=null;save();}
    function toggleFavorite() {const s=current();if(!s)return; if(state.favorites[s.id])delete state.favorites[s.id]; else state.favorites[s.id]=true;save();}
    return { state, current, entry, pool, start, setMode, setScope, select, setText, check, self, dontKnow, navigate, finish, toggleFavorite, storageFailed:()=>storageFailed };
  }
  window.HistologyPrototype = { slides, byId, distractors, normalize, matches, create, STORAGE_KEY };
})();
