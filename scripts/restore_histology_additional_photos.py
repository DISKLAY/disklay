#!/usr/bin/env python3
"""Restore visually screened teaching pairs from the supplied presentations.
Output practice variants append to existing stable variants. Rendering the PDF
page preserves watermarks and overlays; annotated pages remain review images.
"""
from pathlib import Path
from io import BytesIO
import json,sys
import pymupdf as pdf
from PIL import Image
root=Path(__file__).resolve().parents[1];folder=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/tmp/arena-coding-uploads');out=root/'assets/histology/additional';out.mkdir(parents=True,exist_ok=True)
files=['strukturno-funkcionalnaja_organizacija_kletki_4.pdf','differencirovka_kletok._Gistogenez._EHmbriogenez.pdf','morfofunkc_harakt_epitel_tkanei_odnosl.pdf','mnogosl_epitel_zhelez_epit.pdf','soedinitelnye_tkani_voloknistye_so_specialnymi_svoistvami_ehmbrionalnye.pdf','mishichn_tkani.pdf','nervnaya_tkan.pdf']
docs=[pdf.open(folder/f) for f in files]
# (slide ID, document index, pages, optional source-specific stain/number)
items=[
 ('a14',0,[12],None,None),('a51',1,[11,13],None,None),('p40',1,[21,23],None,'39'),
 ('a42',2,[6,8],None,None),('a43',2,[12,14],None,None),('a44',2,[18,20],None,None),
 ('a45',3,[4,6],None,None),('a46',3,[10,12],None,None),('a47',3,[16,18,20],None,None),('a50',3,[24,26],None,None),('a51',3,[30,32],None,None),('a52',3,[36,38,40,42],None,None),
 ('c61',4,[6],None,None),('p62',4,[10,12,14],None,None),('p62a',4,[16],None,None),('h02',4,[32,34,36,38,40],None,None),('h03',4,[42,44,46,48,50],None,None),('p65',4,[54,56],None,None),
 ('a2',5,[2,4,6,8,12,14], 'Гематоксилин — эозин','70'),('a2',5,[16,18],'Железный гематоксилин','70а'),
 ('m71',5,[26,28,30,36],'Гематоксилин — эозин','71'),('m71',5,[39,45,47,49,51,53,55],'Железный гематоксилин','71а'),
 ('p85',6,[14,16,18],'Гематоксилин — эозин','85'),('p85',6,[20],'Импрегнация солями серебра','85а')]
result={}
for sid,idx,pages,stain,number in items:
 d=docs[idx]
 for n in pages:
  page=d[n-1];text=page.get_text().strip();infos=[x for x in page.get_image_info(xrefs=True) if x['width']*x['height']>50000]
  if text:
   # Image can be safely cropped away from the header only for the specified p85 pages.
   assert sid=='p85' and len(infos)==1
  rect=page.rect
  if len(infos)==1 and not page.rotation:
   rect=pdf.Rect(infos[0]['bbox']) & page.rect
  pix=page.get_pixmap(matrix=pdf.Matrix(1.5,1.5),clip=rect,alpha=False)
  im=Image.open(BytesIO(pix.tobytes('png'))).convert('RGB');name=f'd{idx+1}-{n:03}.webp';im.save(out/name,'WEBP',quality=87,method=6)
  review=d[n].get_pixmap(matrix=pdf.Matrix(1.35,1.35),alpha=False);im2=Image.open(BytesIO(review.tobytes('png'))).convert('RGB');rname=f'd{idx+1}-{n+1:03}-review.webp';im2.save(out/rname,'WEBP',quality=84,method=6)
  source=f'{3 if idx>=5 else 2 if idx==4 else 1}-й коллоквиум · {files[idx]}, стр. {n}–{n+1}'
  v={'image':'assets/histology/additional/'+name,'review':'assets/histology/additional/'+rname,'source':source,'note':'Сверьте признаки и обозначения с подписанным изображением источника.'}
  if stain:v['stain']=stain
  if number:v['number']=number
  result.setdefault(sid,[]).append(v)
(root/'js/histology-additional-data.js').write_text('/* Сверенные дополнительные пары из присланных презентаций. */\nwindow.HistologyAdditionalPhotos = '+json.dumps(result,ensure_ascii=False,indent=2)+';\n',encoding='utf8')
print('new variants',sum(map(len,result.values())),'slides',len(result))
