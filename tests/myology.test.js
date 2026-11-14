const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const c=vm.createContext({window:{}});vm.runInContext(fs.readFileSync(path.join(root,'js/myology-data.js'),'utf8'),c);const d=c.window.MedzoMyologyData;
test('официальный список миологии содержит все 222 навыка в исходном порядке',()=>{
 assert.equal(d.skills.length,222);assert.deepEqual(Array.from(d.skills,x=>x.id),Array.from({length:222},(_,i)=>i+1));
 assert.equal(d.skills[0].latin,'M. epicranius');assert.equal(d.skills[152].latin,'M. soleus Tendo calcaneus');assert.equal(d.skills[221].latin,'Sulcus plantaris lateralis');
 for(const x of d.skills){assert.ok(x.latin&&x.page>=1&&x.page<=10);assert.ok(d.groups.some(g=>g.id===x.group&&g.from<=x.id&&x.id<=g.to));for(const r of x.references)assert.ok([1,2].includes(r.variant)&&r.page>=1&&r.page<=(r.variant===1?30:35));}
});
test('66 официальных вопросов и безопасное сопоставление нумерации расписанного источника',()=>{
 assert.equal(d.questions.length,66);assert.deepEqual(Array.from(d.questions,x=>x.id),Array.from({length:66},(_,i)=>i+1));
 assert.match(d.questions[6].text,/синергисты/);assert.deepEqual(Array.from(d.questions[6].sourceNumbers),[7,8]);
 assert.match(d.questions[9].text,/влагалища сухожилий/);assert.deepEqual(Array.from(d.questions[9].sourceNumbers),[10]);
 assert.deepEqual(Array.from(d.questions[16].sourceNumbers),[17,18]);assert.equal(d.questions[16].sourceStatus,'heading-only');assert.equal(d.questions[29].sourceStatus,'diagram');assert.equal(d.questions[55].sourceStatus,'external');assert.deepEqual(Array.from(d.questions[42].sourceNumbers),[44]);assert.deepEqual(Array.from(d.questions[65].sourceNumbers),[67]);
 for(const x of d.questions){assert.ok(x.text);assert.ok(x.pages.length);assert.ok(x.pages.every(p=>p>=2&&p<=25));}
 assert.equal(d.variantPages[0].length,30);assert.equal(d.variantPages[1].length,35);assert.equal(d.theoryPages.length,25);
});
test('оригиналы и все страницы предоставленных вариантов доступны',()=>{
 const base=path.join(root,'assets/anatomy/myology');
 for(const n of ['skills-list.pdf','skills-variant-1.pdf','skills-variant-2.pdf','questions-list.pdf','questions-source.pdf'])assert.ok(fs.statSync(path.join(base,n)).size>50000);
 for(const [folder,count] of [['variant-1-pages',30],['variant-2-pages',35],['question-pages',25]])for(let i=1;i<=count;i++)assert.ok(fs.statSync(path.join(base,folder,String(i).padStart(2,'0')+'.webp')).size>0);
 const client=fs.readFileSync(path.join(root,'js/study-snapshot.js'),'utf8');assert.ok(!client.includes('medzo-myology-practice-v1')); // old clients cannot overwrite new local data
});
