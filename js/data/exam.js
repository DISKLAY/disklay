/* План экзамена: 20 вопросов, 20 минут.
   Экзамен состоит из 11 разделов; в каждом разделе берётся своё количество
   случайных вопросов. pool — источник вопросов: topics — темы банка
   (id из window.TOPICS), nums — конкретные номера вопросов из PDF (для узких
   разделов вроде «Внутреннее основание черепа»). */
window.EXAM_MINUTES = 20;

window.EXAM_SECTIONS = [
  {
    "id": "intro-osteology",
    "title": "Введение. Строение кости как органа. Классификация костей.",
    "count": 2,
    "pool": { "topics": ["intro", "osteology"] }
  },
  {
    "id": "upper-bones",
    "title": "Кости пояса и свободной части верхней конечности.",
    "count": 2,
    "pool": { "topics": ["upper-bones"] }
  },
  {
    "id": "skull-base",
    "title": "Внутреннее основание черепа.",
    "count": 2,
    "pool": { "nums": [110, 111, 112, 113, 114, 115, 116, 117] }
  },
  {
    "id": "upper-joints",
    "title": "Соединение костей пояса и свободной части верхней конечности.",
    "count": 2,
    "pool": { "topics": ["arthro-upper"] }
  },
  {
    "id": "lower-joints",
    "title": "Соединение костей пояса и свободной части нижней конечности.",
    "count": 2,
    "pool": { "topics": ["arthro-lower"], "nums": [185, 186, 187, 192, 193] }
  },
  {
    "id": "face-bones",
    "title": "Кости лицевого черепа.",
    "count": 2,
    "pool": { "topics": ["skull-face"] }
  },
  {
    "id": "arthro-basic",
    "title": "Общая артросиндесмология. Виды соединений костей.",
    "count": 2,
    "pool": { "topics": ["arthro-basic"] }
  },
  {
    "id": "trunk-joints",
    "title": "Соединение костей туловища.",
    "count": 1,
    "pool": { "topics": ["arthro-trunk"] }
  },
  {
    "id": "brain-bones",
    "title": "Кости мозгового черепа.",
    "count": 2,
    "pool": { "topics": ["skull-brain"] }
  },
  {
    "id": "lower-bones",
    "title": "Кости пояса и свободной части нижней конечности.",
    "count": 2,
    "pool": { "topics": ["lower-bones"] }
  },
  {
    "id": "trunk-bones",
    "title": "Кости туловища.",
    "count": 1,
    "pool": { "topics": ["trunk-bones"] }
  }
];
