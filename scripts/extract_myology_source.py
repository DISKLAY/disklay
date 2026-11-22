#!/usr/bin/env python3
"""Переносит расписанную теорию по миологии из PDF в js/myology-source.js.

Источник: assets/anatomy/myology/questions-source.pdf (студенческий конспект).
Страница 1 (обложка со «вторым номером коллоквиума») и страница 25 (личное фото
и QR для донатов) не переносятся. Исключаются логотип и два QR-кода со ссылками
на внешние сайты. Всё остальное переносится как есть, включая неформальные
врезки: текст — дословно, фото — файлами в assets/anatomy/myology/figures/.
"""
import json, re, sys
from pathlib import Path
import pymupdf

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'assets/anatomy/myology/questions-source.pdf'
OUT_JS = ROOT / 'js/myology-source.js'
FIG_DIR = ROOT / 'assets/anatomy/myology/figures'
SKIP_PAGES = {1, 25}          # обложка и финал с личным фото/QR
SKIP_XREFS = {30, 670, 867}   # логотип на каждой странице; QR-ссылки на внешние сайты
TABLE_PAGES = {4}

FIG_ALTS = {
    (2, 46): 'Схема видов мышечных тканей: гладкая, исчерченная скелетная и исчерченная сердечная',
    (3, 84): 'Схема моторной (двигательной) единицы: нейрон и иннервируемые им мышечные волокна',
    (4, 122): 'Анатомический поперечник (слева) и физиологический поперечник (справа) мышцы',
    (5, 186): 'Схема миотомов зародыша и зон, из которых развиваются мышцы',
    (9, 324): 'Фасции шеи на поперечном срезе: поверхностная пластинка, предтрахеальная, предпозвоночная, внутришейная фасция, сонное влагалище, надгрудинное и предвисцеральное пространства',
    (10, 350): 'Аутохтонные мышцы туловища и мышцы-«пришельцы»: трункопетальные и трункофугальные',
    (11, 373): 'Дыхательные мышцы: основные и вспомогательные мышцы вдоха и выдоха',
    (12, 412): 'Треугольники шеи: лопаточно-ключичный, лопаточно-трапециевидный, сонный, лопаточно-трахеальный, поднижнечелюстной',
    (14, 467): 'Скриншот заметки об этимологии слова «херня» (от лат. hernia — грыжа), приведён в исходном конспекте',
    (15, 508): 'Влагалище прямой мышцы живота выше и ниже пупка: соотношение апоневрозов',
    (15, 509): 'Скользящая (аксиальная) и параэзофагеальная грыжи пищеводного отверстия диафрагмы',
    (16, 539): 'Паховый канал: апоневрозы, поперечная фасция и паховая связка',
    (19, 669): 'Над- и подгрушевидное отверстия: выход седалищного и ягодичных сосудисто-нервных пучков',
    (20, 704): 'Бедренный канал: расположение и содержимое',
    (21, 749): 'Бедренный треугольник (femoral triangle): границы и содержимое',
    (22, 786): 'Приводящий канал (canalis adductorius): гребенчатая и приводящие мышцы бедра',
}
# Таблица со страницы 4 восстанавливается вручную: текстовый слой разорван,
# а векторная отрисовка не образует корректных ячеек программно.
TABLE_P4 = {
    'type': 'table',
    'caption': 'Форма и функции мышц',
    'headers': ['Форма', 'Функция'],
    'rows': [
        ['веретенообразные мышцы', 'явл. длинными рычагами (двуглавая мышца плеча)'],
        ['широкие мышцы', 'участвуют в образовании стенок туловища (прямая мышца живота)'],
        ['одно-, дву- и многоперистые мышцы', 'в зависимости от того, по одну сторону от сухожилия или на две и более сторон ложатся мышечные пучки, например, многоперистая дельтовидная мышца.'],
        ['мышцы, имеющие несколько головок или брюшек', 'двух-, трех-, четырехглавые мышцы конечностей; двубрюшная на шее.'],
        ['мышцы, в названиях которых отражена функция', 'разгибатель, сгибатель, приводящая, отводящая, поднимающая, опускающая, сжимающая и т. д.'],
    ],
}

STOPWORDS = {'в','во','на','к','ко','с','со','по','и','а','или','у','от','до','из','об','о','не','для','их','это','как','про','без','при','что','они','она','его','её','the','of','to'}
# Вопросы, которых нет в источнике отдельным заголовком либо заголовок слишком короткий:
# привязываем вручную к странице и началу строки.
MANUAL_ANCHORS = {
    10: (8, 'Костно-фиброзные и фиброзные влагалища'),
    61: (21, '62. Бедренный треугольник'),
}

def tokens(text):
    text = text.lower().replace('ё', 'е')
    return [t for t in re.split(r'[^a-zа-я0-9]+', text) if len(t) > 1 and t not in STOPWORDS]

def first_sentence_tokens(text):
    head = re.split(r'(?<=[.!?])\s+', text.strip(), maxsplit=1)[0]
    return set(tokens(head))

def load_questions():
    raw = (ROOT / 'js/myology-data.js').read_text(encoding='utf-8')
    start = raw.index('{')
    return json.JSONDecoder().raw_decode(raw, start)[0]['questions']

def clean_text(text):
    text = text.replace('\uf04a', ':)')  # Wingdings-смайлик
    return re.sub(r'[ \t\xa0]+', ' ', text).strip()

question_re = re.compile(r'^\s*(\d{1,2})\.\s+(?=[A-ZА-Я««(])')
banner_re = re.compile(r'^[А-ЯЁ0-9 №:«»,.·-]{4,}$')

