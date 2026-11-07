/* Самооценка по билетам и карточкам. Только оценки, без активной сессии. */
(function(root){
  'use strict';
  const KEY='anatomy-oral-1-v1';
  function create(storage, notify){
    function read(){
      try{const raw=JSON.parse(storage.getItem(KEY)||'{}');return {tickets:raw.tickets&&typeof raw.tickets==='object'&&!Array.isArray(raw.tickets)?raw.tickets:{},cards:raw.cards&&typeof raw.cards==='object'&&!Array.isArray(raw.cards)?raw.cards:{}};}catch(_){return {tickets:{},cards:{}};}
    }
    function save(state){try{storage.setItem(KEY,JSON.stringify(state));if(notify)notify();return true;}catch(_){return false;}}
    function markTicket(number,kind,index,value){
      if(!Number.isInteger(number)||number<1||number>35||!['practical','theory'].includes(kind)||!Number.isInteger(index)||index<1||index>(kind==='practical'?10:3)||!['known','again',''].includes(value))return false;
      const s=read(),ticket=s.tickets[number]&&typeof s.tickets[number]==='object'?s.tickets[number]:{};
      const group=ticket[kind]&&typeof ticket[kind]==='object'?ticket[kind]:{};if(value)group[index]=value;else delete group[index];ticket[kind]=group;s.tickets[number]=ticket;return save(s);
    }
    function markCard(number,value){if(!Number.isInteger(number)||number<1||number>72||!['known','again',''].includes(value))return false;const s=read();if(value)s.cards[number]=value;else delete s.cards[number];return save(s);}
    return {read,markTicket,markCard};
  }
  const api={KEY,create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AnatomyOral=api;
})(typeof window!=='undefined'?window:globalThis);
