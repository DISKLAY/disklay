/* Пространство гистологии: не использует сессии и ключи анатомии. */
(function () {
  'use strict';
  const AT=window.AT, H=window.HistologyPrototype, esc=AT.utils.esc;
  const storage={getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>{window.localStorage.setItem(key,value);if(window.MedzoStudySync && Object.hasOwn(window.MedzoStudySnapshot.keys,key))window.MedzoStudySync.changed();}};
  const game=H.create(storage), structureGame=H.createStructures(storage), theoryGame=H.createTheory(storage);
  let theoryScope='all', theorySlide='', theoryTopic='', atlasJump='';
  let lastSectionHash=null;
  let structureScope='all';
  let screen=game.state.session ? 'run' : 'setup';
  let notice='';
  const ATLAS_RETURN_KEY='histology-atlas-return-v1';
  let atlasReturn=null, pendingResume=null, focusReturned=false;
  try { atlasReturn=JSON.parse(window.sessionStorage.getItem(ATLAS_RETURN_KEY) || 'null'); } catch (_) { /* приватный режим / отсутствие sessionStorage */ }
  function returnGame(kind) { return kind==='run'?game:kind==='theory-run'?theoryGame:kind==='structure-run'?structureGame:null; }
  function validAtlasReturn() {
    const r=atlasReturn, g=r && returnGame(r.kind), session=g && g.state.session;
    return !!(session && Number.isInteger(r.index) && r.index>=0 && r.index<session.order.length &&
      typeof r.order==='string' && session.order.join('|')===r.order && session.order[r.index]===r.key &&
      session.entries[r.key] && session.entries[r.key].status!=='unanswered');
  }
  function rememberAtlasReturn(kind, slideId) {
    const g=returnGame(kind), session=g && g.state.session;
    if(!session)return;
    atlasReturn={kind,slideId,index:session.index,key:session.order[session.index],order:session.order.join('|')};
    try { window.sessionStorage.setItem(ATLAS_RETURN_KEY,JSON.stringify(atlasReturn)); } catch (_) { /* возврат работает до обновления вкладки */ }
  }
  function clearAtlasReturn() {
    atlasReturn=null;
    try { window.sessionStorage.removeItem(ATLAS_RETURN_KEY); } catch (_) { /* нет доступа к хранилищу */ }
  }
  function atlasReturnButton() {
    return validAtlasReturn()?'<button type="button" class="histo-atlas-return" data-histo="atlas-return">← Вернуться к заданию</button>':'';
  }
  function goSection(section) {const hash='#/histology?section='+section;if(location.hash===hash){screen=section;AT.rerender();}else location.hash=hash;}
  function countLabel(n, forms) {const last=n%10, teen=n%100;return n+' '+(teen>=11&&teen<=14?forms[2]:last===1?forms[0]:last>=2&&last<=4?forms[1]:forms[2]);}
  function btn(action, value, label, selected) {
    return '<button type="button" class="histo-pill'+(selected?' is-active':'')+'" data-histo="'+action+'" data-value="'+value+'" aria-pressed="'+selected+'">'+label+'</button>';
  }
  function stats() {
    const p=Object.values(game.state.stats);
    return {attempts:p.reduce((a,x)=>a+x.attempts,0),correct:p.reduce((a,x)=>a+x.correct,0), mistakes:H.slides.filter(q=>game.state.stats[q.id]&&game.state.stats[q.id].last===false || Object.entries(game.state.imageStats).some(([key,x])=>key.startsWith(q.id+'@') && x.last===false)).length, favorites:Object.keys(game.state.favorites).length};
  }
  function navigation(active) {
    const sections=[['setup','Тренировка'],['errors','Ошибки'],['stats','Статистика'],['atlas','Атлас'],['structures','Структуры'],['theory','Тесты по теории']];
    return '<nav class="histo-nav" aria-label="Разделы гистологии">'+sections.map(([id,label])=>'<a href="#/histology?section='+id+'" data-histo="section" data-value="'+id+'"'+(id===active?' class="is-active" aria-current="page"':'')+'>'+label+'</a>').join('')+'</nav>';
  }
  // Цвет и название темы показываются только там, где препарат уже известен.
  function groupBadge(slideId) {
    const group=H.atlasGroups.find(g=>g.ids.includes(slideId));
    return group?'<span class="histo-topic-badge" data-histo-group="'+esc(group.id)+'">'+esc(group.name)+'</span>':'';
  }
  function structureStats() {
    const records=Object.values(structureGame.state.stats);
    return {attempts:records.reduce((n,p)=>n+p.attempts,0),correct:records.reduce((n,p)=>n+p.correct,0),mistakes:records.filter(p=>p.last===false).length,seen:records.filter(p=>p.attempts>0).length};
  }
  function errorsView() {
    const wrong=H.slides.filter(q=>game.state.stats[q.id]&&game.state.stats[q.id].last===false || Object.entries(game.state.imageStats).some(([key,p])=>key.startsWith(q.id+'@') && p.last===false));
    const tasks=Object.keys(structureGame.state.stats).filter(id=>structureGame.state.stats[id].last===false), theoryWrong=H.theoryQuestions.filter(q=>theoryGame.state.stats[q.id]&&theoryGame.state.stats[q.id].last===false);
    return '<div class="histo-view view">'+navigation('errors')+'<section class="histo-panel"><span class="histo-kicker">ПОВТОРЕНИЕ</span><h1>Ошибки</h1><p>Ошибки снимков сгруппированы по препарату. Повторение в режиме «Все снимки» предложит ошибочные снимки; старые ошибки без привязки к снимку — все варианты препарата.</p><h2>Препараты · '+wrong.length+'</h2>'+
      (wrong.length?'<button type="button" class="btn btn--primary" data-histo="repeat-mistakes">Повторить препараты</button><ul class="histo-list">'+wrong.map(q=>'<li><strong>'+esc(q.name)+'</strong><small>№ '+esc(q.number)+' · попыток: '+(game.state.stats[q.id] ? game.state.stats[q.id].attempts : 0)+'</small></li>').join('')+'</ul>':'<p class="histo-empty">Ошибок по препаратам пока нет.</p>')+
      '<h2>Структуры · '+tasks.length+'</h2>'+(tasks.length?'<div class="histo-actions"><button type="button" class="btn btn--ghost" data-histo="structure-mistakes" data-value="point">Повторить поиск</button><button type="button" class="btn btn--ghost" data-histo="structure-mistakes" data-value="name">Повторить названия</button></div><ul class="histo-list">'+tasks.map(id=>{const t=H.structureTasks[id],g=H.structureSlides.find(x=>(x.id||x.slideId)===t.groupId),point=g.points.find(x=>x.id===t.pointId);return '<li><strong>'+esc(point.name)+'</strong><small>'+esc(H.byId[t.slideId].name)+' · '+(t.mode==='point'?'показать':'назвать')+'</small></li>';}).join('')+'</ul>':'<p class="histo-empty">Ошибок по структурам пока нет.</p>')+'<h2>Теория · '+theoryWrong.length+'</h2>'+(theoryWrong.length?'<button type="button" class="btn btn--ghost" data-histo="theory-mistakes">Повторить вопросы</button><ul class="histo-list">'+theoryWrong.map(q=>'<li><strong>'+esc(q.question)+'</strong><small>'+esc(H.byId[q.slideId].name)+'</small></li>').join('')+'</ul>':'<p class="histo-empty">Ошибок по теории пока нет.</p>')+'</section></div>';
  }
  function statsView() {
    const p=stats(),st=structureStats(), slideRecords=Object.values(game.state.stats),seen=slideRecords.filter(x=>x.attempts>0).length,learned=slideRecords.filter(x=>x.last===true).length;
    const percent=(correct,attempts)=>attempts?Math.round(correct/attempts*100)+'%':'—';
    const modeStats=mode=>{const records=Object.entries(structureGame.state.stats).filter(([id])=>H.structureTasks[id].mode===mode).map(([,v])=>v);const attempts=records.reduce((n,x)=>n+x.attempts,0),correct=records.reduce((n,x)=>n+x.correct,0);return {attempts,correct,wrong:records.filter(x=>x.last===false).length,seen:records.filter(x=>x.attempts>0).length};};
    const directions=['point','name'].map(mode=>{const r=modeStats(mode),total=Object.values(H.structureTasks).filter(t=>t.mode===mode).length;return '<li><strong>'+(mode==='point'?'Показать структуру':'Назвать отмеченное')+'</strong><small>Попробовано: '+r.seen+' / '+total+' · верно: '+r.correct+' / '+r.attempts+' ('+percent(r.correct,r.attempts)+') · ошибок: '+r.wrong+'</small></li>';}).join('');
    return '<div class="histo-view view">'+navigation('stats')+'<section class="histo-panel"><span class="histo-kicker">ЛИЧНЫЙ ПРОГРЕСС</span><h1>Статистика</h1><p>Результаты хранятся отдельно от анатомии на этом устройстве. Самостоятельно подтверждённые ответы также учитываются.</p></section>'+AT.leaderboardMarkup()+'<section class="histo-panel"><h2>Определение препаратов</h2><div class="histo-stats histo-stats--inner"><div><strong>'+seen+' / '+H.slides.length+'</strong><span>препаратов попробовано</span></div><div><strong>'+learned+'</strong><span>верно в последний раз</span></div><div><strong>'+p.correct+' / '+p.attempts+'</strong><span>верно / ответов · '+percent(p.correct,p.attempts)+'</span></div><div><strong>'+p.mistakes+'</strong><span>текущих ошибок</span></div></div><p>Отдельных снимков попробовано: '+Object.keys(game.state.imageStats).length+' / '+H.slides.reduce((n,q)=>n+q.variants.length,0)+'; снимков с ошибкой: '+Object.values(game.state.imageStats).filter(x=>x.last===false).length+'. Ранее сохранённые результаты по препаратам сохранены; они не приписываются конкретному снимку задним числом.</p><h2>Структуры</h2><div class="histo-stats histo-stats--inner"><div><strong>'+st.seen+' / '+Object.keys(H.structureTasks).length+'</strong><span>заданий попробовано</span></div><div><strong>'+st.correct+' / '+st.attempts+'</strong><span>верно / ответов · '+percent(st.correct,st.attempts)+'</span></div><div><strong>'+st.mistakes+'</strong><span>текущих ошибок</span></div></div><ul class="histo-list">'+directions+'</ul><h2>Тесты по теории</h2><div class="histo-stats histo-stats--inner"><div><strong>'+theoryStats().seen+' / '+H.theoryQuestions.length+'</strong><span>вопросов попробовано</span></div><div><strong>'+theoryStats().correct+' / '+theoryStats().attempts+'</strong><span>верно / ответов · '+percent(theoryStats().correct,theoryStats().attempts)+'</span></div><div><strong>'+theoryStats().wrong+'</strong><span>текущих ошибок</span></div></div></section></div>';
  }
  function theoryText(text) {
    // Склеиваем переносы строк PDF и отдельные маркеры, не меняя слов источника.
    const lines=text.split('\n').map(x=>x.trim()).filter(Boolean), result=[];let items=[],paragraph=[],bullet=false;
    function flushItems(){if(items.length){result.push('<ul>'+items.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>');items=[];}}
    function flushParagraph(){if(paragraph.length){result.push('<p>'+esc(paragraph.join(' '))+'</p>');paragraph=[];}}
    for(const line of lines){
      if(line==='•'){flushParagraph();bullet=true;continue;}
      if(bullet||line.startsWith('•')){flushParagraph();items.push(line.replace(/^•\s*/,''));bullet=false;continue;}
      const heading=line.length<110 && (/^\d{1,2}[.)]\s*\S/.test(line)||/:$/.test(line)||(/^[А-ЯЁ\d\s.,()\-—:]+$/.test(line)&&line.length>8));
      if(heading){flushItems();flushParagraph();result.push('<h4>'+esc(line)+'</h4>');}
      else if(items.length&&/^[а-яёa-z]/.test(line))items[items.length-1]+=' '+line;
      else {flushItems();paragraph.push(line);}
    }
    flushItems();flushParagraph();return result.join('');
  }
  function atlasGallery(q) {
    const pictures=[];
    q.variants.forEach(v=>{
      const item=v?Object.assign({},q,v):q;
      pictures.push({image:item.image,title:'Снимок в тренажёре · № '+item.number,source:item.source,note:'Окраска: '+item.stain+(item.masked?'. Подписи закрыты.':'')});
      if(item.review)pictures.push({image:item.review,title:'Исходные обозначения · № '+item.number,source:item.source,note:'Окраска: '+item.stain});
    });
    const pages=[...((window.HistologyAtlasPhotos||{})[q.id]||[]),...((window.HistologyTissueData?.atlas||{})[q.id]||[]),...((window.HistologyElectronIndividual?.atlas||{})[q.id]||[]),...((window.HistologyBloodFields?.atlas||{})[q.id]||[])];
    const seen=new Set(pictures.map(p=>p.image));
    pages.filter(page=>{if(seen.has(page.image))return false;seen.add(page.image);return true;}).forEach(page=>pictures.push({image:page.image,title:page.title||'Страница сборника',source:page.source,note:page.note||''}));
    return pictures;
  }
  function atlasPictures(q) {
    const pictures=atlasGallery(q);
    return '<section class="histo-gallery" aria-label="Изображения препарата"><div class="histo-gallery__head"><div><span class="histo-kicker">ИЗОБРАЖЕНИЯ И ОБОЗНАЧЕНИЯ</span><h3>Посмотреть препарат</h3><p>Отдельные снимки и исходные страницы с обозначениями. Нажмите, чтобы открыть и увеличить.</p></div><span class="histo-count">'+countLabel(pictures.length,['изображение','изображения','изображений'])+'</span></div><div class="histo-gallery__grid">'+pictures.map((p,i)=>'<button type="button" class="histo-photo" data-histo="atlas-photo" data-slide-id="'+esc(q.id)+'" data-value="'+i+'" aria-label="'+esc('Открыть: '+p.title+', '+p.source)+'"><span class="histo-photo__frame"><img src="'+esc(p.image)+'" loading="lazy" decoding="async" alt=""><span class="histo-photo__missing" hidden>Не загрузилось · открыть</span></span><span class="histo-photo__info"><strong>'+esc(p.title)+'</strong><small>'+esc(p.source)+'</small>'+(p.note?'<small>'+esc(p.note)+'</small>':'')+'</span></button>').join('')+'</div><p class="histo-help">Исходные подписи и водяные знаки сохранены. На одной странице могут быть несколько снимков.</p></section>';
  }
  function atlasCard(q,groupName) {
    const theory=H.atlasTheory[q.id],hasTest=H.theoryQuestions.some(x=>x.slideId===q.id);
    // Не меняем хранимый текст сборника; исправляем видимый артефакт извлечения и редакционную пометку.
    const displayText=theory&&theory.text.replace('вокруgtрабекулярные','вокругтрабекулярные').replace('гладкомышечную ткань (поперечно-полосатая у человека в трахее? -\nисправляем на: трахеальные мышцы)', 'гладкомышечную ткань');
    const warning=q.id==='p143'?'В источнике сказано, что сальные железы на пальце встречаются редко. В толстой коже пальцев, ладоней и подошв волосяные фолликулы и сальные железы отсутствуют. Сверьте с учебником.':q.id==='p132'?'В источнике встречается спорная формулировка об окраске слизи бокаловидных клеток эозином; сверьте её с учебником.':'';
    return '<details class="histo-atlas-item" data-atlas-item data-slide-id="'+esc(q.id)+'" data-search="'+esc(H.normalize([q.name,q.number,groupName,...q.aliases,...((window.HistologyElectronIndividual?.atlas||{})[q.id]||[]),...((window.HistologyBloodFields?.atlas||{})[q.id]||[]).map(p=>p.search||'')].join(' ')))+'"><summary><span>'+esc(q.name)+'</span><small>№ '+esc(q.number)+'</small></summary><div class="histo-atlas-body"><div class="histo-atlas-note"><span>НА ЧТО ОБРАТИТЬ ВНИМАНИЕ</span><p>'+esc(q.note)+'</p></div>'+(theory?'<div class="histo-theory-card"><div class="histo-theory-head"><div><span class="histo-kicker">МАТЕРИАЛ СБОРНИКА</span><h3>Теория препарата</h3></div><span class="histo-theory-source">'+esc(theory.source)+'</span></div>'+(warning?'<p class="histo-source-warning"><strong>Замечание к источнику.</strong> '+esc(warning)+'</p>':'')+'<div class="histo-theory">'+theoryText(displayText)+'</div></div>':'<p class="histo-help">Отдельный текст теории для этой карточки пока не добавлен; приведён краткий ориентир.</p>')+(hasTest?'<button type="button" class="btn btn--ghost histo-atlas-test" data-histo="theory-slide" data-value="'+esc(q.id)+'">Вопрос по этому препарату →</button>':'')+atlasPictures(q)+'</div></details>';
  }
  function atlasSources() {
    const links=[['guide-1.pdf','Пособие к 1-му коллоквиуму'],['methods.pdf','Методы гистологических исследований'],['cell.pdf','Организация клетки'],['development.pdf','Гистогенез и эмбриогенез'],['cell-surface.pdf','Специализации клеточной поверхности'],['epithelium-simple.pdf','Однослойные эпителии'],['epithelium-stratified.pdf','Многослойные и железистые эпителии'],['blood.pdf','Кровь и ткани внутренней среды'],['connective.pdf','Соединительные ткани'],['muscle.pdf','Мышечные ткани'],['nervous.pdf','Нервная ткань'],['electron-2.pdf','Электронные изображения · ткани внутренней среды'],['electron-3.pdf','Электронные изображения · мышцы и нервы'],['atlas-1.pdf','Атлас · часть 1'],['atlas-2.pdf','Атлас · часть 2'],['atlas-3.pdf','Атлас · часть 3'],['atlas-4.pdf','Атлас · часть 4'],['questions-1.pdf','Исходные контрольные вопросы · 1'],['questions-2.pdf','Исходные контрольные вопросы · 2'],['questions-3.pdf','Исходные контрольные вопросы · 3'],['slides-1.pdf','Список препаратов и схем · 1'],['slides-2.pdf','Список препаратов и схем · 2'],['slides-3.pdf','Список препаратов и схем · 3'],['slides-final.pdf','Итоговые препараты']];
    return '<details class="histo-atlas-sources"><summary>Исходные пособия, вопросы и списки препаратов</summary><p class="histo-help">Присланные материалы сохранены для изучения; это не отдельный устный тренажёр. Права на публичное размещение требуют проверки.</p><ul>'+links.map(([url,label])=>'<li><a href="assets/histology/sources/'+esc(url)+'" target="_blank" rel="noopener">'+esc(label)+' ↗</a></li>').join('')+'</ul></details>';
  }
  function atlasView() {
    return '<div class="histo-view view">'+navigation('atlas')+atlasReturnButton()+'<section class="histo-panel histo-atlas"><span class="histo-kicker">СПРАВОЧНИК</span><h1>Атлас препаратов</h1><p>Снимки для '+H.slides.length+' препаратов, теория из присланного сборника для '+Object.keys(H.atlasTheory).length+'. Тексты не проходили независимую экспертную проверку и могут содержать ошибки; отдельные артефакты извлечения исправлены.</p>'+atlasSources()+'<div class="histo-atlas-searchbox"><label class="histo-answer-label" for="atlasSearch">Поиск по всему атласу</label><input id="atlasSearch" class="histo-input histo-atlas-search" type="search" placeholder="Название или номер препарата" autocomplete="off"><p class="histo-help" data-atlas-count>'+(H.slides.length+Object.keys(H.atlasReferences).length)+' карточек · '+H.atlasGroups.length+' разделов</p></div><div class="histo-atlas-groups">'+H.atlasGroups.map(g=>'<details class="histo-atlas-group" data-atlas-group data-histo-group="'+esc(g.id)+'"><summary><span>'+esc(g.name)+'</span><small data-group-count>'+countLabel(g.ids.length,['препарат','препарата','препаратов'])+'</small></summary><div class="histo-atlas-list">'+g.ids.map(id=>atlasCard(H.byId[id]||H.atlasReferences[id],g.name)).join('')+'</div></details>').join('')+'</div><p class="histo-empty" data-atlas-empty hidden>Ничего не найдено.</p></section></div>';
  }
  function theoryStats() {
    const records=Object.values(theoryGame.state.stats);return {attempts:records.reduce((n,x)=>n+x.attempts,0),correct:records.reduce((n,x)=>n+x.correct,0),wrong:records.filter(x=>x.last===false).length,seen:records.filter(x=>x.attempts>0).length};
  }
  function theoryPicker(kind, label, allLabel, selected, options) {
    const current=options.find(([value])=>value===selected);
    return '<details class="histo-picker" data-theory-'+(kind==='topic'?'topic':'filter')+'><summary aria-label="'+esc(label)+'"><span>'+esc(current?current[1]:allLabel)+'</span><i aria-hidden="true"></i></summary><div class="histo-picker__menu" role="group" aria-label="'+esc(label)+'">'+[['',allLabel],...options].map(([value,name])=>'<button type="button" class="histo-picker__option'+(selected===value?' is-selected':'')+'" data-histo="theory-filter-'+kind+'" data-value="'+esc(value)+'" aria-pressed="'+(selected===value)+'"><span>'+esc(name)+'</span>'+(selected===value?'<b aria-hidden="true">✓</b>':'')+'</button>').join('')+'</div></details>';
  }
  function theoryView() {
    const session=theoryGame.state.session, pool=H.theoryQuestions.filter(q=>(theoryScope!=='mistakes'||theoryGame.state.stats[q.id]&&theoryGame.state.stats[q.id].last===false)&&(!theorySlide||q.slideId===theorySlide)&&(!theoryTopic||q.topic===theoryTopic));
    return '<div class="histo-view view">'+navigation('theory')+'<section class="histo-panel"><span class="histo-kicker">УЧИМСЯ ПОНИМАТЬ</span><h1>Тесты по теории</h1><p>Пробная подборка: '+H.theoryQuestions.length+' вопросов по материалам присланного сборника. В каждом один ответ; это не официальный экзаменационный ключ. Новые вопросы составлены заново по темам контрольных списков, а не восстановлены дословно; привязка к препарату тематическая. После ответа доступны объяснение и источник.</p>'+(notice?'<p class="histo-notice" role="status">'+esc(notice)+'</p>':'')+'<div class="histo-setting"><div><strong>Какие вопросы</strong><p>Ошибки учитываются отдельно от препаратов и структур.</p></div><div class="histo-pills">'+btn('theory-scope','all','Все',theoryScope==='all')+btn('theory-scope','mistakes','Ошибки',theoryScope==='mistakes')+'</div></div><div class="histo-setting"><div><strong>Тема</strong><p>Вопросы группируются по содержанию.</p></div>'+theoryPicker('topic','Выбрать тему','Все темы',theoryTopic,Array.from(new Set(H.theoryQuestions.map(q=>q.topic))).sort().map(topic=>[topic,topic]))+'</div><div class="histo-setting"><div><strong>Препарат</strong><p>Вопросы есть пока не для всех карточек.</p></div>'+theoryPicker('slide','Выбрать препарат','Все препараты с вопросами',theorySlide,Array.from(new Set(H.theoryQuestions.map(q=>q.slideId))).map(id=>[id,H.byId[id].name]).sort((a,b)=>a[1].localeCompare(b[1],'ru'))) +'</div><div class="histo-start"><div><strong>'+countLabel(pool.length,['вопрос','вопроса','вопросов'])+'</strong><p>Прогресс сохраняется на устройстве.</p></div><div class="histo-actions">'+(session?'<button type="button" class="btn btn--ghost" data-histo="theory-resume">Продолжить</button>':'')+'<button type="button" class="btn btn--primary" data-histo="theory-start"'+(!pool.length?' disabled':'')+'>'+(session?'Начать заново':'Начать тест')+' →</button></div></div></section></div>';
  }
  function theoryRunView() {
    const s=theoryGame.state.session,q=theoryGame.current(),e=theoryGame.entry();if(!s||!q||!e){screen='theory';return theoryView();}
    const shown=e.status!=='unanswered';
    const options=e.options.map((index,i)=>'<button type="button" class="histo-option'+(e.selected===index?' is-selected':'')+'" data-histo="theory-select" data-value="'+i+'" aria-pressed="'+(e.selected===index)+'"'+(shown?' disabled':'')+'><span>'+(i+1)+'</span>'+esc((e.answers||q.answers)[index])+'</button>').join('');
    const feedback=shown?'<div class="histo-feedback '+(e.status==='correct'?'is-correct':'is-wrong')+'" role="status"><span class="histo-kicker">'+(e.status==='correct'?'Верно!':'Разберём ответ')+'</span><h3>'+esc((e.answers||q.answers)[0])+'</h3>'+groupBadge(q.slideId)+'<p>'+esc(q.explanation)+'</p><p class="histo-source">По материалам сборника: '+(q.sourceUrl?'<a href="'+esc(q.sourceUrl)+'" target="_blank" rel="noopener">'+esc(q.source)+' ↗</a>':esc(q.source||H.atlasTheory[q.slideId].source))+'.</p><button type="button" class="histo-zoom-link" data-histo="theory-atlas" data-value="'+esc(q.slideId)+'">Открыть препарат в атласе →</button></div>':'';
    return '<div class="histo-view view">'+navigation('theory')+'<div class="histo-run-top"><button type="button" class="histo-back" data-histo="theory-setup">← К тестам</button><span class="histo-kicker">ГИСТОЛОГИЯ · ТЕОРИЯ</span></div><div class="histo-progress"><div><strong>Вопрос</strong><span>'+(s.index+1)+' / '+s.order.length+'</span></div><div class="histo-progress__track"><span style="width:'+((s.index+1)/s.order.length*100)+'%"></span></div></div><div class="histo-card"><div class="histo-card__head"><div><span class="histo-kicker">'+esc(H.byId[q.slideId].name)+'</span><h1>'+esc(q.question)+'</h1></div></div>'+keyboardHint+'<p class="histo-answer-label">Выберите один ответ</p><div class="histo-options">'+options+'</div>'+(!shown?'<div class="histo-check"><button type="button" class="btn btn--primary" data-histo="theory-check"'+(e.selected==null?' disabled':'')+'>Проверить</button><button type="button" class="btn btn--ghost" data-histo="theory-dont-know">Не знаю</button></div>':'')+feedback+'<div class="histo-bottom"><button type="button" class="btn btn--ghost" data-histo="theory-prev"'+(s.index===0?' disabled':'')+'>← Назад</button><button type="button" class="btn btn--primary" data-histo="theory-next"'+(!shown?' disabled':'')+'>'+(s.index===s.order.length-1?'Завершить':'Далее →')+'</button></div></div></div>';
  }
  function structuresView() {
    const sg=structureGame, mode=sg.state.mode;
    const total=Object.values(H.structureTasks).filter(t=>t.mode===mode).length;
    const wrong=Object.keys(sg.state.stats).filter(id=>H.structureTasks[id].mode===mode&&sg.state.stats[id].last===false).length;
    return '<div class="histo-view view">'+navigation('structures')+'<section class="histo-panel"><span class="histo-kicker">ПРАКТИКА НА СНИМКАХ</span><h1>Структуры</h1><p>В режиме используются только вручную сверенные метки на конкретных изображениях: '+H.structureSlides.length+' снимков, '+Object.keys(H.structureTasks).length+' заданий: '+Object.values(H.structureTasks).filter(t=>t.mode==='point').length+' на поиск метки и '+Object.values(H.structureTasks).filter(t=>t.mode==='name').length+' на название. Метка обозначает примерное расположение структуры, а не её границу.</p>'+(notice?'<p class="histo-notice" role="status">'+esc(notice)+'</p>':'')+
      '<div class="histo-setting"><div><strong>Как отвечать</strong><p>Выберите тип задания</p></div><div class="histo-pills">'+btn('structure-mode','point','Показать структуру',mode==='point')+btn('structure-mode','name','Назвать отмеченное',mode==='name')+'</div></div>'+
      '<div class="histo-setting"><div><strong>Какие задания</strong><p>Ошибки учитываются отдельно для каждого режима.</p></div><div class="histo-pills">'+btn('structure-scope','all','Все',structureScope==='all')+btn('structure-scope','mistakes','Ошибки',structureScope==='mistakes')+'</div></div>'+
      '<div class="histo-start"><div><strong>'+countLabel(structureScope==='mistakes'?wrong:total,['задание','задания','заданий'])+'</strong><p>'+(mode==='point'?'Выберите метку на снимке и проверьте ответ.':'Выберите один вариант и проверьте ответ.')+'</p></div><div class="histo-actions">'+(sg.state.session?'<button type="button" class="btn btn--ghost" data-histo="structure-resume">Продолжить</button>':'')+'<button type="button" class="btn btn--primary" data-histo="structure-start"'+(!(structureScope==='mistakes'?wrong:total)?' disabled':'')+'>'+(sg.state.session?'Начать заново':'Начать')+' →</button></div></div></section></div>';
  }
  function structureExtentMarkup(p) {
    if(!p.extent)return '';
    const [[x1,y1],[x2,y2]]=p.extent;
    return '<svg class="histo-extent" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line class="histo-extent__line" x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'"/></svg>';
  }
  function displayedStructurePoints(group,task,entry){
    const visible=H.visibleStructurePoints(group,task,task.mode==='point'?entry.selected:null);
    if(entry.status==='unanswered')return visible;
    const used=new Set(visible.map(x=>x.index));
    return [...visible,...group.points.map((point,index)=>({point,index})).filter(x=>!used.has(x.index))];
  }
  const keyboardHint='<p class="histo-help">Клавиатура: 1–5 — выбрать, Enter — проверить или далее, ← / → — назад / далее.</p>';
  function structureRunView() {
    const sg=structureGame,s=sg.state.session,t=sg.current(),e=sg.entry();
    if(!s||!t||!e){screen='structures';return structuresView();}
    const group=sg.group(),target=sg.target(),slide=Object.assign({},H.byId[t.slideId],group.image?{image:group.image,review:group.review,source:group.source}:{}),shown=e.status!=='unanswered';
    const visible=displayedStructurePoints(group,t,e);
    const markers=visible.map(({point:p,index:i},number)=>{
      if(t.mode==='name' && !shown && p.id!==t.pointId)return '';
      const selected=t.mode==='name'?p.id===t.pointId:e.selected===p.id;
      return structureExtentMarkup(p)+'<button type="button" class="histo-marker'+(p.extent?' histo-marker--extent':'')+(p.x>75?' histo-marker--label-left':'')+(selected?' is-selected':'')+(shown&&p.id===t.pointId?' is-correct':'')+'" style="left:'+p.x+'%;top:'+p.y+'%" data-histo="structure-point" data-value="'+i+'" data-number="'+(number+1)+'" aria-label="Метка '+(number+1)+'" aria-pressed="'+selected+'"'+(t.mode==='name'||shown?' disabled':'')+'></button>';
    }).join('');
    let controls='';
    if(!shown&&t.mode==='point') controls='<p class="histo-answer-label">Нажмите метку на изображении или выберите её номер:</p><div class="histo-marker-choices" role="group" aria-label="Выбор метки">'+visible.map(({point:p,index:i},number)=>'<button type="button" class="histo-marker-choice'+(e.selected===p.id?' is-selected':'')+'" data-histo="structure-point" data-value="'+i+'" aria-pressed="'+(e.selected===p.id)+'">Метка '+(number+1)+'</button>').join('')+'</div><div class="histo-check"><button type="button" class="btn btn--primary" data-histo="structure-check"'+(!e.selected?' disabled':'')+'>Проверить</button><button type="button" class="btn btn--ghost" data-histo="structure-dont-know">Не знаю</button></div>';
    if(t.mode==='name'&&e.status!=='review') controls='<p class="histo-answer-label">Выберите название отмеченной структуры</p><div class="histo-options">'+e.options.map((option,i)=>'<button type="button" class="histo-option'+(e.selected===option?' is-selected':'')+'" data-histo="structure-option" data-value="'+i+'" aria-pressed="'+(e.selected===option)+'"'+(shown?' disabled':'')+'><span>'+(i+1)+'</span>'+esc(option)+'</button>').join('')+'</div>'+(!shown?'<div class="histo-check"><button type="button" class="btn btn--primary" data-histo="structure-check"'+(!e.selected?' disabled':'')+'>Проверить</button><button type="button" class="btn btn--ghost" data-histo="structure-dont-know">Не знаю</button></div>':'');
    let feedback='';
    if(shown) feedback='<div class="histo-feedback '+(e.status==='correct'?'is-correct':'is-wrong')+'" role="status"><span class="histo-kicker">'+(e.status==='review'?'Сверьте самостоятельно':e.status==='correct'?'Верно!':'Разберём структуру')+'</span><h3>'+esc(target.name)+'</h3>'+groupBadge(slide.id)+(t.mode==='name'&&e.selected?'<p>Ваш ответ: '+esc(e.selected)+'</p>':e.status==='review'&&e.text?'<p>Ваш прежний ответ: '+esc(e.text)+'</p>':'')+'<p>Метки приблизительны. Сверьте их с исходными обозначениями в атласе.</p>'+(e.status==='review'?'<div class="histo-self"><span>Ваш ответ можно считать верным?</span><button class="btn btn--sm btn--ghost" type="button" data-histo="structure-self" data-value="yes">Да, верно</button><button class="btn btn--sm btn--ghost" type="button" data-histo="structure-self" data-value="no">Нет, ошибся</button></div>':'')+'<ul class="histo-marker-legend">'+visible.map(({point:p},number)=>'<li><strong>'+(number+1)+'.</strong> '+esc(p.name)+'</li>').join('')+'</ul>'+(slide.review?'<details class="histo-review"><summary>Исходное изображение с обозначениями</summary><button type="button" class="histo-review__open" data-histo="structure-zoom" data-value="'+esc(slide.review)+'" aria-label="Увеличить исходное изображение"><img src="'+esc(slide.review)+'" loading="lazy" alt=""></button><button type="button" class="histo-zoom-link" data-histo="structure-zoom" data-value="'+esc(slide.review)+'">Увеличить</button><p class="histo-image__error" hidden>Изображение не загрузилось.</p></details>':'')+'<p class="histo-source">Источник: '+esc(slide.source)+'.</p><button type="button" class="histo-zoom-link" data-histo="structure-atlas" data-value="'+esc(slide.id)+'">Посмотреть препарат в атласе →</button></div>';
    return '<div class="histo-view view">'+navigation('structures')+'<div class="histo-run-top"><button type="button" class="histo-back" data-histo="structure-setup">← К структурам</button><span class="histo-kicker">ГИСТОЛОГИЯ · СТРУКТУРЫ</span></div><div class="histo-progress"><div><strong>Задание</strong><span>'+(s.index+1)+' / '+s.order.length+'</span></div><div class="histo-progress__track"><span style="width:'+((s.index+1)/s.order.length*100)+'%"></span></div></div><div class="histo-card"><div class="histo-card__head"><div><span class="histo-kicker">'+esc(slide.name)+'</span><h1>'+(t.mode==='point'?'Покажите: '+esc(target.name):'Что отмечено?')+'</h1></div></div>'+keyboardHint+'<figure class="histo-image"><div class="histo-structure-image"><img src="'+esc(slide.image)+'" alt="Микрофотография с метками"><div class="histo-markers">'+markers+'</div></div><figcaption>Метки указывают примерное положение структур.</figcaption><button type="button" class="histo-zoom-link histo-structure-zoom" data-histo="structure-zoom" data-value="'+esc(slide.image)+'">Увеличить снимок с метками</button><p class="histo-image__error" hidden>Изображение не загрузилось. Попробуйте обновить страницу.</p></figure>'+controls+feedback+'<div class="histo-bottom"><button type="button" class="btn btn--ghost" data-histo="structure-prev"'+(s.index===0?' disabled':'')+'>← Назад</button><button type="button" class="btn btn--primary" data-histo="structure-next"'+(e.status==='unanswered'||e.status==='review'?' disabled':'')+'>'+(s.index===s.order.length-1?'Завершить':'Далее →')+'</button></div></div></div>';
  }
  function setupView() {
    const s=game.state, n=stats(), session=s.session;
    return '<div class="histo-view view">'+navigation('setup')+
      '<div class="histo-hero"><div><div class="histo-eyebrow"><span></span> НОВЫЙ ПРЕДМЕТ · ТРЕНИРОВКА</div><h1>Гистология<span>.</span></h1><p>Учитесь узнавать препараты по изображению. Сравнивайте похожие препараты и повторяйте ошибки.</p><div class="histo-hero__tags"><span>'+H.slides.length+' препаратов</span><span>2 режима ответа</span><span>Прогресс отдельно</span></div></div><div class="histo-hero__mark" aria-hidden="true"><svg class="histo-hero__slide" viewBox="0 0 88 70" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="9" width="78" height="52" rx="7"/><path d="M21 10v50M11 20h4M11 26h4"/><path d="M33 28c0-6 4-10 10-10s10 4 10 10-4 10-10 10-10-4-10-10Z"/><circle cx="43" cy="28" r="2.5" fill="currentColor" stroke="none"/><path d="M51 45c0-5.5 4-9.5 9.5-9.5S70 39.5 70 45s-4 9.5-9.5 9.5S51 50.5 51 45Z"/><circle cx="60.5" cy="45" r="2.5" fill="currentColor" stroke="none"/><circle cx="32" cy="46" r="4"/></svg><small>МИКРО<br>АТЛАС</small></div></div>'+
      (AT.leaderboardInviteMarkup?AT.leaderboardInviteMarkup('histology'):'')+
      (notice?'<p class="histo-notice" role="status">'+esc(notice)+'</p>':'')+
      '<div class="histo-stats"><div><strong>'+n.attempts+'</strong><span>ответов</span></div><div><strong>'+n.correct+'</strong><span>верных</span></div><div><strong>'+n.mistakes+'</strong><span>на повторение</span></div><div><strong>'+n.favorites+'</strong><span>в избранном</span></div></div>'+
      '<div class="histo-setup"><div class="histo-setup__head"><div><span class="histo-kicker">ВАША ТРЕНИРОВКА</span><h2>Как будем заниматься?</h2></div><span class="histo-count">'+game.pool().length+' препаратов</span></div>'+
      '<div class="histo-setting"><div><strong>Способ ответа</strong><p>Выберите подходящий режим</p></div><div class="histo-pills">'+btn('mode','choice','Из вариантов',s.mode==='choice')+btn('mode','text','Написать название',s.mode==='text')+'</div></div>'+
      '<div class="histo-setting"><div><strong>Какие препараты</strong><p>Повторяйте нужное в своём темпе</p></div><div class="histo-pills">'+btn('scope','all','Все',s.scope==='all')+btn('scope','mistakes','Ошибки',s.scope==='mistakes')+btn('scope','favorites','Избранное',s.scope==='favorites')+'</div></div>'+
      '<div class="histo-setting"><div><strong>Количество снимков</strong><p>Все снимки — отдельное задание для каждого; один на препарат — короткая подборка.</p></div><div class="histo-pills">'+btn('sampling','images','Все снимки',s.sampling==='images')+btn('sampling','slides','По одному',s.sampling==='slides')+'</div></div>'+
      '<div class="histo-start"><div><strong>'+game.candidates().length+' снимков в подборке</strong><p>Варианты подобраны из похожих препаратов и перемешиваются.</p></div><div class="histo-actions">'+(session?'<button type="button" class="btn btn--ghost" data-histo="resume">Продолжить</button>':'')+'<button type="button" class="btn btn--primary" data-histo="start"'+(!game.candidates().length?' disabled':'')+'>'+(session?'Начать заново':'Начать тренировку')+' →</button></div></div></div>'+
      '<p class="histo-footnote">Представлены все позиции указателя из четырёх PDF; разные снимки одного органа объединены. Дополнительные снимки отобраны из атласа; не все страницы сборника пригодны для вопросов. На некоторых изображениях подписи закрыты, а стрелки остались. Формат университетской проверки пока неизвестен; баллы и валюта здесь не начисляются.</p></div>';
  }
  function runView() {
    const s=game.state.session, q=game.current(), e=game.entry();
    if(!s||!q||!e) {screen='setup';return setupView();}
    const shown=e.status!=='unanswered';
    const favorite=!!game.state.favorites[q.id];
    let answer='';
    if(!shown && s.mode==='choice') {
      answer='<p class="histo-answer-label">Выберите один вариант</p><div class="histo-options">'+e.options.map((id,i)=>'<button type="button" class="histo-option'+(e.selected===id?' is-selected':'')+'" data-histo="select" data-value="'+esc(id)+'" aria-pressed="'+(e.selected===id)+'"><span>'+(i+1)+'</span>'+esc(H.byId[id].name)+'</button>').join('')+'</div>';
    } else if(!shown) {
      answer='<form data-histo-form><label class="histo-answer-label" for="histoAnswer">Ваш ответ</label><div class="histo-input-row"><input id="histoAnswer" name="answer" class="histo-input" type="text" maxlength="300" autocomplete="off" placeholder="Например, название органа" value="'+esc(e.text)+'"><button class="btn btn--primary" type="submit">Проверить</button></div><p class="histo-help">Необязательно писать окраску. Неузнанные формулировки можно оценить самостоятельно.</p></form>';
    }
    let feedback='';
    if (shown) {
      const label=e.status==='review'?'Сверьте самостоятельно':e.status==='correct'?'Верно!':'Разберём этот препарат';
      feedback='<div class="histo-feedback '+(e.status==='wrong'?'is-wrong':e.status==='correct'?'is-correct':'')+'" role="status"><span class="histo-kicker">'+label+'</span><h3>'+esc(q.name)+'</h3>'+groupBadge(q.id)+'<p>Препарат № '+esc(q.number)+' · '+esc(q.stain)+'</p>'+(e.text?'<p class="histo-your-answer">Ваш ответ: '+esc(e.text)+'</p>':'')+'<p>'+esc(q.note)+'</p>'+
        (e.status==='review'?'<div class="histo-self"><span>Ваш ответ можно считать верным?</span><button class="btn btn--sm btn--ghost" type="button" data-histo="self" data-value="yes">Да, верно</button><button class="btn btn--sm btn--ghost" type="button" data-histo="self" data-value="no">Нет, ошибся</button></div>':'')+
        (q.review?'<details class="histo-review"><summary>Показать изображение с обозначениями</summary><button type="button" class="histo-review__open" data-histo="zoom" data-value="'+esc(q.review)+'" aria-label="Увеличить изображение с обозначениями"><img src="'+esc(q.review)+'" loading="lazy" alt=""></button><button type="button" class="histo-zoom-link" data-histo="zoom" data-value="'+esc(q.review)+'">Увеличить изображение</button><p class="histo-image__error" hidden>Изображение не загрузилось. Проверьте подключение и <button type="button" data-histo="retry-image" data-value="review">попробуйте ещё раз</button>.</p></details>':'')+
        '<p class="histo-source">По материалам присланной базы: '+esc(q.source)+'.</p><button type="button" class="histo-zoom-link" data-histo="review-atlas" data-value="'+esc(q.id)+'">Все изображения и теория в атласе →</button></div>';
    }
    return '<div class="histo-view view">'+navigation('setup')+'<div class="histo-run-top"><button type="button" class="histo-back" data-histo="setup">← К настройкам</button><span class="histo-kicker">ГИСТОЛОГИЯ · '+(s.mode==='choice'?'ВЫБОР ОТВЕТА':'ВВОД НАЗВАНИЯ')+'</span></div>'+
      '<div class="histo-progress"><div><strong>Определите препарат</strong><span>'+ (s.index+1)+' / '+s.order.length+'</span></div><div class="histo-progress__track"><span style="width:'+((s.index+1)/s.order.length*100)+'%"></span></div></div>'+
      '<div class="histo-card"><div class="histo-card__head"><div><span class="histo-kicker">МИКРОПРЕПАРАТ</span><h1>Что изображено?</h1></div><button type="button" class="histo-favorite'+(favorite?' is-active':'')+'" data-histo="favorite" aria-pressed="'+favorite+'" aria-label="'+(favorite?'Убрать из избранного':'Добавить в избранное')+'">'+(favorite?'★':'☆')+'</button></div>'+
      '<figure class="histo-image"><button type="button" class="histo-image__open" data-histo="zoom" data-value="'+esc(q.image)+'" aria-label="Увеличить изображение препарата"><img src="'+esc(q.image)+'" alt="Микрофотография препарата для определения" fetchpriority="high"></button><figcaption>Нажмите на изображение, чтобы увеличить'+(q.masked?' · Подписи закрыты':'')+'</figcaption><p class="histo-image__error" hidden>Изображение не загрузилось. Проверьте подключение и <button type="button" data-histo="retry-image">попробуйте ещё раз</button>.</p></figure>'+
      (s.mode==='choice'?keyboardHint:'<p class="histo-help">Введите название и нажмите Enter. Стрелки ← / → — назад / далее.</p>')+answer+(!shown&&s.mode==='choice'?'<div class="histo-check"><button type="button" class="btn btn--primary" data-histo="check"'+(!e.selected?' disabled':'')+'>Проверить</button><button type="button" class="btn btn--ghost" data-histo="dont-know">Не знаю</button></div>':!shown?'<div class="histo-check"><button type="button" class="btn btn--ghost" data-histo="dont-know">Не знаю</button></div>':'')+feedback+
      '<div class="histo-bottom"><button type="button" class="btn btn--ghost" data-histo="prev"'+(s.index===0?' disabled':'')+'>← Назад</button><button type="button" class="btn btn--primary" data-histo="next"'+(e.status==='unanswered'||e.status==='review'?' disabled':'')+'>'+(s.index===s.order.length-1?'Завершить':'Далее →')+'</button></div></div></div>';
  }
  // Один просмотрщик для теста, структур и атласа. Масштаб считается относительно вписывания в окно.
  function openImageViewer(items, initial, opener, structureOverlay) {
    if(!items.length||!items[initial])return;
    const dialog=document.createElement('dialog');dialog.className='histo-image-dialog';dialog.setAttribute('aria-label','Просмотр изображений препарата');
    dialog.innerHTML='<div class="histo-image-dialog__head"><div class="histo-viewer__heading"><strong data-viewer-title>Изображение</strong><span data-viewer-source></span></div><button type="button" data-zoom-close aria-label="Закрыть изображение">Закрыть</button></div><div class="histo-viewer__toolbar"><div class="histo-viewer__paging"><button type="button" data-viewer-prev aria-label="Предыдущее изображение">←</button><span data-viewer-count></span><button type="button" data-viewer-next aria-label="Следующее изображение">→</button></div><div class="histo-viewer__zoom"><button type="button" data-zoom-out aria-label="Уменьшить">−</button><span data-zoom-level aria-live="polite">100%</span><button type="button" data-zoom-toggle aria-label="Увеличить">+</button><button type="button" data-zoom-fit aria-label="Вписать изображение в экран">Вписать</button></div></div><div class="histo-image-dialog__viewport" tabindex="0" aria-label="Область изображения"><div class="histo-viewer__stage"><img alt=""><div class="histo-viewer__markers"></div></div></div><p class="histo-viewer__note" data-viewer-note></p><p class="histo-viewer__error" data-zoom-error hidden>Изображение не загрузилось. <button type="button" data-viewer-retry>Повторить</button></p><p class="histo-viewer__hint">+ и − — масштаб; перетаскивайте увеличенное изображение. На телефоне можно увеличивать двумя пальцами.</p>';
    const viewport=dialog.querySelector('.histo-image-dialog__viewport'),stage=dialog.querySelector('.histo-viewer__stage'),image=stage.querySelector('img'),markers=stage.querySelector('.histo-viewer__markers');
    const prev=dialog.querySelector('[data-viewer-prev]'),next=dialog.querySelector('[data-viewer-next]'),zoomIn=dialog.querySelector('[data-zoom-toggle]'),zoomOut=dialog.querySelector('[data-zoom-out]');
    let index=initial,scale=1,fitWidth=0,fitHeight=0,loaded=false,drag=null,pinch=null;const pointers=new Map();
    function geometry() {
      if(!loaded||!image.naturalWidth||!viewport.clientWidth||!viewport.clientHeight)return;
      const fit=Math.min(viewport.clientWidth/image.naturalWidth,viewport.clientHeight/image.naturalHeight);
      fitWidth=image.naturalWidth*fit;fitHeight=image.naturalHeight*fit;
      stage.style.width=(fitWidth*scale)+'px';stage.style.height=(fitHeight*scale)+'px';
      dialog.querySelector('[data-zoom-level]').textContent=Math.round(scale*100)+'%';
      zoomOut.disabled=scale<=1;zoomIn.disabled=scale>=5;
      viewport.classList.toggle('is-zoomed',scale>1);
    }
    function setZoom(nextScale,clientX,clientY) {
      if(!loaded)return;
      nextScale=Math.max(1,Math.min(5,nextScale));
      const rect=stage.getBoundingClientRect(),vrect=viewport.getBoundingClientRect();
      const x=clientX==null?vrect.left+vrect.width/2:clientX,y=clientY==null?vrect.top+vrect.height/2:clientY;
      const rx=Math.max(0,Math.min(1,(x-rect.left)/rect.width)),ry=Math.max(0,Math.min(1,(y-rect.top)/rect.height));
      scale=nextScale;geometry();
      const after=stage.getBoundingClientRect();viewport.scrollLeft+=after.left+rx*after.width-x;viewport.scrollTop+=after.top+ry*after.height-y;
    }
    function renderMarkers() {
      markers.innerHTML='';if(!structureOverlay)return;
      const group=structureGame.group(),task=structureGame.current(),entry=structureGame.entry();if(!group||!task||!entry)return;
      const shown=entry.status!=='unanswered';
      displayedStructurePoints(group,task,entry).forEach(({point:p,index:i},number)=>{
        if(task.mode==='name'&&!shown&&p.id!==task.pointId)return;
        const selected=task.mode==='name'?p.id===task.pointId:entry.selected===p.id;
        if(p.extent)markers.insertAdjacentHTML('beforeend',structureExtentMarkup(p));
        const button=document.createElement('button');button.type='button';button.className='histo-marker'+(p.extent?' histo-marker--extent':'')+(p.x>75?' histo-marker--label-left':'')+(selected?' is-selected':'')+(shown&&p.id===task.pointId?' is-correct':'');button.style.left=p.x+'%';button.style.top=p.y+'%';button.dataset.number=String(number+1);button.setAttribute('aria-label','Метка '+(number+1));button.setAttribute('aria-pressed',String(selected));button.disabled=task.mode==='name'||shown;
        button.addEventListener('click',()=>{if(!structureGame.select(p.id))return;document.querySelectorAll('.histo-view [data-histo="structure-point"]').forEach(b=>{const on=b.dataset.value===String(i);b.classList.toggle('is-selected',on);b.setAttribute('aria-pressed',String(on));});const check=document.querySelector('.histo-view [data-histo="structure-check"]');if(check)check.disabled=false;renderMarkers();if(structureGame.storageFailed())AT.ui.toast('Не удалось сохранить прогресс на устройстве','warn');});markers.appendChild(button);
      });
    }
    function show(i) {
      if(i<0||i>=items.length)return;
      index=i;const item=items[index];scale=1;loaded=false;drag=null;pinch=null;pointers.clear();stage.style.width='0px';stage.style.height='0px';
      dialog.querySelector('[data-viewer-title]').textContent=item.title||'Изображение';
      dialog.querySelector('[data-viewer-source]').textContent=item.source||'';
      dialog.querySelector('[data-viewer-count]').textContent=(index+1)+' / '+items.length;
      dialog.querySelector('[data-viewer-note]').textContent=item.note||'';
      dialog.querySelector('[data-zoom-error]').hidden=true;
      prev.disabled=index===0;next.disabled=index===items.length-1;prev.parentElement.hidden=items.length===1;
      image.alt=item.alt||'Увеличенное изображение препарата';image.src=item.image;renderMarkers();
    }
    image.addEventListener('load',()=>{loaded=true;scale=1;geometry();viewport.scrollLeft=0;viewport.scrollTop=0;});
    image.addEventListener('error',()=>{loaded=false;dialog.querySelector('[data-zoom-error]').hidden=false;});
    zoomIn.addEventListener('click',()=>setZoom(scale*1.5));zoomOut.addEventListener('click',()=>setZoom(scale/1.5));
    dialog.querySelector('[data-zoom-fit]').addEventListener('click',()=>setZoom(1));
    prev.addEventListener('click',()=>show(index-1));next.addEventListener('click',()=>show(index+1));
    dialog.querySelector('[data-viewer-retry]').addEventListener('click',()=>{dialog.querySelector('[data-zoom-error]').hidden=true;image.src=items[index].image+'?retry='+Date.now();});
    dialog.querySelector('[data-zoom-close]').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
    dialog.addEventListener('keydown',event=>{if(event.key==='+'||event.key==='='){event.preventDefault();setZoom(scale*1.5);}else if(event.key==='-'){event.preventDefault();setZoom(scale/1.5);}else if(event.key==='0'){event.preventDefault();setZoom(1);}else if(items.length>1&&scale===1&&event.key==='ArrowLeft'){event.preventDefault();show(index-1);}else if(items.length>1&&scale===1&&event.key==='ArrowRight'){event.preventDefault();show(index+1);}});
    viewport.addEventListener('dblclick',event=>{if(event.target.closest('button'))return;event.preventDefault();setZoom(scale>1?1:2,event.clientX,event.clientY);});
    viewport.addEventListener('wheel',event=>{event.preventDefault();setZoom(scale*(event.deltaY<0?1.2:1/1.2),event.clientX,event.clientY);},{passive:false});
    viewport.addEventListener('pointerdown',event=>{if(event.target.closest('button')||(event.pointerType==='mouse'&&event.button!==0))return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});viewport.setPointerCapture(event.pointerId);if(pointers.size===1)drag={x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};if(pointers.size===2){const [a,b]=Array.from(pointers.values());pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),scale};drag=null;}if(event.pointerType!=='mouse'||scale>1)event.preventDefault();});
    viewport.addEventListener('pointermove',event=>{if(!pointers.has(event.pointerId))return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size===2&&pinch){const [a,b]=Array.from(pointers.values()),distance=Math.hypot(a.x-b.x,a.y-b.y);if(pinch.distance>0)setZoom(pinch.scale*distance/pinch.distance,(a.x+b.x)/2,(a.y+b.y)/2);}else if(pointers.size===1&&drag&&scale>1){viewport.scrollLeft=drag.left-(event.clientX-drag.x);viewport.scrollTop=drag.top-(event.clientY-drag.y);}});
    function endPointer(event){pointers.delete(event.pointerId);pinch=null;const remaining=Array.from(pointers.values())[0];drag=remaining?{x:remaining.x,y:remaining.y,left:viewport.scrollLeft,top:viewport.scrollTop}:null;}
    viewport.addEventListener('pointerup',endPointer);viewport.addEventListener('pointercancel',endPointer);viewport.addEventListener('lostpointercapture',endPointer);
    const resize=()=>geometry();window.addEventListener('resize',resize);
    dialog.addEventListener('close',()=>{window.removeEventListener('resize',resize);dialog.remove();if(opener.isConnected)opener.focus();},{once:true});
    document.body.appendChild(dialog);dialog.showModal();show(initial);
    return ()=>{if(dialog.open)dialog.close();else {window.removeEventListener('resize',resize);dialog.remove();}};
  }

  AT.views.histology=function (params) {
    if(typeof location!=='undefined' && location.hash!==lastSectionHash){
      const first=lastSectionHash===null;lastSectionHash=location.hash;const section=params&&params.section;
      if(pendingResume && pendingResume.section===section){screen=pendingResume.kind;pendingResume=null;}
      else if(section)screen=['setup','errors','stats','atlas','structures','theory'].includes(section)?section:'setup';else if(!first)screen='setup';
      if(first && screen==='atlas' && validAtlasReturn())atlasJump=atlasReturn.slideId;
    }
    const html=screen==='run'?runView():screen==='errors'?errorsView():screen==='stats'?statsView():screen==='atlas'?atlasView():screen==='structures'?structuresView():screen==='structure-run'?structureRunView():screen==='theory'?theoryView():screen==='theory-run'?theoryRunView():setupView();
    return {title:'Гистология',html,mount(root) {
      const view=root.querySelector('.histo-view');
      if(screen==='stats' && window.MedzoStudySync) window.MedzoStudySync.mountLeaderboard(view.querySelector('[data-leaderboard]'));
      if(screen==='stats' && params && params.rating==='1' && AT.focusLeaderboard) AT.focusLeaderboard(view);
      if(screen==='setup' && window.MedzoStudySync) window.MedzoStudySync.mountVisibility(view.querySelector('[data-rating-invite]'));
      if(focusReturned) {
        focusReturned=false;
        requestAnimationFrame(()=>{
          if(!view.isConnected)return;
          const feedback=view.querySelector('.histo-feedback');
          if(feedback)feedback.scrollIntoView({block:'center'});
          const button=view.querySelector('.histo-self button, [data-histo="next"], [data-histo="theory-next"], [data-histo="structure-next"]');
          if(button && !button.disabled)button.focus({preventScroll:true});
        });
      }
      // Точная высота шапки зависит от ширины и масштаба; кнопка остаётся под ней.
      const returnButton=view.querySelector('.histo-atlas-return'),topbar=document.querySelector('.topbar');
      if(screen==='atlas') {
        const updateAtlasOffsets=()=>{
          const top=topbar ? topbar.offsetHeight : 64;
          view.style.setProperty('--histo-return-top',(top+6)+'px');
          // Запас учитывает вступительный сдвиг экрана и оставляет заголовок открытой карточки видимым.
          view.style.setProperty('--histo-atlas-scroll-offset',(top+(returnButton?returnButton.offsetHeight+28:12))+'px');
        };
        updateAtlasOffsets();
        window.addEventListener('resize',updateAtlasOffsets);
        const observer=typeof ResizeObserver==='function'?new ResizeObserver(updateAtlasOffsets):null;
        if(observer){if(topbar)observer.observe(topbar);if(returnButton)observer.observe(returnButton);}
        if(AT.onCleanup)AT.onCleanup(()=>{window.removeEventListener('resize',updateAtlasOffsets);if(observer)observer.disconnect();});
      }
      let closeViewer=null;
      if(AT.onCleanup)AT.onCleanup(()=>{if(closeViewer)closeViewer();});
      view.addEventListener('click',ev=>{
        const el=ev.target.closest('[data-histo]'); if(!el || el.disabled)return;
        const action=el.dataset.histo, val=el.dataset.value;
        if(action==='atlas-photo') {
          if(screen!=='atlas')return;const slide=H.byId[el.dataset.slideId]||H.atlasReferences[el.dataset.slideId],index=Number(val);if(!slide||!Number.isInteger(index))return;
          closeViewer=openImageViewer(atlasGallery(slide),index,el,false);return;
        }
        if(action==='zoom'||action==='structure-zoom') {
          const q=game.current(), t=structureGame.current();let item,overlay=false;
          if(action==='zoom'&&screen==='run'&&q&&(val===q.image||(game.entry().status!=='unanswered'&&val===q.review))) item={image:val,title:game.entry().status==='unanswered'?'Изображение для определения':q.name,source:game.entry().status==='unanswered'?'':q.source};
          if(action==='structure-zoom'&&screen==='structure-run'&&t){const group=structureGame.group(),slide=Object.assign({},H.byId[t.slideId],group.image?{image:group.image,review:group.review,source:group.source}:{});if(val===slide.image){item={image:val,title:slide.name,source:slide.source};overlay=true;}else if(structureGame.entry().status!=='unanswered'&&val===slide.review)item={image:val,title:slide.name,source:slide.source};}
          if(item)closeViewer=openImageViewer([item],0,el,overlay);return;
        }
        if(action==='structure-atlas') {const t=structureGame.current(),e=structureGame.entry();if(screen!=='structure-run'||!t||!e||e.status==='unanswered'||t.slideId!==val)return;rememberAtlasReturn('structure-run',val);atlasJump=val;goSection('atlas');return;}
        if(action==='review-atlas') {const q=game.current(),e=game.entry();if(screen!=='run'||!q||!e||e.status==='unanswered'||q.id!==val)return;rememberAtlasReturn('run',val);atlasJump=val;goSection('atlas');return;}
        if(action==='atlas-return') {
          if(screen!=='atlas'||!validAtlasReturn()){clearAtlasReturn();AT.rerender();return;}
          const r=atlasReturn, g=returnGame(r.kind);g.navigate(r.index-g.state.session.index);
          const section=r.kind==='run'?'setup':r.kind==='theory-run'?'theory':'structures';
          pendingResume={kind:r.kind,section};focusReturned=true;clearAtlasReturn();goSection(section);return;
        }
        if(action==='section') {
          if(!['setup','errors','stats','atlas','structures','theory'].includes(val))return;
          notice='';
          // Ссылки сохраняют стандартные действия браузера, включая историю и открытие в новой вкладке.
          if(location.hash==='#/histology?section='+val && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey && !ev.altKey && ev.button===0){ev.preventDefault();screen=val;AT.rerender();}
          return;
        }
        if(action==='repeat-mistakes') {game.setScope('mistakes');notice='Выбраны препараты с ошибками. Текущую подборку можно продолжить или начать новую.';goSection('setup');return;}
        if(action==='theory-slide') {if(!H.theoryQuestions.some(q=>q.slideId===val))return;theorySlide=val;theoryTopic='';atlasJump=val;theoryScope='all';notice=theoryGame.state.session?'Выбран препарат для новой подборки. Незавершённый тест можно продолжить.':'';goSection('theory');return;}
        if(action==='theory-atlas') {const q=theoryGame.current(),e=theoryGame.entry();if(screen!=='theory-run'||!q||!e||e.status==='unanswered'||q.slideId!==val)return;rememberAtlasReturn('theory-run',val);atlasJump=val;goSection('atlas');return;}
        if(action==='theory-mistakes') {theorySlide='';theoryTopic='';theoryScope='mistakes';notice='Выбраны ошибки по теории.';goSection('theory');return;}
        if(action==='theory-select') {
          const e=theoryGame.entry(),index=Number(val);if(!e||!Number.isInteger(index)||!theoryGame.select(e.options[index]))return;
          view.querySelectorAll('[data-histo="theory-select"]').forEach(button=>{const on=button.dataset.value===val;button.classList.toggle('is-selected',on);button.setAttribute('aria-pressed',String(on));});
          view.querySelector('[data-histo="theory-check"]').disabled=false;if(theoryGame.storageFailed())AT.ui.toast('Не удалось сохранить прогресс на устройстве','warn');return;
        }
        if(action==='theory-filter-topic') {if(val&&!H.theoryQuestions.some(q=>q.topic===val))return;theoryTopic=val;theorySlide='';notice='';AT.rerender();return;}
        if(action==='theory-filter-slide') {if(val&&!H.theoryQuestions.some(q=>q.slideId===val))return;theorySlide=val;theoryTopic='';notice='';AT.rerender();return;}
        if(action==='theory-scope') {if(!['all','mistakes'].includes(val))return;theoryScope=val;}
        else if(action==='theory-start') {if(!theoryGame.start(theoryScope,theorySlide,theoryTopic))return;screen='theory-run';notice='';}
        else if(action==='theory-resume') {if(!theoryGame.state.session)return;screen='theory-run';}
        else if(action==='theory-setup') {screen='theory';notice='Тест сохранён — его можно продолжить.';}
        else if(action==='theory-check') {if(!theoryGame.check())return;}
        else if(action==='theory-dont-know') {if(!theoryGame.dontKnow())return;}
        else if(action==='theory-prev') theoryGame.navigate(-1);
        else if(action==='theory-next') {const s=theoryGame.state.session,e=theoryGame.entry();if(!s||!e||!['correct','wrong'].includes(e.status))return;if(s.index===s.order.length-1){theoryGame.finish();screen='theory';notice='Тест завершён.';}else theoryGame.navigate(1);}
        else if(action.startsWith('theory-'))return;
        if(action.startsWith('theory-')) {if(theoryGame.storageFailed())AT.ui.toast('Не удалось сохранить прогресс на устройстве','warn');AT.rerender();return;}
        if(action==='structure-mistakes') {if(!['point','name'].includes(val))return;structureGame.setMode(val);structureScope='mistakes';notice='Выбраны ошибки по структурам.';goSection('structures');return;}
        if(action==='structure-point') {
          const group=structureGame.group(),index=Number(val),point=group && Number.isInteger(index) && group.points[index];
          if(!point||!structureGame.select(point.id))return;
          view.querySelectorAll('[data-histo="structure-point"]').forEach(button=>{const on=button.dataset.value===val;button.classList.toggle('is-selected',on);button.setAttribute('aria-pressed',String(on));});
          view.querySelector('[data-histo="structure-check"]').disabled=false;
          if(structureGame.storageFailed())AT.ui.toast('Не удалось сохранить прогресс на устройстве','warn');return;
        }
        if(action==='structure-option') {
          const e=structureGame.entry(),index=Number(val),option=e&&Number.isInteger(index)&&e.options&&e.options[index];
          if(!option||!structureGame.select(option))return;
          view.querySelectorAll('[data-histo="structure-option"]').forEach(button=>{const on=button.dataset.value===val;button.classList.toggle('is-selected',on);button.setAttribute('aria-pressed',String(on));});
          view.querySelector('[data-histo="structure-check"]').disabled=false;
          if(structureGame.storageFailed())AT.ui.toast('Не удалось сохранить прогресс на устройстве','warn');return;
        }
        if(action==='structure-mode') structureGame.setMode(val);
        else if(action==='structure-scope') {if(!['all','mistakes'].includes(val))return;structureScope=val;}
        else if(action==='structure-start') {if(!structureGame.start(structureScope))return;screen='structure-run';notice='';}
        else if(action==='structure-resume') {if(!structureGame.state.session)return;screen='structure-run';}
        else if(action==='structure-setup') {screen='structures';notice='Тренировка структур сохранена — её можно продолжить.';}
        else if(action==='structure-check') {if(!structureGame.check())return;}
        else if(action==='structure-dont-know') {if(!structureGame.dontKnow())return;}
        else if(action==='structure-self') {if(!['yes','no'].includes(val)||!structureGame.self(val==='yes'))return;}
        else if(action==='structure-prev') structureGame.navigate(-1);
        else if(action==='structure-next') {const s=structureGame.state.session,e=structureGame.entry();if(!s||!e||!['correct','wrong'].includes(e.status))return;if(s.index===s.order.length-1){structureGame.finish();screen='structures';notice='Тренировка структур завершена.';}else structureGame.navigate(1);}
        else if(action.startsWith('structure-')) return;
        else { /* остальные действия относятся к тренировке препаратов */ }
        if(action.startsWith('structure-')) {if(structureGame.storageFailed())AT.ui.toast('Не удалось сохранить прогресс на устройстве','warn');AT.rerender();return;}
        if(action==='retry-image') {
          const isReview=val==='review';
          const box=view.querySelector(isReview ? '.histo-review' : '.histo-image');
          const image=box && box.querySelector('img');
          const url=isReview ? game.current().review : game.current().image;
          if(!image || !url) return;
          box.querySelector('.histo-image__error').hidden=true; image.src=url + '?retry=' + Date.now();
          return;
        }
        if(action==='select') {
          if (!game.select(val)) return;
          view.querySelectorAll('[data-histo="select"]').forEach(button=>{const active=button.dataset.value===val;button.classList.toggle('is-selected',active);button.setAttribute('aria-pressed',String(active));});
          view.querySelector('[data-histo="check"]').disabled=false;
          if(game.storageFailed()) AT.ui.toast('Не удалось сохранить прогресс на устройстве','warn');
          return;
        }
        if(action==='mode') game.setMode(val);
        else if(action==='sampling') {game.setSampling(val);}
        else if(action==='scope') game.setScope(val);
        else if(action==='start') {if(!game.start())return;screen='run';notice='';}
        else if(action==='resume') {if(!game.state.session)return;screen='run';}
        else if(action==='setup') {screen='setup';notice='Тренировка сохранена — её можно продолжить.';}
        else if(action==='favorite') game.toggleFavorite();
        else if(action==='check') {if(!game.check())return;}
        else if(action==='dont-know') {if(!game.dontKnow())return;}
        else if(action==='self') {if(!game.self(val==='yes'))return;}
        else if(action==='prev') game.navigate(-1);
        else if(action==='next') {const session=game.state.session, entry=game.entry();if(!session||!entry||!['correct','wrong'].includes(entry.status))return;if(session.index===session.order.length-1){game.finish();screen='setup';notice='Подборка завершена. Можно повторить ошибки или начать заново.';}else game.navigate(1);}
        else return;
        if(game.storageFailed()) AT.ui.toast('Не удалось сохранить прогресс на устройстве','warn');
        AT.rerender();
      });
      view.querySelectorAll('.histo-image, .histo-review').forEach(box=>{
        const image=box.querySelector('img'), error=box.querySelector('.histo-image__error');
        if(!image || !error) return;
        image.addEventListener('error',()=>{error.hidden=false;});
        image.addEventListener('load',()=>{error.hidden=true;});
        // Ленивые изображения внутри закрытого details ещё не были загружены.
        if(!image.loading || image.loading!=='lazy') {
          if(image.complete && !image.naturalWidth) error.hidden=false;
        }
      });
      view.querySelectorAll('.histo-photo__frame img').forEach(img=>{const fallback=img.parentElement.querySelector('.histo-photo__missing');img.addEventListener('error',()=>{img.hidden=true;fallback.hidden=false;});img.addEventListener('load',()=>{img.hidden=false;fallback.hidden=true;});if(img.complete&&img.currentSrc&&!img.naturalWidth){img.hidden=true;fallback.hidden=false;}});
      const search=view.querySelector('[data-atlas-count]') && view.querySelector('#atlasSearch');
      if(search) {
        let searching=false,oldOpen=new Map();
        search.addEventListener('input',()=>{const query=H.normalize(search.value),active=!!query;let count=0;
          if(active&&!searching){oldOpen=new Map(Array.from(view.querySelectorAll('[data-atlas-group]'),g=>[g,g.open]));}
          view.querySelectorAll('[data-atlas-group]').forEach(group=>{let matches=0;group.querySelectorAll('[data-atlas-item]').forEach(item=>{const found=item.dataset.search.includes(query);item.hidden=!found;if(found){count++;matches++;}});group.hidden=matches===0;group.querySelector('[data-group-count]').textContent=countLabel(matches,['препарат','препарата','препаратов']);if(active)group.open=matches>0;else if(searching)group.open=!!oldOpen.get(group);});
          searching=active;view.querySelector('[data-atlas-count]').textContent=count+' из '+(H.slides.length+Object.keys(H.atlasReferences).length)+' карточек';view.querySelector('[data-atlas-empty]').hidden=count!==0;
        });
        if(atlasJump){const item=Array.from(view.querySelectorAll('[data-atlas-item]')).find(x=>x.dataset.slideId===atlasJump);atlasJump='';if(item){item.closest('[data-atlas-group]').open=true;item.open=true;requestAnimationFrame(()=>{if(item.isConnected)item.scrollIntoView({block:'start'});});}}
      }
      const pickers=view.querySelectorAll('.histo-picker');
      pickers.forEach(picker=>picker.addEventListener('toggle',()=>{if(picker.open)pickers.forEach(other=>{if(other!==picker)other.open=false;});}));
      view.addEventListener('click',ev=>{if(!ev.target.closest('.histo-picker'))pickers.forEach(picker=>picker.open=false);});
      view.addEventListener('keydown',ev=>{if(ev.key!=='Escape')return;const picker=ev.target.closest('.histo-picker');if(picker&&picker.open){picker.open=false;picker.querySelector('summary').focus();ev.preventDefault();}});
      const hotkeys=ev=>{
        if(!view.isConnected||!['run','structure-run','theory-run'].includes(screen)||ev.defaultPrevented||ev.repeat||ev.ctrlKey||ev.altKey||ev.metaKey||ev.shiftKey||Array.from(document.querySelectorAll('dialog[open], [role="dialog"][aria-modal="true"]')).some(el=>el.getClientRects().length))return;
        const target=ev.target;if(target instanceof Element&&(target.isContentEditable||target.closest('input,textarea,select,[contenteditable],.histo-picker')))return;
        const prefix=screen==='theory-run'?'theory-':screen==='structure-run'?'structure-':'';
        const num=/^(?:Digit|Numpad)([1-5])$/.exec(ev.code)||/^([1-5])$/.exec(ev.key);
        let button;
        if(num){
          if(screen==='structure-run')button=(view.querySelectorAll('[data-histo="structure-option"]').length?view.querySelectorAll('[data-histo="structure-option"]'):view.querySelectorAll('.histo-marker-choices [data-histo="structure-point"]'))[Number(num[1])-1];
          else button=view.querySelectorAll('[data-histo="'+prefix+'select"]')[Number(num[1])-1];
          if(!button){const self=view.querySelectorAll('[data-histo="'+prefix+'self"]');button=self[Number(num[1])-1];}
        }else if(ev.key==='Enter'){
          if(target instanceof Element&&target.closest('button,a,summary,[role="button"]'))return;
          button=view.querySelector('[data-histo="'+prefix+'check"]:not(:disabled)')||view.querySelector('[data-histo="'+prefix+'next"]:not(:disabled)');
        }else if(ev.key==='ArrowLeft'||ev.key==='ArrowRight')button=view.querySelector('[data-histo="'+prefix+(ev.key==='ArrowLeft'?'prev':'next')+'"]:not(:disabled)');
        if(button&&!button.disabled){ev.preventDefault();button.click();if(num){const heading=view.querySelector('.histo-card h1');if(heading){heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}}}
      };
      document.addEventListener('keydown',hotkeys);if(AT.onCleanup)AT.onCleanup(()=>document.removeEventListener('keydown',hotkeys));
      const form=view.querySelector('[data-histo-form]');
      if(form) {
        const input=form.querySelector('input');
        input.addEventListener('input',()=>game.setText(input.value));
        form.addEventListener('submit',ev=>{ev.preventDefault();if(!game.check(input.value)){input.focus();return;}if(game.storageFailed())AT.ui.toast('Не удалось сохранить прогресс на устройстве','warn');AT.rerender();});
      }
    }};
  };
  AT.views.histology.openSection=function(section) {if(!['setup','errors','stats','atlas','structures','theory'].includes(section))return;screen=section;notice='';AT.rerender();};
  AT.views.histology.onLeave=function() {lastSectionHash=null;};
})();
