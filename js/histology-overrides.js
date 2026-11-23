/* Подгрузка публичных правок меток гистологии с сервера.
   Локальные правки разработчика ранее хранились в histology-dev-edits-v1;
   теперь правки уходят на сервер и видны всем после сохранения.
*/
(function(){
  'use strict';
  const ENDPOINT='https://pgkimwwxoxizlmncdevq.supabase.co/functions/v1/medzo-study-sync';
  const SERVER_KEY='histology-server-overrides-v1';
  const LEGACY_KEY='histology-dev-edits-v1';

  async function fetchServer(){
    try{
      const r=await fetch(ENDPOINT,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({action:'histology-get'}),
        cache:'no-store'
      });
      if(!r.ok) return null;
      const data=await r.json();
      return data.overrides || {};
    }catch{ return null; }
  }

  async function sync(){
    const overrides=await fetchServer();
    if(overrides && typeof overrides==='object'){
      try{ localStorage.setItem(SERVER_KEY, JSON.stringify(overrides)); }catch{}
      return overrides;
    }
    return null;
  }

  function getServerOverrides(){
    try{
      const raw=localStorage.getItem(SERVER_KEY);
      return raw? JSON.parse(raw) : {};
    }catch{ return {}; }
  }

  function getLegacyOverrides(){
    try{
      const raw=localStorage.getItem(LEGACY_KEY);
      return raw? JSON.parse(raw) : {};
    }catch{ return {}; }
  }

  // Сливает серверные и локальные правки: сервер приоритетнее, но если локальных больше — покажем их тоже.
  function getMerged(){
    const server=getServerOverrides();
    const legacy=getLegacyOverrides();
    const out=Object.assign({}, server);
    for(const [k,v] of Object.entries(legacy)){
      if(!out[k]) out[k]=v;
    }
    return out;
  }

  async function put(slideId, points){
    // Требует авторизацию разработчика — берём сессию из study-sync
    let token=null;
    try{
      const raw=localStorage.getItem('medzo-study-sync-session-v1');
      if(raw) token=JSON.parse(raw).session;
    }catch{}
    if(!token) throw new Error('need_auth');
    const r=await fetch(ENDPOINT,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({action:'histology-put', slideId, points}),
      cache:'no-store'
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.error||'save_failed');
    // обновим серверный кэш локально
    const cur=getServerOverrides();
    cur[slideId]=points;
    try{ localStorage.setItem(SERVER_KEY, JSON.stringify(cur)); }catch{}
    return true;
  }

  async function del(slideId){
    let token=null;
    try{
      const raw=localStorage.getItem('medzo-study-sync-session-v1');
      if(raw) token=JSON.parse(raw).session;
    }catch{}
    if(!token) throw new Error('need_auth');
    const r=await fetch(ENDPOINT,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({action:'histology-delete', slideId}),
      cache:'no-store'
    });
    if(!r.ok) throw new Error('delete_failed');
    const cur=getServerOverrides();
    delete cur[slideId];
    try{ localStorage.setItem(SERVER_KEY, JSON.stringify(cur)); }catch{}
    return true;
  }

  // Автоподгрузка при старте — не блокирует, но обновит кэш
  if(typeof window!=='undefined'){
    // запустим sync в фоне, если есть navigator
    setTimeout(()=>{ sync().catch(()=>{}); }, 800);
    // также синхронизируем при фокусе
    window.addEventListener('focus', ()=>{ sync().catch(()=>{}); });
  }

  window.HistologyOverrides={sync, getServerOverrides, getLegacyOverrides, getMerged, put, del, SERVER_KEY, LEGACY_KEY};
})();
