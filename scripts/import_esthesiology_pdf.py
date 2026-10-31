#!/usr/bin/env python3
"""Импорт таблицы эстезиологии и черепных нервов с ключом из PDF.

Нужен PyMuPDF:
  python scripts/import_esthesiology_pdf.py 'анат 7 коллок.pdf' js/data/colloquium-5.js
В исходнике верные ответы обозначены зелёной подсветкой. Дополнительно
проверяем столбец +/-; единственное расхождение — вопрос 15, вариант 2:
он выделен зелёным, хотя знак «+» отсутствует. Используем зелёный ключ.
"""
import bisect
import json
import re
import sys
from pathlib import Path

import pymupdf

TOPICS = [
    (39, 'eye', 'Глазное яблоко и вспомогательные структуры'),
    (46, 'visual-pathways', 'Проводящие пути зрительного анализатора'),
    (62, 'external-middle-ear', 'Наружное и среднее ухо'),
    (78, 'inner-ear', 'Внутреннее ухо и равновесие'),
    (85, 'hearing-pathways', 'Слуховые и вестибулярные проводящие пути'),
    (103, 'cranial-nerves', 'Черепные нервы: общие вопросы'),
    (132, 'trigeminal', 'Тройничный нерв и иннервация лица'),
    (145, 'facial', 'Лицевой нерв'),
    (161, 'glossopharyngeal-vagus', 'Языкоглоточный и блуждающий нервы'),
]


def clean(text):
    return re.sub(r'\s+', ' ', text).strip()


def extract(path):
    questions = []
    with pymupdf.open(path) as pdf:
        for page_no, page in enumerate(pdf, 1):
            if page_no == 1:  # титульная страница без вопросов
                continue
            drawings = page.get_drawings()
            borders = sorted({round((r.y0 + r.y1) / 2, 2)
                              for d in drawings if d.get('fill') and max(d['fill']) < .1
                              for it in d['items'] if it[0] == 're' for r in [it[1]]
                              if r.height < 1.2 and r.width > 300})
            if not borders:
                raise ValueError(f'На странице {page_no} не найдены границы строк')
            green = [d['rect'] for d in drawings if d.get('fill') and
                     d['fill'][0] < .1 and d['fill'][1] > .8 and d['fill'][2] < .1]
            rows = {}
            for block in page.get_text('dict')['blocks']:
                for line in block.get('lines', []):
                    text = clean(''.join(s['text'] for s in line['spans']))
                    if not text:
                        continue
                    rect = pymupdf.Rect(line['bbox'])
                    x, y = rect.x0, (rect.y0 + rect.y1) / 2
                    row = rows.setdefault(bisect.bisect_right(borders, y),
                                          {'number': [], 'marker': [], 'text': [], 'green': False})
                    if x < 94:
                        row['number'].append(text)
                    elif x < 110:
                        # В вопросе 25 PDF склеивает знак и текст в одну строку.
                        match = re.fullmatch(r'([+-])\s*(.*)', text)
                        if match:
                            row['marker'].append(match.group(1))
                            if match.group(2):
                                row['text'].append(match.group(2))
                                row['green'] |= any((rect & mark).get_area() > 0 for mark in green)
                        else:
                            row['marker'].append(text)
                    else:
                        row['text'].append(text)
                        row['green'] |= any((rect & mark).get_area() > 0 for mark in green)
            for _, row in sorted(rows.items()):
                text = clean(' '.join(row['text']))
                number = clean(' '.join(row['number']))
                marker = clean(' '.join(row['marker']))
                # Пустые служебные строки с жёлтыми номерами разделов.
                if not text:
                    continue
                if number:
                    if not number.isdigit() or int(number) != len(questions) + 1:
                        raise ValueError(f'Неожиданный номер {number!r} на странице {page_no}')
                    questions.append({'num': int(number), 'page': page_no, 'text': text, 'options': []})
                elif not questions:
                    raise ValueError(f'Вариант до первого вопроса на странице {page_no}')
                else:
                    if marker not in ('', '+', '-'):
                        raise ValueError(f'Неожиданная метка {marker!r} в вопросе {questions[-1]["num"]}')
                    questions[-1]['options'].append((text, marker, row['green']))
    if len(questions) != 161:
        raise ValueError(f'Ожидался 161 вопрос, найдено {len(questions)}')
    output, answers, mismatches = [], {}, []
    for q in questions:
        n, opts = q['num'], q['options']
        if len(opts) != 5 or not any(o[2] for o in opts):
            raise ValueError(f'Проверьте варианты и ключ вопроса {n}: {opts!r}')
        for i, (_, marker, is_green) in enumerate(opts, 1):
            if (marker == '+') != is_green:
                mismatches.append((n, i))
        topic = next(tid for end, tid, _ in TOPICS if n <= end)
        output.append({'id': f'q{n}', 'pos': n, 'num': n, 'topic': topic,
                       'text': q['text'], 'options': [o[0] for o in opts],
                       'sourcePage': q['page'], 'sourceNumber': n})
        answers[str(n)] = [i for i, o in enumerate(opts, 1) if o[2]]
    if mismatches != [(15, 2)]:
        raise ValueError(f'Расхождение зелёной подсветки и знаков: {mismatches}')
    return {'questions': output,
            'topics': [{'id': tid, 'title': title, 'subtitle': ''} for _, tid, title in TOPICS],
            'answers': answers}


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    data = extract(sys.argv[1])
    Path(sys.argv[2]).write_text('/* Вопросы и зелёные ответы из PDF эстезиологии и черепных нервов. */\nwindow.COLLOQUIUM_5 = ' +
                                json.dumps(data, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
    print(f'Импортировано {len(data["questions"])} вопросов и ключей; расхождение PDF: №15 вариант 2')
