// Offline shell. The game is one HTML file and one script, so caching is
// "keep the last build and serve it when the network is gone" — nothing
// cleverer is warranted, and anything cleverer would serve a stale build.
const VERSION = 'hobile-v2';
// the hashed scripts are cached as they are fetched (network first, below)
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

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

// Notifications from the server (server/push.js): the training is done, a
// world boss is up. A tap opens the game (or brings it to the front).
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Hobile', body: e.data?.text?.() || '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Hobile', {
    body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag, icon: './icon.svg', badge: './icon.svg',
    lang: 'he', dir: 'rtl', data: { url: d.url || './' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url.startsWith(self.registration.scope) && 'focus' in c) return c.focus();
    return self.clients.openWindow(url);
  }));
});
