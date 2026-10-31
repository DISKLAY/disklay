#!/usr/bin/env python3
"""Импорт компактного двухколоночного PDF ПНС с отмеченными ответами.

Требуется PyMuPDF:
  python scripts/import_pns_pdf.py ПНС_A4_компакт.pdf js/data/colloquium-6.js
Жирные строки на левом краю — условие, строки с отступом — варианты;
галочка в PDF означает правильный вариант. Разбиение на темы условное.
"""
import json
import re
import sys
from pathlib import Path

import pymupdf

TOPICS = [
    (5, 'thoracic-nerves', 'Грудные спинномозговые нервы'),
    (10, 'cervical-plexus', 'Шейное сплетение'),
    (30, 'brachial-plexus', 'Плечевое сплетение и нервы руки'),
    (49, 'lumbar-plexus', 'Поясничные нервы и сплетение'),
    (70, 'sacral-plexus', 'Крестцовое сплетение и нервы ноги'),
    (87, 'autonomic-general', 'Вегетативная нервная система'),
    (110, 'autonomic-head', 'Вегетативные узлы и нервы головы'),
    (118, 'autonomic-organs', 'Вегетативная иннервация органов'),
]


def clean(text):
    return re.sub(r'\s+', ' ', text).strip()


def extract(path):
    questions = []
    with pymupdf.open(path) as pdf:
        for page_no, page in enumerate(pdf, 1):
            # Все строки каждой колонки идут сверху вниз. Отступ в 6 пунктов
            # отделяет варианты от заголовка, даже когда PyMuPDF склеил блоки.
            columns = [[], []]
            for block in page.get_text('dict')['blocks']:
                for line in block.get('lines', []):
                    x, y = line['bbox'][:2]
                    if y < 20:
                        continue
                    col = 0 if x < 300 else 1
                    base = 22.7 if col == 0 else 304.7
                    if abs(x - base) < 1:
                        kind = 'question'
                    elif abs(x - base - 6) < 1:
                        kind = 'options'
                    else:
                        raise ValueError(f'Неожиданный отступ страницы {page_no}: {x}')
                    text = ''.join(span['text'] for span in line['spans'])
                    columns[col].append((y, kind, text))
            for col in columns:
                for _, kind, text in sorted(col, key=lambda item: item[0]):
                    match = re.match(r'^(\d+)\.\s*(.*)', text) if kind == 'question' else None
                    if match:
                        n = int(match.group(1))
                        if n != len(questions) + 1:
                            raise ValueError(f'Неожиданный номер: {n} на странице {page_no}')
                        questions.append({'num': n, 'sourcePage': page_no,
                                          'title': [match.group(2)], 'options_text': []})
                    elif not questions:
                        raise ValueError(f'Текст перед первым вопросом на странице {page_no}')
                    elif kind == 'question':
                        if questions[-1]['options_text']:
                            raise ValueError(f'Продолжение условия после вариантов: {questions[-1]["num"]}')
                        questions[-1]['title'].append(text)
                    else:
                        questions[-1]['options_text'].append(text)
    if len(questions) != 118:
        raise ValueError(f'Ожидалось 118 вопросов, получено {len(questions)}')
    output, answers = [], {}
    for item in questions:
        n = item['num']
        fragments = clean(' '.join(item['options_text'])).split('|')
        if len(fragments) != 5:
            raise ValueError(f'В вопросе {n}: вариантов {len(fragments)}, а не 5')
        options, key = [], []
        for i, part in enumerate(fragments, 1):
            part = clean(part)
            if part.startswith('✓'):
                key.append(i)
                part = clean(part[1:])
            if not part or '✓' in part:
                raise ValueError(f'Повреждён вариант {i} вопроса {n}')
            options.append(part)
        if not key:
            raise ValueError(f'Не отмечены ответы вопроса {n}')
        topic = next(topic for end, topic, _ in TOPICS if n <= end)
        output.append({'id': f'q{n}', 'pos': n, 'num': n, 'topic': topic,
                       'text': clean(' '.join(item['title'])), 'options': options,
                       'sourcePage': item['sourcePage'], 'sourceNumber': n})
        answers[str(n)] = key
    topics = [{'id': key, 'title': title, 'subtitle': ''} for _, key, title in TOPICS]
    return {'questions': output, 'topics': topics, 'answers': answers}


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    data = extract(sys.argv[1])
    Path(sys.argv[2]).write_text('/* Вопросы и отмеченные ответы из компактного PDF ПНС. */\nwindow.COLLOQUIUM_6 = ' +
                                json.dumps(data, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
    print(f'Импортировано {len(data["questions"])} вопросов и ключей')
