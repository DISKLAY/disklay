/* Preserve Telegram launch parameters before our hash router can replace them. */
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
})();
