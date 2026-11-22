/* Telegram webhook and explicit, temporary-secret installation. */
const WELCOME = `🩺 <b>Medzo</b> — бесплатный помощник для подготовки по анатомии и гистологии.

Всё в одном месте: тренировка по ключу, теория, атлас, отзывы о преподавателях и статистика. Сервис полностью бесплатный, без подписок и рекламы.

<b>Анатомия · 11 баз вопросов</b>
• <b>Тренировка</b> по темам: мгновенная проверка по ключу, работа над ошибками, статистика.
• <b>Пробный экзамен</b> первого коллоквиума — 20 вопросов за 20 минут.
• <b>Теория</b> первого коллоквиума: 72 темы, поиск по тексту, страницы оригинала.
• <b>Практические навыки</b> — 330 пунктов с подсказками и самооценкой.
• <b>Отзывы о преподавателях</b> — 783 отзыва по 33 дисциплинам, дословно из таблицы студентов.

<b>Гистология</b>
• <b>Препараты</b>: тренажёр на 73 позиции и 201 изображение, выбор или ввод названия.
• <b>Атлас</b>: 12 тематических разделов, теория и снимки с разбором.
• <b>Структуры</b>: 545 заданий на снимках — найти метку или назвать структуру.
• <b>Тесты по теории</b>: 226 вопросов с объяснениями.

<b>Везде</b>
• Избранное и личные заметки к вопросам.
• Ошибки и статистика отдельно по каждой базе.
• Свой ключ ответов: правки, импорт и экспорт.
• Награды и оформления за учёбу.
• Офлайн: сайт устанавливается на телефон как приложение.

<b>Синхронизация</b>
Меню → Профиль → вход через Telegram. Прогресс, заметки, кошелёк, награды и оформления переходят между устройствами. Настройки и незавершённые тренировки остаются на устройстве. Если данные расходятся, приложение предложит выбрать версию.

<b>С чего начать</b>
Нажмите «Открыть Medzo» и выберите предмет в меню. Быстрый переход — кнопками ниже.

Материалы помогают учиться, но не заменяют учебники и требования преподавателей. Вопросы и идеи: @D1sklay.`;
const SITE='https://disklay.github.io/disklay/';
// Кнопки ведут прямо в разделы: hash-роутер приложения понимает #/route.
const KEYBOARD=[
  [{text:'Открыть Medzo',web_app:{url:SITE}}],
  [{text:'Тренировка',web_app:{url:SITE+'#/tests'}},{text:'Гистология',web_app:{url:SITE+'#/histology'}}],
  [{text:'Отзывы о преподавателях',web_app:{url:SITE+'#/teachers'}}]
];
const enc=new TextEncoder();
async function webhookSecret(bot) {
  const key=await crypto.subtle.importKey('raw',enc.encode(bot),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode('medzo-bot/webhook-secret/v1')));
  return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
}
function equal(a,b) { if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0; }
function createHandler(env,fetchFn=fetch) { return async request=>{
  const origin=request.headers.get('origin');
  const cors=origin==='https://supabase.com'?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, content-type, apikey, x-client-info, x-medzo-install-key','Vary':'Origin'}:{};
  const respond=(status,body)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
  if(request.method==='OPTIONS')return origin==='https://supabase.com'?new Response(null,{status:204,headers:cors}):respond(403,{error:'forbidden'});
  if(request.method!=='POST')return respond(405,{error:'method'});
  const bot=env.get('TELEGRAM_BOT_TOKEN')||'',service=env.get('SUPABASE_SERVICE_ROLE_KEY')||'',base=env.get('SUPABASE_URL')||'';
  if(!bot||!service||!base)return respond(503,{error:'not_configured'});
  async function telegram(method,data) {const r=await fetchFn('https://api.telegram.org/bot'+bot+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(!r.ok)throw Error('telegram');const result=await r.json();if(!result.ok)throw Error('telegram');return result.result;}
  try {
    if(Number(request.headers.get('content-length')||0)>65536)return respond(413,{error:'too_large'});
    const raw=await request.text();if(raw.length>65536)return respond(413,{error:'too_large'});
    const data=JSON.parse(raw||'{}');
    if(data.action==='install') {
      const installKey=env.get('MEDZO_BOT_INSTALL_KEY')||'';
      if(installKey.length<32 || !equal(request.headers.get('x-medzo-install-key')||'',installKey))return respond(401,{error:'unauthorized'});
      const url=base+'/functions/v1/medzo-bot',current=await telegram('getWebhookInfo',{});
      if(current.url && current.url!==url)return respond(409,{error:'existing_webhook'});
      await telegram('setWebhook',{url,secret_token:await webhookSecret(bot),allowed_updates:['message'],drop_pending_updates:false});
      return respond(200,{ok:true});
    }
    if(!equal(request.headers.get('x-telegram-bot-api-secret-token')||'',await webhookSecret(bot)))return respond(401,{error:'unauthorized'});
    const message=data.message;
    if(message && message.chat && message.chat.type==='private' && Number.isSafeInteger(message.chat.id) && typeof message.text==='string' && /^\/(?:start|help)(?:@[A-Za-z0-9_]+)?(?:\s|$)/i.test(message.text)) {
      await telegram('sendMessage',{chat_id:message.chat.id,text:WELCOME,parse_mode:'HTML',link_preview_options:{is_disabled:true},reply_markup:{inline_keyboard:KEYBOARD}});
    }
    return respond(200,{ok:true});
  } catch (_) {return respond(502,{error:'request_failed'});}
};}
if(typeof Deno!=='undefined')Deno.serve(createHandler(Deno.env));
if(typeof module!=='undefined'&&module.exports)module.exports={createHandler,webhookSecret,WELCOME,KEYBOARD};
