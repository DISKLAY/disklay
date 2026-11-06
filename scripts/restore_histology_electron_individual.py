#!/usr/bin/env python3
"""Extract individual illustrations; hand-assigned atlas references and unlabelled cell training.
Run with PyMuPDF/Pillow and the original PDFs: python3 ... <upload-folder>.
"""
from pathlib import Path
from io import BytesIO
import json,sys
import pymupdf as pdf
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[1];folder=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/tmp/arena-coding-uploads');out=root/'assets/histology/electron/individual';out.mkdir(parents=True,exist_ok=True)
files=['strukturno-funkcionalnaja_organizacija_kletki_4.pdf','specializacija_kletochnoi_poverkhnosti.pdf','elertron_mikrofotofraf_2k.pdf','elertron_mikrofotofraf_3k.pdf']
docs=[pdf.open(folder/f) for f in files]
# Assign every original page to the closest specimen, or to an atlas-only cell reference.
mapping={
 1:{15:['emcellnucleus'],17:['emcellnucleus'],18:['emcellerg'],19:['emcellmito'],20:['emcellorg'],21:['emcellnucleus'],22:['emcellmito'],23:['emcellmito'],24:['emcellmito'],25:['emcellerg'],26:['emcellerg'],28:['emcellgolgi'],30:['emcellorg'],32:['emcellsecret']},
 2:{3:['a43'],5:['a43'],7:['a43'],9:['a43'],11:['a43'],13:['a44'],15:['a44']},
 3:{2:['recmneutro','recmbaso','recmplatelet'],3:['recmneutro'],4:['recmbaso','recmplatelet'],5:['recmeos','recmmmono','recmmlymph'],6:['recmeos'],7:['recmmmono','recmmlymph'],8:['recmmast'],9:['recmplasma'],10:['h04'],11:['h04'],12:['h04']},
 4:{2:['m71'],3:['m71'],4:['m71'],5:['a2'],6:['a2'],7:['m71'],8:['m71'],9:['n79a'],10:['n79a'],11:['n79a'],12:['n79']}}
# Separate cell images were identified against titles in the original slide.
cells=[
 ('recmneutro','Сегментоядерный нейтрофил',19,3,'Сегментированное ядро и мелкие гранулы цитоплазмы.',['нейтрофил','сегментоядерный нейтрофил']),
 ('recmbaso','Базофил',20,4,'Крупные электронно-плотные гранулы в цитоплазме.',['базофил','базофильный гранулоцит']),
 ('recmplatelet','Тромбоциты',21,4,'Безъядерные клеточные фрагменты; обратите внимание на гранулы.',['тромбоцит','тромбоциты','кровяные пластинки']),
 ('recmeos','Эозинофил',29,6,'Специфические гранулы с кристаллоидами и сегментированное ядро.',['эозинофил','эозинофильный гранулоцит']),
 ('recmmmono','Моноцит',30,7,'Крупная клетка с неровным ядром и цитоплазматическими отростками.',['моноцит']),
 ('recmmlymph','Лимфоцит',28,7,'Крупное ядро и сравнительно узкий ободок цитоплазмы.',['лимфоцит']),
 ('recmmast','Тучная клетка (лаброцит)',39,8,'В цитоплазме тучной клетки многочисленные плотные гранулы.',['тучная клетка','лаброцит','мастоцит']),
 ('recmplasma','Плазмоцит',42,9,'Найдите развитую гранулярную эндоплазматическую сеть и ядро.',['плазмоцит','плазматическая клетка'])]
def export(docno,n,xref):
 # Apply the PDF display rotation; xrefs are frequently stored rotated.
 doc=docs[docno-1];p=doc[n-1]; rect,m=p.get_image_rects(xref,transform=True)[0]
 im=Image.open(BytesIO(doc.extract_image(xref)['image'])).convert('RGB')
 if abs(m.b)>abs(m.a): im=im.rotate(90 if m.b<0 else -90,expand=True)
 elif m.a<0 and m.d<0: im=im.rotate(180)
 # PDF may scale nonuniformly; follow the displayed image proportions.
 ratio=rect.width/rect.height;w,h=im.size
 if abs((w/h)/ratio-1)>0.03: im=im.resize((max(1,round(h*ratio)),h),Image.Resampling.LANCZOS)
 name=f'e{docno}-{n:03}-{xref}.webp';im.save(out/name,'WEBP',quality=88,method=6)
 return 'assets/histology/electron/individual/'+name
atlas={}
for docno,pages in mapping.items():
 d=docs[docno-1]
 for n,ids in pages.items():
  p=d[n-1];search=' '.join(p.get_text().split());images=[];seen=set()
  for xref,_,w,h,*_ in p.get_images():
   if xref in seen or min(w,h)<110 or w*h<40000 or not p.get_image_rects(xref):continue
   seen.add(xref);images.append(export(docno,n,xref))
  source=f'{1 if docno<=2 else docno-1}-й коллоквиум · {files[docno-1]}, стр. {n}'
  for sid in ids:
   if docno==3 and n in (2,4,5,7):
    target={'recmneutro':19,'recmbaso':20,'recmplatelet':21,'recmeos':29,'recmmmono':30,'recmmlymph':28}[sid]
    selected=[image for image in images if image.endswith(f'-{target}.webp')]
   else: selected=images
   for image in selected:atlas.setdefault(sid,[]).append({'image':image,'title':'Отдельное изображение','source':source,'note':'Извлечено из страницы; возможны рисунки и исходные обозначения.','search':search})
   atlas.setdefault(sid,[]).append({'image':f'assets/histology/electron/e{docno}-{n:03}.webp','title':'Исходная страница с обозначениями','source':source,'note':'Подписанный оригинал для разбора.','search':search})
