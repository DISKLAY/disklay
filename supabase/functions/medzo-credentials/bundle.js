/* Standalone Supabase Edge Function. No secret is sent to clients or written to logs. */
const ISSUER='https://oauth.telegram.org';
const SITE='https://disklay.github.io';
const enc=new TextEncoder();
const b64u=bytes=>btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const unb64=s=>{if(!/^[A-Za-z0-9_-]+$/.test(s))throw new Error('encoding');return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));};
const utf8=bytes=>new TextDecoder().decode(bytes);
const parse=s=>JSON.parse(utf8(unb64(s)));
const hmac=async(key,msg)=>new Uint8Array(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',typeof key==='string'?enc.encode(key):key,{name:'HMAC',hash:'SHA-256'},false,['sign']),enc.encode(msg)));
function equal(a,b){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a[i]^b[i];return x===0;}
async function signObject(payload,key){const data=b64u(enc.encode(JSON.stringify(payload)));return data+'.'+b64u(await hmac(key,data));}
async function verifyObject(token,key,kind,now){
  if(typeof token!=='string'||token.length>4096)throw new Error('token');
  const parts=token.split('.');if(parts.length!==2||!equal(await hmac(key,parts[0]),unb64(parts[1])))throw new Error('signature');
  const data=parse(parts[0]);if(data.kind!==kind||!Number.isSafeInteger(data.exp)||data.exp<now||data.exp>now+(kind==='challenge'?180:(data.sid?90*86400:28800)))throw new Error('expired');return data;
}
function userId(value){const id=String(value);if(!/^[1-9][0-9]{0,19}$/.test(id))throw new Error('user');return id;}
async function verifyInitData(init,botToken,now){
  if(typeof init!=='string'||init.length>12000)throw new Error('data');
  const params=new URLSearchParams(init),entries=[...params];if(new Set(entries.map(x=>x[0])).size!==entries.length)throw new Error('duplicate');
  const hash=params.get('hash');if(!hash||!/^[a-f0-9]{64}$/i.test(hash))throw new Error('hash');
  const check=entries.filter(([key])=>key!=='hash').sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+'='+v).join('\n');
  const secret=await hmac('WebAppData',botToken),received=Uint8Array.from(hash.match(/../g),x=>parseInt(x,16));
  if(!equal(await hmac(secret,check),received))throw new Error('signature');
  const date=Number(params.get('auth_date'));if(!Number.isSafeInteger(date)||date>now+30||now-date>3600)throw new Error('expired');
  return userId(JSON.parse(params.get('user')||'{}').id);
}
async function verifyOidc(token,nonce,botId,fetchFn,now){
  if(typeof token!=='string'||token.length>12000)throw new Error('token');const p=token.split('.');if(p.length!==3)throw new Error('token');
  const header=parse(p[0]),claims=parse(p[1]);if(header.alg!=='RS256'||typeof header.kid!=='string')throw new Error('algorithm');
  if(claims.iss!==ISSUER||!(claims.aud===botId||(Array.isArray(claims.aud)&&claims.aud.includes(botId)))||!Number.isSafeInteger(claims.exp)||claims.exp<now||!Number.isSafeInteger(claims.iat)||claims.iat>now+30||now-claims.iat>300||claims.nonce!==nonce)throw new Error('claims');
  const response=await fetchFn(ISSUER+'/.well-known/jwks.json');if(!response.ok)throw new Error('jwks');const jwks=await response.json();
  const jwk=(jwks.keys||[]).find(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.alg||k.alg==='RS256'));if(!jwk)throw new Error('jwks');
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,unb64(p[2]),enc.encode(p[0]+'.'+p[1])))throw new Error('signature');
  // Telegram OIDC's sub is opaque and need not equal the numeric profile id.
  // Require profile scope so website and Mini App map to the same Telegram user id.
  if(typeof claims.sub!=='string'||!claims.sub||claims.id==null)throw new Error('subject');return userId(claims.id);
}
// Only JPEG image bytes can be saved. Clients re-encode into a small image,
// dropping EXIF; the server still limits and validates the untrusted payload.
function validPhoto(value){
  if(typeof value!=='string'||value.length<16||value.length>90000||value.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))return false;
  try {const data=atob(value);return data.length<=65536 && data.charCodeAt(0)===255 && data.charCodeAt(1)===216 && data.charCodeAt(2)===255 && data.charCodeAt(data.length-2)===255 && data.charCodeAt(data.length-1)===217;}catch(_){return false;}
}
const moduleIds=['1','2','3','4','5','6','7','credit-1','credit-2','stom-2','stom-3'];
const anatomyFields=['key','keyMeta','progress','favorites','comments','sessions','seen'];
const allowed=Object.fromEntries(moduleIds.map(id=>[id==='1'?'anatomy-colloquium-v1':'anatomy-colloquium-v1-'+id,anatomyFields]).concat(Object.entries({'histology-prototype-v1':['stats','favorites','imageStats'],'histology-structures-v1':['stats'],'histology-theory-v1':['stats'],'anatomy-practical-skills-1-v1':['favorites','stats','notes']})));
const rewardFields=['coins','rating','verified','achievements','cosmeticSpentApplied','appearanceReceipts','inventory'];
const legacyBoosts=['hint-train','hint-exam','double-train','double-exam'];
const sharedKey='anatomy-colloquium-rewards-shared-v1',sharedFields=['achievements','appearances','cosmeticSpent','walletSpent','appearance'];
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const anatomyKeys=moduleIds.map(id=>id==='1'?'anatomy-colloquium-v1':'anatomy-colloquium-v1-'+id);
function validSnapshot(x){
  if(!object(x)||(x.schema!==1&&x.schema!==2)||!object(x.records)||Object.keys(x).some(k=>k!=='schema'&&k!=='records'))return false;
  return Object.entries(x.records).every(([k,v])=>{
    if(!object(v))return false;
    if(k===sharedKey)return x.schema===2&&Object.keys(v).every(f=>sharedFields.includes(f));
    if(!Object.hasOwn(allowed,k))return false;
    return Object.keys(v).every(f=>{
      if(allowed[k].includes(f))return true;
      if(f!=='game'||x.schema!==2||!anatomyKeys.includes(k)||!object(v.game))return false;
      return Object.keys(v.game).every(g=>rewardFields.includes(g)&&(g!=='inventory'||(object(v.game.inventory)&&Object.keys(v.game.inventory).every(i=>legacyBoosts.includes(i)))));
    });
  });
}


