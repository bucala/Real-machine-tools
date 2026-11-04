// Service worker – offline režim. Vygenerovaný pri builde (vite.config.js), needitovať v public/.
// Pri inštalácii uloží všetky súbory aplikácie, takže po prvej návšteve fungujú všetky stroje aj bez internetu.
const CACHE = 'rmt-6ea7af1a26c4';
const PRECACHE = [
  "/",
  "/apple-touch-icon.png",
  "/boot.css",
  "/boot.js",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/manifest.webmanifest",
  "/assets/barlow-condensed-latin-600-normal-DepVgxBB.woff2",
  "/assets/barlow-condensed-latin-700-normal-v1xN8_Wq.woff2",
  "/assets/barlow-condensed-latin-ext-600-normal-18ESti3H.woff2",
  "/assets/barlow-condensed-latin-ext-700-normal-CwuXbfVR.woff2",
  "/assets/barlow-latin-400-normal-qiz4-Cze.woff2",
  "/assets/barlow-latin-500-normal-BPAOfeC8.woff2",
  "/assets/barlow-latin-600-normal-DILqtrty.woff2",
  "/assets/barlow-latin-700-normal-A9pxMQ4z.woff2",
  "/assets/barlow-latin-ext-400-normal-HxX4XjxC.woff2",
  "/assets/barlow-latin-ext-500-normal-DOaysfXq.woff2",
  "/assets/barlow-latin-ext-600-normal-B8NK_A3D.woff2",
  "/assets/barlow-latin-ext-700-normal-BLuWmldJ.woff2",
  "/assets/bender-Hp4xAyfY.js",
  "/assets/benderMath-d1cNdKwu.js",
  "/assets/core3d-DaXZM6NJ.js",
  "/assets/cylgrind-Ci_XivAw.js",
  "/assets/drill-B0QxzLU6.js",
  "/assets/folder-OhGhX-NX.js",
  "/assets/grinder-cBCArjTx.js",
  "/assets/hermle-15xcuA56.js",
  "/assets/hfMath-B0JgUNbA.js",
  "/assets/hob-CzPN2WDZ.js",
  "/assets/horiz-DtZJ0S6-.js",
  "/assets/index-BqhjI5NM.css",
  "/assets/index-CrwQ3Aex.js",
  "/assets/lathe-BcX8Qv8O.js",
  "/assets/machineWorkInspect-CyOJcd-J.js",
  "/assets/mill-DCCRndBQ.js",
  "/assets/plate-BcjjKpaA.js",
  "/assets/press-DZzopEkY.js",
  "/assets/radial-BWc8TOWF.js",
  "/assets/saw-KSqNtGKQ.js",
  "/assets/shaper-B1zYkguU.js",
  "/assets/shaperMath-BfNySK0Q.js",
  "/assets/share-tech-mono-latin-400-normal-CCqdbj5z.woff2",
  "/assets/shear-CSUOBin5.js",
  "/assets/shopMath-B3CAL8Sc.js",
  "/assets/sketch-CvKDSnri.js",
  "/assets/slotter-BWUuUw-t.js",
  "/assets/src-BxCSWZs8.js",
  "/assets/tools-DT_v3rdK.js",
  "/assets/weld-BFRGNBS1.js"
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('rmt-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // stránka: najprv sieť (nová verzia po nasadení), bez siete uložená kópia
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req)
      .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('/', copy)); } return res; })
      .catch(() => caches.match('/')));
    return;
  }
  // ostatné súbory: z vyrovnávacej pamäte, inak zo siete (a hashované súbory sa uložia)
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok && url.pathname.startsWith('/assets/')) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});
