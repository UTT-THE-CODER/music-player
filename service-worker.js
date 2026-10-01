const CACHE_NAME = 'echofree-app-shell-v6';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/styles.css?v=playlist-nav-1',
  './src/app.js?v=playlist-nav-1',
  './src/pwa.js',
  './src/audio/audioEngine.js',
  './src/audio/mediaSession.js',
  './src/library/library.js',
  './src/library/renderLibrary.js',
  './src/storage/libraryStorage.js?v=offline-1',
  './src/storage/database.js?v=offline-1',
  './src/storage/opfs.js',
  './src/ui/ui.js',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // User music stays in OPFS and must never be copied into Cache Storage.
  if (request.destination === 'audio') {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then(cached => {
        const network = fetch(request).catch(() => cached);
        const timeout = new Promise(resolve => setTimeout(() => resolve(cached), 2500));
        return Promise.race([network, timeout]).then(response => response || cached);
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (!response || response.status !== 200 || response.type !== 'basic') return response;
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      return response;
    }))
  );
});
