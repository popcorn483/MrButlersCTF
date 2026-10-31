/* Mr B's CTF Practice service worker — makes the installed app work offline.
   Stale-while-revalidate: serve fast from cache, refresh in the background.
   A new deploy = a new CACHE/VERSION; the new worker WAITS so the page can offer
   "Update now" (with patch notes), and activates when it receives SKIP_WAITING. */
var VERSION = 'mbctf-v8';
var CACHE = VERSION;
var CORE = [
  './', 'index.html', 'teacher.html', 'manifest.webmanifest',
  'assets/css/style.css',
  'assets/js/challenges.js', 'assets/js/hashes.js', 'assets/js/content.js',
  'assets/js/app.js', 'assets/js/features.js', 'assets/js/event.js',
  'assets/js/tools.js', 'assets/js/test.js', 'assets/js/welcome.js', 'assets/js/pwa.js', 'assets/js/splash.js', 'assets/js/update.js', 'assets/js/qrcode.js', 'assets/js/share.js',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/apple-touch-icon.png',
  'assets/icons/maskable-192.png', 'assets/icons/maskable-512.png',
  'assets/fonts/lemonmilk-regular.woff', 'assets/fonts/lemonmilk-medium.woff', 'assets/fonts/lemonmilk-bold.woff', 'assets/fonts/lemonmilk-light.woff',
  'assets/fonts/AtkinsonHyperlegible-Regular.woff2', 'assets/fonts/AtkinsonHyperlegible-Bold.woff2', 'assets/fonts/AtkinsonHyperlegible-Italic.woff2',
  'version.json'
].map(function (p) { return new URL(p, self.location).toString(); });

self.addEventListener('install', function (e) {
  // precache, but do NOT skipWaiting — the page offers the user an "Update now" prompt
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE).catch(function () { }); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('message', function (e) {
  var d = e.data || {};
  if (d.type === 'SKIP_WAITING') self.skipWaiting();
  if (d.type === 'VERSION' && e.source) e.source.postMessage({ type: 'VERSION', version: VERSION });
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // version.json network-first, so update checks see fresh patch notes
  if (/version\.json$/.test(new URL(req.url).pathname)) {
    e.respondWith(fetch(req).then(function (res) { var c = res.clone(); caches.open(CACHE).then(function (ch) { ch.put(req, c); }); return res; }).catch(function () { return caches.match(req); }));
    return;
  }
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
