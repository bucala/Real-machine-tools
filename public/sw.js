// Service worker – offline režim. Vygenerovaný pri builde (vite.config.js), needitovať v public/.
// Pri inštalácii uloží všetky súbory aplikácie, takže po prvej návšteve fungujú všetky stroje aj bez internetu.
const CACHE = 'rmt-e17a29a39f6e';
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
  "/assets/bender-CBsQ5_UG.js",
  "/assets/benderMath-d1cNdKwu.js",
  "/assets/core3d-D7Gcjfiz.js",
  "/assets/cylgrind-6OtgqHDL.js",
  "/assets/drill-DOxgqLD2.js",
  "/assets/folder-D-xp9faF.js",
  "/assets/grinder-BoDxj_o7.js",
  "/assets/hermle-BUHijsM1.css",
  "/assets/hermle-CrrqSvlO.js",
  "/assets/hfMath-B0JgUNbA.js",
  "/assets/hob-CuxXp3Bs.js",
  "/assets/horiz-B5tpuqvH.js",
  "/assets/index-BnNjx62_.css",
  "/assets/index-Dn7BrpsF.js",
  "/assets/lathe-DN-D2F_F.js",
  "/assets/machineWorkInspect-DTCz4jdV.js",
  "/assets/mill-1xRAA3NW.js",
  "/assets/plate-C2iIsgPz.js",
  "/assets/press-Bc8lRjY5.js",
  "/assets/radial-DxzY1xQO.js",
  "/assets/saw-CsBVTOpN.js",
  "/assets/shaper-BHAOwro9.js",
  "/assets/shaperMath-BfNySK0Q.js",
  "/assets/share-tech-mono-latin-400-normal-CCqdbj5z.woff2",
  "/assets/shear-ClkWH7UB.js",
  "/assets/shopMath-B3CAL8Sc.js",
  "/assets/sketch-DaI008Lf.js",
  "/assets/slotter-CSsb8Im4.js",
  "/assets/src-BFDAoaxe.js",
  "/assets/tools-Dt4SHJKx.js",
  "/assets/weld-ozyoySfJ.js"
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
