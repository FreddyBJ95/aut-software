const cachePrefix = 'inspection:' + self.registration.scope + ':';
const cacheName = cachePrefix + 'v13';
const assets = ['./', 'index.html', 'style.css', 'app.js', 'language.js', 'app.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(assets)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(cachePrefix) && key !== cacheName).map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(cacheName).then(async cache => (
    (await cache.match(event.request)) ||
    (event.request.mode === 'navigate' ? (await cache.match('./')) : null) ||
    fetch(event.request)
  )));
});
