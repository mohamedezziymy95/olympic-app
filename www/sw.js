const CACHE_NAME = 'olympiad-club-v1';
const SHELL = [
  './', './index.html', './styles.css', './app.js', './manifest.webmanifest', './assets/club-logo.png', './assets/club-mark.svg', './data/content.json',
  './files/club-library/optics.pdf', './files/club-library/SIunits.pdf', './files/club-library/DCelectricity.pdf',
  './files/club-library/electrostatics.pdf', './files/club-library/equilibre-static.pdf', './files/club-library/gravitation.pdf',
  './files/club-library/mesures.pdf'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('olympiad-club-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const isRemoteContent = url.hostname === 'raw.githubusercontent.com' && /\/data\/(content|updates)\.json$/.test(url.pathname);
  const isRemoteAsset = url.hostname === 'raw.githubusercontent.com' && /\.(pdf|png|jpg|jpeg|webp)$/i.test(url.pathname);
  if (isRemoteContent || isRemoteAsset) {
    event.respondWith(fetch(request).then(response => {
      if (response.ok && response.type !== 'opaque') caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(async () => (await caches.match(request)) || Response.error()));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put('./index.html', response.clone()));
      return response;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(request).then(cached => {
    const update = fetch(request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(() => cached);
    return cached || update;
  }));
});
