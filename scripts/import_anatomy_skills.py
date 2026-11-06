#!/usr/bin/env python3
"""Extract the numbered skills from the supplied PDF; requires PyMuPDF.

Usage: python scripts/import_anatomy_skills.py /path/to/prakt_modul_1_anatomiya_kosti.pdf
The skull headings follow the PDF; other section labels and hints are editorial aids.
"""
import json, re, sys
from pathlib import Path
import pymupdf

GROUPS = [
 ('spine','Позвоночный столб и крестец'),('thorax','Грудная клетка'),
 ('upper','Кости верхней конечности'),('pelvis','Тазовая кость'),
 ('lower','Кости нижней конечности'),('skull','Череп'),
 ('head-joints','Соединения черепа'),('spine-joints','Соединения позвоночника'),
 ('thorax-joints','Соединения грудной клетки'),('upper-joints','Соединения верхней конечности'),
 ('pelvis-joints','Соединения и размеры таза'),('lower-joints','Соединения нижней конечности')]
# The PDF names CRANIUM and individual skull bones; the unheaded bone and
# arthrosyndesmology portions are subdivided by anatomical region for navigation.
SECTIONS = [
 ('vertebrae','Позвоночный столб и крестец',1,30),
 ('thoracic-cage','Грудная клетка',31,42),
 ('upper-limb','Кости верхней конечности',43,93),
 ('hip-bone','Тазовая кость',94,114),
 ('lower-limb','Кости нижней конечности',115,144),
 ('cranium','Череп в целом · Cranium',145,147),
 ('occipital','Затылочная кость · Os occipitale',148,158),
 ('sphenoid','Клиновидная кость · Os sphenoidale',159,173),
 ('temporal','Височная кость · Os temporale',174,186),
 ('parietal','Теменная кость · Os parietale',187,189),
 ('frontal','Лобная кость · Os frontale',190,199),
 ('ethmoid','Решётчатая кость · Os ethmoidale',200,205),
 ('maxilla','Верхняя челюсть и кости лицевого черепа · Maxilla',206,217),
 ('palatine','Нёбная кость и сошник · Os palatinum',218,220),
 ('zygomatic','Скуловая кость · Os zygomaticum',221,222),
 ('mandible','Нижняя челюсть · Mandibula',223,232),
 ('pterygopalatine','Крылонёбная ямка',233,235),
 ('skull-joints','Соединения черепа',236,245),
 ('vertebral-joints','Соединения позвоночника',246,255),
 ('thoracic-joints','Соединения грудной клетки',256,266),
 ('upper-limb-joints','Соединения верхней конечности',267,292),
 ('pelvic-joints','Соединения и размеры таза',293,306),
 ('lower-limb-joints','Соединения нижней конечности',307,330),
]
# Each numbered item receives a specific, intentionally opt-in orientation hint.
HINTS = [
 (1,6,'spine','Позвонок'),(7,7,'spine','Атлант — первый шейный позвонок'),(8,8,'spine','Позвонок'),(9,9,'spine','Шейный позвонок'),(10,10,'spine','Позвонок'),(11,13,'spine','Атлант — первый шейный позвонок'),(14,14,'spine','Осевой позвонок'),(15,16,'spine','Грудной позвонок'),(17,17,'spine','Поясничный позвонок'),(18,29,'spine','Крестец'),(30,30,'spine','Копчик'),
 (31,37,'thorax','Грудина'),(38,42,'thorax','Ребро'),
 (43,46,'upper','Ключица'),(47,56,'upper','Лопатка'),(57,71,'upper','Плечевая кость'),(72,78,'upper','Локтевая кость'),(79,84,'upper','Лучевая кость'),(85,92,'upper','Кости запястья'),(93,93,'upper','Кости кисти'),
 (94,97,'pelvis','Тазовая кость'),(98,105,'pelvis','Подвздошная кость'),(106,109,'pelvis','Лобковая кость'),(110,114,'pelvis','Седалищная кость'),
 (115,122,'lower','Бедренная кость'),(123,123,'lower','Надколенник'),(124,125,'lower','Бедренная кость'),(126,131,'lower','Большеберцовая кость'),(132,133,'lower','Малоберцовая кость'),(134,144,'lower','Кости предплюсны'),
 (145,147,'skull','Череп в целом'),(148,158,'skull','Затылочная кость'),(159,164,'skull','Клиновидная кость'),(165,166,'skull','Глазница и прилежащие кости черепа'),(167,169,'skull','Клиновидная кость'),(170,170,'skull','Основание черепа: клиновидная, височная и затылочная кости'),(171,173,'skull','Клиновидная кость'),(174,186,'skull','Височная кость'),(187,189,'skull','Теменная кость'),(190,194,'skull','Лобная кость'),(195,195,'skull','Передняя черепная ямка: лобная и решётчатая кости'),(196,199,'skull','Лобная кость'),(200,205,'skull','Решётчатая кость'),(206,214,'skull','Верхняя челюсть'),(215,217,'skull','Лицевой череп'),(218,219,'skull','Нёбная кость'),(220,220,'skull','Полость носа'),(221,222,'skull','Скуловая кость'),(223,232,'skull','Нижняя челюсть'),(233,235,'skull','Крылонёбная ямка и прилежащие кости'),
 (236,245,'head-joints','Соединения костей черепа'),(246,248,'spine-joints','Соединения черепа и верхних шейных позвонков'),(249,255,'spine-joints','Соединения позвонков'),
 (256,266,'thorax-joints','Грудная клетка и её соединения'),(267,270,'upper-joints','Соединение ключицы с грудиной'),(271,274,'upper-joints','Ключица и лопатка'),(275,276,'upper-joints','Плечевой сустав'),(277,282,'upper-joints','Локтевой сустав'),(283,284,'upper-joints','Соединения костей предплечья'),(285,287,'upper-joints','Лучезапястный сустав'),(288,292,'upper-joints','Соединения костей кисти'),
 (293,296,'pelvis-joints','Соединения таза и крестца'),(297,299,'pelvis-joints','Таз и его связки'),(300,300,'pelvis-joints','Лобковое соединение таза'),(301,306,'pelvis-joints','Таз: границы и размеры'),
 (307,309,'lower-joints','Тазобедренный сустав'),(310,319,'lower-joints','Коленный сустав'),(320,322,'lower-joints','Соединения костей голени'),(323,323,'lower-joints','Голеностопный сустав'),(324,330,'lower-joints','Соединения костей стопы')]

