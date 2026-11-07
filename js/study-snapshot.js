/* Учебный прогресс и награды; состояние подземелья и текущие сессии остаются локально. */
(function(root){
  'use strict';
  const modules=['1','2','3','4','5','6','7','credit-1','credit-2','stom-2','stom-3'];
  const anatomyFields=['key','keyMeta','progress','favorites','comments','sessions','seen'];
  // These fields together form the wallet, rating and legacy purchase receipts.
  const rewardFields=['coins','rating','verified','achievements','cosmeticSpentApplied','appearanceReceipts','inventory'];
  const legacyBoosts=['hint-train','hint-exam','double-train','double-exam'];
  const sharedKey='anatomy-colloquium-rewards-shared-v1';
  const sharedFields=['achievements','appearances','cosmeticSpent','walletSpent','appearance'];
  const otherFields={
    'histology-prototype-v1':['stats','favorites','imageStats'],
    'histology-structures-v1':['stats'],
    'histology-theory-v1':['stats'],
    'anatomy-practical-skills-1-v1':['favorites','stats','notes']
  };
  const anatomyKeys=modules.map(id=>id==='1'?'anatomy-colloquium-v1':'anatomy-colloquium-v1-'+id);
  const keys=Object.fromEntries(anatomyKeys.map(key=>[key,anatomyFields]).concat(Object.entries(otherFields)));
  const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  const clone=x=>JSON.parse(JSON.stringify(x));
  function copyFields(value,fields){
    const out={};for(const field of fields)if(Object.hasOwn(value,field))out[field]=clone(value[field]);return out;
  }
  function copyRewards(game){
    const out=copyFields(game,rewardFields.filter(f=>f!=='inventory'));
    // Unused old boosts are necessary for the existing one-time wallet refund.
    if(object(game.inventory)){const inventory=copyFields(game.inventory,legacyBoosts);if(Object.keys(inventory).length)out.inventory=inventory;}
    return out;
  }
  function capture(storage){
    const records={};
    for(const [key,fields] of Object.entries(keys)){
      const raw=storage.getItem(key);if(raw===null)continue;
      let value;try{value=JSON.parse(raw);}catch(_){throw new Error('Не удалось прочитать сохранение '+key);}
      if(!object(value))throw new Error('Повреждено сохранение '+key);
      const selected=copyFields(value,fields);
      if(anatomyKeys.includes(key)&&object(value.game)){const rewards=copyRewards(value.game);if(Object.keys(rewards).length)selected.game=rewards;}
      if(Object.keys(selected).length)records[key]=selected;
    }
    const raw=storage.getItem(sharedKey);
    if(raw!==null){let value;try{value=JSON.parse(raw);}catch(_){throw new Error('Не удалось прочитать награды');}
      if(!object(value))throw new Error('Повреждено сохранение наград');
      const selected=copyFields(value,sharedFields);if(Object.keys(selected).length)records[sharedKey]=selected;
    }
    return {schema:2,records};
  }
  function validate(snapshot){
    if(!object(snapshot)||(snapshot.schema!==1&&snapshot.schema!==2)||!object(snapshot.records)||Object.keys(snapshot).some(k=>k!=='schema'&&k!=='records'))return false;
    return Object.entries(snapshot.records).every(([key,val])=>{
      if(!object(val))return false;
      if(key===sharedKey)return snapshot.schema===2&&Object.keys(val).every(f=>sharedFields.includes(f));
      if(!Object.hasOwn(keys,key))return false;
      return Object.keys(val).every(f=>{
        if(keys[key].includes(f))return true;
        if(f!=='game'||snapshot.schema!==2||!anatomyKeys.includes(key)||!object(val.game))return false;
        return Object.keys(val.game).every(g=>rewardFields.includes(g)&&(g!=='inventory'||(object(val.game.inventory)&&Object.keys(val.game.inventory).every(k=>legacyBoosts.includes(k)))));
      });
    });
  }
  // Version 1 has no rewards and must never erase them.
  // Before writing, save full copies of every affected record for recovery.
  function apply(storage,snapshot){
    if(!validate(snapshot))throw new Error('Неизвестный или повреждённый формат данных');
    const before={},updates={};
    for(const [key,fields] of Object.entries(keys)){
      const raw=storage.getItem(key),incoming=snapshot.records[key];
      if(raw===null&&!incoming)continue;
      before[key]=raw;
      let current={};if(raw!==null){try{current=JSON.parse(raw);}catch(_){throw new Error('Не удалось прочитать сохранение '+key);}if(!object(current))throw new Error('Повреждено сохранение '+key);}
      for(const f of fields)delete current[f];
      if(incoming)Object.assign(current,copyFields(incoming,fields));
      if(snapshot.schema===2&&anatomyKeys.includes(key)){
        const game=object(current.game)?current.game:{},from=incoming&&incoming.game;
        for(const f of rewardFields.filter(f=>f!=='inventory'))delete game[f];
        if(object(game.inventory)){for(const f of legacyBoosts)delete game.inventory[f];if(!Object.keys(game.inventory).length)delete game.inventory;}
        if(from){Object.assign(game,copyFields(from,rewardFields.filter(f=>f!=='inventory')));
          if(object(from.inventory))game.inventory=Object.assign(object(game.inventory)?game.inventory:{},copyFields(from.inventory,legacyBoosts));}
        if(Object.keys(game).length)current.game=game;else delete current.game;
      }
      updates[key]=JSON.stringify(current);
    }
    if(snapshot.schema===2){
      const raw=storage.getItem(sharedKey),incoming=snapshot.records[sharedKey];
      if(raw!==null||incoming){before[sharedKey]=raw;let current={};
        if(raw!==null){try{current=JSON.parse(raw);}catch(_){throw new Error('Не удалось прочитать награды');}if(!object(current))throw new Error('Повреждено сохранение наград');}
        for(const f of sharedFields)delete current[f];if(incoming)Object.assign(current,copyFields(incoming,sharedFields));
        updates[sharedKey]=JSON.stringify(current);
      }
    }
    const base='medzo-study-sync-local-backup-'+Date.now();let backupKey=base,n=0;
    while(storage.getItem(backupKey)!==null)backupKey=base+'-'+(++n);
    const backup=JSON.stringify({schema:1,createdAt:Date.now(),records:before});
    try{storage.setItem(backupKey,backup);}catch(_){throw new Error('Не удалось создать резервную копию. Данные не изменены.');}
    const written=[];
    try{for(const [key,value] of Object.entries(updates)){storage.setItem(key,value);written.push(key);}}
    catch(error){
      for(const key of written.reverse()){try{before[key]===null?storage.removeItem(key):storage.setItem(key,before[key]);}catch(_){/* резервная копия остаётся */}}
      throw new Error('Не удалось полностью восстановить данные. Локальная резервная копия сохранена.');
    }
    return {backupKey};
  }
  const api={keys,modules,capture,validate,apply};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MedzoStudySnapshot=api;
})(typeof window!=='undefined'?window:globalThis);
