/* Medzo — service worker: офлайн-оболочка + кэш посещённых ресурсов.
   Только same-origin GET; запросы к Supabase и Telegram всегда идут в сеть.
   Навигация — network-first (свежесть важнее), статика — stale-while-revalidate. */
const CACHE = 'medzo-pwa-20261128';

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/favicon.svg',
  './js/telegram-boot.js?v=20261116-pwa14',
  './js/bank-loader.js?v=20261116-pwa14',
  './js/offline-mode.js?v=20261116-pwa14',
  './js/modules.js?v=20261116-pwa14',
  './js/core.js?v=20261116-pwa14',
  './js/game.js?v=20261116-pwa14',
  './js/ui.js?v=20261116-pwa14',
  './js/germ-squad.js?v=20261116-pwa14',
  './js/views-study.js?v=20261116-pwa14',
  './js/study-snapshot.js?v=20261116-pwa14',
  './js/study-sync-engine.js?v=20261116-pwa14',
  './js/oral-snapshot.js?v=20261116-pwa14',
  './js/myology-snapshot.js?v=20261116-pwa14',
  './js/dev-config.js?v=20261116-pwa14',
  './js/profile-photo.js?v=20261116-pwa14',
  './js/study-sync.js?v=20261116-pwa14',
  './js/promo-codes.js?v=20261116-pwa14',
  './js/views-pages.js?v=20261116-pwa14',
  './js/views-rewards.js?v=20261116-pwa14',
  './js/course-drawer.js?v=20261116-pwa14',
  './js/colloquium-switch.js?v=20261116-pwa14',
  './js/teacher-reviews-data.js?v=20261116-pwa14',
  './js/teacher-reviews.js?v=20261116-pwa14',
  './js/views-teacher-reviews.js?v=20261116-pwa14',
  './js/views-dev.js?v=20261116-pwa14',
  './js/histology-editor.js?v=20261116-pwa14',
  './js/myology-data.js?v=20261116-pwa14',
  './js/myology-source.js?v=20261116-pwa14',
  './js/myology-skills.js?v=20261116-pwa14',
  './js/views-myology.js?v=20261116-pwa14',
  './js/views-anatomy-oral.js?v=20261116-pwa14',
  './js/views-anatomy-skills.js?v=20261116-pwa14',
  './js/views-theory.js?v=20261116-pwa14',
  './js/views-skills-hub.js?v=20261116-pwa14',
  './css/myology.css?v=20261116-pwa14',
  './css/teacher-reviews.css?v=20261116-pwa14',
  './css/anatomy-skills.css?v=20261116-pwa14',
  './css/anatomy-oral.css?v=20261116-pwa14',
  './js/app.js?v=20261116-pwa14',
  './js/onboarding.js?v=20261116-pwa14',
  './css/styles.css?v=20261116-pwa14',
  './js/data/questions.js?v=20261116-pwa14',
  './js/data/answers.js?v=20261116-pwa14',
  './js/data/exam.js?v=20261116-pwa14',
  './js/data/colloquium-2.js?v=20261116-pwa14',
  './js/data/colloquium-3.js?v=20261116-pwa14',
  './js/data/colloquium-4.js?v=20261116-pwa14',
  './js/data/colloquium-5.js?v=20261116-pwa14',
  './js/data/colloquium-6.js?v=20261116-pwa14',
  './js/data/colloquium-7.js?v=20261116-pwa14',
  './js/data/credit-1.js?v=20261116-pwa14',
  './js/data/credit-2.js?v=20261116-pwa14',
  './js/data/dental-2.js?v=20261116-pwa14',
  './js/data/dental-3.js?v=20261116-pwa14',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-192.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/medzo-mark-transparent.png?v=20261116-pwa14'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

function cacheable(response) {
  /* Кладём в кэш только полные ответы; 206 (Range, типично для PDF) не кэшируем,
     иначе полный запрос потом получит обрезанный ответ. */
  return response && response.status === 200;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        if (cacheable(fresh)) {
          const cache = await caches.open(CACHE);
          await cache.put('./index.html', fresh.clone());
        }
        return fresh;
      } catch (error) {
        const cached = (await caches.match('./index.html')) || (await caches.match('./'));
        if (cached) return cached;
        throw error;
      }
    })());
    return;
  }

  const refresh = fetch(request).then(async (response) => {
    if (cacheable(response) && !request.headers.has('range')) {
      try {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
      } catch (error) { /* кэш переполнен — не критично */ }
    }
    return response;
  }).catch(() => null);

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreVary: true });
    if (cached) {
      event.waitUntil(refresh);
      return cached;
    }
    const response = await refresh;
    if (response) return response;
    return new Response('Нет подключения — ресурс ещё не сохранён в кэше.', {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  })());
});
