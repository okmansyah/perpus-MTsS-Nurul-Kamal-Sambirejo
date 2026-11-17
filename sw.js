/* Service worker: website tetap bisa dibuka saat offline (network-first). */
const CACHE = 'perpus-web-v8';
const FILES = ["./", "index.html", "logo.png", "manifest.webmanifest", "script.js", "style.css", "vendor/JsBarcode.all.min.js", "vendor/chart.umd.min.js", "vendor/fa/css/all.min.css", "vendor/fa/webfonts/fa-brands-400.woff2", "vendor/fa/webfonts/fa-regular-400.woff2", "vendor/fa/webfonts/fa-solid-900.woff2", "vendor/fa/webfonts/fa-v4compatibility.woff2", "vendor/font/pjs-400.woff2", "vendor/font/pjs-500.woff2", "vendor/font/pjs-600.woff2", "vendor/font/pjs-700.woff2", "vendor/font/pjs-800.woff2", "vendor/qrcode.js", "vendor/zxing.min.js"];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
    const u = new URL(e.request.url);
    if (e.request.method !== 'GET' || u.origin !== location.origin) return;
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })
        .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
