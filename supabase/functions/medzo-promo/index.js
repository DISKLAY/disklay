/* Secret promo verification only; appearances remain on the device. */
const SITE='https://disklay.github.io';
function equal(a,b) { if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0; }
function createHandler(env) { return async req=>{
  const origin=req.headers.get('origin');
  const cors=origin===SITE?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}:{};
  const respond=(status,body)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
  if(req.method==='OPTIONS')return origin===SITE?new Response(null,{status:204,headers:cors}):respond(403,{error:'forbidden'});
  if(req.method!=='POST'||(origin&&origin!==SITE))return respond(403,{error:'forbidden'});
  const secret=env.get('MEDZO_PRIVATE_PROMO')||'';
  const future=env.get('MEDZO_FUTURE_PROMO')||'';
  const validLegacy=/^[A-Z2-7]{5}(?:-[A-Z2-7]{5}){3}$/.test(secret);
  const validFuture=/^[A-Z2-9]{5}(?:-[A-Z2-9]{5}){3}$/.test(future);
  if(!validLegacy&&!validFuture)return respond(503,{error:'unavailable'});
  try {
    if(Number(req.headers.get('content-length')||0)>1024)return respond(413,{error:'too_large'});
    const raw=await req.text();if(raw.length>1024)return respond(413,{error:'too_large'});
    const data=JSON.parse(raw||'{}');
    const code=typeof data.code==='string'?data.code.trim().toUpperCase():'';
    if(validFuture && equal(code,future))return respond(200,{reward:'all-appearances-future'});
    if(validLegacy && equal(code,secret))return respond(200,{reward:'all-appearances'});
    return respond(404,{error:'not_found'});
  } catch (_) { return respond(400,{error:'invalid_request'}); }
};}
if(typeof Deno!=='undefined')Deno.serve(createHandler(Deno.env));
if(typeof module!=='undefined'&&module.exports)module.exports={createHandler};
