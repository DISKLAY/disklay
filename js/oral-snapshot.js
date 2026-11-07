/* Only self-assessments; never include the selected card/ticket or active views. */
(function(root){
 'use strict';
 const KEY='anatomy-oral-1-v1',object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 const digits=(k,max)=>/^[1-9][0-9]*$/.test(k)&&Number(k)<=max;
 function validate(x){
  if(!object(x)||x.schema!==1||!object(x.tickets)||!object(x.cards)||Object.keys(x).some(k=>!['schema','tickets','cards'].includes(k)))return false;
  const rating=v=>v==='known'||v==='again';
  return Object.entries(x.cards).every(([k,v])=>digits(k,72)&&rating(v))&&Object.entries(x.tickets).every(([n,t])=>digits(n,35)&&object(t)&&Object.entries(t).every(([kind,group])=>['practical','theory'].includes(kind)&&object(group)&&Object.entries(group).every(([i,v])=>digits(i,kind==='practical'?10:3)&&rating(v))));
 }
 function capture(storage){
  const raw=storage.getItem(KEY);let value;
  try{value=raw===null?{tickets:{},cards:{}}:JSON.parse(raw);}catch(_){throw Error('Повреждены оценки устной подготовки');}
  if(!object(value)||!object(value.tickets)||!object(value.cards)||Object.keys(value).some(k=>!['tickets','cards'].includes(k)))throw Error('Повреждены оценки устной подготовки');
  const out={schema:1,tickets:value.tickets,cards:value.cards};if(!validate(out))throw Error('Повреждены оценки устной подготовки');return out;
 }
 function apply(storage,snapshot){
  if(!validate(snapshot))throw Error('invalid_snapshot');const raw=storage.getItem(KEY);
  // Persist recovery copy before replacing anything; old oral data is not in the main sync backup.
  const base='medzo-oral-sync-local-backup-'+Date.now();let backupKey=base,n=0;
  while(storage.getItem(backupKey)!==null)backupKey=base+'-'+(++n);
  try{storage.setItem(backupKey,JSON.stringify({createdAt:Date.now(),raw}));}catch(_){throw Error('local_save');}
  try{storage.setItem(KEY,JSON.stringify({tickets:snapshot.tickets,cards:snapshot.cards}));}catch(_){throw Error('local_save');}
  return {backupKey};
 }
 const api={KEY,capture,validate,apply};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MedzoOralSnapshot=api;
})(typeof window!=='undefined'?window:globalThis);
