#!/usr/bin/env python3
"""Extract the supplied oral-theory PDF into searchable topic text.

Requires PyMuPDF. It preserves the source wording, emphasis, lists and examples;
only physical line wrapping is normalized. Illustrations remain available on the
original-page previews. Review the source rather than treating this as medical editing.
"""
import json, re
from pathlib import Path
import pymupdf as fitz

ROOT=Path(__file__).resolve().parents[1]
PDF=ROOT/'assets/anatomy/colloquium-1-oral-theory.pdf'
DATA=ROOT/'js/anatomy-oral-data.js'
OUT=ROOT/'js/anatomy-oral-source.js'
PREVIEWS=ROOT/'assets/anatomy/oral-source-pages'
raw=DATA.read_text(encoding='utf8').split('=',1)[1].strip().removesuffix(';')
items=json.loads(raw)
doc=fitz.open(PDF)
if len(doc)!=95 or len(items)!=72: raise RuntimeError('Unexpected source/version')
sections=[{'id':x['id'],'pages':[], 'blocks':[]} for x in items]
anchors={}
for item in items:
 page=doc[item['page']-1]; candidates=[]
 for b in page.get_text('dict')['blocks']:
  if b['type']!=0: continue
  for line in b['lines']:
   text=''.join(s['text'] for s in line['spans']).strip()
   if re.match(r'^'+str(item['id'])+r'\.\s',text):candidates.append(line)
 if item['id'] in (2,3): candidates=[x for x in candidates if x['bbox'][0]>100]
 if len(candidates)!=1:raise RuntimeError(f"Ambiguous heading {item['id']}: {len(candidates)}")
 anchors[(item['page'],round(candidates[0]['bbox'][1],1))]=item['id']

def textclean(s):
 return re.sub(r'\s+',' ',s.replace('\uf0b7','•').replace('\u00a0',' '))
def append_run(runs,text,bold=False):
 if not text:return
 text=textclean(text)
 if runs and runs[-1]['bold']==bool(bold):runs[-1]['text']+=text
 else:runs.append({'text':text,'bold':bool(bold)})

def get_lines(page):
 lines=[]
 for block in page.get_text('dict')['blocks']:
  if block['type']!=0: continue
  for line in block['lines']:
   spans=[s for s in line['spans'] if s['text'].strip()]
   if spans: lines.append({'y':line['bbox'][1],'x':line['bbox'][0],'spans':spans})
 lines.sort(key=lambda l:(l['y'],l['x']))
 # Text justified around illustrations may be split into distinct line objects
 # at the same baseline. Join in left-to-right order, not PDF object order.
 groups=[]
 for line in lines:
  if groups and abs(groups[-1][0]['y']-line['y'])<2.2:groups[-1].append(line)
  else:groups.append([line])
 out=[]
 for group in groups:
  group.sort(key=lambda l:l['x']);runs=[];prev=None
  for l in group:
   for s in sorted(l['spans'],key=lambda a:a['bbox'][0]):
    value=textclean(s['text'])
    if prev is not None and s['bbox'][0]-prev>1.3 and runs and not runs[-1]['text'].endswith(' ') and not value.startswith((' ','.',',',')',':',';')):append_run(runs,' ')
    append_run(runs,value,'Bold' in s['font']);prev=s['bbox'][2]
  if runs:
   runs[0]['text']=runs[0]['text'].lstrip();runs[-1]['text']=runs[-1]['text'].rstrip()
  txt=''.join(r['text'] for r in runs).strip()
  if txt:out.append({'y':min(l['y'] for l in group),'x':min(l['x'] for l in group),'runs':runs,'text':txt})
 return out

def cell(page,rect):
 if rect is None:return ''
 return textclean(page.get_textbox(fitz.Rect(rect))).strip()
def table_rows(page_num):
 page=doc[page_num-1];tables=page.find_tables().tables
 table=next(t for t in tables if abs(t.bbox[0]-80)<2 and t.col_count==3)
 rows=[]
 for row in table.rows:
  if page_num==40 and row.bbox[1]>=628:break
  rows.append([cell(page,r) for r in row.cells])
 return rows

