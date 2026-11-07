/* Server-only Supabase Auth adapter. No HTTP endpoint calls this yet.
 * An atomic server-side username mapping and rate limiter are prerequisites.
 */
(function(root){
  'use strict';
  function create({base,serviceKey,fetchFn=fetch,randomUUID=()=>crypto.randomUUID()}){
    if(!base||!serviceKey||typeof fetchFn!=='function')throw Error('missing_provider_configuration');
    async function request(path,body){
      const response=await fetchFn(base.replace(/\/$/,'')+'/auth/v1/'+path,{
        method:'POST',headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},body:JSON.stringify(body)
      });
      let data;try{data=await response.json();}catch(_){throw Error('provider_unavailable');}
      return {ok:response.ok,status:response.status,data};
    }
    return {
      async create({password,nickname}){
        // The address is a random internal identifier, not a deliverable email.
        // No username or personal data is used as the address.
        const email=randomUUID()+'@accounts.medzo.invalid';
        const result=await request('admin/users',{email,password,email_confirm:true,user_metadata:{display_name:nickname}});
        if(!result.ok||typeof result.data.id!=='string')throw Error('provider_unavailable');
        return {id:result.data.id,email};
      },
      async authenticate(account,password){
        // Nonexistent names still perform a provider request to reduce timing leaks.
        const email=account?.email||'unknown-account@accounts.medzo.invalid';
        const result=await request('token?grant_type=password',{email,password});
        if(!result.ok){if(result.status===400||result.status===401)return {ok:false};throw Error('provider_unavailable');}
        if(!account||result.data?.user?.id!==account.id)return {ok:false};
        // Provider tokens remain server-side: the caller must issue a Medzo session.
        return {ok:true,identity:{id:account.id}};
      }
    };
  }
  const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MedzoGoTrue=api;
})(typeof window!=='undefined'?window:globalThis);
