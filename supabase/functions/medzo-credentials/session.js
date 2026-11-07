/* Session issuance for password identities. Not connected to production. */
(function(root){
  'use strict';
  function create({persist,sign,clock=()=>Math.floor(Date.now()/1000),random=bytes=>crypto.getRandomValues(bytes)}){
    if(typeof persist!=='function'||typeof sign!=='function')throw Error('missing_session_adapters');
    return async function issueSession(userId){
      if(typeof userId!=='string'||!/^p_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(userId))throw Error('invalid_identity');
      const sid=btoa(String.fromCharCode(...random(new Uint8Array(32)))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(sid))),b=>b.toString(16).padStart(2,'0')).join('');
      const expiresAt=clock()+90*86400;
      await persist({session_hash:hash,user_id:userId,expires_at:new Date(expiresAt*1000).toISOString()});
      return {session:await sign({kind:'session',id:userId,sid,exp:expiresAt}),userId,expiresAt};
    };
  }
  const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MedzoPasswordSession=api;
})(typeof window!=='undefined'?window:globalThis);