# The temporal-bone table continues across pages 39–40; merge the split cell.
a,b=table_rows(39),table_rows(40)
a[-1][-1]=(a[-1][-1]+' '+b[0][-1]).strip();b=b[1:]
assert a[0]==['Канал','Что соединяет','Что проходит'] and len(a)==4 and len(b)==7

def merge_line(p,line):
 # Undo only a physical line-break hyphen before a lowercase continuation.
 last=p['runs'][-1]['text'] if p['runs'] else ''
 first=line['runs'][0]['text'] if line['runs'] else ''
 glue='' if re.search(r'[A-Za-zА-Яа-яЁё]-$', last) and first[:1].islower() else ' '
 append_run(p['runs'],glue)
 for run in line['runs']:append_run(p['runs'],run['text'],run['bold'])

current=None;prev=None;footnote=None
for num in range(4,96):
 lines=get_lines(doc[num-1]); events=[]
 for line in lines:
  y=line['y']
  if num==11 and 289<=y<430:continue
  if num==39 and 642<=y<784:continue
  if num==40 and y<628:continue
  if num==7 and y>=749:
   if footnote is None:footnote={'type':'note','page':7,'runs':[]}
   if footnote['runs']:append_run(footnote['runs'],' ')
   for r in line['runs']:append_run(footnote['runs'],r['text'],r['bold'])
   continue
  line['kind']='line';events.append(line)
 if num==11:events.append({'kind':'diagram','y':294})
 if num==39:events.append({'kind':'table','y':643,'rows':a[1:]})
 if num==40:events.append({'kind':'table','y':56,'rows':b})
 events.sort(key=lambda l:(l['y'],l.get('x',0)))
 for line in events:
  if line['kind']=='diagram':
   if current!=8:raise RuntimeError(f'Diagram assigned to {current}')
   sections[current-1]['blocks'].append({'type':'table','page':num,'caption':'Кости по расположению в теле человека','headers':['Осевой скелет','Добавочный скелет'],'rows':[['кости черепа','скелет и пояс верхней конечности'],['позвоночный столб','скелет и пояс нижней конечности'],['грудная клетка','']]});prev=None
   continue
  if line['kind']=='table':
   if current!=26:raise RuntimeError(f'Table assigned to {current} on {num}')
   if num not in sections[current-1]['pages']:sections[current-1]['pages'].append(num)
   sections[current-1]['blocks'].append({'type':'table','page':num,'headers':a[0],'rows':line['rows']});prev=None
   continue
  heading=anchors.get((num,round(line['y'],1)))
  if heading:current=heading;prev=None
  if current is None:raise RuntimeError(f'No topic on page {num}')
  sec=sections[current-1]
  if num not in sec['pages']:sec['pages'].append(num)
  txt=line['text'];bullet=bool(re.match(r'^(?:•|\d{1,2}[.)])\s',txt))
  new=(prev is None or prev['page']!=num or line['y']-prev['y']>23 or bullet or heading or (prev.get('heading') and line['x']<=90))
  if new:
   typ='heading' if heading else 'list' if bullet else 'text'
   sec['blocks'].append({'type':typ,'page':num,'runs':line['runs']})
  else:merge_line(sec['blocks'][-1],line)
  prev={'y':line['y'],'page':num,'heading':bool(heading)}
assert current==72 and footnote and 'Насчет ребер' in ''.join(r['text'] for r in footnote['runs'])
sections[3]['blocks'].append(footnote)
# Original pages: printable previews preserve illustrations, diagrams and layout.
PREVIEWS.mkdir(parents=True,exist_ok=True)
for num in range(4,96):
 path=PREVIEWS/f'{num:02}.jpg'
 pix=doc[num-1].get_pixmap(matrix=fitz.Matrix(1.35,1.35),alpha=False)
 path.write_bytes(pix.tobytes('jpg',jpg_quality=75))
OUT.write_text('/* Автоматическое извлечение предоставленного PDF: требуется сверка с оригиналом и независимая медицинская редактура. */\nwindow.AnatomyOralSource = '+json.dumps(sections,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8')
print('Wrote',len(sections),'topics,',sum(len(s['blocks']) for s in sections),'blocks,',len(list(PREVIEWS.glob('*.jpg'))),'page previews')
