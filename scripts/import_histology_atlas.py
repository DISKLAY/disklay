#!/usr/bin/env python3
"""Import selected informative pages from the four user-provided histology PDFs.

Usage: python scripts/import_histology_atlas.py /path/to/pdf-directory
Requires PyMuPDF and Pillow. The files themselves are not distributed here.
Page mappings are deliberately explicit: a page may contain multiple annotated
micrographs, or both an unlabelled and an annotated version of the same image.
The source's annotations, watermarks, slide numbers and page decoration remain.
"""
import sys
import json
from pathlib import Path
import pymupdf
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PARTS = ['Гистология_0001-0112.pdf', 'Гистология_0113-0220-сжатый.pdf',
         'Гистология_0221-0330-сжатый.pdf', 'Гистология_0331-0426-сжатый.pdf']
# 1-based physical page numbers, checked against the supplied PDFs.
# Annotated pages are favoured when a bare page is exactly the same micrograph.
PAGES = {
    'p40': [(1,[9,10])], 'h01': [(1,list(range(13,28)))],
    'p62': [(1,[29,30,31,32,33])], 'p62a': [(1,[34,35])],
    'h02': [(1,[38,40,42,43])], 'h03': [(1,[46,48,50,52,54])],
    'p65': [(1,[57,58,59])], 'h04': [(1,[63,65,67,69,71])],
    'p68': [(1,[73,75,77,79,81])], 'p69': [(1,[83,84,85])],
    'p85': [(1,[88,90])], 'p86a': [(1,[92,94,96,98,99,100])],
    'p89': [(1,[103,104])], 'h05': [(1,[107,109,111]),(2,[1,3,4,6,8])],
    'p92': [(2,[10,11,12])], 'p93': [(2,[14,15])], 'p95': [(2,[18,19,20])],
    'p96': [(2,[23,24,25,26])], 'p101': [(2,[29,30,31,32])],
    'p102': [(2,[34,35,36])], 'p103a': [(2,[39])],
    'p107': [(2,[41,42,43,44,45,46,47,48,50])],
    'p109': [(2,[53,54,55,56,57,58,59])],
    'p110': [(2,[61,62,63,65,66])], 'p111': [(2,[61,67,68,69,70])],
    'p112': [(2,[72,73,74,75])], 'p115': [(2,[77,78,79])],
    'p117': [(2,[82,83,84,85,86,87,88,89])],
    'p118': [(2,[92,93,94,95,96,97,98,99,100])],
    'p119': [(2,[103,104,105,106,107,108]),(3,[1,2,3,4])],
    'p125': [(3,[6,7,8])], 'p120': [(3,[10,11])], 'p121': [(3,[13])],
    'h06': [(3,[15,16,17,18])], 'p128': [(3,[20,21,22])],
    'p129': [(3,[24,25,26])], 'p130': [(3,[28,29,30,31])],
    'p131': [(3,[33,34,35])], 'p132': [(3,[38,39,40,41])],
    'p133': [(3,[43,44])], 'p135': [(3,[46,47])], 'p136': [(3,[49,50])],
    'p137': [(3,[55,56,57,58,59])], 'p139': [(3,[61,62,64,66,67,68,69])],
    'p141': [(3,[72,73,74])], 'p142': [(3,[79,81,83,84,85,86])],
    'p143': [(3,[89,90])], 'p144': [(3,[92,93,94])],
    'p146': [(3,[97,99,101,103,105,107,109]),(4,[1,3,5,7,9,11,13,15,17,19,21,23])],
    'p147': [(4,[26,28,30])], 'p149': [(4,[32,33,34,35,36])],
    'p150': [(4,[38,39,40])], 'p151': [(4,[42,43,44])],
    'p152': [(4,[46,47,48])], 'p153': [(4,[50,51,52])],
    'p154': [(4,[54,55,56,57])], 'p157': [(4,[59,60,61])],
    'p158': [(4,[65,66,67])], 'p159': [(4,[66,67,68])],
    'p113': [(4,[70])], 'p122': [(4,[72])], 'p123': [(4,[74,75])],
    'p127': [(4,[78,80])], 'p140': [(4,[82,83,84])],
    'p148': [(4,[86,87,88])], 'p155': [(4,[89,90,91,92,93])],
    'p129a': [(4,[95,96])],
}
NOTES = {
    ('p110', 2, 65): 'В источнике: щитовидная железа при гипофункции (№ 110а).',
    ('p110', 2, 66): 'В источнике: щитовидная железа при гипофункции (№ 110а).',
    ('p110', 2, 61): 'На странице также показана паращитовидная железа.',
    ('p111', 2, 61): 'На странице показаны щитовидная и паращитовидная железы.',
    ('p158', 4, 66): 'На странице показаны плодная и материнская части плаценты.',
    ('p158', 4, 67): 'На странице показаны плодная и материнская части плаценты.',
    ('p159', 4, 66): 'На странице показаны плодная и материнская части плаценты.',
    ('p159', 4, 67): 'На странице показаны плодная и материнская части плаценты.',
    ('p140', 4, 82): 'На странице показаны печень и стенка желчного пузыря.',
    ('p140', 4, 83): 'На странице показаны печень и желчный пузырь.',
    ('p127', 4, 78): 'Подпись источника; соответствие изображения нуждается в проверке.',
    ('p127', 4, 80): 'Подпись источника; соответствие изображения нуждается в проверке.',
}

def main():
    if len(sys.argv) != 2:
        sys.exit('Usage: python scripts/import_histology_atlas.py /path/to/pdf-directory')
    folder = Path(sys.argv[1])
    docs = [pymupdf.open(folder / name) for name in PARTS]
    out = ROOT / 'assets/histology/atlas'
    out.mkdir(parents=True, exist_ok=True)
    rendered = set()
    manifest = {}
    for slide_id, ranges in PAGES.items():
        records = []
        for part, pages in ranges:
            for number in pages:
                page_key = (part, number)
                filename = f'part{part}-{number:03}.webp'
                if page_key not in rendered:
                    page = docs[part-1][number-1]
                    scale = 1600 / page.rect.width
                    pix = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False)
                    image = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
                    image.save(out / filename, 'WEBP', quality=86, method=5)
                    rendered.add(page_key)
                record = {'image': 'assets/histology/atlas/' + filename,
                          'source': f'часть {part}, страница {number}'}
                if (slide_id, part, number) in NOTES:
                    record['note'] = NOTES[(slide_id, part, number)]
                records.append(record)
        manifest[slide_id] = records
    target = ROOT / 'js/histology-atlas-data.js'
    target.write_text('/* Подборка страниц из предоставленного сборника. См. scripts/import_histology_atlas.py. */\n'
                      'window.HistologyAtlasPhotos = ' + json.dumps(manifest, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
    print(f'{len(manifest)} препаратов, {len(rendered)} уникальных страниц; {target}')

if __name__ == '__main__':
    main()
