#!/usr/bin/env python3
"""Restore selected first-colloquium labelled/unlabelled teaching pairs.
Usage: PYTHONPATH=<pymupdf+pillow> python3 scripts/restore_histology_first.py <pdf-folder>
Pages are hand selected; other pages are deliberately not turned into questions.
"""
from pathlib import Path
import sys,io,json
import pymupdf
from PIL import Image
root=Path(__file__).resolve().parents[1]
folder=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/tmp/arena-coding-uploads')
out=root/'assets/histology/first';out.mkdir(parents=True,exist_ok=True)
names=['obekti_metodi_gistologich_issledov.pdf','strukturno-funkcionalnaja_organizacija_kletki_4.pdf','differencirovka_kletok._Gistogenez._EHmbriogenez.pdf','morfofunkc_harakt_epitel_tkanei_odnosl.pdf','mnogosl_epitel_zhelez_epit.pdf']
docs=[pymupdf.open(folder/name) for name in names]
def render(i,page,target):
 pix=docs[i][page-1].get_pixmap(matrix=pymupdf.Matrix(1.35,1.35),alpha=False)
 Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGB').save(out/target,'WEBP',quality=84,method=6)
 return 'assets/histology/first/'+target
def pair(id,i,page,stain=None):
 assert not docs[i][page-1].get_text().strip(),(id,page)
 v={'image':render(i,page,id+'-image.webp'),'review':render(i,page+1,id+'-review.webp'),'source':f'1-й коллоквиум · {names[i]}, страницы {page}–{page+1}'}
 if stain:v['stain']=stain
 return v
# Stable IDs from prior training version when known. Identical organs are never distractors for each other.
items=[
 ('a2','Поперечно-полосатое мышечное волокно: скелетная мышца','2',0,8,'Гематоксилин — эозин','muscle',['скелетная мышца','скелетное мышечное волокно','поперечно полосатое мышечное волокно']),
 ('a12','Включения гликогена в клетках печени аксолотля','12',1,3,'ШИК-реакция — гематоксилин','cell',['включения гликогена','гликоген печени аксолотля']),
 ('a13','Жировые включения в клетках печени аксолотля','13',1,7,'Осмиевая кислота — кармин','cell',['жировые включения','липидные включения']),
 ('a14','Пигментные включения в хроматофорах кожи головастика','14',1,10,'Неокрашенный препарат','cell',['пигментные включения','хроматофоры кожи головастика']),
 ('a21','Митоз растительной клетки: корешок лука','21',2,3,'Железный гематоксилин','cell',['митоз растительной клетки','корешок лука']),
 ('a22','Митоз животной клетки','22',2,5,'Метиленовый синий','cell',['митоз животной клетки']),
 ('a37','Первичная полоска зародыша курицы','37',2,15,'Гематоксилин — эозин','development',['первичная полоска зародыша курицы','первичная полоска']),
 ('a38','Сомиты, хорда и нервная трубка зародыша курицы','38',2,17,'Гематоксилин — эозин','development',['сомиты хорда и нервная трубка','зародыш на стадии дифференцировки мезодермы']),
 ('a42','Однослойный плоский эпителий: мезотелий брюшины','42',3,2,'Импрегнация серебром — гематоксилин','epithelium',['мезотелий брюшины','однослойный плоский эпителий','мезотелий']),
 ('a43','Однослойный призматический каёмчатый эпителий: тонкая кишка','43',3,10,'Гематоксилин — эозин','epithelium',['однослойный призматический каемчатый эпителий','каемчатый эпителий тонкой кишки']),
 ('a44','Однослойный многорядный реснитчатый эпителий: трахея','44',3,16,'Гематоксилин — эозин','epithelium',['однослойный многорядный реснитчатый эпителий','мерцательный эпителий трахеи']),
 ('a45','Многослойный плоский неороговевающий эпителий: пищевод','45',4,2,'Гематоксилин — эозин','epithelium',['многослойный плоский неороговевающий эпителий','эпителий пищевода']),
 ('a46','Многослойный плоский ороговевающий эпителий: кожа пальца','46',4,8,'Гематоксилин — эозин','epithelium',['многослойный плоский ороговевающий эпителий','эпидермис кожи пальца']),
 ('a47','Переходный эпителий: мочевой пузырь','47',4,14,'Гематоксилин — эозин','epithelium',['переходный эпителий','уротелий мочевого пузыря']),
 ('a50','Простые трубчатые неразветвлённые железы матки','50',4,22,'Гематоксилин — эозин','epithelium',['простые трубчатые железы матки','маточные железы']),
 ('a51','Простая разветвлённая альвеолярная железа: сальная железа','51',4,28,'Гематоксилин — эозин','epithelium',['сальная железа','простая разветвленная альвеолярная железа']),
 ('a52','Сложные разветвлённые альвеолярно-трубчатые железы языка','52',4,34,'Гематоксилин — эозин','epithelium',['железы языка','сложные разветвленные альвеолярно трубчатые железы']),
]
slides=[];groups={}
for id,name,num,i,n,stain,group,aliases in items:
 filename=id+'v0' if id=='a2' else id
 v=pair(filename,i,n)
 slides.append(dict(id=id,name=name,number=num,stain=stain,aliases=[name,*aliases],note='Сверьте морфологические признаки с исходной страницей с обозначениями.',**v));groups.setdefault(group,[]).append(id)
variants={'a2':[pair('a2v1',0,10),pair('a2v2',0,12,'Железный гематоксилин')]}
distractors={
 'a2':['p62','h03','p65'], 'a12':['a13','a14','a21'], 'a13':['a12','a14','a22'], 'a14':['a12','a13','a21'], 'a21':['a22','a14','a13'], 'a22':['a21','a14','a12'],
 'a37':['a38','p123','p122'], 'a38':['a37','p123','p122'], 'a42':['a45','a46','a47'], 'a43':['a44','a45','a47'], 'a44':['a43','a45','a47'], 'a45':['a43','a44','a47'], 'a46':['a43','a44','a47'], 'a47':['a43','a44','a46'], 'a50':['a51','a52','a44'], 'a51':['a50','a52','a42'], 'a52':['a50','a51','a42']}
data={'slides':slides,'variants':variants,'groups':groups,'distractors':distractors,'structures':[]}
(root/'js/histology-first-data.js').write_text('/* Восстановлено из проверенных пар исходных страниц. */\nwindow.HistologyFirstData = '+json.dumps(data,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
print(len(slides),'cards; 2 additional variants')
