/* Общие промокоды на локальные оформления. Это публичные коды, не секреты. */
(function(root){
  'use strict';
  // Пример для добавления по запросу владельца: { code: 'MEDZO', appearance: 'ocean' }.
  // Пока активных промокодов нет.
  const codes=[];
  function redeem(input,game,entries=codes){
    const code=String(input || '').trim().toUpperCase();
    if(!/^[A-Z0-9_-]{1,64}$/.test(code))return {ok:false,message:'Введите промокод латинскими буквами и цифрами.'};
    const match=entries.find(item=>item.code===code);
    if(!match)return {ok:false,message:'Промокод не найден или больше не действует.'};
    if(!game.appearances || !Object.hasOwn(game.appearances,match.appearance) || match.appearance==='default')return {ok:false,message:'Оформление по этому промокоду недоступно.'};
    if(game.profile().appearances[match.appearance])return {ok:false,message:'Это оформление уже открыто на устройстве.'};
    return game.importAppearances({sharedRewards:{appearances:{[match.appearance]:true}}});
  }
  async function redeemWithServer(input,game,fetchFn,entries=codes){
    const code=String(input || '').trim().toUpperCase();
    const local=redeem(code,game,entries);
    if(!/^[A-Z0-9_-]{1,64}$/.test(code) || entries.some(item=>item.code===code))return local;
    let response;
    try { response=await fetchFn('https://pgkimwwxoxizlmncdevq.supabase.co/functions/v1/medzo-promo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code}),cache:'no-store'}); }
    catch (_) { return {ok:false,message:'Не удалось проверить промокод. Проверьте интернет.'}; }
    if(response.status===404)return local;
    if(!response.ok)return {ok:false,message:'Не удалось проверить промокод. Попробуйте позже.'};
    let result;try{result=await response.json();}catch(_){return {ok:false,message:'Не удалось проверить промокод.'};}
    if(result && result.reward==='all-appearances-future' && typeof game.grantAllFutureAppearances==='function')return game.grantAllFutureAppearances();
    if(!result||result.reward!=='all-appearances'||!game.appearances)return {ok:false,message:'Не удалось проверить промокод.'};
    const ids=Object.keys(game.appearances).filter(id=>id!=='default'&&id!=='meme');
    if(!ids.length)return {ok:false,message:'Нет доступных оформлений.'};
    const owned=game.profile().appearances;
    if(ids.every(id=>owned[id]))return {ok:false,message:'Все доступные оформления уже открыты на устройстве.'};
    return game.importAppearances({sharedRewards:{appearances:Object.fromEntries(ids.map(id=>[id,true]))}});
  }
  const api={redeem,redeemWithServer};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MedzoPromoCodes=api;
})(typeof window!=='undefined'?window:globalThis);
