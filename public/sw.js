// Service worker – offline režim. Vygenerovaný pri builde (vite.config.js), needitovať v public/.
// Pri inštalácii uloží všetky súbory aplikácie, takže po prvej návšteve fungujú všetky stroje aj bez internetu.
const CACHE = 'rmt-2de65634903d';
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
  "/assets/bender-Bo6NaJG3.js",
  "/assets/benderMath-d1cNdKwu.js",
  "/assets/core3d-CpYwH7Hl.js",
  "/assets/cylgrind-B9kj0GmH.js",
  "/assets/drill-euFlAxYS.js",
  "/assets/folder-DT5nlt04.js",
  "/assets/grinder-Cv1GDY_c.js",
  "/assets/hermle-CKtQMyTm.css",
  "/assets/hermle-CeoVWn5Q.js",
  "/assets/hfMath-B0JgUNbA.js",
  "/assets/hob-ZBTPpaZP.js",
  "/assets/horiz-DLgcPCw_.js",
  "/assets/index-DyIADZks.js",
  "/assets/index-hG2oWmGF.css",
  "/assets/lathe-e1xtsfw5.js",
  "/assets/machineWorkInspect-BSdBVMNX.js",
  "/assets/mill-B82yTuzw.js",
  "/assets/oscar-Mi9ydNT3.js",
  "/assets/plate-Dg3-3s0j.js",
  "/assets/press-Dmc8fxH2.js",
  "/assets/profiles-K4q7Vx22.css",
  "/assets/profiles-nQvphqVO.js",
  "/assets/radial-B1sy08SL.js",
  "/assets/roeders-CxxOzAXS.js",
  "/assets/saw-p91v2BfO.js",
  "/assets/shaper-TWDwql0D.js",
  "/assets/shaperMath-BfNySK0Q.js",
  "/assets/share-tech-mono-latin-400-normal-CCqdbj5z.woff2",
  "/assets/shear-JjMHa-vk.js",
  "/assets/shopMath-B3CAL8Sc.js",
  "/assets/sketch-iW5ZvC3J.js",
  "/assets/slotter-Dml1NmXg.js",
  "/assets/src-B4wH5sZ0.js",
  "/assets/tools-aKTAtTf0.js",
  "/assets/weld-CXIta7JC.js"
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
