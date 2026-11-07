/* Unpublished HTTP handler. Adapters, issuer and real DB session support are required. */
(function(root){
  'use strict';
  function create({service,issueSession,site='https://disklay.github.io'}){
    if(!service||typeof service.register!=='function'||typeof service.login!=='function'||typeof issueSession!=='function')throw Error('missing_adapters');
    return async function(req){
      const origin=req.headers.get('origin');
      const headers={'Content-Type':'application/json','Cache-Control':'no-store',...(origin===site?{'Access-Control-Allow-Origin':site,'Vary':'Origin','Access-Control-Allow-Headers':'content-type, authorization','Access-Control-Allow-Methods':'POST, OPTIONS'}:{})};
      const response=(status,body)=>new Response(JSON.stringify(body),{status,headers});
      if(req.method==='OPTIONS')return origin===site?new Response(null,{status:204,headers}):new Response(null,{status:403});
      if(req.method!=='POST'||(origin&&origin!==site))return response(403,{error:'forbidden'});
      if(Number(req.headers.get('content-length')||0)>2048)return response(413,{error:'too_large'});
      let body;
      try{
        const reader=req.body?.getReader(),chunks=[];let size=0;
        if(reader){for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();return response(413,{error:'too_large'});}chunks.push(value);}}
        const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
        body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
      }catch(_){return response(400,{error:'invalid_input'});}
      if(!body||typeof body!=='object'||Array.isArray(body)||!['register','login'].includes(body.action))return response(400,{error:'invalid_action'});
      try{
        if(body.action==='register'){
          const result=await service.register({username:body.username,nickname:body.nickname,password:body.password},{});
          if(result.ok)return response(200,{ok:true});
          return response(({invalid_input:400,username_taken:409,rate_limited:429,unavailable:503})[result.error]||503,{error:result.error});
        }
        const result=await service.login({username:body.username,password:body.password},{});
        if(!result.ok)return response(({invalid_credentials:401,rate_limited:429,unavailable:503})[result.error]||503,{error:result.error});
        const id=result.identity?.accountId;
        if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))throw Error('invalid_identity');
        const session=await issueSession('p_'+id);
        return response(200,session);
      }catch(_){return response(503,{error:'unavailable'});}
    };
  }
  const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MedzoCredentialsHandler=api;
})(typeof window!=='undefined'?window:globalThis);
