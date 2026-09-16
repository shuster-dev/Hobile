// Offline shell. The game is one HTML file and one script, so caching is
// "keep the last build and serve it when the network is gone" — nothing
// cleverer is warranted, and anything cleverer would serve a stale build.
const VERSION = 'hobile-v1';
const SHELL = ['./', './index.html', './main.js', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (e) => {
  // Not addAll: it rejects the whole install if any one URL 404s, and which
  // files exist depends on which build was deployed. A missing extra must not
  // cost us the service worker.
  e.waitUntil(caches.open(VERSION)
    .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Network first: a cached build that never updates is worse than a slow one.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      // Falling back to the shell only makes sense for a navigation: hand an
      // HTML page to a request for a model and the loader chokes on it, where
      // a plain failure just leaves the procedural creature on screen.
      .catch(() => caches.match(e.request).then((hit) => hit
        || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
