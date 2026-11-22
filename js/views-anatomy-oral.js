/* Подготовка к устной части первого коллоквиума. */
(function(){
  'use strict';
  const AT=window.AT, esc=AT.utils.esc, rows=window.AnatomyOralData;
  const skillById=Object.fromEntries(window.AnatomySkillsData.items.map(item=>[item.id,item]));
  const ticketSkills=window.AnatomyTicketSkills;
  const sourceById=Object.fromEntries(window.AnatomyOralSource.map(section=>[section.id,section]));
  let store;
  try{store=window.localStorage;}catch(_){store={getItem(){return null;},setItem(){throw Error('storage');}};}
  const game=window.AnatomyOral.create(store,()=>window.MedzoStudySync?.oralChanged());
  let selectedTicket=1, card=1, showAnswer=false;
  // Порядок карточек: по порядку или вперемешку; выбор запоминается на устройстве.
  const cardOrderKey='medzo-oral-cards-order-v1';
  const shuffleIds=list=>{const copy=list.slice();for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;};
  let cardOrder=(()=>{try{return window.localStorage.getItem(cardOrderKey)==='random'?'random':'ordered';}catch(_){return 'ordered';}})();
  let cardDeck=null;
  function cardIds(){const all=rows.map(r=>r.id);if(cardOrder==='ordered')return all;if(!cardDeck||cardDeck.length!==all.length)cardDeck=shuffleIds(all);return cardDeck;}
  function cardPosition(){const list=cardIds();const index=list.indexOf(card);return index<0?0:index;}
  function setCardOrder(value){cardOrder=value==='random'?'random':'ordered';try{window.localStorage.setItem(cardOrderKey,cardOrder);}catch(_){}cardDeck=cardOrder==='random'?shuffleIds(rows.map(r=>r.id)):null;showAnswer=false;}
  function answerContent(item){return '<div class="oral-explanation"><p><strong>Кратко.</strong> '+esc(item.answer)+'</p><p><strong>Подробнее.</strong> '+esc(item.detail)+'</p><p><strong>Примеры и ориентиры.</strong> '+esc(item.examples)+'</p></div>'; }
  function sourceText(section){
    return section.blocks.map(block=>block.type==='table'?[block.caption||'',...block.headers,...block.rows.flat()].join(' '):block.runs.map(run=>run.text).join('')).join(' ');
  }
  function sourceRuns(runs){
    const plain=runs.map(run=>run.text).join('');
    // Highlight concise definitions or important labels; retain all source text.
    const match=plain.match(/^(?:•\s*)?(?:\d+[.)]\s*)?([^.!?;]{2,110}?)(?:\s+[–—-]\s+|:\s+)/);
    let end=match?match[0].length:0,position=0;
    return runs.map(run=>{const before=Math.max(0,Math.min(run.text.length,end-position));position+=run.text.length;
      const a=esc(run.text.slice(0,before)),b=esc(run.text.slice(before));
      return (a?'<strong>'+a+'</strong>':'')+(b?(run.bold?'<strong>'+b+'</strong>':b):'');
    }).join('');
  }
  function sourceTable(block){
    return '<div class="oral-source-table">'+(block.caption?'<h4>'+esc(block.caption)+'</h4>':'')+block.rows.map(row=>'<dl class="oral-source-table__row">'+row.map((cell,i)=>cell?'<div><dt>'+esc(block.headers[i]||'')+'</dt><dd>'+esc(cell)+'</dd></div>':'').join('')+'</dl>').join('')+'</div>';
  }
  function fullSource(section){
    // Служебных подписей «Страница N оригинала» на экране нет: текст и рисунки
    // идут подряд, а страница исходника остаётся в разметке как data-атрибут.
    const body=section.blocks.map(block=>{const wrap=page=>'<div data-source-page="'+page+'">';
      if(block.type==='table')return '<div data-source-page="'+block.page+'">'+sourceTable(block)+'</div>';
      const tag=block.type==='heading'?'h3':'p',cls=block.type==='list'?'oral-source-list':block.type==='note'?'oral-source-footnote':'';
      return '<div data-source-page="'+block.page+'"><'+tag+(cls?' class="'+cls+'"':'')+'>'+sourceRuns(block.runs)+'</'+tag+'></div>';
    }).join('');
    // Рисунки исходника показаны прямо на странице, без перехода в PDF:
    // ссылок на оригинал в материале не держим.
    const pages=section.pages.map(page=>'<figure><img src="assets/anatomy/oral-source-pages/'+String(page).padStart(2,'0')+'.jpg" loading="lazy" alt="Страница '+page+' исходной теории: рисунки и оригинальный текст"></figure>').join('');
    return '<div class="oral-source-text">'+body+'</div><details class="oral-pages"><summary>Иллюстрации · '+section.pages.length+'</summary><p>На странице могут находиться и соседние темы.</p><div class="oral-pages__grid">'+pages+'</div></details>';
  }
  function notes(){return '<section class="oral-panel"><h2 class="oral-panel__title">Конспект</h2><p class="oral-note">Текст перенесён близко к исходному материалу, включая примеры; выделены термины и важные места. Возможны ошибки исходника и переноса, независимой медицинской редактуры не было. Иллюстрации и таблицы сверяйте с оригинальными страницами.</p><label> <span>Поиск по теории: </span><input type="search" class="oral-search" data-oral-search placeholder="Найти тему, определение или пример"></label><div class="oral-list">'+rows.map(x=>{const full=sourceById[x.id];return '<details data-oral-note data-search="'+esc((x.id+' '+x.title+' '+x.answer+' '+x.detail+' '+x.examples+' '+sourceText(full)).toLowerCase())+'"><summary>'+x.id+'. '+esc(x.title)+'</summary><details class="oral-brief"><summary>Краткое повторение · примеры и ориентиры</summary>'+answerContent(x)+'</details>'+fullSource(full)+'</details>';}).join('')+'</div><p data-oral-empty hidden>Ничего не найдено.</p><p class="oral-note">Текст и иллюстрации перенесены на страницу целиком, поэтому открывать PDF не нужно. Сверяйте формулировки с учебником.</p></section>';}

  function ratings(kind,count){
    const data=game.read().tickets[selectedTicket]?.[kind]||{};
    return '<div class="oral-rating-grid">'+Array.from({length:count},(_,j)=>{
      const n=j+1,value=data[n],entry=kind==='practical'?ticketSkills[selectedTicket-1]?.[j]:null,skill=entry?.skillId?skillById[entry.skillId]:null;
      const heading=entry?'<strong><span class="oral-rating__number">'+n+'.</span> <span lang="la">'+esc(skill?skill.latin:entry.term)+'</span></strong>':'<strong>Вопрос '+n+'</strong>';
      const detail=entry?(skill?'<small>'+(entry.related?'Связанный':'Соответствует')+' навык № '+skill.id+(entry.term!==skill.latin?' · В билете: '+esc(entry.term):'')+'</small><button type="button" class="oral-hint-toggle" data-ticket-hint aria-expanded="false">Подсказка</button><p class="oral-skill-hint" hidden>'+esc(skill.hint)+'</p>':'<small>Нет точного соответствия в навыках · сверьтесь с билетом</small>'):'';
      return '<div class="oral-rating">'+heading+detail+'<div class="oral-rate-actions">'+[['known','Знаю'],['again','Повторить']].map(([v,label])=>'<button type="button" data-ticket-rate="'+kind+'" data-index="'+n+'" data-value="'+v+'" aria-label="'+label+': '+(kind==='practical'?'навык':'вопрос')+' '+n+'" aria-pressed="'+(value===v)+'">'+label+'</button>').join('')+'</div></div>';
    }).join('')+'</div>';
  }
  function ticketView(){
    const path='assets/anatomy/tickets/'+String(selectedTicket).padStart(2,'0')+'.webp',marks=game.read().tickets[selectedTicket]||{},done=Object.values(marks.practical||{}).filter(v=>['known','again'].includes(v)).length+Object.values(marks.theory||{}).filter(v=>['known','again'].includes(v)).length;
    return '<section class="oral-panel"><h2>Билеты первого коллоквиума</h2><p class="oral-note">Оцените каждый пункт. Названия взяты из навыков, а отличающиеся формулировки билетов показаны отдельно. Где найден соответствующий навык, доступна подсказка. Самооценка не начисляет баллы или валюту.</p><div class="oral-toolbar"><label for="oral-ticket">Выберите билет</label><select class="oral-select" id="oral-ticket">'+Array.from({length:35},(_,i)=>'<option value="'+(i+1)+'"'+(i+1===selectedTicket?' selected':'')+'>Билет № '+(i+1)+'</option>').join('')+'</select><button class="btn btn--ghost btn--sm" type="button" data-oral="random-ticket">Случайный</button><span data-ticket-count>Оценено: '+done+' / 13</span></div><h3>Практическая часть · 10 навыков</h3>'+ratings('practical',10)+'<h3>Теоретическая часть · 3 вопроса</h3><p class="oral-note">Теоретические вопросы пока приведены на фотографии билета. Нажмите её для увеличения.</p><a class="oral-image-link" href="'+path+'" target="_blank" rel="noopener" aria-label="Открыть фотографию билета № '+selectedTicket+' в полном размере"><img class="oral-ticket-image" src="'+path+'" alt="Оригинальная фотография билета № '+selectedTicket+'; десять практических и три теоретических задания" loading="lazy"></a><a class="oral-source" href="assets/anatomy/colloquium-1-tickets.pdf#page='+selectedTicket+'" target="_blank" rel="noopener">Открыть исходный PDF · стр. '+selectedTicket+' ↗</a>'+ratings('theory',3)+'<div class="oral-pagination"><button class="btn btn--ghost" type="button" data-oral="previous-ticket"'+(selectedTicket===1?' disabled':'')+'>← Предыдущий</button><button class="btn btn--ghost" type="button" data-oral="next-ticket"'+(selectedTicket===35?' disabled':'')+'>Следующий →</button></div></section>';
  }
  function cardView(){const item=rows.find(x=>x.id===card)||rows[0],mark=game.read().cards[card],list=cardIds(),position=cardPosition();return '<section class="oral-panel"><h2>Карточки для заучивания</h2><p class="oral-note">Вспомните тему, откройте объяснение с примерами и оцените себя. Сверяйте ответ с учебником и исходным материалом.</p><div class="oral-toolbar"><label for="oral-card">Тема</label><select class="oral-select" id="oral-card">'+rows.map(x=>'<option value="'+x.id+'"'+(x.id===card?' selected':'')+'>'+x.id+'. '+esc(x.title)+'</option>').join('')+'</select><div class="oral-order" role="group" aria-label="Порядок карточек"><button type="button" data-oral="order-ordered" aria-pressed="'+(cardOrder==='ordered')+'">По порядку</button><button type="button" data-oral="order-random" aria-pressed="'+(cardOrder==='random')+'">Вперемешку</button></div>'+(cardOrder==='random'?'<button class="btn btn--ghost btn--sm" type="button" data-oral="shuffle-cards">Перемешать</button>':'')+'<span>Карточка '+(position+1)+' / '+list.length+'</span></div><div class="oral-card"><span class="overline">ВОПРОС '+card+'</span><h2>'+esc(item.title)+'</h2><button class="btn btn--primary" type="button" data-oral="reveal" aria-expanded="'+showAnswer+'">'+(showAnswer?'Скрыть ответ':'Показать ответ')+'</button><div class="oral-answer"'+(showAnswer?'':' hidden')+'>'+answerContent(item)+'<div class="oral-card-actions">'+[['known','Знаю'],['again','Повторить']].map(([value,label])=>'<button type="button" data-card-rate="'+value+'" aria-pressed="'+(mark===value)+'">'+label+'</button>').join('')+'</div></div></div><div class="oral-pagination"><button class="btn btn--ghost" type="button" data-oral="previous-card"'+(position===0?' disabled':'')+'>← Назад</button><button class="btn btn--ghost" type="button" data-oral="next-card"'+(position===list.length-1?' disabled':'')+'>Далее →</button></div></section>';}
  AT.views.anatomyOral=function(params){
    const section=['notes','cards','tickets'].includes(params.section)?params.section:'notes';
    const html='<div class="view oral-view"><header class="oral-head"><span class="overline">АНАТОМИЯ · 1 КОЛЛОКВИУМ</span><h1>Теория и устная подготовка</h1><p>Кости и их соединения: конспект, карточки и оригинальные билеты. Оценки сохраняются на устройстве и синхронизируются при входе в аккаунт. При разных изменениях потребуется выбрать версию в профиле.</p></header>'+(section==='notes'?notes():section==='cards'?cardView():ticketView())+'</div>';
    return {title:'Устная подготовка',html,mount(root){const view=root.querySelector('.oral-view');
      view.addEventListener('input',e=>{if(!e.target.matches('[data-oral-search]'))return;const q=e.target.value.trim().toLowerCase();let count=0;view.querySelectorAll('[data-oral-note]').forEach(item=>{item.hidden=!!q&&!item.dataset.search.includes(q);if(!item.hidden)count++;});view.querySelector('[data-oral-empty]').hidden=count>0;});
      view.addEventListener('change',e=>{if(e.target.id==='oral-ticket'){selectedTicket=Number(e.target.value);AT.rerender();}if(e.target.id==='oral-card'){card=Number(e.target.value);showAnswer=false;AT.rerender();}});
      view.addEventListener('click',e=>{
        const hint=e.target.closest('[data-ticket-hint]');if(hint){const target=hint.closest('.oral-rating').querySelector('.oral-skill-hint'),open=hint.getAttribute('aria-expanded')==='true';hint.setAttribute('aria-expanded',String(!open));target.hidden=open;return;}
        const rated=e.target.closest('[data-ticket-rate]');if(rated){const kind=rated.dataset.ticketRate,index=Number(rated.dataset.index),value=rated.dataset.value,current=game.read().tickets[selectedTicket]?.[kind]?.[index];if(!game.markTicket(selectedTicket,kind,index,current===value?'':value)){AT.ui.toast('Не удалось сохранить оценку','warn');return;}const updated=game.read().tickets[selectedTicket]||{};rated.closest('.oral-rating').querySelectorAll('[data-ticket-rate]').forEach(button=>button.setAttribute('aria-pressed',String((updated[kind]||{})[index]===button.dataset.value)));const count=['practical','theory'].reduce((sum,k)=>sum+Object.values(updated[k]||{}).filter(x=>['known','again'].includes(x)).length,0);view.querySelector('[data-ticket-count]').textContent='Оценено: '+count+' / 13';return;}
        const ratedCard=e.target.closest('[data-card-rate]');if(ratedCard){const value=ratedCard.dataset.cardRate,current=game.read().cards[card];if(!game.markCard(card,current===value?'':value)){AT.ui.toast('Не удалось сохранить оценку','warn');return;}const updated=game.read().cards[card];ratedCard.closest('.oral-card-actions').querySelectorAll('[data-card-rate]').forEach(button=>button.setAttribute('aria-pressed',String(updated===button.dataset.cardRate)));return;}
        const btn=e.target.closest('[data-oral]');if(!btn)return;
        switch(btn.dataset.oral){case'reveal':showAnswer=!showAnswer;break;case'previous-card':{const list=cardIds();card=list[Math.max(0,cardPosition()-1)];showAnswer=false;break;}case'next-card':{const list=cardIds();card=list[Math.min(list.length-1,cardPosition()+1)];showAnswer=false;break;}case'order-ordered':setCardOrder('ordered');break;case'order-random':setCardOrder('random');break;case'shuffle-cards':cardDeck=shuffleIds(rows.map(r=>r.id));showAnswer=false;break;case'previous-ticket':selectedTicket=Math.max(1,selectedTicket-1);break;case'next-ticket':selectedTicket=Math.min(35,selectedTicket+1);break;case'random-ticket':selectedTicket=1+Math.floor(Math.random()*35);break;default:return;}AT.rerender();
      });
    }};
  };
})();
