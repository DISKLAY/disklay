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
  const api={redeem};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MedzoPromoCodes=api;
})(typeof window!=='undefined'?window:globalThis);
