const CACHE = 'mis-finanzas-v4';
const ASSETS = [
  '/finanzas-personales/',
  '/finanzas-personales/index.html',
  '/finanzas-personales/manifest.json',
  '/finanzas-personales/icon-192.svg',
  '/finanzas-personales/icon-512.svg'
];

// Install: cache all static assets
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

// Activate: clean old caches (borra mis-finanzas-v1 y v2)
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for app shell, network-first for API calls
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Google Sheets API → always network, never cache
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('google.com')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response(
        JSON.stringify({ error: 'Sin conexión' }),
        { headers: { 'Content-Type': 'application/json' } }
      ))
    );
    return;
  }

  // App shell → cache first, fallback to network
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

// Background sync: flush offline queue when back online
self.addEventListener('sync', e => {
  if (e.tag === 'sync-transactions') {
    e.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ type: 'SYNC_NOW' }));
      })
    );
  }
});
