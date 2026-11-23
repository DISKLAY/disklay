/* Редактор меток гистологии — только для режима разработчика.
   Работает локально: правки в localStorage, экспорт JSON для коммита.
   Доступен в #/dev через кнопку «Редактор».
*/
(function(){
  'use strict';
  const STORAGE_KEY='histology-dev-edits-v1';
  function loadEdits(){
    try{ const raw=localStorage.getItem(STORAGE_KEY); return raw? JSON.parse(raw): {}; }catch{return {};}
  }
  function saveEdits(map){ localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); }

  function getSlides(){
    const proto=window.HistologyPrototype;
    if(!proto) return {slides:[], structureSlides:[]};
    return {slides: proto.slides||[], structureSlides: proto.structureSlides||[]};
  }

  function mount(container){
    if(!container) return;
    const {slides, structureSlides}=getSlides();
    if(!structureSlides.length){
      container.innerHTML='<p class="muted">Гистология ещё не загружена. Откройте любой препарат, затем вернитесь.</p>';
      return;
    }
    const edits=loadEdits();
    let selectedSlide = structureSlides[0]?.slideId || '';
    let selectedPointId=null;
    let drag=null;

    function imageFor(slideId){
      const s=slides.find(x=>x.id===slideId);
      return s? s.image : null;
    }

    function currentGroup(){
      // берём актуальные точки: если есть правки — они уже применены в прототипе после перезагрузки,
      // но для живого предпросмотра берём из edits если есть, иначе из оригинала
      const base=structureSlides.find(g=>g.slideId===selectedSlide);
      if(!base) return null;
      if(edits[selectedSlide]) return {slideId:selectedSlide, points: edits[selectedSlide]};
      return base;
    }

    function render(){
      const group=currentGroup();
      const img=imageFor(selectedSlide);
      container.innerHTML='';
      const wrap=document.createElement('div');
      wrap.className='histo-editor';
      // селектор слайда
      const sel=document.createElement('div');
      sel.className='card card--pad';
      sel.innerHTML='<h3 class="card__title">Препарат</h3><select class="input" data-he-slide></select><p class="muted small">Выберите препарат — метки хранятся как проценты 0–100 по изображению. Перетащите точку или правьте координаты ниже.</p>';
      const select=sel.querySelector('select');
      structureSlides.forEach(g=>{
        const opt=document.createElement('option');
        opt.value=g.slideId; opt.textContent=g.slideId+' — '+(slides.find(s=>s.id===g.slideId)?.name||'')+' ('+g.points.length+')';
        if(g.slideId===selectedSlide) opt.selected=true;
        select.append(opt);
      });
      wrap.append(sel);

      // изображение + точки
      const stage=document.createElement('div');
      stage.className='card card--pad';
      stage.innerHTML='<h3 class="card__title">Снимок и метки</h3>';
      const imgWrap=document.createElement('div');
      imgWrap.style.cssText='position:relative;max-width:720px;margin:12px auto;background:#000;border-radius:12px;overflow:hidden;aspect-ratio:16/10;';
      if(img){
        const im=document.createElement('img');
        im.src=img; im.style.cssText='width:100%;height:100%;object-fit:contain;display:block;';
        im.alt='';
        imgWrap.append(im);
      } else {
        imgWrap.textContent='Нет изображения';
        imgWrap.style.padding='40px'; imgWrap.style.color='#fff';
      }
      // точки
      if(group){
        group.points.forEach(p=>{
          const dot=document.createElement('div');
          dot.dataset.pointId=p.id;
          dot.title=p.name;
          const isSel=p.id===selectedPointId;
          dot.style.cssText=`position:absolute;left:${p.x}%;top:${p.y}%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:${isSel?'#ff3b30':'#4f46e5'};border:2px solid #fff;cursor:grab;box-shadow:0 1px 4px rgba(0,0,0,.4);`;
          dot.textContent='';
          // label
          const lab=document.createElement('span');
          lab.textContent=p.name;
          lab.style.cssText=`position:absolute;left:16px;top:-8px;background:rgba(0,0,0,.7);color:#fff;padding:2px 6px;border-radius:6px;font-size:11px;white-space:nowrap;pointer-events:none;`;
          dot.append(lab);
          imgWrap.append(dot);
        });
      }
      stage.append(imgWrap);
      wrap.append(stage);

      // список точек / форма
      const list=document.createElement('div');
      list.className='card card--pad';
      list.innerHTML='<h3 class="card__title">Точки</h3>';
      if(group){
        const ul=document.createElement('div');
        ul.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;';
        group.points.forEach(p=>{
          const b=document.createElement('button');
          b.type='button';
          b.className='btn btn--ghost btn--sm'+(p.id===selectedPointId?' is-active':'');
          b.textContent=p.name+' ('+p.x.toFixed(1)+', '+p.y.toFixed(1)+')';
          b.dataset.pick=p.id;
          ul.append(b);
        });
        const add=document.createElement('button');
        add.type='button'; add.className='btn btn--primary btn--sm'; add.textContent='+ Добавить точку';
        add.dataset.add='1';
        ul.append(add);
        list.append(ul);

        if(selectedPointId){
          const pt=group.points.find(p=>p.id===selectedPointId);
          if(pt){
            const form=document.createElement('div');
            form.style.cssText='display:grid;gap:10px;';
            form.innerHTML=`
              <label> ID <input class="input" data-f="id" value="${escapeHtml(pt.id)}"></label>
              <label> Название <input class="input" data-f="name" value="${escapeHtml(pt.name)}"></label>
              <label> Алиасы (через запятую) <input class="input" data-f="aliases" value="${escapeHtml((pt.aliases||[]).join(', '))}"></label>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;"><label> X % <input class="input" type="number" step="0.1" min="0" max="100" data-f="x" value="${pt.x}"></label><label> Y % <input class="input" type="number" step="0.1" min="0" max="100" data-f="y" value="${pt.y}"></label></div>
              <div style="display:flex;gap:8px;"><button type="button" class="btn btn--primary btn--sm" data-save-point>Сохранить точку</button><button type="button" class="btn btn--ghost btn--sm" data-del-point>Удалить</button></div>
            `;
            list.append(form);
          }
        }
        // действия
        const actions=document.createElement('div');
        actions.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;';
        actions.innerHTML=`
          <button type="button" class="btn btn--primary btn--sm" data-save-all>Сохранить в браузере</button>
          <button type="button" class="btn btn--ghost btn--sm" data-save-public style="background:#0ea5e9;color:#fff;border-color:#0ea5e9;">Сохранить публично</button>
          <button type="button" class="btn btn--ghost btn--sm" data-export>Копировать JSON</button>
          <button type="button" class="btn btn--ghost btn--sm" data-download>Скачать edits.json</button>
          <button type="button" class="btn btn--ghost btn--sm" data-reset-slide>Сбросить препарат</button>
          <button type="button" class="btn btn--ghost btn--sm" data-reset-all>Сбросить всё</button>
        `;
        list.append(actions);
        const hint=document.createElement('p');
        hint.className='muted small';
        hint.textContent='«Сохранить публично» отправляет правки на сервер — все увидят их сразу. «В браузере» — только у вас (localStorage).';
        list.append(hint);
        const preview=document.createElement('pre');
        preview.style.cssText='background:#0f172a;color:#e2e8f0;padding:12px;border-radius:8px;overflow:auto;max-height:260px;font-size:12px;';
        preview.textContent=JSON.stringify(edits, null, 2) || '{}';
        list.append(preview);
      }
      wrap.append(list);
      container.append(wrap);

      // события
      select.addEventListener('change',()=>{ selectedSlide=select.value; selectedPointId=null; render(); });
      container.querySelectorAll('[data-pick]').forEach(b=> b.addEventListener('click',()=>{ selectedPointId=b.dataset.pick; render(); }));
      const addBtn=container.querySelector('[data-add]'); if(addBtn) addBtn.addEventListener('click',()=>{
        const g=currentGroup(); if(!g) return;
        const baseId='p'+Date.now().toString(36).slice(-4);
        g.points.push({id:baseId, name:'Новая метка', aliases:['новая метка'], x:50, y:50});
        if(!edits[selectedSlide]) edits[selectedSlide]=[...g.points];
        else edits[selectedSlide]=g.points;
        selectedPointId=baseId;
        saveEdits(edits); render();
      });
      container.querySelectorAll('[data-save-point]').forEach(b=> b.addEventListener('click',()=>{
        const g=currentGroup(); const pt=g.points.find(p=>p.id===selectedPointId); if(!pt) return;
        const idEl=container.querySelector('[data-f="id"]'), nameEl=container.querySelector('[data-f="name"]'), aliasesEl=container.querySelector('[data-f="aliases"]'), xEl=container.querySelector('[data-f="x"]'), yEl=container.querySelector('[data-f="y"]');
        const newId=idEl.value.trim()||pt.id;
        pt.id=newId; pt.name=nameEl.value.trim()||pt.name; pt.aliases=aliasesEl.value.split(',').map(s=>s.trim()).filter(Boolean); pt.x=parseFloat(xEl.value); pt.y=parseFloat(yEl.value);
        selectedPointId=newId;
        edits[selectedSlide]=g.points.slice();
        saveEdits(edits); render();
      }));
      container.querySelectorAll('[data-del-point]').forEach(b=> b.addEventListener('click',()=>{
        const g=currentGroup(); g.points=g.points.filter(p=>p.id!==selectedPointId);
        edits[selectedSlide]=g.points.slice();
        if(!g.points.length) delete edits[selectedSlide];
        saveEdits(edits); selectedPointId=null; render();
      }));
      const saveAll=container.querySelector('[data-save-all]'); if(saveAll) saveAll.addEventListener('click',()=>{
        const g=currentGroup(); if(g) edits[selectedSlide]=g.points.slice();
        saveEdits(edits);
        toast('Сохранено в браузере. Перезагрузите для применения.');
      });
      const savePub=container.querySelector('[data-save-public]'); if(savePub) savePub.addEventListener('click', async()=>{
        const g=currentGroup(); if(!g) return;
        savePub.disabled=true; savePub.textContent='Сохранение...';
        const payload=g.points.map(p=>({id:p.id,name:p.name,x:Number(p.x),y:Number(p.y),aliases:p.aliases||[p.name], extent:p.extent||undefined}));
        try{
          if(window.HistologyOverrides && window.HistologyOverrides.put){
            await window.HistologyOverrides.put(selectedSlide, payload);
            toast('Опубликовано для всех');
          } else throw new Error('no_api');
        }catch(e){
          toast('Ошибка: '+(e.message||'save_failed')+' — попробуйте «Сохранить в браузере»');
        } finally { savePub.disabled=false; savePub.textContent='Сохранить публично'; }
      });
      const exp=container.querySelector('[data-export]'); if(exp) exp.addEventListener('click',async()=>{
        const text=JSON.stringify(edits,null,2);
        try{ await navigator.clipboard.writeText(text); toast('Скопировано в буфер'); }catch{ prompt('Скопируйте JSON:', text); }
      });
      const dl=container.querySelector('[data-download]'); if(dl) dl.addEventListener('click',()=>{
        const blob=new Blob([JSON.stringify(edits,null,2)],{type:'application/json'});
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a'); a.href=url; a.download='histology-dev-edits.json'; a.click();
        setTimeout(()=>URL.revokeObjectURL(url),1500);
      });
      const rs=container.querySelector('[data-reset-slide]'); if(rs) rs.addEventListener('click',()=>{
        delete edits[selectedSlide]; saveEdits(edits); selectedPointId=null; render(); toast('Сброшен препарат');
      });
      const ra=container.querySelector('[data-reset-all]'); if(ra) ra.addEventListener('click',()=>{
        localStorage.removeItem(STORAGE_KEY); for(const k of Object.keys(edits)) delete edits[k]; selectedPointId=null; render(); toast('Все правки сброшены');
      });

      // drag
      imgWrap.querySelectorAll('[data-point-id]').forEach(dot=>{
        dot.addEventListener('pointerdown', (e)=>{
          e.preventDefault();
          drag={id:dot.dataset.pointId, wrap:imgWrap};
          dot.setPointerCapture(e.pointerId);
          dot.style.cursor='grabbing';
        });
        dot.addEventListener('pointermove', (e)=>{
          if(!drag || drag.id!==dot.dataset.pointId) return;
          const rect=imgWrap.getBoundingClientRect();
          const x=((e.clientX-rect.left)/rect.width)*100;
          const y=((e.clientY-rect.top)/rect.height)*100;
          const g=currentGroup(); const pt=g.points.find(p=>p.id===drag.id); if(!pt) return;
          pt.x=Math.max(0,Math.min(100,x)); pt.y=Math.max(0,Math.min(100,y));
          // live update dot position
          dot.style.left=pt.x+'%'; dot.style.top=pt.y+'%';
          // update preview coords in list if selected
          if(selectedPointId===drag.id){
            const xEl=container.querySelector('[data-f="x"]'); const yEl=container.querySelector('[data-f="y"]');
            if(xEl) xEl.value=pt.x.toFixed(1); if(yEl) yEl.value=pt.y.toFixed(1);
          }
        });
        dot.addEventListener('pointerup', (e)=>{
          if(!drag) return;
          drag=null;
          dot.style.cursor='grab';
          // save live drag to edits
          const g=currentGroup(); edits[selectedSlide]=g.points.slice(); saveEdits(edits);
        });
        dot.addEventListener('click', (e)=>{ e.stopPropagation(); selectedPointId=dot.dataset.pointId; render(); });
      });
      imgWrap.addEventListener('click', (e)=>{
        if(e.target!==imgWrap) return;
        // click on image to create? ignore
      });
    }

    function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    function toast(msg){
      if(window.AT && AT.ui && AT.ui.toast) AT.ui.toast(msg);
      else alert(msg);
    }

    render();
  }

  window.HistologyEditor={mount, STORAGE_KEY, loadEdits, saveEdits};
})();
