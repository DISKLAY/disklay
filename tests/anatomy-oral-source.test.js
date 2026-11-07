const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const c=vm.createContext({window:{}});for(const file of ['anatomy-oral-data.js','anatomy-oral-source.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),c);
const brief=c.window.AnatomyOralData,full=c.window.AnatomyOralSource;
function text(item){return item.blocks.map(b=>b.runs?b.runs.map(r=>r.text).join(''):[b.caption||'',...b.headers,...b.rows.flat()].join(' ')).join('\n');}
test('все 72 темы соотносятся с исходными страницами и сохраняют предыдущие идентификаторы',()=>{
 assert.equal(full.length,72);let length=0,bold=0;
 full.forEach((item,i)=>{assert.equal(item.id,brief[i].id);assert.equal(item.pages[0],brief[i].page);assert.ok(item.blocks.length>1);assert.equal(item.blocks[0].type,'heading');assert.match(text(item).split('\n')[0],new RegExp('^'+item.id+'\\.'));assert.ok(item.pages.every(p=>p>=4&&p<=95));
   for(const p of item.pages)assert.ok(fs.existsSync(path.join(__dirname,'../assets/anatomy/oral-source-pages',String(p).padStart(2,'0')+'.jpg')));
   length+=text(item).length;bold+=item.blocks.flatMap(b=>b.runs||[]).filter(r=>r.bold&&r.text.trim()).length;
 });assert.ok(length>150000);assert.ok(bold>500);
});
test('сохранены примеры и примечания, включая разрезанные переходом страниц',()=>{
 assert.match(text(full[0]),/Кости черепа, такие как лобная, теменная, височная/);
 assert.match(text(full[1]),/редукция ребер, слияние сегментарно организованных/);
 assert.match(text(full[3]),/Бедренная, плечевая, берцовая/);assert.match(text(full[3]),/Насчет ребер спросите у своего преподавателя/);
 assert.match(text(full[4]),/кости свода черепа/i);assert.match(text(full[4]),/хрящевую\n• костную/);
 assert.match(text(full[45]),/Шаровидный – Плечевой сустав/);
 assert.match(text(full[46]),/Примеры: атланто-осевой сустав, рёберно-поперечный сустав/);
 assert.match(text(full[71]),/«ключом» Лисфранкова сустава/);
});
test('таблица каналов височной кости сохранена по ячейкам на двух страницах',()=>{
 const section=full[25],tables=section.blocks.filter(b=>b.type==='table');assert.deepEqual(Array.from(section.pages),[38,39,40]);assert.equal(tables.length,2);assert.equal(tables.reduce((n,b)=>n+b.rows.length,0),10);
 assert.match(text(section),/Лицевой нерв \(VII пара\).*артерия и вена внутреннего уха/);assert.match(text(section),/Водопровод улитки/);assert.match(text(section),/Ушная ветвь блуждающего/);
});
test('структура схемы осевого и добавочного скелета не перемешана',()=>{
 const table=full[7].blocks.find(b=>b.type==='table');assert.equal(table.caption,'Кости по расположению в теле человека');assert.deepEqual(Array.from(table.headers),['Осевой скелет','Добавочный скелет']);assert.match(table.rows[0][0],/кости черепа/);assert.match(table.rows[0][1],/верхней конечности/);
});
