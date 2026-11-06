/* Учебная часть сохранений для синхронизации. Игровые данные не включаются. */
(function(root){
  'use strict';
  const modules=['1','2','3','4','5','6','7','credit-1','credit-2','stom-2','stom-3'];
  const anatomyFields=['key','keyMeta','progress','favorites','comments','sessions','seen'];
  const otherFields={
    'histology-prototype-v1':['stats','favorites','imageStats'],
    'histology-structures-v1':['stats'],
    'histology-theory-v1':['stats'],
    'anatomy-practical-skills-1-v1':['favorites','stats','notes']
  };
  const keys=Object.fromEntries(modules.map(id=>[id==='1'?'anatomy-colloquium-v1':'anatomy-colloquium-v1-'+id,anatomyFields]).concat(Object.entries(otherFields)));
  const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  const clone=x=>JSON.parse(JSON.stringify(x));
  function copyFields(value,fields){
    const out={};for(const field of fields)if(Object.hasOwn(value,field))out[field]=clone(value[field]);return out;
  }
  function capture(storage){
    const records={};
    for(const [key,fields] of Object.entries(keys)){
      const raw=storage.getItem(key);if(raw===null)continue;
      let value;try{value=JSON.parse(raw);}catch(_){throw new Error('Не удалось прочитать сохранение '+key);}
      if(!object(value))throw new Error('Повреждено сохранение '+key);
      const selected=copyFields(value,fields);if(Object.keys(selected).length)records[key]=selected;
    }
    return {schema:1,records};
  }
  function validate(snapshot){
    if(!object(snapshot)||snapshot.schema!==1||!object(snapshot.records))return false;
    return Object.entries(snapshot.records).every(([key,val])=>Object.hasOwn(keys,key)&&object(val)&&Object.keys(val).every(name=>keys[key].includes(name)));
  }
  // Применять только после явного выбора пользователя. Активные сессии и игра остаются локальными.
  // Сначала сохраняется полная локальная копия всех затрагиваемых записей.
  function apply(storage,snapshot){
    if(!validate(snapshot))throw new Error('Неизвестный или повреждённый формат учебных данных');
    const before={},updates={};
    for(const [key,fields] of Object.entries(keys)){
      const raw=storage.getItem(key),incoming=snapshot.records[key];
      if(raw===null&&!incoming)continue;
      before[key]=raw;
      let current={};if(raw!==null){try{current=JSON.parse(raw);}catch(_){throw new Error('Не удалось прочитать сохранение '+key);}if(!object(current))throw new Error('Повреждено сохранение '+key);}
      for(const f of fields)delete current[f];
      if(incoming)Object.assign(current,copyFields(incoming,fields));
      updates[key]=JSON.stringify(current);
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
