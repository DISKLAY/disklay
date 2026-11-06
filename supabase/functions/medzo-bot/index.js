/* Telegram webhook and explicit, service-role-only installation. */
const WELCOME = `Привет! Это Medzo — бесплатный помощник для подготовки по анатомии и гистологии. 🩺

Мы создали Medzo, чтобы повторять учебный материал было удобнее: в своём темпе, на сайте или прямо в Telegram. Сервис абсолютно бесплатный.

Здесь можно:
• решать тесты и повторять ошибки;
• изучать препараты и структуры в атласе гистологии;
• тренировать практические навыки по анатомии;
• сохранять избранное и заметки, следить за учебным прогрессом.

Чтобы начать, нажмите «Открыть Medzo» под этим сообщением или кнопку меню бота. Выберите предмет и раздел.

Для синхронизации учебных данных откройте «Настройки → Синхронизация учёбы» и войдите в один и тот же Telegram-аккаунт на устройствах. При разных версиях данных приложение попросит выбрать нужную. Игра, кошелёк и оформления не синхронизируются.

Материалы помогают учиться, но не заменяют проверку по учебникам и указания преподавателей. По вопросам: @D1sklay.`;
const SITE='https://disklay.github.io/disklay/';
const enc=new TextEncoder();
async function webhookSecret(bot) {
  const key=await crypto.subtle.importKey('raw',enc.encode(bot),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode('medzo-bot/webhook-secret/v1')));
  return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
}
function equal(a,b) { if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0; }
function createHandler(env,fetchFn=fetch) { return async request=>{
  const respond=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  if(request.method!=='POST')return respond(405,{error:'method'});
  const bot=env.get('TELEGRAM_BOT_TOKEN')||'',service=env.get('SUPABASE_SERVICE_ROLE_KEY')||'',base=env.get('SUPABASE_URL')||'';
  if(!bot||!service||!base)return respond(503,{error:'not_configured'});
  async function telegram(method,data) {const r=await fetchFn('https://api.telegram.org/bot'+bot+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(!r.ok)throw Error('telegram');const result=await r.json();if(!result.ok)throw Error('telegram');return result.result;}
  try {
    if(Number(request.headers.get('content-length')||0)>65536)return respond(413,{error:'too_large'});
    const raw=await request.text();if(raw.length>65536)return respond(413,{error:'too_large'});
    const data=JSON.parse(raw||'{}');
    if(data.action==='install') {
      if(!equal(request.headers.get('authorization')||'','Bearer '+service))return respond(401,{error:'unauthorized'});
      const url=base+'/functions/v1/medzo-bot',current=await telegram('getWebhookInfo',{});
      if(current.url && current.url!==url)return respond(409,{error:'existing_webhook'});
      await telegram('setWebhook',{url,secret_token:await webhookSecret(bot),allowed_updates:['message'],drop_pending_updates:false});
      return respond(200,{ok:true});
    }
    if(!equal(request.headers.get('x-telegram-bot-api-secret-token')||'',await webhookSecret(bot)))return respond(401,{error:'unauthorized'});
    const message=data.message;
    if(message && message.chat && message.chat.type==='private' && Number.isSafeInteger(message.chat.id) && typeof message.text==='string' && /^\/(?:start|help)(?:@[A-Za-z0-9_]+)?(?:\s|$)/i.test(message.text)) {
      await telegram('sendMessage',{chat_id:message.chat.id,text:WELCOME,reply_markup:{inline_keyboard:[[{text:'Открыть Medzo',web_app:{url:SITE}}]]}});
    }
    return respond(200,{ok:true});
  } catch (_) {return respond(502,{error:'request_failed'});}
};}
if(typeof Deno!=='undefined')Deno.serve(createHandler(Deno.env));
if(typeof module!=='undefined'&&module.exports)module.exports={createHandler,webhookSecret,WELCOME};
