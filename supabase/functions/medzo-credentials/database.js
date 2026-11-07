/* Server-side adapters for the future password service; not an HTTP endpoint. */
(function(root){
  'use strict';
  function create({base,serviceKey,fetchFn=fetch}){
    if(!base||!serviceKey||typeof fetchFn!=='function')throw Error('missing_database_configuration');
    async function request(path,options={}){
      const res=await fetchFn(base.replace(/\/$/,'')+'/rest/v1/'+path,{...options,headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json',...(options.headers||{})}});
      if(!res.ok)throw Error('database_unavailable');return res.json();
    }
    const rpc=(name,data)=>request('rpc/'+name,{method:'POST',body:JSON.stringify(data)});
    const accounts={
      async reserve(username,nickname){return rpc('medzo_password_reserve',{p_username:username,p_name:nickname});},
      async complete(reservation,identity){
        if(!reservation||!identity||identity.email!==reservation.email)throw Error('identity_mismatch');
        const ok=await rpc('medzo_password_complete',{p_reservation:reservation.reservation,p_provider_id:identity.id});
        if(ok!==true)throw Error('reservation_not_pending');
      },
      async find(username){
        const rows=await request('medzo_password_accounts?username=eq.'+encodeURIComponent(username)+'&state=eq.active&select=provider_id,account_id,internal_email');
        if(!Array.isArray(rows))throw Error('database_unavailable');
        return rows.length?{id:rows[0].provider_id,accountId:rows[0].account_id,email:rows[0].internal_email}:null;
      }
    };
    const limiter={async allow(action,username){return await rpc('medzo_password_allow',{p_action:action,p_username:username})===true;}};
    return {accounts,limiter};
  }
  const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MedzoCredentialsDatabase=api;
})(typeof window!=='undefined'?window:globalThis);
