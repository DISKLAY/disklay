(function () {
  'use strict';
  const AT=window.AT, H=window.AnatomySkills, esc=AT.utils.esc;
  let store;try {const local=window.localStorage;store={getItem:key=>local.getItem(key),setItem:(key,value)=>{local.setItem(key,value);if(window.MedzoStudySync)window.MedzoStudySync.changed();}};} catch(e){store={getItem(){return null;},setItem(){throw e;}};}
  const game=H.create(store);
  let screen='setup',search='',groupMenuOpen=false;
  const openSections=new Set();
  const skillCount=n=>n+' '+(n%10===1&&n%100!==11?'навык':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'навыка':'навыков');
  const statusLabel=status=>status==='known'?'Знаю и могу показать':status==='again'?'Повторить':'Не оценено';
  const choices={
    group:[['all','Все темы'],...H.data.groups.map(g=>[g.id,g.name])],
    scope:[['all','Все навыки'],['unseen','Ещё не оценённые'],['again','Требуют повторения'],['favorites','Избранные']],
    limit:[['10','10 навыков'],['20','20 навыков'],['50','50 навыков'],['0','Все доступные']],
    sequence:[['random','Вперемешку'],['ordered','По порядку']]
  };
  function picker(name,label,value,instance='setup'){
    const entries=choices[name], selectedGroups=Array.isArray(value)?value:[String(value)];
    const selected=entries.find(x=>x[0]===String(value))||entries[0], key=name+'-'+instance;
    const labelText=name==='group' && selectedGroups.length>1 ? 'Выбрано тем: '+selectedGroups.length : selected[1];
    const opened=name==='group' && groupMenuOpen;
    return '<div class="ps-picker" data-picker="'+name+'" data-picker-instance="'+instance+'"><span class="ps-picker__label" id="ps-label-'+key+'">'+label+'</span><button type="button" class="ps-picker__trigger" data-picker-trigger aria-labelledby="ps-label-'+key+' ps-value-'+key+'" aria-controls="ps-menu-'+key+'" aria-expanded="'+opened+'"><span id="ps-value-'+key+'">'+esc(labelText)+'</span><span class="ps-chevron" aria-hidden="true"></span></button><div class="ps-picker__menu" id="ps-menu-'+key+'" role="group" aria-labelledby="ps-label-'+key+'"'+(opened?'':' hidden')+'>'+entries.map(([id,text])=>{const active=name==='group'?selectedGroups.includes(id):id===selected[0];return '<button type="button" class="ps-picker__option'+(active?' is-selected':'')+'" data-ps-option="'+name+'" data-value="'+esc(id)+'" aria-pressed="'+active+'"><span>'+esc(text)+'</span><span class="ps-picker__check" aria-hidden="true">'+(active?'✓':'')+'</span></button>';}).join('')+'</div></div>';

  }
  function catalog(){
    const s=game.state;
    return '<section class="ps-catalog"><div class="ps-catalog__head"><div><span class="ps-eyebrow">СПРАВОЧНИК</span><h2>Список навыков</h2></div><span class="ps-count">'+H.data.items.length+'</span></div><div class="ps-catalog__controls"><label class="ps-search"><span class="ps-search__icon" aria-hidden="true">⌕</span><input type="search" aria-label="Поиск по названию, номеру или разделу" data-ps-search value="'+esc(search)+'" placeholder="Найти навык или раздел"></label>'+picker('sequence','Порядок раздела',s.sequence,'catalog')+'</div><div class="ps-sections">'+H.data.sections.map(section=>{
      const items=H.data.items.filter(item=>item.id>=section.from&&item.id<=section.to);
      return '<section class="ps-section" data-section="'+esc(section.id)+'" data-section-name="'+esc(section.name.toLowerCase())+'" data-total="'+items.length+'"><div class="ps-section__head"><button type="button" class="ps-section__toggle" data-section-toggle aria-expanded="'+openSections.has(section.id)+'" aria-controls="ps-section-'+esc(section.id)+'"><span class="ps-section__arrow" aria-hidden="true"></span><span class="ps-section__title">'+esc(section.name)+'<small data-section-count>'+skillCount(items.length)+'</small></span></button><button type="button" class="ps-section__train" data-ps="section-start" data-id="'+esc(section.id)+'" aria-label="Тренировать весь раздел '+esc(section.name)+'" title="Все навыки раздела">Тренировать <span aria-hidden="true">↗</span></button></div><div class="ps-section__items" id="ps-section-'+esc(section.id)+'"'+(openSections.has(section.id)?'':' hidden')+'>'+items.map(item=>'<div class="ps-list-item" data-search="'+esc((item.id+' '+item.latin).toLowerCase())+'"><span class="ps-item-number">'+item.id+'</span><strong lang="la">'+esc(item.latin)+'</strong></div>').join('')+'</div></section>';
    }).join('')+'</div><p class="ps-no-results" data-no-results hidden>Ничего не найдено.</p></section>';
  }
  function setupView(){
    const s=game.state,session=s.session,stats=Object.values(s.stats);
    const learned=stats.filter(x=>x.last==='known').length,again=stats.filter(x=>x.last==='again').length;
    let html='<header class="ps-head"><span class="ps-eyebrow">АНАТОМИЯ <span aria-hidden="true">/</span> 1 КОЛЛОКВИУМ</span><h1>Практические навыки</h1><p>Переведите термин и найдите структуру в атласе или на препарате.</p></header>'+
      '<div class="ps-stats" aria-label="Ваш прогресс"><div><strong>'+learned+'</strong><span>знаю</span></div><div><strong>'+again+'</strong><span>повторить</span></div><div><strong>'+stats.length+'<em> / '+H.data.items.length+'</em></strong><span>оценено</span></div></div>';
    if(session)html+='<div class="ps-resume"><div><strong>'+(session.finished?'Последняя подборка':'Продолжить тренировку')+'</strong><p>Оценено '+Object.keys(session.answers).length+' из '+session.order.length+'</p></div><button class="btn btn--primary" type="button" data-ps="resume">'+(session.finished?'Посмотреть итог':'Продолжить →')+'</button></div>';
    html+='<section class="ps-panel ps-builder"><div class="ps-builder__head"><div><span class="ps-eyebrow">НАСТРОЙКА</span><h2>Новая тренировка</h2></div><span class="ps-builder__icon" aria-hidden="true">✦</span></div><div class="ps-filters">'+picker('group','Темы',s.group)+picker('scope','Подборка',s.scope)+picker('limit','Количество',s.limit)+picker('sequence','Порядок',s.sequence)+'</div>'+
      '<div class="ps-start"><p>Доступно: <strong>'+game.pool().length+'</strong>'+(s.sequence==='ordered'&&s.limit&&game.pool().length>s.limit?' · первые '+s.limit:'')+'</p><button type="button" class="btn btn--primary" data-ps="start"'+(!game.pool().length?' disabled':'')+'>Начать тренировку <span aria-hidden="true">→</span></button></div></section>'+catalog()+
      '<details class="ps-data"><summary>О данных</summary><p>Навыки и оценки сохраняются в этом браузере. Подсказки — ориентир, сверяйтесь с атласом. Самооценка не начисляет очки.</p><button type="button" data-ps="reset">Сбросить оценки</button></details>';
    return html;
  }
  function runView(){
    const s=game.state.session,item=game.current();if(!s||!item){screen='setup';return setupView();}
    const status=s.answers[item.id],fav=!!game.state.favorites[item.id],showHint=!!s.hints[item.id];
    return '<div class="ps-run-top"><button type="button" class="ps-back" data-ps="setup">← К настройкам</button><span>НАВЫК '+(s.index+1)+' / '+s.order.length+'</span></div>'+
      '<div class="ps-progress" role="progressbar" aria-label="Позиция в подборке" aria-valuemin="1" aria-valuemax="'+s.order.length+'" aria-valuenow="'+(s.index+1)+'"><span style="width:'+((s.index+1)/s.order.length*100)+'%"></span></div>'+
      '<article class="ps-card"><div class="ps-card-head"><span class="ps-eyebrow">НАВЫК № '+item.id+'</span><button class="ps-favorite'+(fav?' is-active':'')+'" data-ps="favorite" data-id="'+item.id+'" aria-label="'+(fav?'Убрать из избранного':'Добавить в избранное')+'" aria-pressed="'+fav+'" type="button">'+(fav?'★':'☆')+'</button></div>'+
      '<h1 tabindex="-1" class="ps-term" lang="la">'+esc(item.latin)+'</h1>'+(s.index===0?'<p class="ps-prompt">Переведите и покажите структуру, затем сверьте себя с атласом.</p>':'')+
      '<p class="ps-prompt">Клавиатура: 1 — знаю, 2 — повторить, H — подсказка, ← / → — назад / далее, Enter — далее.</p>'+
      '<div class="ps-hint">'+(showHint?'<strong tabindex="-1" data-ps-hint-result>Ориентир:</strong> '+esc(item.hint):'<button type="button" class="ps-hint__button" data-ps="hint"><span aria-hidden="true">✧</span> Подсказка</button>')+'</div>'+
      '<div class="ps-review"><h2>Как получилось?</h2><div class="ps-review-actions"><button type="button" class="btn '+(status==='known'?'btn--success':'btn--ghost')+'" data-ps="mark" data-value="known" aria-pressed="'+(status==='known')+'">Знаю и покажу</button><button type="button" class="btn '+(status==='again'?'btn--danger':'btn--ghost')+'" data-ps="mark" data-value="again" aria-pressed="'+(status==='again')+'">Повторить</button></div>'+(status?'<p class="ps-status" role="status">'+statusLabel(status)+'</p>':'')+'</div>'+
      '<details class="ps-notes"><summary>Моя заметка</summary><label for="ps-note">Запись после сверки</label><textarea id="ps-note" data-ps-note maxlength="2000" placeholder="Личная заметка…">'+esc(game.state.notes[item.id]||'')+'</textarea><small>Заметка сохраняется на устройстве.</small></details>'+
      '<div class="ps-pagination"><button type="button" class="btn btn--ghost" data-ps="prev"'+(s.index===0?' disabled':'')+'>← Назад</button><button type="button" class="btn btn--primary" data-ps="'+(s.index===s.order.length-1?'finish':'next')+'">'+(s.index===s.order.length-1?'К итогам':'Далее →')+'</button></div></article>';
  }
  function summaryView(){
    const s=game.state.session;if(!s){screen='setup';return setupView();}
    const known=s.order.filter(id=>s.answers[id]==='known').length,again=s.order.filter(id=>s.answers[id]==='again').length,unanswered=s.order.length-known-again;
    return '<header class="ps-head"><span class="ps-eyebrow">ТРЕНИРОВКА ЗАВЕРШЕНА</span><h1>Итоги подборки</h1><p>Результат вашей самооценки</p></header><div class="ps-stats"><div><strong>'+known+'</strong><span>знаю и покажу</span></div><div><strong>'+again+'</strong><span>повторить</span></div><div><strong>'+unanswered+'</strong><span>без оценки</span></div></div><section class="ps-panel"><h2>Навыки в подборке</h2><div class="ps-summary-list">'+s.order.map((id,index)=>'<div class="ps-summary-item"><span><small>№ '+id+' · '+statusLabel(s.answers[id])+'</small><strong lang="la">'+esc(H.byId[id].latin)+'</strong></span><button type="button" class="btn btn--ghost btn--sm" data-ps="open-index" data-index="'+index+'">Открыть</button></div>').join('')+'</div><div class="ps-summary-actions"><button type="button" class="btn btn--primary" data-ps="setup">К настройкам</button><button type="button" class="btn btn--ghost" data-ps="resume-run">Вернуться к подборке</button></div></section>';
  }
  function jumpTop(){requestAnimationFrame(()=>{const term=document.querySelector('.ps-term');if(term){term.focus({preventScroll:true});window.scrollTo({top:0,behavior:'auto'});}});}
  function syncSearch(view){
    const q=search.trim().toLowerCase();let visible=0;
    view.querySelectorAll('[data-section]').forEach(section=>{
      const nameMatch=q&&section.dataset.sectionName.includes(q);let count=0;
      section.querySelectorAll('[data-search]').forEach(item=>{const matches=!q||nameMatch||item.dataset.search.includes(q);item.hidden=!matches;if(matches)count++;});
      section.hidden=count===0;if(!count)return;visible++;
      const expanded=q?true:openSections.has(section.dataset.section);
      section.querySelector('[data-section-toggle]').setAttribute('aria-expanded',String(expanded));
      section.querySelector('.ps-section__items').hidden=!expanded;
      section.querySelector('[data-section-count]').textContent=q && count<Number(section.dataset.total)?count+' из '+section.dataset.total:skillCount(count);
    });
    const empty=view.querySelector('[data-no-results]');if(empty)empty.hidden=visible>0;
  }
  AT.views.anatomySkills=function(){
    const html='<div class="view ps-view">'+(screen==='run'?runView():screen==='summary'?summaryView():setupView())+'</div>';
    return {title:'Практические навыки',html,mount(root){
      const view=root.querySelector('.ps-view');
      const warn=()=>{if(game.storageFailed())AT.ui.toast('Не удалось сохранить навыки на устройстве','warn');};
      const closePicker=picker=>{if(picker.dataset.picker==='group')groupMenuOpen=false;picker.querySelector('[data-picker-trigger]').setAttribute('aria-expanded','false');picker.querySelector('.ps-picker__menu').hidden=true;};
      const closeMenus=()=>view.querySelectorAll('[data-picker]').forEach(closePicker);
      async function start(section){
        const s=game.state.session;
        if(s&&!s.finished){const ok=await AT.ui.confirmDialog({title:'Начать новую подборку?',text:'Текущая подборка будет заменена. Уже выставленные оценки и избранное сохранятся.',confirm:'Начать'});if(!ok)return;}
        if(section?game.startSection(section):game.start()){screen='run';AT.rerender();jumpTop();warn();}
      }
      view.addEventListener('click',async e=>{
        const trigger=e.target.closest('[data-picker-trigger]');
        if(trigger){const picker=trigger.closest('[data-picker]'),wasOpen=trigger.getAttribute('aria-expanded')==='true';closeMenus();if(!wasOpen){if(picker.dataset.picker==='group')groupMenuOpen=true;trigger.setAttribute('aria-expanded','true');picker.querySelector('.ps-picker__menu').hidden=false;}return;}
        const opt=e.target.closest('[data-ps-option]');
        if(opt){e.stopPropagation();const name=opt.dataset.psOption,instance=opt.closest('[data-picker]').dataset.pickerInstance,values={group:game.state.group,scope:game.state.scope,limit:game.state.limit,sequence:game.state.sequence};if(name==='group') { const id=opt.dataset.value, previous=Array.isArray(values.group)?values.group:values.group==='all'?[]:[values.group]; values.group=id==='all'?'all':previous.includes(id)?previous.filter(x=>x!==id):previous.concat(id); groupMenuOpen=true; } else values[name]=opt.dataset.value;game.setOptions(values.group,values.scope,values.limit,values.sequence);AT.rerender();const focus=name==='group'?root.querySelector('[data-ps-option="group"][data-value="'+opt.dataset.value+'"]'):root.querySelector('[data-picker="'+name+'"][data-picker-instance="'+instance+'"] [data-picker-trigger]');focus?.focus({preventScroll:true});warn();return;}
        const toggle=e.target.closest('[data-section-toggle]');
        if(toggle){const section=toggle.closest('[data-section]'),expanded=toggle.getAttribute('aria-expanded')==='true';toggle.setAttribute('aria-expanded',String(!expanded));section.querySelector('.ps-section__items').hidden=expanded;if(expanded)openSections.delete(section.dataset.section);else openSections.add(section.dataset.section);return;}
        const btn=e.target.closest('[data-ps]');if(!btn)return;const a=btn.dataset.ps,s=game.state.session;
        if(a==='start'||a==='section-start'){await start(a==='section-start'?btn.dataset.id:null);return;}
        if(a==='reset'){
          const ok=await AT.ui.confirmDialog({title:'Сбросить оценки навыков?',text:'Оценки и текущая подборка будут удалены. Избранное и заметки сохранятся; другие тренировки не изменятся.',confirm:'Сбросить',danger:true});if(!ok)return;game.reset();
        } else if(a==='setup')screen='setup';
        else if(a==='resume')screen=s&&s.finished?'summary':'run';
        else if(a==='resume-run'){game.resume();screen='run';}
        else if(a==='open-index' && s){game.resume();game.navigate(Number(btn.dataset.index)-s.index);screen='run';}
        else if(a==='favorite')game.favorite(Number(btn.dataset.id));
        else if(a==='hint')game.hint();
        else if(a==='mark')game.mark(btn.dataset.value);
        else if(a==='prev'||a==='next')game.navigate(a==='prev'?-1:1);
        else if(a==='finish'){game.finish();screen='summary';}
        else return;
        AT.rerender();warn();
        if(['prev','next','resume-run','open-index','resume'].includes(a)&&screen==='run')jumpTop();
        else if(a==='hint')root.querySelector('[data-ps-hint-result]')?.focus({preventScroll:true});
        else if(a==='mark'||a==='favorite')root.querySelector(a==='mark'?'[data-ps="mark"][data-value="'+btn.dataset.value+'"]':'[data-ps="favorite"]')?.focus({preventScroll:true});
      });
      view.addEventListener('keydown',e=>{
        const picker=e.target.closest('[data-picker]');if(!picker)return;const trigger=picker.querySelector('[data-picker-trigger]'),menu=picker.querySelector('.ps-picker__menu');
        if(e.key==='Escape'&&!menu.hidden){e.preventDefault();closeMenus();trigger.focus();return;}
        if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;
        e.preventDefault();if(menu.hidden){closeMenus();menu.hidden=false;trigger.setAttribute('aria-expanded','true');}
        const opts=Array.from(menu.querySelectorAll('[data-ps-option]'));let i=opts.indexOf(document.activeElement);
        if(e.key==='Home')i=0;else if(e.key==='End')i=opts.length-1;else if(i<0)i=opts.findIndex(o=>o.getAttribute('aria-pressed')==='true');else i=(i+(e.key==='ArrowDown'?1:-1)+opts.length)%opts.length;
        opts[Math.max(0,i)].focus();
      });
      view.addEventListener('focusout',e=>{const picker=e.target.closest('[data-picker]');if(picker)setTimeout(()=>{if(view.isConnected&&!picker.contains(document.activeElement))closePicker(picker);},0);});
      const outside=e=>{if(!view.contains(e.target)||!e.target.closest('[data-picker]'))closeMenus();};document.addEventListener('click',outside);if(AT.onCleanup)AT.onCleanup(()=>document.removeEventListener('click',outside));
      const hotkeys=e=>{
        if(!view.isConnected||screen!=='run'||e.defaultPrevented||e.repeat||e.ctrlKey||e.altKey||e.metaKey||e.shiftKey||Array.from(document.querySelectorAll('dialog[open], [role="dialog"][aria-modal="true"]')).some(el=>el.getClientRects().length))return;
        const target=e.target;if(target instanceof Element&&(target.isContentEditable||target.closest('input,textarea,select,[contenteditable],[data-picker]')))return;
        let button;
        if(e.code==='Digit1'||e.code==='Numpad1'||e.key==='1')button=view.querySelector('[data-ps="mark"][data-value="known"]');
        else if(e.code==='Digit2'||e.code==='Numpad2'||e.key==='2')button=view.querySelector('[data-ps="mark"][data-value="again"]');
        else if(e.code==='KeyH')button=view.querySelector('[data-ps="hint"]');
        else if(e.key==='ArrowLeft')button=view.querySelector('[data-ps="prev"]');
        else if(e.key==='ArrowRight'||e.key==='Enter'){
          if(e.key==='Enter'&&target instanceof Element&&target.closest('button,a,summary,[role="button"]'))return;
          button=view.querySelector('[data-ps="next"], [data-ps="finish"]');
        }
        if(button&&!button.disabled){e.preventDefault();button.click();if(['mark','hint'].includes(button.dataset.ps))root.querySelector('.ps-term')?.focus({preventScroll:true});}
      };
      document.addEventListener('keydown',hotkeys);if(AT.onCleanup)AT.onCleanup(()=>document.removeEventListener('keydown',hotkeys));
      view.addEventListener('input',e=>{
        if(e.target.matches('[data-ps-note]')){game.note(game.current()?.id,e.target.value);warn();}
        if(e.target.matches('[data-ps-search]')){search=e.target.value;syncSearch(view);}
      });
      if(screen==='setup')syncSearch(view);
    }};
  };
})();
