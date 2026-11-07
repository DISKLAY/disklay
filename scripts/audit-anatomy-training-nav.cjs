/* Serve the repository and set PLAYWRIGHT_MODULE / CHROMIUM_PATH. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const assert=require('node:assert/strict');
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:8001/';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});try{
 for(const width of [195,320,390,768,1440])for(const theme of ['light','dark']){
  const p=await browser.newPage({viewport:{width,height:850}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(theme=>{localStorage.setItem('anatomy-colloquium-theme',theme);if(!localStorage.getItem('anatomy-oral-1-v1'))localStorage.setItem('anatomy-oral-1-v1',JSON.stringify({tickets:{1:{practical:{1:'known'}}},cards:{1:'again'}}));},theme);
  await p.emulateMedia({reducedMotion:'reduce'});await p.goto(base+'#/tests');await p.waitForSelector('.test-groups');
  const check=async()=>{assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),`${width} ${theme}: overflow at ${p.url()}`);assert.equal(await p.locator('.anatomy-training-nav a').count(),7);assert.equal(await p.locator('#anatomySidebar [data-sidebar-route="tests"]').getAttribute('aria-current'),'page');};
  await check();assert.equal(await p.locator('#anatomySidebar [data-sidebar-route]').count(),9);
  for(const [label,selector] of [['Тесты','[data-topic-picker]'],['Экзамен','.exam-plan'],['Навыки · 1','.ps-builder'],['Билеты · 1','.oral-rating'],['Карточки · 1','[data-oral="reveal"]'],['Ошибки','.page-head'],['Базы','.test-groups']]){
   await p.getByRole('navigation',{name:'Разделы тренировки по анатомии'}).getByRole('link',{name:label,exact:true}).click();await p.waitForSelector(selector);await check();
   assert.equal(await p.getByRole('navigation',{name:'Разделы тренировки по анатомии'}).getByRole('link',{name:label,exact:true}).getAttribute('aria-current'),'page');
   if(label==='Билеты · 1')assert.equal(await p.locator('[data-ticket-rate="practical"][data-index="1"][data-value="known"]').getAttribute('aria-pressed'),'true');
   if(label==='Карточки · 1'){await p.locator('[data-oral="reveal"]').click();assert.equal(await p.locator('[data-card-rate="again"]').getAttribute('aria-pressed'),'true');}
  }
  await p.goto(base+'#/anatomy-oral?section=notes');await p.waitForSelector('.oral-list');assert.equal(await p.locator('.anatomy-training-nav').count(),0);assert.equal(await p.locator('#anatomySidebar [data-sidebar-route="anatomy-oral"]').getAttribute('aria-current'),'page');
  for(const pdf of ['colloquium-1-tickets.pdf','colloquium-1-oral-theory.pdf'])assert.equal(await p.locator('.oral-materials a[href$="'+pdf+'"]').count(),1);
  // No duplicate icons in either visible subject-specific sidebar, including subject and profile.
  const sidebarIcons=async()=>p.evaluate(()=>Array.from(document.querySelectorAll('#courseSidebar [data-nav-icon]')).filter(el=>el.getClientRects().length).map(el=>el.dataset.navIcon));
  if(width<=700)await p.locator('#courseToggle').click();
  let icons=await sidebarIcons();assert.equal(new Set(icons).size,icons.length,icons.join(','));
  await p.locator('[data-subject-link="histology"]').click();await p.waitForSelector('.histo-setup');if(width<=1100)await p.locator('#courseToggle').click();
  icons=await sidebarIcons();assert.equal(new Set(icons).size,icons.length,icons.join(','));assert.equal(await p.locator('[data-histo-sidebar="setup"]').getAttribute('data-nav-icon'),'slide');
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));
  if(width<=700){
   if(await p.locator('#courseToggle').getAttribute('aria-expanded')==='true')await p.locator('#courseToggle').click();
   await p.goto(base+'#/anatomy-oral?section=notes');await p.waitForSelector('.oral-list');
   await p.locator('[data-mobile-nav="mistakes"]').click();assert.equal(await p.locator('.oral-list').isVisible(),true);assert.match(p.url(),/#\/anatomy-oral\?section=notes$/);
  }
  assert.deepEqual(errors,[]);await p.close();console.log(width,theme,'OK');
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
