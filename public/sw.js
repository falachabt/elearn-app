/* Service worker de la PWA Elearn Prépa : démarrage à froid sans internet.
 *
 * - Coquille (page, manifeste, icônes) mise en cache à l'installation.
 * - Fichiers statiques de l'app (JS, CSS, polices, images sous /_expo, /assets et à la racine) : cache d'abord, remplis au
 *   premier passage. Leurs noms portent un hash : une nouvelle version de l'app = de nouveaux fichiers.
 * - Pages (navigation) : réseau d'abord, la page en cache sinon, pour que les mises à jour passent et que l'app s'ouvre hors ligne.
 * - Tout le reste (API Supabase, autres domaines, requêtes qui écrivent) : jamais intercepté, donc réseau d'abord par nature.
 * Pour forcer le renouvellement de la coquille, changer VERSION : l'ancien cache est supprimé à l'activation.
 */
var VERSION = 'v1';
var CACHE = 'elearn-coquille-' + VERSION;
var COQUILLE = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/favicon-32.png'];

function estStatique(url) {
  return /^\/(_expo|assets)\//.test(url.pathname) || /\.(?:js|css|woff2?|ttf|png|jpe?g|svg|ico|webp|json)$/.test(url.pathname);
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // Une icône manquante ne doit pas empêcher l'installation : chaque fichier est ajouté séparément.
      return Promise.all(COQUILLE.map(function (u) { return cache.add(u).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (noms) {
      return Promise.all(noms.filter(function (n) { return n.indexOf('elearn-coquille-') === 0 && n !== CACHE; }).map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function reseauPuisCache(requete, secours) {
  return fetch(requete).then(function (reponse) {
    if (reponse && reponse.ok) {
      var copie = reponse.clone();
      caches.open(CACHE).then(function (c) { return c.put(secours, copie); });
    }
    return reponse;
  }).catch(function () {
    return caches.match(secours);
  });
}

function cacheDAbord(requete) {
  return caches.match(requete).then(function (trouve) {
    if (trouve) return trouve;
    return fetch(requete).then(function (reponse) {
      if (reponse && reponse.ok) {
        var copie = reponse.clone();
        caches.open(CACHE).then(function (c) { return c.put(requete, copie); });
      }
      return reponse;
    });
  });
}

self.addEventListener('fetch', function (event) {
  var requete = event.request;
  if (requete.method !== 'GET') return;
  var url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/sw.js') return;
  if (requete.mode === 'navigate') {
    // Toutes les routes de l'app servent la même page : « / » sert de secours et de copie.
    event.respondWith(reseauPuisCache(requete, '/'));
    return;
  }
  if (estStatique(url)) event.respondWith(cacheDAbord(requete));
});
