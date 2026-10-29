#!/usr/bin/env python3
"""Перенос вопросов и подсвеченных вариантов из PDF. Требуется PyMuPDF.

python scripts/import_colloquium_pdf.py 2 path/to/myology.pdf js/data/colloquium-2.js
python scripts/import_colloquium_pdf.py 3 path/to/splanchnology.pdf js/data/colloquium-3.js
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
}


def extract(module, source):
    topics = TOPICS[module]
    questions, answers = [], {}
    current = None
    with pymupdf.open(source) as document:
        for page in document:
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
                    current = {'num': int(re.search(r'\d+', text).group()), 'blocks': []}
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
        if not 2 <= len(options) <= 6 or not any(b[2] for b in options):
            raise ValueError(f'Проверьте варианты и подсветку вопроса № {num}')
        topic = next(topic_id for end, topic_id, _, _ in topics if num <= end)
        output.append({'id': f'q{num}', 'pos': position, 'num': num, 'topic': topic,
                       'text': blocks[0][0], 'options': [b[0] for b in options]})
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
                            'window.COLLOQUIUM_' + module + ' = ' +
                            json.dumps(data, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
    print(f"Коллоквиум {module}: {len(data['questions'])} вопросов, {len(data['answers'])} ответов")
