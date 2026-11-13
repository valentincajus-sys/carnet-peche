/* Hors-ligne : réseau d'abord (pour avoir la dernière version), cache en secours au bord de l'eau. */
const CACHE = 'peche-v5';
const ASSETS = ['./', 'index.html', 'styles.css', 'app.js', 'data.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'vendor/sb-admin-2/sb-admin-2.min.css', 'vendor/fontawesome/css/all.min.css', 'vendor/fontawesome/webfonts/fa-solid-900.woff2',
  'vendor/jquery/jquery.min.js', 'vendor/datatables/jquery.dataTables.min.js', 'vendor/datatables/dataTables.bootstrap4.min.js',
  'vendor/datatables/dataTables.bootstrap4.min.css', 'vendor/chart.js/Chart.min.js',
  'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css', 'vendor/leaflet/leaflet.markercluster.js', 'vendor/leaflet/MarkerCluster.css', 'vendor/leaflet/leaflet-heat.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