/*
 * Credential service core, deliberately not an HTTP handler or deployed function.
 * The adapter must reserve usernames atomically, store passwords through a vetted
 * authentication provider, and enforce rate limits using a trusted client identity.
 * Linking Telegram, issuing Medzo sessions and password recovery are separate work.
 */
(function (root) {
  'use strict';
  const encoder=new TextEncoder();
  function username(input) {
    if(typeof input!=='string')return null;
    const value=input.trim().toLowerCase();
    return /^[a-z0-9_]{4,32}$/.test(value)?value:null;
  }
  function nickname(input) {
    if(typeof input!=='string')return null;
    const value=input.trim().normalize('NFC');
    return value.length>=1 && value.length<=48 && !/[\u0000-\u001f\u007f]/.test(value)?value:null;
  }
  function password(input) {
    if(typeof input!=='string')return false;
    const length=encoder.encode(input).length;
    return Array.from(input).length>=10 && length<=72;
  }
  function create({accounts,provider,limiter}) {
    if(!accounts||!provider||!limiter||typeof limiter.allow!=='function')throw new Error('missing_adapters');
    async function register(input,context) {
      const login=username(input?.username),name=nickname(input?.nickname),secret=input?.password;
      if(!login||!name||!password(secret))return {ok:false,error:'invalid_input'};
      try {if(!await limiter.allow('register',login,context))return {ok:false,error:'rate_limited'};} catch (_) {return {ok:false,error:'unavailable'};}
      // reserve() must atomically prevent both concurrent and pre-existing names.
      let reservation;try {reservation=await accounts.reserve(login,name);} catch (_) {return {ok:false,error:'unavailable'};}
      if(!reservation)return {ok:false,error:'username_taken'};
      let identity=null;
      try {
        // The provider is responsible for secure password storage and a random,
        // non-deliverable internal identifier; never use a real person's email.
        identity=await provider.create({password:secret,nickname:name,email:reservation.email});
        if(!identity||typeof identity.id!=='string'||!identity.id)throw new Error('invalid_identity');
        await accounts.complete(reservation,identity,name);
        return {ok:true};
      } catch (error) {
        // A definitive provider rejection cannot have created an identity.
        // Ambiguous timeouts remain reserved to avoid deleting a real account.
        if(!identity&&error?.definitive===true&&typeof accounts.release==='function'){
          try{await accounts.release(reservation);}catch(_){}
        }
        // A provider/database timeout can occur after the operation committed.
        // Retain the reservation and identity for explicit reconciliation;
        // deleting either here could destroy a successfully-created account.
        return {ok:false,error:'unavailable'};
      }
    }
    async function login(input,context) {
      const login=username(input?.username),secret=input?.password;
      if(!login||typeof secret!=='string'||encoder.encode(secret).length>72)return {ok:false,error:'invalid_credentials'};
      try {if(!await limiter.allow('login',login,context))return {ok:false,error:'rate_limited'};} catch (_) {return {ok:false,error:'unavailable'};}
      try {
        const account=await accounts.find(login);
        // The provider must perform a comparable dummy verification for unknown
        // users rather than short-circuiting. It decides whether login succeeded.
        const result=await provider.authenticate(account||null,secret);
        if(!account||!result||!result.ok||!result.identity||result.identity.id!==account.id)return {ok:false,error:'invalid_credentials'};
        return {ok:true,identity:{id:account.id,accountId:account.accountId}};
      } catch (_) {return {ok:false,error:'unavailable'};}
    }
    return {register,login};
  }
  const api={username,nickname,password,create};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MedzoCredentialsCore=api;
})(typeof window!=='undefined'?window:globalThis);

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
      async release(reservation){if(!reservation||typeof reservation.reservation!=='string')throw Error('invalid_reservation');return rpc('medzo_password_release',{p_reservation:reservation.reservation});},
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
      async create({password,nickname,email:reservedEmail}){
        // The address is a random internal identifier, not a deliverable email.
        // No username or personal data is used as the address.
        const email=reservedEmail||randomUUID()+'@accounts.medzo.invalid';
        if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@accounts\.medzo\.invalid$/.test(email)&&reservedEmail)throw Error('invalid_internal_email');
        const result=await request('admin/users',{email,password,email_confirm:true,user_metadata:{display_name:nickname}});
        if(!result.ok){const e=Error('provider_unavailable');e.definitive=[400,422].includes(result.status);throw e;}
        if(typeof result.data.id!=='string')throw Error('provider_unavailable');
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

Deno.serve(MedzoPasswordEndpoint.create({Core:MedzoCredentialsCore,Database:MedzoCredentialsDatabase,GoTrue:MedzoGoTrue,PasswordSession:MedzoPasswordSession,CredentialHandler:MedzoCredentialsHandler,Sync:{hmac,signObject,verifyObject,validPhoto,validSnapshot}},Deno.env));
