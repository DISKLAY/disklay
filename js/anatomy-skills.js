/* Независимая самооценка практических навыков первого коллоквиума. */
(function () {
  'use strict';
  const data=window.AnatomySkillsData;
  const KEY='anatomy-practical-skills-1-v1';
  const byId=Object.fromEntries(data.items.map(item=>[item.id,item]));
  const groups=new Set(data.groups.map(g=>g.id));
  const scopes=['all','unseen','again','favorites'];
  function create(store,random) {
    random=random||Math.random;
    const state={group:'all',scope:'all',limit:10,sequence:'random',favorites:{},stats:{},notes:{},session:null};
    let failed=false;
    try {
      const saved=JSON.parse(store.getItem(KEY)||'{}');
      if(saved && typeof saved==='object') {
        if(saved.group==='all'||groups.has(saved.group))state.group=saved.group;
        if(scopes.includes(saved.scope))state.scope=saved.scope;
        if([0,10,20,50].includes(saved.limit))state.limit=saved.limit;
        if(['random','ordered'].includes(saved.sequence))state.sequence=saved.sequence;
        for(const item of data.items){
          const id=item.id, favorite=saved.favorites&&saved.favorites[id], stat=saved.stats&&saved.stats[id], note=saved.notes&&saved.notes[id];
          if(favorite===true)state.favorites[id]=true;
          if(stat && Number.isSafeInteger(stat.attempts) && stat.attempts>0 && Number.isSafeInteger(stat.known) && stat.known>=0 && stat.known<=stat.attempts && ['known','again'].includes(stat.last))state.stats[id]={attempts:stat.attempts,known:stat.known,last:stat.last};
          if(typeof note==='string')state.notes[id]=note.slice(0,2000);
        }
        const s=saved.session;
        if(s && Array.isArray(s.order) && s.order.length && s.order.length<=data.items.length && s.order.every(id=>Number.isInteger(id)&&byId[id]) && new Set(s.order).size===s.order.length && Number.isInteger(s.index) && s.index>=0 && s.index<s.order.length) {
          const answers={},hints={};
          s.order.forEach(id=>{if(s.answers && ['known','again'].includes(s.answers[id]))answers[id]=s.answers[id];if(s.hints&&s.hints[id]===true)hints[id]=true;});
          state.session={order:s.order.slice(),index:s.index,answers,hints,finished:s.finished===true};
        }
      }
    } catch(e) { /* damaged or disabled storage: safe default */ }
    function save(){try{store.setItem(KEY,JSON.stringify(state));failed=false;}catch(e){failed=true;}}
    function setOptions(group,scope,limit,sequence){if(group==='all'||groups.has(group))state.group=group;if(scopes.includes(scope))state.scope=scope;if([0,10,20,50].includes(Number(limit)))state.limit=Number(limit);if(['random','ordered'].includes(sequence))state.sequence=sequence;save();}
    function pool(){return data.items.filter(item=> (state.group==='all'||item.group===state.group) && (state.scope==='all'||(state.scope==='favorites'&&state.favorites[item.id])||(state.scope==='again'&&state.stats[item.id]?.last==='again')||(state.scope==='unseen'&&!state.stats[item.id])));}
    function begin(ids,limit){
      if(!ids.length)return false;
      if(state.sequence==='ordered')ids.sort((a,b)=>a-b);
      else for(let i=ids.length-1;i>0;i--){let j=Math.floor(random()*(i+1)); j=Math.max(0,Math.min(i,j));[ids[i],ids[j]]=[ids[j],ids[i]];}
      if(limit)ids=ids.slice(0,limit);
      state.session={order:ids,index:0,answers:{},hints:{},finished:false};save();return true;
    }
    function start(){return begin(pool().map(item=>item.id),state.limit);}
    // A catalogue section means the entire section, independent of the setup filters.
    function startSection(id){const section=data.sections.find(section=>section.id===id);return section?begin(data.items.filter(item=>item.id>=section.from&&item.id<=section.to).map(item=>item.id),0):false;}
    function current(){const s=state.session;return s?byId[s.order[s.index]]:null;}
    function mark(status){
      const s=state.session,item=current();if(!s||!item||s.finished||!['known','again'].includes(status))return false;
      const previous=state.stats[item.id]?s.answers[item.id]:null,old=state.stats[item.id]||{attempts:0,known:0,last:status};
      if(!previous){old.attempts++;if(status==='known')old.known++;}
      else if(previous!==status)old.known+=status==='known'?1:-1;
      s.answers[item.id]=status;old.last=status;state.stats[item.id]=old;save();return true;
    }
    function navigate(delta){const s=state.session;if(!s)return false;const i=s.index+delta;if(!Number.isInteger(i)||i<0||i>=s.order.length)return false;s.index=i;s.finished=false;save();return true;}
    function finish(){if(!state.session)return false;state.session.finished=true;save();return true;}
    function resume(){if(!state.session)return false;state.session.finished=false;save();return true;}
    function hint(){const s=state.session,item=current();if(!s||!item)return;s.hints[item.id]=true;save();}
    function favorite(id){if(!byId[id])return; if(state.favorites[id])delete state.favorites[id];else state.favorites[id]=true;save();}
    function note(id,text){if(!byId[id])return;state.notes[id]=String(text).slice(0,2000);if(!state.notes[id])delete state.notes[id];save();}
    function reset(){state.stats={};state.session=null;save();} // notes and favorites survive
    return {state,pool,setOptions,start,startSection,current,mark,navigate,finish,resume,hint,favorite,note,reset,storageFailed:()=>failed};
  }
  window.AnatomySkills={data,byId,KEY,create};
})();
