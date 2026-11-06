/* Telegram sign-in and explicit conflict resolution for study data. */
(function () {
  'use strict';
  const endpoint='https://pgkimwwxoxizlmncdevq.supabase.co/functions/v1/medzo-study-sync';
  const SESSION='medzo-study-sync-session-v1';
  const S=window.MedzoStudySnapshot, E=window.MedzoSyncEngine;
  let auth=null, engine=null, plan=null, busy=false, listener=null, message='', challenge=null, config=null;
  let miniLoaded=false, miniFailed=false, loginLoaded=false;
  function notify() { if(listener) listener(); }
  function loadScript(src) {
    return new Promise((resolve,reject)=>{
      const el=document.createElement('script');el.src=src;el.async=true;
      el.onload=resolve;el.onerror=()=>reject(Error('script'));document.head.appendChild(el);
    });
  }
  // Mini App integration is optional: offline use does not wait for Telegram.
  if(window.MedzoTelegramLaunch) loadScript('https://telegram.org/js/telegram-web-app.js').then(()=>{
    miniLoaded=true;
    const app=window.Telegram && window.Telegram.WebApp;
    if(app && app.initData) { app.ready(); app.expand(); document.documentElement.classList.add('telegram-mini-app'); }
    notify();
  }).catch(()=>{miniFailed=true;notify();});
  async function call(body, authenticated=true) {
    const headers={'Content-Type':'application/json'};
    if(authenticated && auth) headers.Authorization='Bearer '+auth.session;
    const response=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify(body),cache:'no-store'});
    let result;try { result=await response.json(); } catch (_) { throw Error('network'); }
    if(!response.ok) { if(response.status===409) throw Error('changed'); if(response.status===401&&authenticated) throw Error('auth'); throw Error('network'); }
    return result;
  }
  function connect(data) {
    if(!data || !/^[1-9][0-9]{0,19}$/.test(String(data.userId)) || typeof data.session!=='string' || !Number.isSafeInteger(data.expiresAt)) throw Error('auth');
    localStorage.setItem(SESSION,JSON.stringify(data));sessionStorage.removeItem(SESSION);auth=data;
    engine=E.makeEngine({store:localStorage,snapshot:S,request:body=>call(body),userId:String(data.userId)});
  }
  async function logout() {
    if(!auth||busy)return;busy=true;notify();
    try { await call({action:'logout'});auth=null;engine=null;plan=null;localStorage.removeItem(SESSION);sessionStorage.removeItem(SESSION);message='Вы вышли. Локальные учебные данные не изменены.'; }
    catch (e) { if(e.message==='auth'){auth=null;engine=null;plan=null;localStorage.removeItem(SESSION);sessionStorage.removeItem(SESSION);message='Сессия завершена. Учебные данные на устройстве не изменены.';}else message='Не удалось выйти. Проверьте интернет и повторите.'; }
    finally { busy=false;notify(); }
  }
  try { const old=JSON.parse(localStorage.getItem(SESSION)||sessionStorage.getItem(SESSION)||'null');if(old&&old.expiresAt>Date.now()/1000+5)connect(old);else {localStorage.removeItem(SESSION);sessionStorage.removeItem(SESSION);} } catch (_) { auth=null; }
  window.addEventListener('storage',e=>{if(e.key!==SESSION)return;if(!e.newValue){auth=null;engine=null;plan=null;message='Вход завершён в другой вкладке.';notify();}else try{const next=JSON.parse(e.newValue);if(!auth||next.session!==auth.session){connect(next);plan=null;message='';notify();}}catch(_){} });
  async function prepareLogin() {
    if(auth || window.MedzoTelegramLaunch)return;
    try {
      if(!loginLoaded) { await loadScript('https://telegram.org/js/telegram-login.js');loginLoaded=true; }
      const values=await Promise.all([call({action:'config'},false),call({action:'challenge'},false)]);
      if(!/^\d+$/.test(String(values[0].botId)) || typeof values[1].nonce!=='string')throw Error('config');
      config=values[0];challenge={nonce:values[1].nonce,at:Date.now()};notify();
    } catch (_) { message='Не удалось подготовить вход. Проверьте интернет и нажмите «Войти» ещё раз.';notify(); }
  }
  async function inspect(auto=false) {
    if(!engine||busy)return;
    busy=true;notify();
    try {
      const result=await engine.inspect();plan=result;
      if(auto&&result.state==='local-changed') { await engine.push(result);plan=await engine.inspect(); }
      message='';
    } catch(e) { plan=null;message=e.message==='auth'?'Не удалось подтвердить сессию. Проверьте интернет; если проблема не исчезнет, выйдите и войдите снова.':'Не удалось проверить синхронизацию. Учебные данные на устройстве не изменены.'; }
    finally { busy=false;notify(); }
  }
  async function loginMini(initData) {
    busy=true;notify();
    try { connect(await call({action:'login',initData},false));message=''; }
    catch (_) { message='Не удалось войти через Telegram. Закройте и снова откройте приложение из бота.'; }
    finally { busy=false;notify(); }
    if(engine)await inspect();
  }
  function login() {
    if(busy)return;
    const mini=window.Telegram && window.Telegram.WebApp;
    if(mini && mini.initData){loginMini(mini.initData);return;}
    if(window.MedzoTelegramLaunch && !miniLoaded){message=miniFailed?'Не удалось загрузить Telegram. Проверьте интернет и откройте приложение заново.':'Ожидаем загрузки Telegram. Попробуйте ещё раз через несколько секунд.';notify();return;}
    if(window.MedzoTelegramLaunch){message='Данные Telegram недоступны. Откройте Medzo заново из бота.';notify();return;}
    if(!loginLoaded||!config||!challenge||Date.now()-challenge.at>100000||!window.Telegram || !window.Telegram.Login) {
      message='Подготавливаем вход. Через несколько секунд нажмите «Войти» ещё раз.';notify();prepareLogin();return;
    }
    const nonce=challenge.nonce;challenge=null;
    try {
      // Keep this call in the click handler so the browser permits the popup.
      window.Telegram.Login.auth({client_id:Number(config.botId),scope:['profile'],lang:'ru',nonce},async result=>{
        if(!result||!result.id_token){message='Вход отменён или не завершён. Попробуйте ещё раз.';notify();prepareLogin();return;}
        busy=true;notify();
        try { connect(await call({action:'login',idToken:result.id_token,nonce},false));message=''; }
        catch (_) { message='Вход не удалось проверить. Попробуйте ещё раз.';prepareLogin(); }
        finally { busy=false;notify(); }
        if(engine)await inspect();
      });
    } catch (_) { message='Не удалось открыть Telegram. Разрешите всплывающие окна и повторите.';notify();prepareLogin(); }
  }
  async function choose(direction) {
    if(!plan||!engine||busy)return;
    const selection=plan, selectedEngine=engine;
    const text=direction==='pull'
      ?'Учебные данные на этом устройстве будут заменены облачной копией. Игра, оформление и активные сессии останутся на устройстве. Перед заменой будет создана локальная резервная копия; рекомендуем также скачать учебную копию. Продолжить?'
      :'Учебные данные в облаке будут заменены данными этого устройства. Предыдущая облачная версия будет сохранена в истории. Продолжить?';
    busy=true;notify();
    const confirmed=await window.AT.ui.confirmDialog({title:direction==='pull'?'Загрузить из облака?':'Сохранить в облако?',text,confirm:direction==='pull'?'Загрузить':'Сохранить',danger:true});
    if(!confirmed || selectedEngine!==engine){busy=false;notify();return;}
    // Finish pending in-memory anatomy saves before comparing and replacing.
    if(direction==='pull' && !window.AT.save(true)){busy=false;message='Не удалось сохранить текущие данные. Загрузка отменена.';notify();return;}
    busy=true;notify();
    try {
      if(direction==='pull') { await selectedEngine.pull(selection);location.reload();return; }
      await selectedEngine.push(selection);plan=await selectedEngine.inspect();message='Учебные данные сохранены в облаке.';
    } catch(e) { plan=null;message=e.message==='changed'?'Данные изменились после проверки. Ничего не заменено — проверьте ещё раз.':'Не удалось завершить операцию. Проверьте подключение и повторите проверку.'; }
    finally { busy=false;notify(); }
  }
  function backup() {
    try {
      const blob=new Blob([JSON.stringify(S.capture(localStorage),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download='medzo-study-backup.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
    } catch (_) { message='Не удалось скачать учебную копию.';notify(); }
  }
  async function restore(file) {
    if(!file)return;
    if(file.size>1040000){message='Файл слишком большой.';notify();return;}
    let data;try{data=JSON.parse(await file.text());if(!S.validate(data))throw Error();}catch(_){message='Это не учебная копия Medzo или файл повреждён.';notify();return;}
    if(!await window.AT.ui.confirmDialog({title:'Восстановить учебную копию?',text:'Учебные данные на этом устройстве будут заменены данными из файла. Игра и активные сессии останутся на устройстве. Текущие данные будут сохранены в локальной резервной копии.',confirm:'Восстановить',danger:true}))return;
    if(!window.AT.save(true)){message='Не удалось сохранить текущие данные. Восстановление отменено.';notify();return;}
    try { localStorage.removeItem(E.META);S.apply(localStorage,data);location.reload(); }
    catch(_){message='Не удалось восстановить данные. Проверьте свободное место в браузере.';notify();}
  }
  function mount(node) {
    listener=()=>{
      if(!node.isConnected){listener=null;return;}
      const status=node.querySelector('[data-sync-status]'),actions=node.querySelector('[data-sync-actions]');
      const view=node.closest('.view');
      if(view)view.querySelectorAll('[data-if-signed-out]').forEach(el=>{el.hidden=!!auth && auth.expiresAt>Date.now()/1000;});
      let text=message;
      if(!text && busy)text='Проверяем…';
      if(!text && !auth)text='Войдите через Telegram.';
      if(!text && auth && !plan)text='Нажмите «Проверить», чтобы сравнить данные.';
      if(!text && plan)text=({equal:'Учебные данные совпадают.',initial:'В облаке пока нет данных. Можно сохранить учебные данные этого устройства.', 'local-changed':'На устройстве есть новые учебные данные.','remote-changed':'В облаке есть обновления. Загрузите их, когда будете готовы.','conflict':'На устройстве и в облаке разные учебные данные. Выберите, какую версию сохранить; автоматической перезаписи не будет.'})[plan.state];
      status.textContent=text;
      let html=auth?'<button type="button" class="btn btn--ghost" data-sync="check">Проверить</button><button type="button" class="btn btn--ghost" data-sync="logout">Выйти</button>':'<button type="button" class="btn btn--primary" data-sync="login">Войти через Telegram</button>';
      if(auth && plan && plan.state!=='equal') {
        html+='<button type="button" class="btn btn--ghost" data-sync="push">Сохранить данные устройства в облако</button>';
        if(plan.remote.revision>0)html+='<button type="button" class="btn btn--ghost" data-sync="pull">Загрузить данные из облака</button>';
      }
      actions.innerHTML=html;actions.querySelectorAll('button').forEach(b=>{b.disabled=busy;});
    };
    node.addEventListener('click',e=>{const b=e.target.closest('[data-sync]');if(!b)return;const a=b.dataset.sync;if(a==='login')login();if(a==='logout')logout();if(a==='check')inspect();if(a==='push'||a==='pull')choose(a);if(a==='backup')backup();});
    node.addEventListener('change',e=>{if(e.target.matches('[data-sync-file]')){const file=e.target.files[0];e.target.value='';restore(file);}});
    window.AT.onCleanup(()=>{listener=null;});notify();
    if(auth)inspect();else prepareLogin();
  }
  // Only a known common baseline permits unattended upload; conflicts are never overwritten.
  setInterval(()=>{if(auth && !document.hidden)inspect(true);},30000);
  window.addEventListener('online',()=>{if(auth)inspect(true);});
  window.MedzoStudySync={mount};
})();
