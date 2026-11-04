// Service worker – offline režim. Vygenerovaný pri builde (vite.config.js), needitovať v public/.
// Pri inštalácii uloží všetky súbory aplikácie, takže po prvej návšteve fungujú všetky stroje aj bez internetu.
const CACHE = 'rmt-82329087e8ae';
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
  "/rmt-powermill-bridge.zip",
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
  "/assets/bender-DjpHXY-L.js",
  "/assets/benderMath-d1cNdKwu.js",
  "/assets/core3d-DaXZM6NJ.js",
  "/assets/cylgrind-AoRiBSeV.js",
  "/assets/drill-WMERfPtj.js",
  "/assets/folder-DRZXYHOR.js",
  "/assets/grinder-BJZ-8zib.js",
  "/assets/hermle-BJa9s_6I.css",
  "/assets/hermle-DAveBaD7.js",
  "/assets/hfMath-B0JgUNbA.js",
  "/assets/hob-D8ZvyM5U.js",
  "/assets/horiz-DltxrnMD.js",
  "/assets/index-BSSf7gDV.css",
  "/assets/index-_wZ47xH7.js",
  "/assets/lathe-4qA2rUfW.js",
  "/assets/machineWorkInspect-BELew1mZ.js",
  "/assets/mill-CTW3CUEt.js",
  "/assets/plate-gI_VeJxi.js",
  "/assets/press-CFvMpNq5.js",
  "/assets/radial-DApnenau.js",
  "/assets/saw-C4uVmtaL.js",
  "/assets/shaper-xmKhqAYt.js",
  "/assets/shaperMath-BfNySK0Q.js",
  "/assets/share-tech-mono-latin-400-normal-CCqdbj5z.woff2",
  "/assets/shear-BROwhTHD.js",
  "/assets/shopMath-B3CAL8Sc.js",
  "/assets/sketch-qfoAPBYX.js",
  "/assets/slotter-CAvH_QgX.js",
  "/assets/src-BxCSWZs8.js",
  "/assets/tools-D_gha4vu.js",
  "/assets/weld-hfhMA_2L.js"
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
