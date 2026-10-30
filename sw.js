/* Mr Butler's CTF service worker — makes the installed app work offline.
   Stale-while-revalidate: serve fast from cache, refresh in the background. */
var CACHE = 'mbctf-v3';
var CORE = [
  './', 'index.html', 'teacher.html', 'manifest.webmanifest',
  'assets/css/style.css',
  'assets/js/challenges.js', 'assets/js/hashes.js', 'assets/js/content.js',
  'assets/js/app.js', 'assets/js/features.js', 'assets/js/event.js',
  'assets/js/tools.js', 'assets/js/test.js', 'assets/js/welcome.js', 'assets/js/pwa.js', 'assets/js/splash.js',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/apple-touch-icon.png',
  'assets/icons/maskable-192.png', 'assets/icons/maskable-512.png',
  'assets/fonts/lemonmilk-regular.woff', 'assets/fonts/lemonmilk-medium.woff', 'assets/fonts/lemonmilk-bold.woff', 'assets/fonts/lemonmilk-light.woff'
].map(function (p) { return new URL(p, self.location).toString(); });

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE).catch(function () { }); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req).then(function (cached) {
        var network = fetch(req).then(function (res) {
          if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone());
          return res;
        }).catch(function () {
          // offline: for a page navigation, fall back to the app shell
          if (req.mode === 'navigate') return cache.match(new URL('index.html', self.location).toString());
          return cached;
        });
        return cached || network;
      });
    })
  );
});
