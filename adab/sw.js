// Service worker: keeps every file of the app on the phone, so the app opens and reads offline. The literature itself
// is in the phone's IndexedDB (js/data/db.js); requests to Supabase always go to the network and are never cached here.
//
// TO PUBLISH A CHANGE: raise VERSION (keep it equal to VERSION in js/config.js). Phones then fetch the new files in the
// background and use them from the next start. Every file of the app must be in FILES (web/tests checks it).

const VERSION = '1.0.0';
const CACHE = `adab-${VERSION}`;

const FILES = [
  './',
  'index.html',
  'app.css',
  'manifest.webmanifest',
  'assets/audio/intro.m4a',
  'assets/fonts/OFL.txt',
  'assets/fonts/naskh-bold.woff2',
  'assets/fonts/naskh-regular.woff2',
  'assets/img/apple-touch-icon.png',
  'assets/img/favicon-64.png',
  'assets/img/icon-192.png',
  'assets/img/icon-512.png',
  'assets/img/icon-small.png',
  'assets/img/rubab.webp',
  'js/config.js',
  'js/core/alphabet.js',
  'js/core/content.js',
  'js/core/search.js',
  'js/core/sharecard.js',
  'js/core/stanzas.js',
  'js/core/validator.js',
  'js/data/api.js',
  'js/data/db.js',
  'js/data/store.js',
  'js/main.js',
  'js/strings.js',
  'js/ui/dom.js',
  'js/ui/intro.js',
  'js/ui/nav.js',
  'js/ui/rubab.js',
  'js/ui/screens/favorites.js',
  'js/ui/screens/forms.js',
  'js/ui/screens/home.js',
  'js/ui/screens/notifications.js',
  'js/ui/screens/read.js',
  'js/ui/screens/settings.js',
  'js/ui/share.js',
  'js/ui/theme.js',
  'js/ui/widgets.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache: 'reload' skips the browser's HTTP cache, so a new version never stores an old file.
    await cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('adab-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase: always the network
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Opening the app (any address of it) always gets the cached start page.
    const key = request.mode === 'navigate' ? 'index.html' : request;
    const hit = await cache.match(key, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(request);
    } catch (e) {
      if (request.mode === 'navigate') return (await cache.match('./')) || Response.error();
      return Response.error();
    }
  })());
});
