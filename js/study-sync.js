/* Telegram sign-in and explicit conflict resolution for study data. */
(function () {
  'use strict';
  const endpoint='https://pgkimwwxoxizlmncdevq.supabase.co/functions/v1/medzo-study-sync';
  const SESSION='medzo-study-sync-session-v1';
  const S=window.MedzoStudySnapshot, E=window.MedzoSyncEngine;
  let auth=null, engine=null, plan=null, busy=false, listener=null, message='', challenge=null, config=null;
  let miniLoaded=false, miniFailed=false, loginLoaded=false, remember=true, authStorage=null;
  let photo=null, photoStatus='', photoVersion=0;
  let leaders=[], member=null, leaderStatus='', leaderVersion=0, leaderNeedsForm=true;
  function updateHeader(){
    if(typeof document.getElementById!=='function')return;
    const image=document.getElementById('topbarProfilePhoto'),fallback=document.getElementById('topbarProfilePlaceholder');
    if(!image||!fallback)return;
    const show=!!auth&&auth.expiresAt>Date.now()/1000&&typeof photo==='string'&&photo.length<=90000&&/^[A-Za-z0-9+/]*={0,2}$/.test(photo);
    image.hidden=!show;fallback.toggleAttribute('hidden',show);
    if(show){const src='data:image/jpeg;base64,'+photo;if(image.getAttribute('src')!==src)image.src=src;}else image.removeAttribute('src');
  }
  function notify() { updateHeader();if(listener) listener(); }
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
  function validAuth(data) {
    return data && /^[1-9][0-9]{0,19}$/.test(String(data.userId)) && typeof data.session==='string' && Number.isSafeInteger(data.expiresAt) && data.expiresAt>Date.now()/1000+5;
  }
  function connect(data, storageName, persist=true) {
    if(!validAuth(data))throw Error('auth');
    if(persist) {
      const target=storageName==='local'?localStorage:sessionStorage;
      target.setItem(SESSION,JSON.stringify(data));
      // A tab-only login must not erase a remembered login belonging to another tab.
      if(storageName==='local')sessionStorage.removeItem(SESSION);
    }
    auth=data;authStorage=storageName;photo=null;photoStatus='';photoVersion++;leaders=[];member=null;leaderStatus='';leaderVersion++;leaderNeedsForm=true;
    engine=E.makeEngine({store:localStorage,snapshot:S,request:body=>call(body),userId:String(data.userId)});
  }
  function clearAuth() {auth=null;engine=null;plan=null;authStorage=null;photo=null;photoStatus='';photoVersion++;leaders=[];member=null;leaderStatus='';leaderVersion++;leaderNeedsForm=true;}
  function clearCurrentSession() {
    const store=authStorage==='local'?localStorage:authStorage==='session'?sessionStorage:null;
    // Never erase a newer session written by another tab while logout was in flight.
    if(store) {try {const stored=JSON.parse(store.getItem(SESSION)||'null');if(stored && auth && stored.session===auth.session)store.removeItem(SESSION);} catch (_) { /* leave unknown storage untouched */ }}
    clearAuth();
  }
  async function logout() {
    if(!auth||busy)return;const active=auth;busy=true;notify();
    try { await call({action:'logout'});if(auth===active){clearCurrentSession();message='Вы вышли. Локальные учебные данные не изменены.';} }
    catch (e) { if(e.message==='auth' && auth===active){clearCurrentSession();message='Сессия завершена. Учебные данные на устройстве не изменены.';}else if(auth===active)message='Не удалось выйти. Проверьте интернет и повторите.'; }
    finally { busy=false;notify(); }
  }
  // Do not silently turn a tab-only session into a persistent one.
  for(const [name,store] of [['session',sessionStorage],['local',localStorage]]) {
    try {const saved=JSON.parse(store.getItem(SESSION)||'null');if(validAuth(saved)){connect(saved,name,false);break;}if(saved)store.removeItem(SESSION);} catch (_) { /* ignore unavailable or malformed storage */ }
  }
  window.addEventListener('storage',e=>{
    if(e.key!==SESSION || e.storageArea!==localStorage || authStorage==='session')return;
    if(!e.newValue){if(authStorage==='local'){clearAuth();message='Вход завершён в другой вкладке.';notify();}return;}
    try{const next=JSON.parse(e.newValue);if(validAuth(next)&&(!auth||next.session!==auth.session)){connect(next,'local',false);plan=null;message='';notify();loadPhoto();loadLeaderboard();}}catch(_){}
  });
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
      if(auto&&result.state==='local-changed') { await engine.push(result);plan=await engine.inspect();loadLeaderboard(); }
      message='';
    } catch(e) { plan=null;message=e.message==='auth'?'Не удалось подтвердить сессию. Проверьте интернет; если проблема не исчезнет, выйдите и войдите снова.':'Не удалось проверить синхронизацию. Учебные данные на устройстве не изменены.'; }
    finally { busy=false;notify(); }
  }
  async function loginMini(initData,rememberLogin) {
    busy=true;notify();
    try { connect(await call({action:'login',initData},false),rememberLogin?'local':'session');message=''; }
    catch (_) { message='Не удалось войти через Telegram. Закройте и снова откройте приложение из бота.'; }
    finally { busy=false;notify(); }
    if(engine){await Promise.all([inspect(),loadPhoto(),loadLeaderboard()]);}
  }
  function login() {
    if(busy)return;
    const rememberLogin=remember;
    const mini=window.Telegram && window.Telegram.WebApp;
    if(mini && mini.initData){loginMini(mini.initData,rememberLogin);return;}
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
        try { connect(await call({action:'login',idToken:result.id_token,nonce},false),rememberLogin?'local':'session');message=''; }
        catch (_) { message='Вход не удалось проверить. Попробуйте ещё раз.';prepareLogin(); }
        finally { busy=false;notify(); }
        if(engine){await Promise.all([inspect(),loadPhoto(),loadLeaderboard()]);}
      });
    } catch (_) { message='Не удалось открыть Telegram. Разрешите всплывающие окна и повторите.';notify();prepareLogin(); }
  }
  async function choose(direction) {
    if(!plan||!engine||busy)return;
    const selection=plan, selectedEngine=engine;
    const text=direction==='pull'
      ?(selection.remote.snapshot.schema===1?'Учебные данные будут заменены старой облачной копией. В ней нет наград: кошелёк, достижения и оформления останутся на устройстве. ':'Учебные данные, кошелёк, достижения и оформления на этом устройстве будут заменены облачной копией. ')+'Подземелье и активные сессии останутся на устройстве. Перед заменой создаётся локальная резервная копия. Закройте другие вкладки Medzo и продолжайте только если готовы заменить данные.'
      :'Учебные данные, кошелёк, достижения и оформления в облаке будут заменены данными этого устройства. Предыдущая облачная версия будет сохранена в истории. Продолжить?';
    busy=true;notify();
    const confirmed=await window.AT.ui.confirmDialog({title:direction==='pull'?'Загрузить из облака?':'Сохранить в облако?',text,confirm:direction==='pull'?'Загрузить':'Сохранить',danger:true});
    if(!confirmed || selectedEngine!==engine){busy=false;notify();return;}
    // Finish pending in-memory anatomy saves before comparing and replacing.
    if(direction==='pull' && !window.AT.save(true)){busy=false;message='Не удалось сохранить текущие данные. Загрузка отменена.';notify();return;}
    busy=true;notify();
    try {
      if(direction==='pull') { await selectedEngine.pull(selection);location.reload();return; }
      await selectedEngine.push(selection);plan=await selectedEngine.inspect();message='Данные сохранены в облаке.';loadLeaderboard();
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
    if(!await window.AT.ui.confirmDialog({title:'Восстановить учебную копию?',text:data.schema===1?'Учебные данные будут заменены. Старая копия не содержит наград, поэтому кошелёк, достижения и оформления останутся на устройстве. Подземелье и активные сессии останутся без изменений. Закройте другие вкладки Medzo.':'Учебные данные, кошелёк, достижения и оформления будут заменены данными из файла. Подземелье и активные сессии останутся на устройстве. Будет создана резервная копия. Закройте другие вкладки Medzo.',confirm:'Восстановить',danger:true}))return;
    if(!window.AT.save(true)){message='Не удалось сохранить текущие данные. Восстановление отменено.';notify();return;}
    try { localStorage.removeItem(E.META);S.apply(localStorage,data);location.reload(); }
    catch(_){message='Не удалось восстановить данные. Проверьте свободное место в браузере.';notify();}
  }
  async function loadPhoto() {
    if(!auth)return;
    const active=auth,version=++photoVersion;
    try {const result=await call({action:'photo-get'});if(auth===active&&version===photoVersion){photo=typeof result.photo==='string'?result.photo:null;photoStatus='';}}
    catch (_){if(auth===active&&version===photoVersion)photoStatus='Не удалось загрузить фото. Проверьте интернет.';}
    notify();
  }
  async function changePhoto(file) {
    if(!auth||busy||!file)return;
    const active=auth,version=++photoVersion;busy=true;photoStatus='Подготавливаем фото…';notify();
    try{
      const encoded=await window.MedzoProfilePhoto.prepare(file);
      if(auth!==active||version!==photoVersion)return;
      await call({action:'photo-put',photo:encoded});
      if(auth===active&&version===photoVersion){photo=encoded;photoStatus='Фото сохранено в аккаунте.';if(member?.showPhoto)loadLeaderboard();}
    }catch(_){if(auth===active&&version===photoVersion)photoStatus='Не удалось сохранить фото. Выберите JPG, PNG или WebP до 8 МБ и проверьте интернет.';}
    finally{busy=false;notify();}
  }
  async function deletePhoto(){
    if(!auth||busy||!photo)return;
    const active=auth,version=++photoVersion;busy=true;photoStatus='Удаляем фото…';notify();
    try{await call({action:'photo-delete'});if(auth===active&&version===photoVersion){photo=null;photoStatus='Фото удалено.';if(member?.showPhoto)loadLeaderboard();}}
    catch(_){if(auth===active&&version===photoVersion)photoStatus='Не удалось удалить фото. Проверьте интернет.';}
    finally{busy=false;notify();}
  }
  async function loadLeaderboard(){
    if(!auth)return;const active=auth,version=++leaderVersion;
    try{const data=await call({action:'leaderboard-get'});if(auth===active&&version===leaderVersion){leaders=Array.isArray(data.leaders)?data.leaders:[];member=data.member||null;leaderNeedsForm=true;leaderStatus='';}}
    catch(_){if(auth===active&&version===leaderVersion)leaderStatus='Не удалось загрузить рейтинг. Проверьте интернет.';}
    notify();
  }
  async function joinLeaderboard(form){
    if(!auth||busy)return;const active=auth,version=++leaderVersion;
    const name=form.elements['leaderboard-name'].value,showPhoto=form.elements['leaderboard-photo'].checked;
    busy=true;leaderStatus='Сохраняем…';notify();
    try{await call({action:'leaderboard-join',name,showPhoto});if(auth===active&&version===leaderVersion){await loadLeaderboard();leaderStatus='Настройки рейтинга сохранены.';}}
    catch(_){if(auth===active&&version===leaderVersion)leaderStatus='Не удалось сохранить. Проверьте имя и подключение.';}
    finally{busy=false;notify();}
  }
  async function leaveLeaderboard(){
    if(!auth||busy||!member)return;const active=auth,version=++leaderVersion;busy=true;leaderStatus='Удаляем из рейтинга…';notify();
    try{await call({action:'leaderboard-leave'});if(auth===active&&version===leaderVersion){await loadLeaderboard();leaderStatus='Вы больше не участвуете в рейтинге.';}}
    catch(_){if(auth===active&&version===leaderVersion)leaderStatus='Не удалось выйти из рейтинга. Проверьте подключение.';}
    finally{busy=false;notify();}
  }
  function renderLeaderboard(node){
    const form=node.querySelector('[data-leaderboard-form]'),list=node.querySelector('[data-leaderboard-list]'),status=node.querySelector('[data-leaderboard-status]');
    if(!form||!form.elements||!list||!list.replaceChildren)return;
    if(leaderNeedsForm){form.elements['leaderboard-name'].value=member?.name||'';form.elements['leaderboard-photo'].checked=!!member?.showPhoto;leaderNeedsForm=false;}
    const save=node.querySelector('[data-leaderboard-save]'),leave=node.querySelector('[data-leaderboard-leave]');
    if(save){save.textContent=member?'Сохранить':'Участвовать';save.disabled=busy;}
    if(leave){leave.hidden=!member;leave.disabled=busy;}
    if(status)status.textContent=leaderStatus;
    list.replaceChildren();
    leaders.slice(0,100).forEach((row,index)=>{
      const li=document.createElement('li'),number=document.createElement('span'),name=document.createElement('strong'),score=document.createElement('span');
      number.className='leaderboard__place';number.textContent=String(index+1);
      if(typeof row.photo==='string'&&row.photo.length<=90000&&/^[A-Za-z0-9+/]*={0,2}$/.test(row.photo)){
        const image=document.createElement('img');image.className='leaderboard__avatar';image.alt='';image.src='data:image/jpeg;base64,'+row.photo;li.append(number,image);
      }else li.append(number);
      name.textContent=typeof row.display_name==='string'?row.display_name:'Участник';score.className='leaderboard__score';score.textContent=Number.isSafeInteger(row.score)&&row.score>=0?row.score.toLocaleString('ru-RU'):'0';
      li.append(name,score);list.append(li);
    });
  }
  function mount(node) {
    listener=()=>{
      if(!node.isConnected){listener=null;return;}
      const status=node.querySelector('[data-sync-status]'),actions=node.querySelector('[data-sync-actions]');
      const account=node.querySelector('[data-sync-account]');
      if(account){account.hidden=!auth;account.textContent=auth?'Telegram подключён':'';}
      const view=node.closest('.view');
      if(view)view.querySelectorAll('[data-if-signed-out]').forEach(el=>{el.hidden=!!auth && auth.expiresAt>Date.now()/1000;});
      if(view)view.querySelectorAll('[data-if-signed-in]').forEach(el=>{el.hidden=!auth || auth.expiresAt<=Date.now()/1000;});
      const photoImage=node.querySelector('[data-profile-photo]'),placeholder=node.querySelector('[data-profile-placeholder]'),photoText=node.querySelector('[data-profile-status]'),photoDelete=node.querySelector('[data-profile-delete]');
      if(photoImage && photoImage.tagName==='IMG'){photoImage.hidden=!photo;if(photo)photoImage.src='data:image/jpeg;base64,'+photo;else photoImage.removeAttribute('src');}
      if(placeholder)placeholder.hidden=!!photo;
      if(photoText)photoText.textContent=photoStatus;
      if(photoDelete){photoDelete.hidden=!photo;photoDelete.disabled=busy;}

      renderLeaderboard(node);
      let text=message;
      if(!text && busy)text='Проверяем…';
      if(!text && !auth)text='Войдите через Telegram.';
      if(!text && auth && !plan)text='Telegram подключён. Нажмите «Проверить», чтобы сравнить данные.';
      if(!text && plan)text=({equal:'Учебные данные совпадают.',initial:'В облаке пока нет данных. Можно сохранить учебные данные этого устройства.', 'local-changed':'На устройстве есть новые учебные данные.','remote-changed':'В облаке есть обновления. Загрузите их, когда будете готовы.','conflict':'На устройстве и в облаке разные учебные данные. Выберите, какую версию сохранить; автоматической перезаписи не будет.'})[plan.state];
      status.textContent=text;
      let html=auth?'<button type="button" class="btn btn--ghost" data-sync="check">Проверить</button><button type="button" class="btn btn--ghost" data-sync="logout">Выйти</button>':'<button type="button" class="btn btn--primary" data-sync="login">Войти через Telegram</button>';
      if(auth && plan && plan.state!=='equal') {
        html+='<button type="button" class="btn btn--ghost" data-sync="push">Сохранить данные устройства в облако</button>';
        if(plan.remote.revision>0)html+='<button type="button" class="btn btn--ghost" data-sync="pull">Загрузить данные из облака</button>';
      }
      actions.innerHTML=html;actions.querySelectorAll('button').forEach(b=>{b.disabled=busy;});
    };
    node.addEventListener('click',e=>{const b=e.target.closest('[data-sync]');if(!b)return;const a=b.dataset.sync;if(a==='login')login();if(a==='logout')logout();if(a==='check')inspect();if(a==='push'||a==='pull')choose(a);if(a==='backup')backup();if(a==='photo-delete')deletePhoto();if(a==='leaderboard-leave')leaveLeaderboard();});
    node.addEventListener('submit',e=>{if(e.target.matches('[data-leaderboard-form]')){e.preventDefault();joinLeaderboard(e.target);}});
    node.addEventListener('change',e=>{if(e.target.matches('[data-profile-file]')){const file=e.target.files[0];e.target.value='';changePhoto(file);}if(e.target.matches('[data-sync-remember]'))remember=e.target.checked;if(e.target.matches('[data-sync-file]')){const file=e.target.files[0];e.target.value='';restore(file);}});
    const checkbox=node.querySelector('[data-sync-remember]');if(checkbox)checkbox.checked=remember;
    window.AT.onCleanup(()=>{listener=null;});notify();
    if(auth){inspect();loadPhoto();loadLeaderboard();}else prepareLogin();
  }
  function mountVisibility(view) {
    listener=()=>{if(!view.isConnected){listener=null;return;}view.querySelectorAll('[data-if-signed-out]').forEach(el=>{el.hidden=!!auth && auth.expiresAt>Date.now()/1000;});};
    window.AT.onCleanup(()=>{listener=null;});notify();
  }
  // Only a known common baseline permits unattended upload; conflicts are never overwritten.
  setInterval(()=>{if(auth && !document.hidden)inspect(true);},30000);
  window.addEventListener('online',()=>{if(auth)inspect(true);});
  window.MedzoStudySync={mount,mountVisibility};
  notify();
  if(auth)loadPhoto();
})();