def main():
    questions = load_questions()
    q_tokens = [(q['id'], set(tokens(q['text'])), first_sentence_tokens(q['text'])) for q in questions]
    anchored = {}

    src = pymupdf.open(SRC)
    pages_out = []
    figure_count = 0
    for pageno in range(2, src.page_count + 1):
        if pageno in SKIP_PAGES:
            continue
        page = src[pageno - 1]
        blocks = []
        # --- таблица (страница 4): выкидываем её текстовые блоки и вставляем вручную
        table_bbox = None
        if pageno in TABLE_PAGES:
            found = page.find_tables()
            if found.tables:
                rects = [t.bbox for t in found.tables]
                table_bbox = (min(r[0] for r in rects), min(r[1] for r in rects),
                              max(r[2] for r in rects), max(r[3] for r in rects))
        table_inserted = False
        # --- текстовые блоки
        for block in page.get_text('blocks'):
            x0, y0, x1, y1, text = block[:5]
            if block[6] != 0:
                continue
            if table_bbox and (y1 > table_bbox[1] and y0 < table_bbox[3] + 14):
                if not table_inserted:
                    blocks.append(('table_marker', table_bbox[1]))
                    table_inserted = True
                continue
            text = clean_text(text)
            if not text:
                continue
            # разрезаем блок на части в местах, где начинается вопрос (N. ...) или баннер (ТОПОГРАФИЯ ...)
            parts, current = [], []
            for line in text.splitlines():
                stripped = line.strip()
                is_banner = bool(banner_re.match(stripped)) and any(c.isalpha() for c in stripped) and stripped == stripped.upper()
                if (question_re.match(line) or is_banner) and current:
                    parts.append(' '.join(current)); current = [stripped]
                else:
                    current.append(stripped)
            if current:
                parts.append(' '.join(current))
            for part in parts:
                part = re.sub(r'\s+', ' ', part).strip()
                if part:
                    blocks.append(('text', y0, part))
        # --- картинки
        for image in page.get_images(full=True):
            xref = image[0]
            if xref in SKIP_XREFS:
                continue
            rects = page.get_image_rects(xref)
            if not rects:
                continue
            rect = rects[0]
            alt = FIG_ALTS.get((pageno, xref))
            if not alt:
                print(f'WARNING: нет alt для p{pageno} x{xref}', file=sys.stderr)
                alt = f'Иллюстрация со страницы {pageno} исходного конспекта'
            ext = src.extract_image(xref)['ext']
            name = f'p{pageno:02d}-{xref}.{ext}'
            target = FIG_DIR / name
            if not target.exists():
                target.write_bytes(src.extract_image(xref)['image'])
            figure_count += 1
            blocks.append(('figure', rect.y0, {
                'file': 'assets/anatomy/myology/figures/' + name,
                'width': int(image[2]), 'height': int(image[3]), 'alt': alt}))
        blocks.sort(key=lambda b: (b[1], 0 if b[0] == 'table_marker' else 1))
        # --- классификация и якоря
        out_blocks = []
        for item in blocks:
            if item[0] == 'table_marker':
                out_blocks.append(TABLE_P4)
                continue
            if item[0] == 'figure':
                out_blocks.append({'type': 'figure', **item[2]})
                continue
            part = item[2]
            first_line = part.split('. ', 1)[0] + '. ' if question_re.match(part) else ''
            cand_tokens = set(tokens(part))
            matched = None
            manual = next((qid for qid, (page, needle) in MANUAL_ANCHORS.items()
                          if page == pageno and needle in part and qid not in anchored), None)
            if manual is not None:
                matched = manual
            else:
                m = question_re.match(part)
                if m:
                    best, best_score = None, 0.0
                    for qid, qset, first_set in q_tokens:
                        if qid in anchored:
                            continue
                        score = max(len(cand_tokens & qset) / max(1, len(qset)),
                                    (len(cand_tokens & first_set) / max(1, len(first_set))) if first_set else 0.0)
                        if score > best_score:
                            best, best_score = qid, score
                    if best is not None and best_score >= 0.75:
                        matched = best
            if matched is not None:
                anchored[matched] = pageno
                body = question_re.sub('', part, count=1).strip()
                out_blocks.append({'type': 'heading', 'anchor': matched, 'text': body})
                continue
            if banner_re.match(part) and any(c.isalpha() for c in part) and part == part.upper():
                out_blocks.append({'type': 'banner', 'text': part})
                continue
            out_blocks.append({'type': 'text', 'text': part})
        pages_out.append({'page': pageno, 'blocks': out_blocks})

    # --- отчёт о покрытии
    missing = [q['id'] for q in questions if q['id'] not in anchored]
    print('Вопросов привязано:', len(anchored), 'из', len(questions))
    if missing:
        print('Без якоря (останутся без ссылки «К материалу»):', missing)
    print('Картинок перенесено:', figure_count)

    payload = json.dumps(pages_out, ensure_ascii=False, indent=1)
    OUT_JS.write_text(
        '/* Полный текст расписанной теории по миологии, перенесённый из исходного PDF.\n'
        '   Сгенерировано scripts/extract_myology_source.py — не редактируйте вручную;\n'
        '   правки вносите в исходный PDF или в скрипт. Страницы 1 и 25 не переносятся. */\n'
        'window.MedzoMyologySource=' + payload + ';\n',
        encoding='utf-8')
    print('Записано:', OUT_JS)

if __name__ == '__main__':
    main()