def main():
 doc=pymupdf.open(sys.argv[1]); items=[]
 for page_no,page in enumerate(doc,1):
  for line in page.get_text().splitlines():
   m=re.match(r'^\s*(\d+)\.\s*(.*?)\s*$',line)
   if not m: continue
   n=int(m[1]); latin=re.sub(r'\s+',' ',m[2]).strip(' .')
   # Typographical fixes only; retain the source terminology and original number.
   latin=latin.replace('Iacrimalis','lacrimalis').replace('anatomicа','anatomica')
   if n==325: latin=latin.replace('Atr.', 'Art.')
   if n in (277,280): latin=latin.replace('Art.', 'Art. ',1).replace('  ',' ')
   group,hint=next((g,h) for lo,hi,g,h in HINTS if lo<=n<=hi)
   items.append({'id':n,'latin':latin,'group':group,'hint':hint,'page':page_no})
 assert [i['id'] for i in items]==list(range(1,331)), 'Unexpected PDF numbering'
 assert all(sum(lo<=i['id']<=hi for lo,hi,_,_ in HINTS)==1 for i in items)
 assert all(sum(lo<=i['id']<=hi for _,_,lo,hi in SECTIONS)==1 for i in items)
 out=Path(__file__).resolve().parent.parent/'js/anatomy-skills-data.js'
 out.write_text('/* Практические навыки: номера и формулировки из предоставленного PDF. */\nwindow.AnatomySkillsData = '+json.dumps({'groups':[{'id':k,'name':v} for k,v in GROUPS], 'sections':[{'id':k,'name':name,'from':lo,'to':hi} for k,name,lo,hi in SECTIONS], 'items':items},ensure_ascii=False,indent=2)+';\n')
 print(f'{len(items)} skills written to {out}')
if __name__=='__main__': main()
