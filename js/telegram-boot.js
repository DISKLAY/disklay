/* Preserve Telegram launch parameters before our hash router can replace them.
   Also capture Telegram Login redirect result (#tgAuthResult) which is lost
   if the router treats it as a page route. */
(function () {
  'use strict';
  const params={};
  [location.search,location.hash].forEach(part=>{
    const raw=part.slice(1);
    for(const [key,value] of new URLSearchParams(raw)) if(/^tgWebApp/.test(key)) params[key]=value;
  });
  const hasParams=o=>!!o&&(o.tgWebAppData!=null||o.tgWebAppPlatform!=null||o.tgWebAppVersion!=null);
  let active=hasParams(params)||!!window.TelegramWebviewProxy, saved=false;
  try {
    const old=JSON.parse(sessionStorage.getItem('__telegram__initParams')||'{}');
    if(hasParams(params)) { sessionStorage.setItem('__telegram__initParams',JSON.stringify({...old,...params})); saved=true; }
    else if(hasParams(old))active=true;
  } catch (_) { /* Telegram SDK can still read the current launch URL. */ }
  window.MedzoTelegramLaunch=active;
  // Only replace a pure launch hash, never a normal app route.
  if(saved && /^#tgWebApp/.test(location.hash))history.replaceState(null,'',location.pathname+location.search);

  // --- Telegram Login redirect handling (popup blocked -> full page redirect) ---
  // Telegram's oauth returns "#tgAuthResult=<base64url-json>" at the site origin.
  // Our hash router would treat it as "#/tgAuthResult=..." and render "not found".
  // Capture it early, persist in sessionStorage, and clean the URL before app.js
  // parses the hash. study-sync.js will pick it up and complete the login.
  function extractAuthResult(){
    let found=null;
    const candidates=[location.search, location.hash, location.href.includes('#')? '#'+location.href.split('#').slice(1).join('#') : ''];
    for(const part of candidates){
      if(!part) continue;
      const qIdx=part.indexOf('?');
      const hIdx=part.indexOf('#');
      const searchLike = qIdx>=0 ? part.slice(qIdx) : '';
      const hashLike = hIdx>=0 ? part.slice(hIdx) : part;
      for(const src of [searchLike, hashLike, part]){
        try{
          const sp=new URLSearchParams(src.startsWith('?')||src.startsWith('#') ? src.slice(1) : src);
          if(sp.has('tgAuthResult')){ found=sp.get('tgAuthResult'); break; }
          // telegram-login.js sometimes writes tgAuthResult as raw hash without "?" prefix
          if(src.includes('tgAuthResult=')){
            const m=src.match(/tgAuthResult=([^&#]+)/);
            if(m) { found=decodeURIComponent(m[1]); break; }
          }
        }catch(_){}
      }
      if(found) break;
    }
    return found;
  }
  let authResult=extractAuthResult();
  // Also restore previous attempt that was not yet consumed (e.g. auto-reload after redirect)
  try {
    if(!authResult) authResult=sessionStorage.getItem('__telegram__authResult');
    else if(authResult) sessionStorage.setItem('__telegram__authResult', authResult);
  } catch (_) {}
  window.MedzoTelegramAuthResult=authResult || null;
  window.MedzoTelegramAuthResultRaw=authResult;
  if(authResult){
    // Clean URL: remove tgAuthResult from both search and hash, keep the rest (e.g. "#/profile" should stay)
    try{
      const url=new URL(location.href);
      let cleanedHash=url.hash;
      // Remove tgAuthResult param from hash fragment
      if(cleanedHash.includes('tgAuthResult')){
        // hash may be "#tgAuthResult=..." or "#/profile?tgAuthResult=..." or "#tgAuthResult=...&..."
        // Parse as URLSearchParams after removing leading "#"
        const raw=cleanedHash.slice(1);
        // If hash is a route like "#/profile", it contains "/", preserve route part
        // Split route vs query: "#/path?query"
        const qPos=raw.indexOf('?');
        if(qPos>=0){
          const path=raw.slice(0,qPos);
          const qs=raw.slice(qPos+1);
          const sp=new URLSearchParams(qs);
          sp.delete('tgAuthResult'); sp.delete('tgAuthResultHash');
          const rest=sp.toString();
          cleanedHash = rest ? '#'+path+'?'+rest : '#'+path;
          if(cleanedHash==='#/') cleanedHash='';
          if(cleanedHash==='#') cleanedHash='';
        } else {
          // Pure "#tgAuthResult=..." or "#tgAuthResult=...&other"
          const sp=new URLSearchParams(raw);
          if(sp.has('tgAuthResult')){
            sp.delete('tgAuthResult'); sp.delete('tgAuthResultHash');
            const rest=sp.toString();
            cleanedHash = rest ? '#'+rest : '';
          } else {
            // fallback regex
            cleanedHash=cleanedHash.replace(/[#&]?tgAuthResult=[^&#]*/g,'').replace(/[#&]?tgAuthResultHash=[^&#]*/g,'');
            if(cleanedHash==='#' || cleanedHash==='') cleanedHash='';
          }
        }
      }
      // Also clean search string
      let cleanedSearch=url.search;
      if(cleanedSearch.includes('tgAuthResult')){
        const sp=new URLSearchParams(cleanedSearch.slice(1));
        sp.delete('tgAuthResult'); sp.delete('tgAuthResultHash');
        const rest=sp.toString();
        cleanedSearch = rest ? '?'+rest : '';
      }
      const newUrl=url.pathname + cleanedSearch + cleanedHash;
      if(newUrl !== url.pathname + url.search + url.hash){
        history.replaceState(null,'', newUrl || (url.pathname + url.search));
      }
    }catch(_){ /* keep original URL on failure */ }
  }
})();
