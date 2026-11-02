/* Пространство гистологии: не использует сессии и ключи анатомии. */
(function () {
  'use strict';
  const AT=window.AT, H=window.HistologyPrototype, esc=AT.utils.esc;
  const storage={getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>window.localStorage.setItem(key,value)};
  const game=H.create(storage);
  let screen=game.state.session ? 'run' : 'setup';
  let notice='';
  function btn(action, value, label, selected) {
    return '<button type="button" class="histo-pill'+(selected?' is-active':'')+'" data-histo="'+action+'" data-value="'+value+'" aria-pressed="'+selected+'">'+label+'</button>';
  }
  function stats() {
    const p=Object.values(game.state.stats);
    return {attempts:p.reduce((a,x)=>a+x.attempts,0),correct:p.reduce((a,x)=>a+x.correct,0), mistakes:p.filter(x=>x.last===false).length, favorites:Object.keys(game.state.favorites).length};
  }
  function setupView() {
    const s=game.state, n=stats(), session=s.session;
    return '<div class="histo-view view">'+
      '<div class="histo-hero"><div><div class="histo-eyebrow"><span></span> НОВЫЙ ПРЕДМЕТ · ТРЕНИРОВКА</div><h1>Гистология<span>.</span></h1><p>Учитесь узнавать препараты по изображению. Сравнивайте похожие препараты и повторяйте ошибки.</p><div class="histo-hero__tags"><span>'+H.slides.length+' препаратов</span><span>2 режима ответа</span><span>Прогресс отдельно</span></div></div><div class="histo-hero__mark" aria-hidden="true"><span>✳</span><small>МИКРО<br>АТЛАС</small></div></div>'+
      (notice?'<p class="histo-notice" role="status">'+esc(notice)+'</p>':'')+
      '<div class="histo-stats"><div><strong>'+n.attempts+'</strong><span>ответов</span></div><div><strong>'+n.correct+'</strong><span>верных</span></div><div><strong>'+n.mistakes+'</strong><span>на повторение</span></div><div><strong>'+n.favorites+'</strong><span>в избранном</span></div></div>'+
      '<div class="histo-setup"><div class="histo-setup__head"><div><span class="histo-kicker">ВАША ТРЕНИРОВКА</span><h2>Как будем заниматься?</h2></div><span class="histo-count">'+game.pool().length+' препаратов</span></div>'+
      '<div class="histo-setting"><div><strong>Способ ответа</strong><p>Выберите подходящий режим</p></div><div class="histo-pills">'+btn('mode','choice','Из вариантов',s.mode==='choice')+btn('mode','text','Написать название',s.mode==='text')+'</div></div>'+
      '<div class="histo-setting"><div><strong>Какие препараты</strong><p>Повторяйте нужное в своём темпе</p></div><div class="histo-pills">'+btn('scope','all','Все',s.scope==='all')+btn('scope','mistakes','Ошибки',s.scope==='mistakes')+btn('scope','favorites','Избранное',s.scope==='favorites')+'</div></div>'+
      '<div class="histo-start"><div><strong>'+game.pool().length+' из '+H.slides.length+' в подборке</strong><p>Варианты подобраны из похожих препаратов и перемешиваются.</p></div><div class="histo-actions">'+(session?'<button type="button" class="btn btn--ghost" data-histo="resume">Продолжить</button>':'')+'<button type="button" class="btn btn--primary" data-histo="start"'+(!game.pool().length?' disabled':'')+'>'+(session?'Начать заново':'Начать тренировку')+' →</button></div></div></div>'+
      '<p class="histo-footnote">Представлены все позиции указателя из четырёх PDF; разные снимки одного органа объединены. На некоторых изображениях подписи закрыты, а стрелки остались. Формат университетской проверки пока неизвестен; баллы и валюта здесь не начисляются.</p></div>';
  }
  function runView() {
    const s=game.state.session, q=game.current(), e=game.entry();
    if(!s||!q||!e) {screen='setup';return setupView();}
    const shown=e.status!=='unanswered';
    const favorite=!!game.state.favorites[q.id];
    let answer='';
    if(!shown && s.mode==='choice') {
      answer='<p class="histo-answer-label">Выберите один вариант</p><div class="histo-options">'+e.options.map((id,i)=>'<button type="button" class="histo-option'+(e.selected===id?' is-selected':'')+'" data-histo="select" data-value="'+esc(id)+'" aria-pressed="'+(e.selected===id)+'"><span>'+String.fromCharCode(65+i)+'</span>'+esc(H.byId[id].name)+'</button>').join('')+'</div>';
    } else if(!shown) {
      answer='<form data-histo-form><label class="histo-answer-label" for="histoAnswer">Ваш ответ</label><div class="histo-input-row"><input id="histoAnswer" name="answer" class="histo-input" type="text" maxlength="300" autocomplete="off" placeholder="Например, название органа" value="'+esc(e.text)+'"><button class="btn btn--primary" type="submit">Проверить</button></div><p class="histo-help">Необязательно писать окраску. Неузнанные формулировки можно оценить самостоятельно.</p></form>';
    }
    let feedback='';
    if (shown) {
      const label=e.status==='review'?'Сверьте самостоятельно':e.status==='correct'?'Верно!':'Разберём этот препарат';
      feedback='<div class="histo-feedback '+(e.status==='wrong'?'is-wrong':e.status==='correct'?'is-correct':'')+'" role="status"><span class="histo-kicker">'+label+'</span><h3>'+esc(q.name)+'</h3><p>Препарат № '+esc(q.number)+' · '+esc(q.stain)+'</p>'+(e.text?'<p class="histo-your-answer">Ваш ответ: '+esc(e.text)+'</p>':'')+'<p>'+esc(q.note)+'</p>'+
        (e.status==='review'?'<div class="histo-self"><span>Ваш ответ можно считать верным?</span><button class="btn btn--sm btn--ghost" type="button" data-histo="self" data-value="yes">Да, верно</button><button class="btn btn--sm btn--ghost" type="button" data-histo="self" data-value="no">Нет, ошибся</button></div>':'')+
        (q.review?'<details class="histo-review"><summary>Показать изображение с обозначениями</summary><img src="'+esc(q.review)+'" loading="lazy" alt="Препарат с обозначенными структурами"><button type="button" class="histo-zoom-link" data-histo="zoom" data-value="'+esc(q.review)+'">Увеличить изображение</button><p class="histo-image__error" hidden>Изображение не загрузилось. Проверьте подключение и <button type="button" data-histo="retry-image" data-value="review">попробуйте ещё раз</button>.</p></details>':'')+
        '<p class="histo-source">По материалам присланной базы: '+esc(q.source)+'.</p></div>';
    }
    return '<div class="histo-view view"><div class="histo-run-top"><button type="button" class="histo-back" data-histo="setup">← К настройкам</button><span class="histo-kicker">ГИСТОЛОГИЯ · '+(s.mode==='choice'?'ВЫБОР ОТВЕТА':'ВВОД НАЗВАНИЯ')+'</span></div>'+
      '<div class="histo-progress"><div><strong>Определите препарат</strong><span>'+ (s.index+1)+' / '+s.order.length+'</span></div><div class="histo-progress__track"><span style="width:'+((s.index+1)/s.order.length*100)+'%"></span></div></div>'+
      '<div class="histo-card"><div class="histo-card__head"><div><span class="histo-kicker">МИКРОПРЕПАРАТ</span><h1>Что изображено?</h1></div><button type="button" class="histo-favorite'+(favorite?' is-active':'')+'" data-histo="favorite" aria-pressed="'+favorite+'" aria-label="'+(favorite?'Убрать из избранного':'Добавить в избранное')+'">'+(favorite?'★':'☆')+'</button></div>'+
      '<figure class="histo-image"><button type="button" class="histo-image__open" data-histo="zoom" data-value="'+esc(q.image)+'" aria-label="Увеличить изображение препарата"><img src="'+esc(q.image)+'" alt="Микрофотография препарата для определения" fetchpriority="high"></button><figcaption>Нажмите на изображение, чтобы увеличить'+(q.masked?' · Подписи закрыты, стрелки оставлены':'')+'</figcaption><p class="histo-image__error" hidden>Изображение не загрузилось. Проверьте подключение и <button type="button" data-histo="retry-image">попробуйте ещё раз</button>.</p></figure>'+
      answer+(!shown&&s.mode==='choice'?'<div class="histo-check"><button type="button" class="btn btn--primary" data-histo="check"'+(!e.selected?' disabled':'')+'>Проверить</button><button type="button" class="btn btn--ghost" data-histo="dont-know">Не знаю</button></div>':!shown?'<div class="histo-check"><button type="button" class="btn btn--ghost" data-histo="dont-know">Не знаю</button></div>':'')+feedback+
      '<div class="histo-bottom"><button type="button" class="btn btn--ghost" data-histo="prev"'+(s.index===0?' disabled':'')+'>← Назад</button><button type="button" class="btn btn--primary" data-histo="next"'+(e.status==='unanswered'||e.status==='review'?' disabled':'')+'>'+(s.index===s.order.length-1?'Завершить':'Далее →')+'</button></div></div></div>';
  }
  AT.views.histology=function () {
    const html=screen==='run'?runView():setupView();
    return {title:'Гистология',html,mount(root) {
      const view=root.querySelector('.histo-view');
      view.addEventListener('click',ev=>{
        const el=ev.target.closest('[data-histo]'); if(!el || el.disabled)return;
        const action=el.dataset.histo, val=el.dataset.value;
        if(action==='zoom') {
          // Открываем внутри страницы: новые вкладки могут блокироваться в предпросмотре.
          const q=game.current();
          if (!q || (val!==q.image && val!==q.review)) return;
          const dialog=document.createElement('dialog');
          dialog.className='histo-image-dialog';
          dialog.setAttribute('aria-label','Увеличенное изображение препарата');
          dialog.innerHTML='<div class="histo-image-dialog__head"><strong>Препарат</strong><div><button type="button" data-zoom-toggle aria-pressed="false" aria-label="Увеличить в два раза">2×</button><button type="button" data-zoom-close aria-label="Закрыть изображение">Закрыть</button></div></div><div class="histo-image-dialog__viewport"><img alt="Увеличенное изображение препарата"></div><p data-zoom-error hidden>Изображение не загрузилось. Закройте окно и попробуйте ещё раз.</p><p>Для перемещения увеличенного изображения прокрутите область.</p>';
          const dialogImage=dialog.querySelector('img');
          dialogImage.addEventListener('error',()=>{dialog.querySelector('[data-zoom-error]').hidden=false;});
          dialogImage.src=val;
          const toggle=dialog.querySelector('[data-zoom-toggle]');
          toggle.addEventListener('click',()=>{const on=dialog.classList.toggle('is-zoomed');toggle.textContent=on?'1×':'2×';toggle.setAttribute('aria-label',on?'По размеру экрана':'Увеличить в два раза');toggle.setAttribute('aria-pressed',String(on));});
          dialog.querySelector('[data-zoom-close]').addEventListener('click',()=>dialog.close());
          dialog.addEventListener('click',event=>{if(event.target===dialog) dialog.close();});
          dialog.addEventListener('close',()=>{dialog.remove();if(el.isConnected)el.focus();},{once:true});
          document.body.appendChild(dialog);
          if(AT.onCleanup) AT.onCleanup(()=>{if(dialog.open)dialog.close();dialog.remove();});
          dialog.showModal();
          return;
        }
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
      const form=view.querySelector('[data-histo-form]');
      if(form) {
        const input=form.querySelector('input');
        input.addEventListener('input',()=>game.setText(input.value));
        form.addEventListener('submit',ev=>{ev.preventDefault();if(!game.check(input.value)){input.focus();return;}if(game.storageFailed())AT.ui.toast('Не удалось сохранить прогресс на устройстве','warn');AT.rerender();});
      }
    }};
  };
})();