# Optical blood-smear photos have multiple labelled cells; keep them in the
# atlas (not as individual-cell recognition questions) and link by cell type.
for sid,pages in {
 'recmneutro':[3,4,8,9,10,11], 'recmbaso':[6,7,12],
 'recmeos':[13,14], 'recmmmono':[18,19,20],
 'recmmlymph':[4,5,6,8,9,10,11,15,16,17,18],
 'recmplatelet':[4,12,16,17,18,20,21]
}.items():
 for n in pages:
  atlas.setdefault(sid,[]).append({'image':f'assets/histology/tissues/d4-{n:03}.webp',
   'title':'Мазок крови: исходные обозначения','source':f'2-й коллоквиум · preparati_tkani_vnutr_sredi 2.pdf, стр. {n}',
   'note':'Световая микроскопия: на снимке отмечены несколько клеток.'})
# For training use only verified individual cell images. Never render the labelled page as a question.
# These small letter/number labels are embedded in the raster itself, not PDF
# text. Cover them only on the training copies; retain the originals in atlas.
label_boxes={
 'recmbaso':[(278,23,306,49),(293,269,320,294)],
 'recmeos':[(137,48,166,68),(219,262,238,279),(336,252,354,271)],
 'recmmmono':[(89,66,107,87),(173,26,190,47),(164,106,184,128),(320,70,342,91),(394,50,413,71),(348,130,370,151),(460,132,482,155),(213,157,232,178),(307,497,329,518)],
 'recmmlymph':[(342,221,382,252),(338,327,361,355),(558,176,584,205),(586,242,615,271),(590,331,618,361)],
 'recmmast':[(310,408,326,426)],
 'recmplasma':[(141,141,162,164),(195,277,217,301)]
}
slides=[]
for sid,name,xref,n,note,aliases in cells:
 image=export(3,n,xref)
 if sid in label_boxes:
  im=Image.open(root/image).convert('RGB');draw=ImageDraw.Draw(im)
  for box in label_boxes[sid]:draw.rectangle(box,fill=(110,110,110))
  namefile='masked-'+sid+'.webp';im.save(out/namefile,'WEBP',quality=90,method=6)
  image='assets/histology/electron/individual/'+namefile
 slides.append(dict(id=sid,name=name,number='ЭМ',stain='Электронная микроскопия',image=image,masked=sid in label_boxes,review=f'assets/histology/electron/e3-{n:03}.webp',source=f'2-й коллоквиум · {files[2]}, стр. {n}',note=note,aliases=aliases))
reference=[
 ('emcellnucleus','Ядро и ядрышко клетки','Ядерная оболочка, хроматин и компоненты ядрышка.'),
 ('emcellerg','Эндоплазматическая сеть клетки','Сопоставьте гранулярную и гладкую эндоплазматическую сеть.'),
 ('emcellmito','Митохондрии и включения клетки','Сравните форму митохондрий и строение их крист.'),
 ('emcellorg','Лизосомы и пероксисомы','Обратите внимание на мембранные органеллы и их содержимое.'),
 ('emcellgolgi','Комплекс Гольджи','Найдите цистерны и везикулы комплекса Гольджи.'),
 ('emcellsecret','Секреторные клетки','Сравните специализированные секреторные клетки.')]
refs=[dict(id=id,name=name,number='ЭМ',aliases=[name,'электронная микроскопия','электронная микрофотография'],note=note,variants=[]) for id,name,note in reference]
ids=[c[0] for c in cells];distractors={id:[x for x in ids if x!=id and not (id=='recmmast' and x=='recmmlymph')] for id in ids} # Лимфоцит также виден рядом с тучной клеткой.
# Approximate points transferred from the labelled source pages to the
# extracted image bounds. Do not infer finer ultrastructural features.
def point(id,name,x,y,*aliases):return dict(id=id,name=name,x=x,y=y,aliases=[name,*aliases])
structures=[
 {'slideId':'recmneutro','points':[point('nucleus','Сегменты ядра нейтрофила',29,69,'сегменты ядра'),point('granules','Специфические гранулы нейтрофила',81,65,'гранулы нейтрофила')]},
 {'slideId':'recmeos','points':[point('specific','Специфические гранулы эозинофила',35,13,'гранулы эозинофила'),point('primary','Первичные гранулы',69,20,'азурофильные гранулы'),point('nucleus','Сегменты ядра эозинофила',67,68,'сегменты ядра'),point('processes','Отростки цитоплазмы',9,89,'псевдоподии','микроворсинки')]},
 {'slideId':'recmmast','points':[point('lymphocyte','Лимфоцит',23,15,'лимфоцит'),point('granules','Гранулы тучной клетки',75,40,'гранулы лаброцита'),point('collagen','Коллагеновые волокна',86,90,'коллагеновые волокна')]},
 {'slideId':'recmplasma','points':[point('golgi','Комплекс Гольджи',30,36,'аппарат гольджи'),point('rer','Гранулярная эндоплазматическая сеть',34,75,'гранулярная эпс','шероховатая эпс'),point('nucleus','Ядро плазмоцита',68,52,'ядро')]}
]
data={'slides':slides,'references':refs,'groups':{'tissues':ids,'cell':[r['id'] for r in refs]},'distractors':distractors,'atlas':atlas,'structures':structures}
(root/'js/histology-electron-individual-data.js').write_text('/* Отдельные изображения и оригиналы: ручная тематическая привязка. */\nwindow.HistologyElectronIndividual = '+json.dumps(data,ensure_ascii=False,indent=2)+';\n',encoding='utf8')
print('cells',len(slides),'references',len(refs),'gallery entries',sum(map(len,atlas.values())))
