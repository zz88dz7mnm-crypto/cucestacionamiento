const CACHE = 'cuc-local-v1';
const ARCHIVOS = [
  './styles.css',
  './logo.png',
  './favicon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ARCHIVOS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const noCache = [
    '/admin.html',
    '/index.html',
  '/app.js',
  '/admin.js',
  '/db.js',
  '/supabase.min.js',
  '/xlsx.bundle.js',
  ].some(path => url.pathname.endsWith(path));

  if (e.request.method !== 'GET' || noCache) {
    e.respondWith(fetch(e.request));
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
