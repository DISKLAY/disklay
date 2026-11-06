#!/usr/bin/env python3
"""Reassemble embedded micrograph strips and transcribe verified labelled cells.
Requires PyMuPDF, Pillow, and the user's source PDF directory. Watermarks in the
original raster are retained. Coordinates are approximate, checked against
labelled source pages. These single-target tasks use name mode only.
"""
from pathlib import Path
from io import BytesIO
import json,sys
import pymupdf
from PIL import Image
root=Path(__file__).resolve().parents[1];folder=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/tmp/arena-coding-uploads');doc=pymupdf.open(folder/'preparati_tkani_vnutr_sredi 2.pdf');out=root/'assets/histology/blood-cells';out.mkdir(parents=True,exist_ok=True)
# Percentages relative to the reconstructed micrograph; multiple cells on one
# field become separate name questions, never indistinguishable slide choices.
targets={
 4:[('neutro','Сегментоядерный нейтрофил',56.5,55,['нейтрофил','сегментоядерный лейкоцит']),('lymph','Малый лимфоцит',66,71,['лимфоцит'])],
 5:[('band1','Палочкоядерный нейтрофил',27,48,['палочкоядерный лейкоцит','палочкоядерный нейтрофил']),('band2','Палочкоядерный нейтрофил',63,62,['палочкоядерный лейкоцит','палочкоядерный нейтрофил']),('lymph','Лимфоцит',23,62,['лимфоцит'])],
 6:[('baso','Базофил',37,38,['базофильный гранулоцит'])],
 7:[('baso','Базофил',62,38,['базофильный гранулоцит'])],
 8:[('neutro','Сегментоядерный нейтрофил',45,40,['нейтрофил','сегментоядерный лейкоцит'])],
 9:[('neutro','Сегментоядерный нейтрофил',56,30,['нейтрофил','сегментоядерный лейкоцит'])],
 10:[('neutro','Сегментоядерный нейтрофил',59,49,['нейтрофил','сегментоядерный лейкоцит'])],
 11:[('neutro','Сегментоядерный нейтрофил',27,49,['нейтрофил','сегментоядерный лейкоцит'])],
 12:[('baso','Базофил',56,34,['базофильный гранулоцит'])],
 13:[('eos','Эозинофил',62,43,['эозинофильный гранулоцит'])],
 14:[('eos','Эозинофил',45,43,['эозинофильный гранулоцит'])],
 15:[('lymph','Лимфоцит',66,51,['лимфоцит'])],
 16:[('lymph','Малый лимфоцит',42,67,['лимфоцит'])],
 17:[('lymph','Лимфоцит',68,55,['лимфоцит'])],
 18:[('mono','Моноцит',76,55,['моноцит']),('lymph','Лимфоцит',39,9,['лимфоцит'])],
 19:[('mono','Моноцит',59,62,['моноцит'])],
 20:[('mono','Моноцит',79,70,['моноцит'])]
}
groups=[];atlas=[]
for page,pts in targets.items():
 p=doc[page-1];infos=p.get_image_info(xrefs=True);assert infos and all(x['xref'] and x['width']==infos[0]['width'] for x in infos)
 width=infos[0]['width'];k=width/(infos[0]['bbox'][3]-infos[0]['bbox'][1]);ys=[round((x['bbox'][0]-infos[0]['bbox'][0])*k) for x in infos];height=max(y+x['height'] for y,x in zip(ys,infos));image=Image.new('RGB',(width,height),'white')
 for x,y in zip(infos,ys):image.paste(Image.open(BytesIO(doc.extract_image(x['xref'])['image'])).convert('RGB'),(0,y))
 if page==4:image=image.crop((29,49,817, image.height)) # embedded title and white border
 name=f'blood-{page:03}.webp';image.save(out/name,'WEBP',quality=90,method=6)
 path='assets/histology/blood-cells/'+name;src=f'2-й коллоквиум · preparati_tkani_vnutr_sredi 2.pdf, стр. {page}'
 groups.append({'id':f'bloodfield{page:03}','slideId':'h01','image':path,'review':f'assets/histology/tissues/d4-{page:03}.webp','source':src,'modes':['name'],'points':[{'id':pid,'name':name,'x':x,'y':y,'aliases':[name,*aliases]} for pid,name,x,y,aliases in pts]})
 atlas.append({'image':path,'title':'Мазок крови · отдельный снимок','source':src,'note':'Снимок без исходных подписей; обозначения доступны на исходной странице.'})
(root/'js/histology-blood-data.js').write_text('/* Отдельные поля мазка и клетки, обозначенные в источнике. */\nwindow.HistologyBloodFields = '+json.dumps({'structures':groups,'atlas':{'h01':atlas}},ensure_ascii=False,indent=2)+';\n',encoding='utf8')
print('fields',len(groups),'targets',sum(len(g['points']) for g in groups))
