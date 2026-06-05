// =====================================================
//  ZenBreath — Service Worker (PWA / Mode hors-ligne)
// =====================================================

const CACHE_NAME = 'zenbreath-v1';

// Fichiers à mettre en cache lors de l'installation
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './assets/sounds/vagues.mp3',
  './assets/sounds/oiseaux.mp3',
  './assets/sounds/foret-ambiance.mp3',
  './assets/sounds/musique.mp3',
  './assets/icon-192.png',
  './assets/icon-512.png',
];

// Installation : mise en cache des ressources statiques
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // On essaie de mettre en cache les assets textuels (HTML/CSS/JS)
      // Les vidéos sont volontairement exclues (trop lourdes pour le cache)
      return cache.addAll([
        './',
        './index.html',
        './style.css',
        './script.js',
        './manifest.json',
      ]).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activation : supprime les anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch : stratégie Cache First (ressources statiques) / Network First (reste)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Pour les vidéos : toujours depuis le réseau (trop lourdes à cacher)
  if (url.pathname.endsWith('.mp4')) {
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Pour tout le reste : cache en priorité, réseau en fallback
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Met en cache la nouvelle ressource pour les prochaines visites
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached || new Response('Hors ligne', { status: 503 }));
    })
  );
});
