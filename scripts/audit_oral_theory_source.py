#!/usr/bin/env python3
"""Character coverage check against the supplied PDF (requires PyMuPDF)."""
import collections,json,re,unicodedata
from pathlib import Path
import pymupdf
root=Path(__file__).resolve().parents[1]
raw=(root/'js/anatomy-oral-source.js').read_text(encoding='utf8').split('=',1)[1].strip().removesuffix(';')
sections=json.loads(raw);pdf=pymupdf.open(root/'assets/anatomy/colloquium-1-oral-theory.pdf')
def chars(s):
 return collections.Counter(c for c in unicodedata.normalize('NFC',s).lower() if c.isalnum())
original=''.join(page.get_text() for page in pdf[3:]);out=[]
for sec in sections:
 for block in sec['blocks']:
  if block['type']=='table':out.append((block.get('caption') or '')+' '.join(block['headers'])+' '.join(' '.join(row) for row in block['rows']))
  else:out.append(''.join(run['text'] for run in block['runs']))
missing=chars(original)-chars(' '.join(out));difference=sum(missing.values())
print('Source characters:',sum(chars(original).values()),'unrepresented:',difference,'details:',dict(missing))
assert difference<=5, 'Source text coverage regressed; investigate missing characters.'
assert [s['id'] for s in sections]==list(range(1,73))
# Check word order within each ordinary source page. The four exceptions are
# explicitly restructured: footnote, classification diagram, continued table.
for number in range(4,96):
 if number in (7,11,39,40): continue
 source=pdf[number-1].get_text()
 blocks=[b for section in sections for b in section['blocks'] if b['page']==number]
 extracted=' '.join(''.join(r['text'] for r in b['runs']) if 'runs' in b else ' '.join(' '.join(row) for row in b['rows']) for b in blocks)
 tokens=lambda x:re.findall(r'[а-яёa-z0-9]+',x.lower())
 a,b=tokens(source),tokens(extracted)
 assert a==b, f'Word order or content differs on page {number}'
print('72 topic boundaries, source character coverage and word order on 88 ordinary pages passed.')
