/* Isolated snapshot: never include the current session or filters. */
(function(root){
 'use strict';
 const KEY='medzo-myology-practice-v1',object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 const validMap=(value,max)=>object(value)&&Object.entries(value).every(([k,v])=>/^[1-9][0-9]*$/.test(k)&&Number(k)<=max&&['known','again'].includes(v));
 function validate(x){return object(x)&&x.schema===1&&Object.keys(x).every(k=>['schema','skills','questions'].includes(k))&&validMap(x.skills,222)&&validMap(x.questions,66);}
 function capture(store){const raw=store.getItem(KEY);let v;try{v=raw===null?{}:JSON.parse(raw);}catch(_){throw Error('Повреждены оценки миологии');}if(!object(v))throw Error('Повреждены оценки миологии');const out={schema:1,skills:v.skills||{},questions:v.questions||{}};if(!validate(out))throw Error('Повреждены оценки миологии');return out;}
 function apply(store,snapshot){
  if(!validate(snapshot))throw Error('invalid_snapshot');const raw=store.getItem(KEY);let current;try{current=raw===null?{}:JSON.parse(raw);}catch(_){throw Error('local_corrupt');}if(!object(current))throw Error('local_corrupt');
  const base='medzo-myology-sync-local-backup-'+Date.now();let backupKey=base,n=0;while(store.getItem(backupKey)!==null)backupKey=base+'-'+(++n);
  try{store.setItem(backupKey,JSON.stringify({createdAt:Date.now(),raw}));}catch(_){throw Error('local_save');}
  current.skills=snapshot.skills;current.questions=snapshot.questions;
  try{store.setItem(KEY,JSON.stringify(current));}catch(_){throw Error('local_save');}
  return {backupKey};
 }
 const api={KEY,capture,validate,apply};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MedzoMyologySnapshot=api;
})(typeof window!=='undefined'?window:globalThis);
