const scope = new URL(self.registration.scope);
const cachePrefix = `interlock-test-simulator:${scope.href}:`;
const cacheName = `${cachePrefix}v6`;
const legacyCache = /^interlock-v[1-5]$/;
const indexUrl = new URL('index.html', scope);
const assets = [
  'index.html',
  'styles.css?v=5',
  'app.js?v=6',
  'core.js',
  'i18n.js',
  'project.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];
const assetUrls = new Set(assets.map(path => new URL(path, scope).href));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    // Precache a fresh, complete release before the previous worker can retire.
    const requests = [...assetUrls].map(url => new Request(url, { cache: 'reload' }));
    await cache.addAll(requests);
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const outdated = keys.filter(key =>
      key !== cacheName && (key.startsWith(cachePrefix) || legacyCache.test(key))
    );
    await Promise.all(outdated.map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;

  const isAppEntry = request.mode === 'navigate' &&
    (url.pathname === scope.pathname || url.pathname === indexUrl.pathname);
  if (!isAppEntry && !assetUrls.has(url.href)) return;

  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(isAppEntry ? indexUrl.href : request);
    return cached || fetch(request);
  })());
});
