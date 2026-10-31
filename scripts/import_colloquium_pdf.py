#!/usr/bin/env python3
"""Перенос вопросов и подсвеченных вариантов из PDF. Требуется PyMuPDF.

python scripts/import_colloquium_pdf.py 2 path/to/myology.pdf js/data/colloquium-2.js
python scripts/import_colloquium_pdf.py 3 path/to/splanchnology.pdf js/data/colloquium-3.js
python scripts/import_colloquium_pdf.py 4 path/to/cns.pdf js/data/colloquium-4.js
python scripts/import_colloquium_pdf.py 7 path/to/sss.pdf js/data/colloquium-7.js
python scripts/import_colloquium_pdf.py credit-1 path/to/credit1.pdf js/data/credit-1.js
python scripts/import_colloquium_pdf.py credit-2 path/to/credit2.pdf js/data/credit-2.js
"""
import json
import re
import sys
from pathlib import Path

import pymupdf

TOPICS = {
    '2': [
        (13, 'back', 'Мышцы спины', 'Поверхностные и глубокие мышцы'),
        (33, 'chest', 'Мышцы груди и диафрагма', 'Грудная стенка и диафрагма'),
        (60, 'abdomen', 'Мышцы и топография живота', 'Брюшная стенка и паховый канал'),
        (71, 'head', 'Мышцы головы', 'Жевательные и мимические мышцы'),
        (101, 'neck', 'Мышцы и топография шеи', 'Мышцы, фасции и пространства'),
        (153, 'upper', 'Мышцы верхней конечности', 'Плечевой пояс, свободная конечность и топография'),
        (188, 'lower', 'Мышцы нижней конечности', 'Таз, свободная конечность и топография'),
    ],
    '3': [
        (18, 'mouth', 'Полость рта', 'Нёбо, зубы, язык и слюнные железы'),
        (30, 'pharynx', 'Глотка и пищевод', 'Строение и топография'),
        (56, 'digestive', 'Желудок и кишечник', 'Желудок, тонкая и толстая кишка'),
        (81, 'digestive-glands', 'Пищеварительные железы', 'Печень, желчный пузырь и поджелудочная железа'),
        (98, 'peritoneum', 'Брюшина', 'Брюшинная полость и её отделы'),
        (122, 'airways', 'Дыхательные пути', 'Полость носа, гортань, трахея и бронхи'),
        (126, 'thyroid', 'Щитовидная и паращитовидные железы', 'Бранхиогенные эндокринные железы'),
        (149, 'lungs', 'Лёгкие и средостение', 'Лёгкие, плевра и средостение'),
        (185, 'urinary', 'Мочевая система', 'Почки, мочеточники, мочевой пузырь и уретра'),
        (190, 'adrenal', 'Надпочечники', 'Строение и топография'),
        (219, 'male', 'Мужские половые органы', 'Строение и топография'),
        (248, 'female', 'Женские половые органы', 'Строение и топография'),
        (254, 'perineum', 'Промежность', 'Мышцы и топография'),
    ],

    '4': [
        (34, 'spinal-cord', 'Спинной мозг и рефлекторные дуги', 'Строение, ядра и пути'),
        (56, 'meninges', 'Оболочки и ликвор', 'Оболочки головного и спинного мозга'),
        (90, 'brainstem-external', 'Ствол мозга и ромбовидная ямка', 'Внешнее строение и выход нервов'),
        (116, 'cranial-nuclei', 'Ядра черепных нервов', 'Расположение и функции'),
        (156, 'brainstem-internal', 'Строение ствола мозга', 'Продолговатый мозг, мост и средний мозг'),
        (178, 'cerebellum', 'Мозжечок и IV желудочек', 'Строение и связи'),
        (207, 'diencephalon', 'Промежуточный мозг и желудочки', 'Таламус, гипоталамус, базальные ядра'),
        (243, 'cerebrum', 'Конечный мозг', 'Полушария, кора и белое вещество'),
        (257, 'pathways', 'Проводящие пути', 'Чувствительные и двигательные пути'),
    ],
    '7': [
        (48, 'heart', 'Сердце и перикард', 'Камеры, клапаны, проводящая система и оболочки'),
        (59, 'coronary', 'Коронарные сосуды и круги кровообращения', 'Артерии, вены и круги кровообращения'),
        (95, 'head-neck', 'Сосуды головы и шеи', 'Сонные артерии и яремные вены'),
        (130, 'trunk-vessels', 'Сосуды туловища и анастомозы', 'Аорта и системы полых и воротной вен'),
        (135, 'abdominal-branches', 'Ветви брюшной аорты', 'Висцеральные и париетальные ветви'),
        (170, 'upper-limb', 'Сосуды верхней конечности', 'Артерии, вены и лимфатические сосуды'),
        (198, 'lower-limb', 'Сосуды нижней конечности', 'Артерии и вены'),
        (209, 'lymphatic', 'Лимфатическая и иммунная системы', 'Органы, протоки и узлы'),
    ],
    'credit-1': [
        (14, 'general', 'Общая анатомия и кости', 'Плоскости, оси и классификация костей'),
        (30, 'axial', 'Позвоночник и грудная клетка', 'Позвонки, рёбра и грудина'),
        (60, 'limb-bones', 'Кости конечностей', 'Верхняя и нижняя конечности'),
        (93, 'skull-bones', 'Кости черепа', 'Мозговой и лицевой отделы'),
        (120, 'skull', 'Череп в целом', 'Основание, полости и ямки'),
        (140, 'joints-trunk', 'Соединения костей туловища', 'Общая артрология, позвоночник и грудная клетка'),
        (181, 'joints-limbs', 'Соединения костей конечностей', 'Суставы и связки'),
        (200, 'trunk-muscles', 'Мышцы туловища', 'Спина, грудь, живот и диафрагма'),
        (214, 'head-neck', 'Мышцы головы и шеи', 'Мышцы и топография'),
        (231, 'upper-muscles', 'Мышцы верхней конечности', 'Мышцы и топография'),
        (245, 'lower-muscles', 'Мышцы нижней конечности', 'Мышцы и топография'),
    ],
    'credit-2': [
        (18, 'upper-digestive', 'Полость рта, глотка и желудок', 'Начальные отделы пищеварительной системы'),
        (44, 'digestive', 'Кишечник и пищеварительные железы', 'Кишечник, печень и поджелудочная железа'),
        (50, 'peritoneum', 'Брюшина', 'Брюшинная полость и её отделы'),
        (70, 'airways', 'Дыхательные пути и железы шеи', 'Носовая полость, гортань и трахея'),
        (81, 'lungs', 'Лёгкие и средостение', 'Лёгкие и плевра'),
        (102, 'urinary', 'Мочевая система и надпочечники', 'Почки, мочевыводящие пути и надпочечники'),
        (119, 'male', 'Мужские половые органы', 'Строение и топография'),
        (139, 'female', 'Женские половые органы и промежность', 'Строение и топография'),
        (170, 'spinal-cord', 'Спинной мозг и оболочки', 'Строение, ядра и оболочки'),
        (229, 'brainstem', 'Ствол мозга', 'Строение и ядра черепных нервов'),
        (242, 'cerebellum', 'Мозжечок и IV желудочек', 'Строение и связи'),
        (263, 'diencephalon', 'Промежуточный мозг и желудочки', 'Строение и связи'),
        (288, 'cerebrum', 'Конечный мозг', 'Полушария, кора и белое вещество'),
        (297, 'pathways', 'Проводящие пути', 'Чувствительные и двигательные пути'),
    ],
}


