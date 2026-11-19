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

const VERSION = 'goat-v2';
const SHELL = ['./', './manifest.webmanifest', './icon.svg', './icon-maskable.svg'];

// Fichiers construits (JS, CSS) cités par la page : mis en cache dès l'installation.
// Sans cela, la première visite n'en garde aucun et la page reste blanche hors ligne.
async function precacherActifs(cache) {
  const page = await cache.match('./');
  if (!page) return;
  const html = await page.text();
  const actifs = [...new Set([...html.matchAll(/(?:src|href)="(\.?\/?assets\/[^"]+)"/g)].map((m) => m[1]))];
  await Promise.all(actifs.map((a) => cache.add(a).catch(() => undefined)));
  // Morceaux chargés à la demande (écrans « lazy ») : listés par Vite dans __vite__mapDeps du script principal.
  for (const a of actifs.filter((x) => x.endsWith('.js'))) {
    const script = await cache.match(a);
    if (!script) continue;
    const js = await script.text();
    const debut = js.indexOf('__vite__mapDeps');
    const liste = debut < 0 ? null : js.slice(debut).match(/\[([^\]]*)\]/);
    if (!liste) continue;
    const base = new URL(a, self.location.href);
    const morceaux = [...liste[1].matchAll(/"([^"]+\.(?:js|css))"/g)].map((m) => new URL(m[1], base).href);
    await Promise.all(morceaux.map((m) => cache.add(m).catch(() => undefined)));
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL).then(() => precacherActifs(cache)).catch(() => undefined))
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
  url.pathname.includes('/data/') || url.pathname.endsWith('.json');

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/')) return;

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
        .catch(() => caches.match(request).then((cached) => cached || caches.match('./'))),
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
