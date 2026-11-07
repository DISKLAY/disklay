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

function createHandler(env,fetchFn=fetch){return async function(req){
  const origin=req.headers.get('origin');const cors=origin===SITE?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'content-type, authorization, apikey, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'}:{};
  const response=(status,body)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
  if(req.method==='OPTIONS')return origin===SITE?new Response(null,{status:204,headers:cors}):new Response(null,{status:403});
  if(req.method!=='POST'||(origin&&origin!==SITE))return response(403,{error:'forbidden'});
  const bot=env.get('TELEGRAM_BOT_TOKEN')||'',match=/^([1-9][0-9]{2,19}):[^\s]+$/.exec(bot);if(!match)return response(503,{error:'not_configured'});
  const secret=env.get('SUPABASE_SERVICE_ROLE_KEY')||'',base=env.get('SUPABASE_URL')||'';if(!secret||!base)return response(503,{error:'not_configured'});
  const signing=await hmac(bot,'medzo-study-sync/signing/v1'),now=Math.floor(Date.now()/1000);
  const db=async(path,options={})=>{const r=await fetchFn(base+'/rest/v1/'+path,{...options,headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json',...(options.headers||{})}});if(!r.ok)throw new Error('database');return r.json();};
  try{
    if(Number(req.headers.get('content-length')||0)>1100000)return response(413,{error:'too_large'});
    const raw=await req.text();if(raw.length>1100000)return response(413,{error:'too_large'});const body=JSON.parse(raw||'{}');
    if(body.action==='config')return response(200,{botId:match[1]});
    if(body.action==='challenge'){const random=crypto.getRandomValues(new Uint8Array(24));const nonce=await signObject({kind:'challenge',exp:now+120,random:b64u(random)},signing);return response(200,{nonce});}
    if(body.action==='login'){
      let id;
      if(body.initData)id=await verifyInitData(body.initData,bot,now);
      else{const challenge=await verifyObject(body.nonce,signing,'challenge',now);id=await verifyOidc(body.idToken,body.nonce,match[1],fetchFn,now);const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(body.nonce))),x=>x.toString(16).padStart(2,'0')).join('');const claimed=await db('rpc/medzo_study_claim_nonce',{method:'POST',body:JSON.stringify({p_hash:digest,p_expires:challenge.exp})});if(claimed!==true)throw new Error('nonce_used');}
      const sid=b64u(crypto.getRandomValues(new Uint8Array(32))),expiresAt=now+90*86400;
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(sid))),x=>x.toString(16).padStart(2,'0')).join('');
      await db('medzo_study_sessions',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({session_hash:hash,user_id:id,expires_at:new Date(expiresAt*1000).toISOString()})});
      return response(200,{session:await signObject({kind:'session',id,sid,exp:expiresAt},signing),userId:id,expiresAt});
    }
    const auth=req.headers.get('authorization')||'';if(!auth.startsWith('Bearer '))return response(401,{error:'unauthorized'});
    const session=await verifyObject(auth.slice(7),signing,'session',now);const id=userId(session.id);
    if(session.sid){
      if(typeof session.sid!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(session.sid))throw Error('session');
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(session.sid))),x=>x.toString(16).padStart(2,'0')).join('');
      const path='medzo_study_sessions?session_hash=eq.'+hash+'&user_id=eq.'+encodeURIComponent(id);
      if(body.action==='logout'){await db(path,{method:'DELETE',headers:{Prefer:'return=representation'}});return response(200,{ok:true});}
      const rows=await db(path+'&select=expires_at');
      if(!rows.length || Date.parse(rows[0].expires_at)<=Date.now())throw Error('revoked');
    } else if(body.action==='logout') return response(200,{ok:true});
    if(body.action==='photo-get'){
      const rows=await db('medzo_profile_photos?user_id=eq.'+encodeURIComponent(id)+'&select=jpeg_base64');
      return response(200,{photo:rows.length?rows[0].jpeg_base64:null});
    }
    if(body.action==='photo-put'){
      if(!validPhoto(body.photo))return response(400,{error:'invalid_photo'});
      await db('medzo_profile_photos?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({user_id:id,jpeg_base64:body.photo,updated_at:new Date().toISOString()})});
      return response(200,{ok:true});
    }
    if(body.action==='photo-delete'){
      await db('medzo_profile_photos?user_id=eq.'+encodeURIComponent(id),{method:'DELETE',headers:{Prefer:'return=representation'}});
      return response(200,{ok:true});
    }
    if(body.action==='get'){
      const rows=await db('medzo_study_sync?user_id=eq.'+encodeURIComponent(id)+'&select=revision,snapshot,updated_at');
      return response(200,rows.length?{revision:rows[0].revision,snapshot:rows[0].snapshot,updatedAt:rows[0].updated_at}:{revision:0,snapshot:{schema:1,records:{}}});
    }
    if(body.action==='put'){
      if(!Number.isSafeInteger(body.revision)||body.revision<0||!validSnapshot(body.snapshot)||new TextEncoder().encode(JSON.stringify(body.snapshot)).length>1040000)return response(400,{error:'invalid_snapshot'});
      const result=await db('rpc/medzo_study_sync_put',{method:'POST',body:JSON.stringify({p_user_id:id,p_expected:body.revision,p_snapshot:body.snapshot})});return response(result.conflict?409:200,result);
    }
    return response(400,{error:'invalid_action'});
  }catch(error){return error && error.message==='database'?response(503,{error:'unavailable'}):response(401,{error:'request_failed'});}
};}
if(typeof Deno!=='undefined')Deno.serve(createHandler(Deno.env));
if(typeof module!=='undefined'&&module.exports)module.exports={hmac,b64u,unb64,verifyInitData,verifyOidc,signObject,verifyObject,validSnapshot,validPhoto,createHandler};
