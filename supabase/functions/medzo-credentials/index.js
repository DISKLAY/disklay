/* Standalone entry point for password accounts. Build with build-credentials.cjs. */
(function(root){
'use strict';
function create({Core,Database,GoTrue,PasswordSession,CredentialHandler,Sync},env,fetchFn=fetch){
 return async function(req){
  const bot=env.get('TELEGRAM_BOT_TOKEN')||'',secret=env.get('SUPABASE_SERVICE_ROLE_KEY')||'',base=env.get('SUPABASE_URL')||'';
  if(!/^\d+:[^\s]+$/.test(bot)||!secret||!base)return new Response(JSON.stringify({error:'not_configured'}),{status:503,headers:{'Content-Type':'application/json'}});
  const signKey=await Sync.hmac(bot,'medzo-password-session/signing/v1');
  const db=async(path,opts={})=>{const res=await fetchFn(base+'/rest/v1/'+path,{...opts,headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json',...(opts.headers||{})}});if(!res.ok)throw Error('database');return res.json();};
  const {accounts,limiter}=Database.create({base,serviceKey:secret,fetchFn});
  const provider=GoTrue.create({base,serviceKey:secret,fetchFn});
  const service=Core.create({accounts,limiter,provider});
  const issueSession=PasswordSession.create({persist:async row=>{await db('medzo_study_sessions',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(row)});},sign:data=>Sync.signObject(data,signKey)});
  // Registration and login are unauthenticated; all other operations require a session.
  if(req.method==='OPTIONS')return CredentialHandler.create({service,issueSession})(req);
  const origin=req.headers.get('origin'),cors=origin==='https://disklay.github.io'?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'content-type, authorization','Access-Control-Allow-Methods':'POST, OPTIONS'}:{};
  const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
  if(req.method!=='POST'||(origin&&origin!=='https://disklay.github.io'))return reply(403,{error:'forbidden'});
  // Avoid consuming an unbounded body even when Content-Length is absent.
  let raw;try{const reader=req.body?.getReader(),chunks=[];let len=0;if(reader)for(;;){const {done,value}=await reader.read();if(done)break;len+=value.length;if(len>1100000){await reader.cancel();return reply(413,{error:'too_large'});}chunks.push(value);}const bytes=new Uint8Array(len);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch(_){return reply(400,{error:'invalid_input'});}
  let body;try{body=JSON.parse(raw);}catch(_){return reply(400,{error:'invalid_input'});}
  if(body&&['register','login'].includes(body.action)){
   if(new TextEncoder().encode(raw).length>2048)return reply(413,{error:'too_large'});
   return CredentialHandler.create({service,issueSession})(new Request(req.url,{method:'POST',headers:req.headers,body:raw}));
  }
  try{
   const bearer=req.headers.get('authorization')||'';if(!bearer.startsWith('Bearer '))return reply(401,{error:'unauthorized'});
   const session=await Sync.verifyObject(bearer.slice(7),signKey,'session',Math.floor(Date.now()/1000));
   const id=session.id;if(typeof id!=='string'||!/^p_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)||typeof session.sid!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(session.sid))throw Error('session');
   const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(session.sid));const hash=Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
   const sessionPath='medzo_study_sessions?session_hash=eq.'+hash+'&user_id=eq.'+encodeURIComponent(id);
   if(body.action==='logout'){await db(sessionPath,{method:'DELETE',headers:{Prefer:'return=representation'}});return reply(200,{ok:true});}
   const rows=await db(sessionPath+'&select=expires_at');if(!rows.length||Date.parse(rows[0].expires_at)<=Date.now())throw Error('session');
   const pathId=encodeURIComponent(id);
   if(body.action==='account-get'){const rows=await db('medzo_password_accounts?account_id=eq.'+encodeURIComponent(id.slice(2))+'&state=eq.active&select=username,display_name');if(rows.length!==1)throw Error('account');return reply(200,{username:rows[0].username,displayName:rows[0].display_name});}
   if(body.action==='get'){const r=await db('medzo_study_sync?user_id=eq.'+pathId+'&select=revision,snapshot,updated_at');return reply(200,r.length?{revision:r[0].revision,snapshot:r[0].snapshot,updatedAt:r[0].updated_at}:{revision:0,snapshot:{schema:1,records:{}}});}
   if(body.action==='put'){
    if(!Number.isSafeInteger(body.revision)||body.revision<0||!Sync.validSnapshot(body.snapshot)||new TextEncoder().encode(JSON.stringify(body.snapshot)).length>1040000)return reply(400,{error:'invalid_snapshot'});
    const result=await db('rpc/medzo_study_sync_put',{method:'POST',body:JSON.stringify({p_user_id:id,p_expected:body.revision,p_snapshot:body.snapshot})});return reply(result.conflict?409:200,result);
   }
   if(body.action==='photo-get'){const r=await db('medzo_profile_photos?user_id=eq.'+pathId+'&select=jpeg_base64');return reply(200,{photo:r.length?r[0].jpeg_base64:null});}
   if(body.action==='photo-put'){if(!Sync.validPhoto(body.photo))return reply(400,{error:'invalid_photo'});await db('medzo_profile_photos?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({user_id:id,jpeg_base64:body.photo,updated_at:new Date().toISOString()})});return reply(200,{ok:true});}
   if(body.action==='photo-delete'){await db('medzo_profile_photos?user_id=eq.'+pathId,{method:'DELETE',headers:{Prefer:'return=representation'}});return reply(200,{ok:true});}
   if(body.action==='leaderboard-get'){const leaders=await db('rpc/medzo_leaderboard_top',{method:'POST',body:'{}'}),own=await db('medzo_leaderboard_members?user_id=eq.'+pathId+'&select=display_name,show_photo');return reply(200,{leaders,member:own.length?{name:own[0].display_name,showPhoto:own[0].show_photo}:null});}
   if(body.action==='leaderboard-join'){if(typeof body.name!=='string'||typeof body.showPhoto!=='boolean')return reply(400,{error:'invalid_profile'});const name=body.name.trim().normalize('NFC');if(!name||name.length>48||/[\u0000-\u001f\u007f]/.test(name))return reply(400,{error:'invalid_profile'});await db('medzo_leaderboard_members?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({user_id:id,display_name:name,show_photo:body.showPhoto})});return reply(200,{ok:true});}
   if(body.action==='leaderboard-leave'){await db('medzo_leaderboard_members?user_id=eq.'+pathId,{method:'DELETE',headers:{Prefer:'return=representation'}});return reply(200,{ok:true});}
   return reply(400,{error:'invalid_action'});
  }catch(e){return e&&e.message==='database'?reply(503,{error:'unavailable'}):reply(401,{error:'request_failed'});}
 };
}
const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MedzoPasswordEndpoint=api;
})(typeof window!=='undefined'?window:globalThis);
