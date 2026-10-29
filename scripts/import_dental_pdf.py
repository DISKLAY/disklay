#!/usr/bin/env python3
"""Извлечь вопросы из таблиц предоставленных стоматологических PDF без ключей.

Требуется PyMuPDF. Пример:
  python scripts/import_dental_pdf.py 2 modul2.pdf js/data/dental-2.js
  python scripts/import_dental_pdf.py 3 modul3.pdf js/data/dental-3.js
Нумерация в таблице начинается заново в каждом разделе. Поэтому создаём
сквозную нумерацию, сохраняя номер и страницу исходной строки отдельно.
"""
import bisect
import json
import sys
from pathlib import Path

import pymupdf

CONFIG = {
    '2': {
        'variable': 'DENTAL_2', 'count': 102, 'text_x': 71.16, 'number_x': 28.32, 'group_x': 55.08, 'end_x': 779,
        'topics': [
            (7, 'pharynx', 'Глотка'),
            (18, 'esophagus-stomach', 'Пищевод и желудок'),
            (33, 'intestines', 'Тонкая и толстая кишка'),
            (37, 'liver', 'Печень'),
            (45, 'peritoneum', 'Брюшина'),
            (56, 'upper-airways', 'Носовая полость и гортань'),
            (69, 'lungs', 'Трахея, бронхи и лёгкие'),
            (78, 'kidneys', 'Почки и нефрон'),
            (84, 'urinary', 'Мочеточник и мочевой пузырь'),
            (96, 'male', 'Мужские половые органы'),
            (102, 'female', 'Женские половые органы'),
        ],
    },
    '3': {
        'variable': 'DENTAL_3', 'count': 132, 'text_x': 93.26, 'number_x': 56.64, 'group_x': 79.44, 'end_x': 466,
        'topics': [
            (4, 'circulation', 'Круги кровообращения'),
            (32, 'heart', 'Сердце и перикард'),
            (49, 'arteries', 'Артерии'),
            (65, 'veins', 'Вены'),
            (73, 'lymph', 'Лимфатическая и иммунная системы'),
            (84, 'spinal-cord', 'Спинной мозг и оболочки'),
            (97, 'spinal-nerves', 'Спинномозговые нервы и сплетения'),
            (106, 'brain', 'Головной мозг'),
            (121, 'cerebrum', 'Большой и промежуточный мозг'),
            (128, 'pathways', 'Проводящие пути'),
            (132, 'autonomic', 'Автономная нервная система'),
        ],
    },
}


def rows_of(page, cfg):
    # Горизонтальные линии отделяют строки таблицы, даже когда ответ перенесён
    # на несколько строк текста. Цветную заливку (заголовки) не используем.
    borders = sorted(set(round((r.y0 + r.y1) / 2, 1) for drawing in page.get_drawings()
                         if drawing.get('fill') and max(drawing['fill']) < .1
                         for r in [drawing['rect']]
                         if r.height < 1 and r.width > 100 and abs(r.x0 - cfg['text_x']) < 2))
    if not borders:
        raise ValueError('Не найдены границы таблицы')
    rows = {}
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            text = ''.join(span['text'] for span in line['spans']).strip()
            if not text:
                continue
            x = line['bbox'][0]
            y = (line['bbox'][1] + line['bbox'][3]) / 2
            if abs(x - cfg['number_x']) < 3:
                col = 'num'
            elif abs(x - cfg['group_x']) < 3:
                col = 'group'
            elif cfg['text_x'] + 3 <= x < cfg['end_x']:
                col = 'text'
            else:
                continue
            row = bisect.bisect_right(borders, y)
            rows.setdefault(row, {}).setdefault(col, []).append(text)
    return [{key: ' '.join(value) for key, value in rows[i].items()} for i in sorted(rows)]


def extract(module, source):
    cfg = CONFIG[module]
    raw = []
    current = None
    with pymupdf.open(source) as document:
        for page_number, page in enumerate(document, 1):
            for row in rows_of(page, cfg):
                num, group, text = row.get('num'), row.get('group'), row.get('text')
                if num and group:  # строка-заголовок раздела
                    continue
                if num and text:
                    if not num.isdigit():
                        raise ValueError(f'Неожиданный номер {num!r} на странице {page_number}')
                    current = {'sourceNumber': int(num), 'sourcePage': page_number,
                               'text': text, 'options': []}
                    raw.append(current)
                elif text and current:
                    current['options'].append(text)
                elif num:
                    raise ValueError(f'Номер без текста: {num!r}, страница {page_number}')

    # В модуле 3 второй вариант вопроса 28 разорван границей страниц 6–7.
    if module == '3':
        options = raw[27]['options']
        if len(options) != 6 or not options[1].endswith('предсердно-желудочковое') or not options[2].startswith('отверстие'):
            raise ValueError('Изменилась структура перенесённого ответа вопроса 28')
        options[1:3] = [options[1] + ' ' + options[2]]
    if len(raw) != cfg['count'] or any(len(q['options']) != 5 for q in raw):
        raise ValueError('Неожиданное число вопросов или вариантов; требуется проверка исходного PDF')

    questions = []
    for pos, q in enumerate(raw, 1):
        topic = next(key for end, key, _ in cfg['topics'] if pos <= end)
        questions.append({'id': f'q{pos}', 'pos': pos, 'num': pos, 'topic': topic, **q})
    topics = [{'id': key, 'title': title, 'subtitle': 'Стоматологический факультет'}
              for _, key, title in cfg['topics']]
    return {'questions': questions, 'topics': topics, 'answers': {}}


if __name__ == '__main__':
    module, source, target = sys.argv[1:]
    data = extract(module, source)
    out = f"/* Стоматологический факультет, модуль {module}: вопросы без ключа. */\nwindow.{CONFIG[module]['variable']} = "
    Path(target).write_text(out + json.dumps(data, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
    print(f"Модуль {module}: {len(data['questions'])} вопросов, ключ не загружен")
