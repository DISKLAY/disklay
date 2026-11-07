/* Isolated oral self-ratings: old clients cannot read or overwrite these snapshots. */
const site='https://disklay.github.io',enc=new TextEncoder();
const unb64=s=>{if(!/^[A-Za-z0-9_-]+$/.test(s))throw Error('token');return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));};
async function hmac(key,msg){const k=await crypto.subtle.importKey('raw',typeof key==='string'?enc.encode(key):key,{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',k,enc.encode(msg)));}
function equal(a,b){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a[i]^b[i];return x===0;}
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const digits=(k,max)=>/^[1-9][0-9]*$/.test(k)&&Number(k)<=max;
function validSnapshot(x){
 if(!object(x)||x.schema!==1||!object(x.tickets)||!object(x.cards)||Object.keys(x).some(k=>!['schema','tickets','cards'].includes(k)))return false;
 const rating=v=>v==='known'||v==='again';
 if(!Object.entries(x.cards).every(([k,v])=>digits(k,72)&&rating(v)))return false;
 return Object.entries(x.tickets).every(([n,t])=>digits(n,35)&&object(t)&&Object.entries(t).every(([kind,group])=>['practical','theory'].includes(kind)&&object(group)&&Object.entries(group).every(([i,v])=>digits(i,kind==='practical'?10:3)&&rating(v))));
}
async function session(token,bot,now){
 if(typeof token!=='string'||token.length>4096)throw Error('session');const p=token.split('.');if(p.length!==2)throw Error('session');
 const data=JSON.parse(new TextDecoder().decode(unb64(p[0])));
 const isPassword=typeof data.id==='string'&&/^p_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(data.id);
 if(!isPassword&&!(typeof data.id==='string'&&/^[1-9][0-9]{0,19}$/.test(data.id)))throw Error('session');
 const key=await hmac(bot,isPassword?'medzo-password-session/signing/v1':'medzo-study-sync/signing/v1');
 if(!equal(await hmac(key,p[0]),unb64(p[1]))||data.kind!=='session'||!Number.isSafeInteger(data.exp)||data.exp<=now||data.exp>now+90*86400||typeof data.sid!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(data.sid))throw Error('session');
 return data;
}
function createHandler(env,fetchFn=fetch){return async req=>{
 const origin=req.headers.get('origin'),cors=origin===site?{'Access-Control-Allow-Origin':site,'Vary':'Origin','Access-Control-Allow-Headers':'content-type, authorization, apikey, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'}:{};
 const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(req.method==='OPTIONS')return origin===site?new Response(null,{status:204,headers:cors}):new Response(null,{status:403});
 if(req.method!=='POST'||(origin&&origin!==site))return reply(403,{error:'forbidden'});
 const bot=env.get('TELEGRAM_BOT_TOKEN')||'',key=env.get('SUPABASE_SERVICE_ROLE_KEY')||'',base=env.get('SUPABASE_URL')||'';
 if(!/^\d+:[^\s]+$/.test(bot)||!key||!base)return reply(503,{error:'not_configured'});
 const db=async(path,options={})=>{const r=await fetchFn(base+'/rest/v1/'+path,{...options,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',...(options.headers||{})}});if(!r.ok)throw Error('database');return r.json();};
 try{
  const reader=req.body?.getReader(),chunks=[];let size=0;if(reader)for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>50000){await reader.cancel();return reply(413,{error:'too_large'});}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  let body;try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch(_){return reply(400,{error:'invalid'});}
  if(!object(body)||!['get','put'].includes(body.action))return reply(400,{error:'invalid'});
  const auth=req.headers.get('authorization')||'';if(!auth.startsWith('Bearer '))return reply(401,{error:'unauthorized'});
  const user=await session(auth.slice(7),bot,Math.floor(Date.now()/1000));
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(user.sid))),x=>x.toString(16).padStart(2,'0')).join('');
  const rows=await db('medzo_study_sessions?session_hash=eq.'+digest+'&user_id=eq.'+encodeURIComponent(user.id)+'&select=expires_at');
  const expires=rows.length?Date.parse(rows[0].expires_at):NaN;if(!Number.isFinite(expires)||expires<=Date.now())throw Error('session');
  if(body.action==='get'){
    if(Object.keys(body).length!==1)return reply(400,{error:'invalid'});
    const entries=await db('medzo_oral_sync?user_id=eq.'+encodeURIComponent(user.id)+'&select=revision,snapshot,updated_at');
    return reply(200,entries.length?{revision:entries[0].revision,snapshot:entries[0].snapshot,updatedAt:entries[0].updated_at}:{revision:0,snapshot:{schema:1,tickets:{},cards:{}}});
  }
  if(Object.keys(body).sort().join(',')!=='action,revision,snapshot'||!Number.isSafeInteger(body.revision)||body.revision<0||!validSnapshot(body.snapshot))return reply(400,{error:'invalid'});
  const result=await db('rpc/medzo_oral_sync_put',{method:'POST',body:JSON.stringify({p_user_id:user.id,p_expected:body.revision,p_snapshot:body.snapshot})});return reply(result.conflict?409:200,result);
 }catch(e){return e&&e.message==='database'?reply(503,{error:'unavailable'}):reply(401,{error:'unauthorized'});}
};}
if(typeof Deno!=='undefined')Deno.serve(createHandler(Deno.env));
if(typeof module!=='undefined'&&module.exports)module.exports={validSnapshot,session,createHandler,hmac};
