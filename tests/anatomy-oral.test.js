const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const Oral=require('../js/anatomy-oral.js'),Snapshot=require('../js/study-snapshot.js'),server=require('../supabase/functions/medzo-study-sync/index.js');
function storage(initial={}){const data={...initial};return {data,getItem:k=>Object.hasOwn(data,k)?data[k]:null,setItem:(k,v)=>{data[k]=String(v);},removeItem:k=>{delete data[k];}};}
function data(){const c=vm.createContext({window:{}});vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/anatomy-oral-data.js'),'utf8'),c);return c.window.AnatomyOralData;}
test('72 кратких тематических ориентира имеют ссылки на страницы исходника',()=>{const rows=data();assert.equal(rows.length,72);rows.forEach((r,i)=>{assert.equal(r.id,i+1);assert.ok(r.title.length>5);assert.ok(r.answer.length>60);assert.ok(r.page>=4&&r.page<=95);});});
test('все 72 ответа расширены объяснениями и примерами при сохранении идентификаторов и страниц',()=>{
 const rows=data();assert.equal(rows.length,72);
 rows.forEach((r,i)=>{assert.equal(r.id,i+1);assert.ok(r.detail.length>=150,`тема ${r.id}: объяснение`);assert.ok(r.examples.length>=100,`тема ${r.id}: примеры`);assert.ok(r.page>=4&&r.page<=95);});
 assert.match(rows[43].examples,/мениск/i);assert.match(rows[71].examples,/Шопар/i);
});
test('сохранены все 35 оригинальных изображений билетов',()=>{for(let i=1;i<=35;i++){const p=path.join(__dirname,'../assets/anatomy/tickets',String(i).padStart(2,'0')+'.webp');assert.ok(fs.statSync(p).size>10000);assert.equal(fs.readFileSync(p).toString('ascii',0,4),'RIFF');}});
test('самооценка отдельных пунктов сохраняется, меняется и не принимает посторонние данные',()=>{const s=storage();let changes=0;const g=Oral.create(s,()=>changes++);assert.equal(g.markTicket(1,'practical',1,'known'),true);assert.equal(g.markTicket(1,'practical',10,'again'),true);assert.equal(g.markTicket(1,'theory',3,'known'),true);assert.equal(g.markCard(72,'again'),true);assert.equal(changes,4);for(const args of [[36,'theory',1,'known'],[1,'theory',4,'known'],[1,'practical',11,'known'],[1,'practical',0,'known'],[1,'foo',1,'known'],[1,'theory',1,'correct']])assert.equal(g.markTicket(...args),false);assert.equal(g.markCard(73,'known'),false);assert.equal(g.read().tickets[1].practical[10],'again');assert.equal(g.markTicket(1,'practical',1,''),true);assert.equal(g.read().tickets[1].practical[1],undefined);});
test('оценки не входят в прежний учебный снимок и не затрагивают старых клиентов',()=>{const origin=storage(),g=Oral.create(origin);g.markTicket(35,'practical',10,'known');g.markTicket(35,'theory',3,'again');g.markCard(3,'known');let raw=JSON.parse(origin.data[Oral.KEY]);raw.session={secret:true};raw.settings={secret:true};origin.data[Oral.KEY]=JSON.stringify(raw);const snap=Snapshot.capture(origin);assert.ok(Snapshot.validate(snap));assert.ok(server.validSnapshot(snap));assert.equal(snap.records[Oral.KEY],undefined);const result=g.read();assert.equal(result.tickets[35].practical[10],'known');assert.equal(result.tickets[35].theory[3],'again');assert.equal(result.cards[3],'known');});
test('ошибка записи не выдаётся за успешную оценку',()=>{const s=storage();s.setItem=()=>{throw Error('quota')};assert.equal(Oral.create(s).markCard(1,'known'),false);});

test('пункты билетов используют только существующие навыки, не подменяя похожие термины',()=>{
 const c=vm.createContext({window:{}});
 for(const file of ['anatomy-skills-data.js','anatomy-ticket-skills.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),c);
 const byId=new Map(c.window.AnatomySkillsData.items.map(x=>[x.id,x])),tickets=c.window.AnatomyTicketSkills;
 assert.equal(tickets.length,35);assert.equal(tickets.flat().length,350);
 for(const row of tickets){assert.equal(row.length,10);for(const entry of row){assert.ok(entry.term);if(entry.skillId!==null)assert.ok(byId.has(entry.skillId));}}
 const item=(t,n)=>tickets[t-1][n-1];
 assert.equal(item(1,1).skillId,11);assert.equal(item(1,1).term,'Arcus anterior atlantis');
 assert.equal(item(1,6).term,'Foramen jugulare');assert.equal(item(1,6).skillId,null);
 assert.equal(item(10,7).term,'Fossa sphenopalatina');assert.equal(item(10,7).skillId,null);
 assert.equal(item(19,1).skillId,null);assert.equal(item(19,2).skillId,null);
 assert.equal(item(32,2).term,'Incisura scapulae');assert.equal(item(32,2).skillId,48);
 assert.equal(item(35,6).skillId,171);assert.equal(item(1,8).skillId,277);assert.equal(item(1,8).related,true);
 assert.equal(tickets.flat().filter(x=>x.skillId!==null).length,332);
});
