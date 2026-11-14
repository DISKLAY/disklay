/* Myology: supplied lists and the supplied original illustrations. */
(function () {
  'use strict';
  const AT=window.AT, data=window.MedzoMyologyData, esc=AT.utils.esc;
  const KEY='medzo-myology-practice-v1', folder='assets/anatomy/myology/';
  const matches=(text,query)=>query.split(/\s+/).filter(Boolean).every(word=>text.toLowerCase().includes(word));
  let saved={skills:{},questions:{},session:null},groupSelection=[],scope='all',order='ordered',limit=10,search='';
  function loadSaved(){
    saved={skills:{},questions:{},session:null};groupSelection=[];scope='all';order='ordered';limit=10;
    try {
    const x=JSON.parse(localStorage.getItem(KEY)||'{}');
    for(const type of ['skills','questions'])for(const [id,value] of Object.entries(x[type]||{})){
      const n=Number(id),max=type==='skills'?222:66;
      if(Number.isInteger(n)&&n>=1&&n<=max&&['known','again'].includes(value))saved[type][n]=value;
    }
    const prefs=x.preferences||{};
    if(Array.isArray(prefs.groups))groupSelection=[...new Set(prefs.groups.filter(id=>data.groups.some(g=>g.id===id)))];
    if(['all','unseen','again'].includes(prefs.scope))scope=prefs.scope;
    if(['ordered','random'].includes(prefs.order))order=prefs.order;
    if([0,10,20,50].includes(prefs.limit))limit=prefs.limit;
    const s=x.session;
    if(s&&Array.isArray(s.order)&&s.order.length>0&&s.order.length<=222&&s.order.every(n=>Number.isInteger(n)&&n>=1&&n<=222)&&new Set(s.order).size===s.order.length&&Number.isInteger(s.index)&&s.index>=0&&s.index<s.order.length)saved.session={order:s.order,index:s.index};
    }catch(_){/* ignore damaged or unavailable storage */}
  }
  loadSaved();
  let running=false,revealed=false;
  function reloadFromStorage(){loadSaved();if(AT.route && AT.route()==='myology')AT.rerender();}
  window.addEventListener('medzo-myology-updated',reloadFromStorage);
  window.addEventListener('storage',event=>{if(event.key===KEY)reloadFromStorage();});
  function save(){try{saved.preferences={groups:groupSelection,scope,order,limit};localStorage.setItem(KEY,JSON.stringify(saved));if(window.MedzoStudySync?.myologyChanged)window.MedzoStudySync.myologyChanged();return true;}catch(_){AT.ui.toast('Не удалось сохранить самооценку на устройстве','warn');return false;}}
  function image(kind,page){return folder+(kind==='theory'?'question-pages':kind==='v1'?'variant-1-pages':'variant-2-pages')+'/'+String(page).padStart(2,'0')+'.webp';}
  function pdf(kind,page){return folder+(kind==='theory'?'questions-source.pdf':kind==='v1'?'skills-variant-1.pdf':'skills-variant-2.pdf')+'#page='+page;}
  function preview(kind,page){return '<details class="myo-preview" data-preview-kind="'+kind+'" data-preview-page="'+page+'"><summary>Страница '+page+' · открыть изображение</summary><div data-preview-body></div></details>';}
  function markButtons(kind,id){const v=saved[kind][id];return '<div class="myo-rate" aria-label="Самооценка"><button type="button" data-myo-rate="'+kind+'" data-id="'+id+'" data-value="known" aria-pressed="'+(v==='known')+'">Знаю</button><button type="button" data-myo-rate="'+kind+'" data-id="'+id+'" data-value="again" aria-pressed="'+(v==='again')+'">Повторить</button></div>';}
  function pool(){return data.skills.filter(x=>(!groupSelection.length||groupSelection.includes(x.group))&&(scope==='all'||scope==='unseen'&&!saved.skills[x.id]||scope==='again'&&saved.skills[x.id]==='again'));}
  function tabs(section){return '<nav class="myo-tabs" aria-label="Миология · второй коллоквиум">'+[['skills','Практические навыки'],['questions','Вопросы и теория'],['sources','Рисунки и источники']].map(([s,label])=>'<a href="#/myology?section='+s+'"'+(section===s?' aria-current="page"':'')+'>'+label+'</a>').join('')+'</nav>';}
  function header(section){return '<header class="myo-head"><span>АНАТОМИЯ / 2 КОЛЛОКВИУМ</span><h1>Миология</h1><p>Практические навыки, вопросы и материалы для сверки по предоставленным источникам.</p><a class="myo-back" href="#/anatomy-oral?section=notes">← Теория 1 коллоквиума</a></header>'+tabs(section);}
  function links(){return '<div class="myo-links"><a href="'+folder+'skills-list.pdf" target="_blank" rel="noopener">Список навыков PDF ↗</a><a href="'+folder+'skills-variant-1.pdf" target="_blank" rel="noopener">Рисунки · вариант 1 ↗</a><a href="'+folder+'skills-variant-2.pdf" target="_blank" rel="noopener">Рисунки · вариант 2 ↗</a><a href="'+folder+'questions-list.pdf" target="_blank" rel="noopener">Список вопросов PDF ↗</a><a href="'+folder+'questions-source.pdf" target="_blank" rel="noopener">Расписанные вопросы PDF ↗</a></div>';}
  function candidates(item){
    if(!item.references.length)return '<p class="muted small">Точная подпись не найдена автоматически. Откройте варианты целиком и сверьте вручную: похожие названия не подставляются.</p>';
    return '<p class="muted small">Совпадение текста в подписи; проверьте рисунок и перевод по атласу. В студенческих материалах возможны ошибки.</p>'+item.references.map(r=>'<div class="myo-source-row"><strong>Вариант '+r.variant+'</strong>'+preview('v'+r.variant,r.page)+'</div>').join('');
  }
  function skillRun(){
    const s=saved.session,item=data.skills[s.order[s.index]-1];
    return '<section class="myo-panel"><div class="myo-run-meta"><span>Навык '+(s.index+1)+' / '+s.order.length+' · № '+item.id+'</span><button type="button" class="btn btn--ghost" data-myo="setup">К настройкам</button></div><h2 class="myo-term" tabindex="-1" lang="la">'+esc(item.latin)+'</h2><p class="muted small">Переведите и покажите структуру, затем сверьте себя. 1 — знаю, 2 — повторить, H — ориентир, стрелки — навигация.</p>'+
      '<div class="myo-hint">'+(revealed?'<strong>Ориентир:</strong> '+esc(item.hint):'<button type="button" data-myo="hint">Показать ориентир</button>')+'</div><details class="myo-reference"><summary>Свериться с расписанными вариантами</summary>'+candidates(item)+'<p><a href="#/myology?section=sources">Посмотреть все страницы вариантов →</a></p></details>'+markButtons('skills',item.id)+
      '<div class="myo-actions"><button class="btn btn--ghost" type="button" data-myo="prev"'+(s.index===0?' disabled':'')+'>← Назад</button><button class="btn btn--primary" type="button" data-myo="next">'+(s.index===s.order.length-1?'К настройкам':'Далее →')+'</button></div></section>';
  }
  function skillsSetup(){
    const known=Object.values(saved.skills).filter(x=>x==='known').length,again=Object.values(saved.skills).filter(x=>x==='again').length;
    return '<section class="myo-panel"><div class="myo-title-row"><div><h2>Практические навыки</h2><p>222 пункта из списка. Самооценка не начисляет очки.</p></div><div class="myo-counter">'+known+' знаю · '+again+' повторить</div></div><p class="myo-warning">Оценки сохраняются на устройстве и синхронизируются отдельно при входе в аккаунт. При конфликте выберите версию в профиле.</p>'+
      (saved.session?'<div class="myo-actions"><button class="btn btn--ghost" type="button" data-myo="resume">Продолжить подборку ('+(saved.session.index+1)+' / '+saved.session.order.length+')</button></div>':'')+
      '<div class="myo-settings"><details><summary>Темы · можно выбрать несколько</summary><div class="myo-group-list">'+data.groups.map(g=>'<label><input type="checkbox" data-myo-group="'+esc(g.id)+'"'+(groupSelection.includes(g.id)?' checked':'')+'> '+esc(g.name)+'</label>').join('')+'</div><small>Если ничего не выбрано — все темы.</small></details><label>Навыки<select data-myo-scope><option value="all"'+(scope==='all'?' selected':'')+'>Все</option><option value="unseen"'+(scope==='unseen'?' selected':'')+'>Ещё не оценены</option><option value="again"'+(scope==='again'?' selected':'')+'>Повторить</option></select></label><label>Порядок<select data-myo-order><option value="ordered"'+(order==='ordered'?' selected':'')+'>По порядку</option><option value="random"'+(order==='random'?' selected':'')+'>Вперемешку</option></select></label><label>Количество<select data-myo-limit>'+[10,20,50,0].map(n=>'<option value="'+n+'"'+(n===limit?' selected':'')+'>'+(n||'Все')+'</option>').join('')+'</select></label></div><div class="myo-actions"><button class="btn btn--primary" type="button" data-myo="start"'+(!pool().length?' disabled':'')+'>Начать тренировку</button><span data-myo-available>Доступно: '+pool().length+'</span></div></section>'+
      '<section class="myo-panel"><h2>Исходный список навыков</h2><p>Нумерация и формулировки сохранены как в списке, включая возможные опечатки.</p><label class="myo-search"><span>Поиск по номеру или названию</span><input type="search" data-myo-search value="'+esc(search)+'" placeholder="Например, trapezius"></label><div class="myo-list">'+data.groups.map(g=>'<details class="myo-group" data-catalog-group="'+esc(g.id)+'"><summary>'+esc(g.name)+' <small>№ '+g.from+'–'+g.to+'</small></summary><div>'+data.skills.filter(x=>x.group===g.id).map(x=>'<div class="myo-list-row" data-catalog-item="'+x.id+'"><span>'+x.id+'</span><strong lang="la">'+esc(x.latin)+'</strong><small>'+(saved.skills[x.id]==='known'?'Знаю':saved.skills[x.id]==='again'?'Повторить':'')+'</small></div>').join('')+'</div></details>').join('')+'</div><p data-myo-empty hidden>Ничего не найдено.</p></section>';
  }
  function questionStatus(q){return ({'heading-only':'В расписанном источнике только заголовок.',diagram:'В источнике приведена схема; текстовый ответ неполный.',external:'В источнике дана ссылка на внешний материал, а не полный ответ.',partial:'Материал в источнике частичный или входит в другую тему.',text:'Материал есть в исходном документе; проверьте полноту ответа.'})[q.sourceStatus];}
  function questions(){return '<section class="myo-panel"><div class="myo-title-row"><div><h2>Вопросы по миологии</h2><p>66 вопросов из предоставленного списка. В источнике ответы расписаны не на все вопросы; некоторые страницы содержат только формулировки.</p></div></div><p class="myo-warning">На обложке расписанного файла указан другой номер коллоквиума, но по уточнению материал относится ко второму. Содержимое и рисунки приведены без изменения; возможны ошибки, сверяйте с учебником.</p><p class="muted small">Оценки вопросов сохраняются на устройстве и синхронизируются отдельно при входе в аккаунт. Самооценка не даёт очков.</p><label class="myo-search"><span>Найти вопрос</span><input type="search" data-myo-question-search placeholder="Название или номер"></label><div class="myo-list">'+data.questions.map(q=>'<details class="myo-question" data-question="'+q.id+'"><summary><span>№ '+q.id+'</span> '+esc(q.text)+'</summary><p class="myo-question-status">'+esc(questionStatus(q))+'</p><p class="muted small">Страницы источника: '+q.pages.join(', ')+'. Нумерация в расписанном файле отличается от списка вопросов. Проверьте, есть ли на страницах ответ: некоторые пункты в источнике не раскрыты.</p>'+q.pages.map(p=>preview('theory',p)).join('')+markButtons('questions',q.id)+'</details>').join('')+'</div><p data-myo-question-empty hidden>Ничего не найдено.</p></section>';}
  function sources(){return '<section class="myo-panel"><h2>Расписанные материалы</h2><p>Оригинальные страницы и все пять PDF. Подписи могут отличаться от официального списка или содержать ошибки; проверяйте по атласу и учебнику.</p>'+links()+'<label class="myo-search"><span>Поиск по тексту подписей в обоих вариантах</span><input type="search" data-myo-source-search placeholder="Например, m. trapezius"></label>'+data.variantPages.map((pages,i)=>'<section class="myo-source-group"><h3>Практические навыки · вариант '+(i+1)+'</h3><div>'+pages.map(p=>'<div data-source-variant="'+(i+1)+'" data-source-page="'+p.page+'">'+preview('v'+(i+1),p.page)+'</div>').join('')+'</div></section>').join('')+'<p data-myo-source-empty hidden>Совпадений в текстовых подписях не найдено. Подписи внутри изображений поиском не распознаются.</p></section>';}
  function filterCatalog(view){const q=search.trim().toLowerCase();let found=0;view.querySelectorAll('[data-catalog-group]').forEach(g=>{let count=0;g.querySelectorAll('[data-catalog-item]').forEach(el=>{const item=data.skills[Number(el.dataset.catalogItem)-1];const yes=!q||matches(item.id+' '+item.latin+' '+item.hint,q);el.hidden=!yes;if(yes)count++;});g.hidden=!count;if(count){found+=count;if(q)g.open=true;}});view.querySelector('[data-myo-empty]').hidden=found>0;}
  function refreshAvailable(view){const count=pool().length;const el=view.querySelector('[data-myo-available]');if(el)el.textContent='Доступно: '+count;const b=view.querySelector('[data-myo="start"]');if(b)b.disabled=!count;}
  AT.views.myology=function(params){
    const section=['skills','questions','sources'].includes(params.section)?params.section:'skills';
    const html='<div class="view myo-view">'+header(section)+(section==='skills'?(running&&saved.session?skillRun():skillsSetup()):section==='questions'?questions():sources())+'</div>';
    return {title:'Миология · 2 коллоквиум',html,mount(root){const view=root.querySelector('.myo-view');
      if(section==='skills'&&!running)filterCatalog(view);
      view.addEventListener('toggle',event=>{const el=event.target;if(!el.matches('[data-preview-kind]')||!el.open)return;const body=el.querySelector('[data-preview-body]');if(body.dataset.loaded)return;const kind=el.dataset.previewKind,page=Number(el.dataset.previewPage);body.innerHTML='<a href="'+pdf(kind,page)+'" target="_blank" rel="noopener">Открыть оригинал · страница '+page+' ↗</a><img src="'+image(kind,page)+'" alt="Страница '+page+' исходного документа" loading="lazy">'+(kind==='theory'?'<details><summary>Текст страницы для чтения и поиска</summary><pre>'+esc(data.theoryPages[page-1].text)+'</pre></details>':'');body.dataset.loaded='1';},true);
      view.addEventListener('input',event=>{const el=event.target;
        if(el.matches('[data-myo-search]')){search=el.value;filterCatalog(view);}
        if(el.matches('[data-myo-question-search]')){const q=el.value.trim().toLowerCase();let count=0;view.querySelectorAll('[data-question]').forEach(row=>{const x=data.questions[Number(row.dataset.question)-1];row.hidden=!!q&&!matches(x.id+' '+x.text,q);if(!row.hidden)count++;});view.querySelector('[data-myo-question-empty]').hidden=!!count;}
        if(el.matches('[data-myo-source-search]')){const q=el.value.trim().toLowerCase();let count=0;view.querySelectorAll('[data-source-variant]').forEach(row=>{const x=data.variantPages[Number(row.dataset.sourceVariant)-1][Number(row.dataset.sourcePage)-1];row.hidden=!!q&&!matches(x.page+' '+x.text,q);if(!row.hidden)count++;});view.querySelector('[data-myo-source-empty]').hidden=!!count;}
      });
      view.addEventListener('change',event=>{const el=event.target;
        if(el.matches('[data-myo-group]')){const id=el.dataset.myoGroup;groupSelection=el.checked?[...groupSelection,id]:groupSelection.filter(x=>x!==id);refreshAvailable(view);save();}
        else if(el.matches('[data-myo-scope]')){scope=el.value;refreshAvailable(view);save();}
        else if(el.matches('[data-myo-order]')){order=el.value;save();}
        else if(el.matches('[data-myo-limit]')){limit=Number(el.value);save();}
      });
      function mark(type,id,value,container){const previous=saved[type][id];if(previous===value)delete saved[type][id];else saved[type][id]=value;save();container.querySelectorAll('[data-myo-rate]').forEach(b=>b.setAttribute('aria-pressed',String(saved[type][id]===b.dataset.value)));}
      function navigate(delta){const s=saved.session;if(!s)return;if(delta>0&&s.index===s.order.length-1){running=false;save();AT.rerender();return;}const next=s.index+delta;if(next<0||next>=s.order.length)return;s.index=next;revealed=false;save();AT.rerender();requestAnimationFrame(()=>view.isConnected||document.querySelector('.myo-term')?.focus({preventScroll:true}));}
      view.addEventListener('click',event=>{const rate=event.target.closest('[data-myo-rate]');if(rate){mark(rate.dataset.myoRate,Number(rate.dataset.id),rate.dataset.value,rate.closest('.myo-rate'));return;}const el=event.target.closest('[data-myo]');if(!el)return;
        switch(el.dataset.myo){case'start':{let ids=pool().map(x=>x.id);if(order==='random')for(let i=ids.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}if(limit)ids=ids.slice(0,limit);if(!ids.length)return;saved.session={order:ids,index:0};running=true;revealed=false;save();AT.rerender();break;}
        case'resume':running=true;revealed=false;AT.rerender();break;case'setup':running=false;AT.rerender();break;case'hint':revealed=true;AT.rerender();break;case'prev':navigate(-1);break;case'next':navigate(1);break;}
      });
      const key=event=>{if(section!=='skills'||!running||!saved.session||event.ctrlKey||event.metaKey||event.altKey||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)||event.target.isContentEditable)return;
        if(event.key==='1'||event.key==='2'){event.preventDefault();const item=data.skills[saved.session.order[saved.session.index]-1];mark('skills',item.id,event.key==='1'?'known':'again',view.querySelector('.myo-rate'));}
        else if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();navigate(event.key==='ArrowLeft'?-1:1);}
        else if(event.key.toLowerCase()==='h'){event.preventDefault();revealed=true;AT.rerender();}
      };document.addEventListener('keydown',key);AT.onCleanup(()=>document.removeEventListener('keydown',key));
    }};
  };
})();
