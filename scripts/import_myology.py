#!/usr/bin/env python3
"""Extract the supplied myology lists and page references, preserving originals.
Requires PyMuPDF and Pillow. Run from repository root.
"""
from pathlib import Path
import json,re
import pymupdf as fitz
ROOT=Path(__file__).resolve().parents[1]
base=ROOT/'assets/anatomy/myology'

def clean(s): return re.sub(r'\s+',' ',s).strip()
def norm(s): return re.sub(r'[^a-z0-9]+',' ',s.lower()).strip()
groups=[('face','Мимические мышцы',1),('chewing','Жевательные мышцы',15),('neck','Мышцы шеи',19),('back','Мышцы спины',39),('chest','Мышцы груди',54),('diaphragm','Диафрагма',65),('abdomen','Мышцы живота',74),('upper','Верхняя конечность',83),('lower','Нижняя конечность',120),('topography','Топографические образования',171)]
sp=fitz.open(base/'skills-list.pdf');flat='\n'.join(p.get_text() for p in sp)
parts=re.split(r'(?m)^\s*(\d{1,3})\.\s*',flat)
assert len(parts)==445, len(parts)
items=[]
for i in range(1,len(parts),2):
 n=int(parts[i]);raw=parts[i+1]; lines=[x.strip() for x in raw.splitlines() if x.strip()];
 # Group headings start on their own line and are not part of a skill.
 lines=[x for x in lines if x not in ['Musculi faciei','Musculi masticatorii','Musculi colli','Musculi dorsi','Musculi thoracis','Diaphragma','Musculi abdominis','Musculi membri superioris','Musculi membri inferioris','Топографические образования']]
 latin=clean(' '.join(lines));group=next(g for g in reversed(groups) if n>=g[2]);
 page=next(p.number+1 for p in sp if re.search(r'(?m)^\s*'+str(n)+r'\.\s*',p.get_text()))
 items.append({'id':n,'latin':latin,'group':group[0],'hint':group[1],'page':page})
assert [x['id'] for x in items]==list(range(1,223));assert items[0]['latin']=='M. epicranius';assert items[-1]['latin']=='Sulcus plantaris lateralis'
qdoc=fitz.open(base/'questions-list.pdf');raw='\n'.join(p.get_text() for p in qdoc);raw=raw.replace('ТОПОГРАФИЯ И ФАСЦИИ','');questions=[clean(q.replace('- «','-«')) for q in raw.split('')[1:]]
assert len(questions)==66,len(questions)
# The handwritten source splits the combined question 7 into two and adds
# a separate fascia item; it omits a standalone heading for official question 10.
source=fitz.open(base/'questions-source.pdf');heads={}
for p in source:
 for b in p.get_text('dict')['blocks']:
  for line in b.get('lines',[]):
   for span in line['spans']:
    text=span['text'].strip()
    if span['size']>13.5 and span['flags']&16 and re.fullmatch(r'\d{1,2}\.',text):
     n=int(text[:-1]); assert n not in heads,(n,heads[n]); heads[n]=(p.number+1,span['bbox'][1])
assert set(heads)==set(range(1,68)),sorted(set(range(1,68))-set(heads))
def source_numbers(n):
 if n<=6:return [n]
 if n==7:return [7,8]
 if n==8:return [9]
 if n==9:return [10]
 if n==10:return [10]
 if n<=16:return [n]
 if n==17:return [17,18]
 return [n+1]
def pages_for(n):
 result=set()
 for k in source_numbers(n):
  start=heads[k][0];end=heads[k+1][0] if k<67 else len(source)
  result.update(range(start,end+1))
 return sorted(result)
# Verified against the original: some items are headings only, others are a
# diagram or an external-link QR rather than a written answer.
blank=set(range(11,14))|set(range(16,30))|set(range(31,43))|{50,55,57}
scheme={1,30}; external={56,65}; partial={10,15}
def source_status(n):
 return 'heading-only' if n in blank else 'diagram' if n in scheme else 'external' if n in external else 'partial' if n in partial else 'text'
qrows=[{'id':i+1,'text':q,'pages':pages_for(i+1),'sourceNumbers':source_numbers(i+1),'sourceStatus':source_status(i+1)} for i,q in enumerate(questions)]
# Conservative page candidates only: exact Latin phrase immediately before a
# dash/colon. Similar terms, variants and typos must not be auto-corrected.
variant_docs=[fitz.open(base/f'skills-variant-{i}.pdf') for i in [1,2]]
for item in items:
 term=item['latin'];item['references']=[]
 if len(term)>90 or '(' in term or ',' in term:continue
 words=re.findall(r'[A-Za-z]+',term)
 if len(words)<2:continue
 pattern=r'(?<![A-Za-z])'+r'[\s.\-]*'.join(map(re.escape,words))+r'\s*[–—:]'
 for variant,doc in enumerate(variant_docs,1):
  for p in doc:
   if re.search(pattern,p.get_text(),re.I):item['references'].append({'variant':variant,'page':p.number+1})
# Save page-level searchable text and small previews of complete original pages.
variant_pages=[]
for variant,doc in enumerate(variant_docs,1):
 rows=[]
 for p in doc:
  rows.append({'page':p.number+1,'text':clean(p.get_text())})
  out=base/f'variant-{variant}-pages'/f'{p.number+1:02}.webp';out.parent.mkdir(exist_ok=True)
  pix=p.get_pixmap(matrix=fitz.Matrix(1.35,1.35),alpha=False)
  from PIL import Image
  Image.frombytes('RGB',[pix.width,pix.height],pix.samples).save(out,format='WEBP',quality=78,method=5)
 variant_pages.append(rows)
for p in source:
 out=base/'question-pages'/f'{p.number+1:02}.webp';out.parent.mkdir(exist_ok=True)
 pix=p.get_pixmap(matrix=fitz.Matrix(1.35,1.35),alpha=False)
 from PIL import Image
 Image.frombytes('RGB',[pix.width,pix.height],pix.samples).save(out,format='WEBP',quality=80,method=5)
data={'groups':[{'id':x,'name':name,'from':n,'to':groups[i+1][2]-1 if i+1<len(groups) else 222} for i,(x,name,n) in enumerate(groups)],'skills':items,'questions':qrows,'variantPages':variant_pages,'theoryPages':[{'page':p.number+1,'text':p.get_text()} for p in source]}
(ROOT/'js/myology-data.js').write_text('/* Generated by scripts/import_myology.py from the supplied PDFs. */\nwindow.MedzoMyologyData = '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8')
print(f'{len(items)} skills, {len(questions)} questions; exact page candidates: {sum(bool(x["references"]) for x in items)}; {len(heads)} source headings')
