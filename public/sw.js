/*
 * Goat Chèvre The King — service worker.
 *
 * Objectif : le pâturage reste jouable hors-ligne après la première visite.
 *  - navigations et données JSON : réseau d'abord, cache en repli (les
 *    classements et les bases de joueurs restent frais) ;
 *  - assets construits (JS, CSS, polices, images) : cache d'abord, mise à jour
 *    silencieuse en arrière-plan.
 * Aucune requête d'API communautaire n'est mise en cache.
 */

const VERSION = 'goat-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-maskable.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const isDataRequest = (url) =>
  url.pathname.startsWith('/data/') || url.pathname.endsWith('.json');

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  const networkFirst = request.mode === 'navigate' || isDataRequest(url);

  if (networkFirst) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/'))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