def extract(module, source):
    topics = TOPICS[module]
    questions, answers = [], {}
    current = None
    with pymupdf.open(source) as document:
        for page_number, page in enumerate(document, 1):
            # В исходных файлах каждый прямоугольник подсветки расположен под текстом варианта.
            highlights = [drawing['rect'] for drawing in page.get_drawings() if drawing.get('fill')]
            for block in page.get_text('dict')['blocks']:
                if 'lines' not in block:
                    continue
                text = ' '.join(''.join(span['text'] for span in line['spans']).strip()
                                for line in block['lines']).strip()
                if not text:
                    continue
                if re.fullmatch(r'#\s*\d+', text):
                    current = {'num': int(re.search(r'\d+', text).group()), 'page': page_number, 'blocks': []}
                    questions.append(current)
                    continue
                if current is None:
                    continue
                bold = any(span['flags'] & 16 and span['text'].strip()
                           for line in block['lines'] for span in line['spans'])
                rect = pymupdf.Rect(block['bbox'])
                highlighted = any((rect & mark).get_area() > 0 for mark in highlights)
                current['blocks'].append((text, bool(bold), highlighted))

    output = []
    for position, item in enumerate(questions, 1):
        num, blocks = item['num'], item['blocks']
        if num != position or not blocks or not blocks[0][1] or any(b[1] for b in blocks[1:]):
            raise ValueError(f'Неожиданная структура вопроса № {num}')
        options = blocks[1:]
        if (len(options) != 5 if module == '7' else not 2 <= len(options) <= 6) or not any(b[2] for b in options):
            raise ValueError(f'Проверьте варианты и подсветку вопроса № {num}')
        topic = next(topic_id for end, topic_id, _, _ in topics if num <= end)
        output.append({'id': f'q{num}', 'pos': position, 'num': num, 'topic': topic,
                       'text': blocks[0][0], 'options': [b[0] for b in options]})
        if module == '7':
            output[-1].update(sourcePage=item['page'], sourceNumber=num)
        answers[str(num)] = [i for i, block in enumerate(options, 1) if block[2]]
    if len(output) != topics[-1][0]:
        raise ValueError(f'Найдено {len(output)} вопросов вместо {topics[-1][0]}')
    return {'questions': output,
            'topics': [{'id': tid, 'title': title, 'subtitle': subtitle}
                       for _, tid, title, subtitle in topics], 'answers': answers}


if __name__ == '__main__':
    module, source, target = sys.argv[1:]
    data = extract(module, source)
    Path(target).write_text('/* Вопросы и подсвеченные ответы из PDF коллоквиума ' + module + '. */\n'
                            'window.' + ('CREDIT_' + module[-1] if module.startswith('credit-') else 'COLLOQUIUM_' + module) + ' = ' +
                            json.dumps(data, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
    print(f"Коллоквиум {module}: {len(data['questions'])} вопросов, {len(data['answers'])} ответов")
