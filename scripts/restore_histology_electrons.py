#!/usr/bin/env python3
"""Render annotated electron-microscopy pages into topic-specific atlas galleries."""
from pathlib import Path
import io,sys,json
import pymupdf as pdf
from PIL import Image
root=Path(__file__).resolve().parents[1];folder=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/tmp/arena-coding-uploads');out=root/'assets/histology/electron';out.mkdir(parents=True,exist_ok=True)
configs=[
 ('strukturno-funkcionalnaja_organizacija_kletki_4.pdf','cell',1,[15,17,18,19,20,21,22,23,24,25,26,28,30,32]),
 ('specializacija_kletochnoi_poverkhnosti.pdf','epithelium',1,[3,5,7,9,11,13,15]),
 ('elertron_mikrofotofraf_2k.pdf','tissues',2,list(range(2,13))),
 ('elertron_mikrofotofraf_3k.pdf','split',3,list(range(2,13)))
]
collections={}
for i,(filename,group,col,pages) in enumerate(configs):
 d=pdf.open(folder/filename)
 for n in pages:
  g=('muscle' if n<=8 else 'nervous') if group=='split' else group
  pix=d[n-1].get_pixmap(matrix=pdf.Matrix(1.35,1.35),alpha=False);name=f'e{i+1}-{n:03}.webp'
  Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGB').save(out/name,'WEBP',quality=84,method=6)
  text=' '.join(d[n-1].get_text().split())
  collections.setdefault(g,[]).append({'image':'assets/histology/electron/'+name,'title':'Электронная микрофотография · страница '+str(n),'source':f'{col}-й коллоквиум · {filename}, стр. {n}','note':'Исходные обозначения сохранены.','search':text})
(root/'js/histology-electron-data.js').write_text('/* Подписанные материалы: только для атласа. */\nwindow.HistologyElectronPages = '+json.dumps(collections,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
print('pages:',sum(map(len,collections.values())),{g:len(p) for g,p in collections.items()})
