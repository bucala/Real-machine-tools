// Service worker – offline režim. Vygenerovaný pri builde (vite.config.js), needitovať v public/.
// Pri inštalácii uloží všetky súbory aplikácie, takže po prvej návšteve fungujú všetky stroje aj bez internetu.
const CACHE = 'rmt-658584f56773';
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
  "/assets/bender-B5Wxu5Cs.js",
  "/assets/benderMath-d1cNdKwu.js",
  "/assets/bystronic-CNtSkLmt.css",
  "/assets/bystronic-tih78Lrb.js",
  "/assets/core3d-MPyVCCvB.js",
  "/assets/cylgrind-Bl8uIK-l.js",
  "/assets/drill-C61WYAX4.js",
  "/assets/folder-BOkD93xm.js",
  "/assets/grinder-B9Q7qScO.js",
  "/assets/hermle-71NrEP1C.js",
  "/assets/hermle-CKtQMyTm.css",
  "/assets/hfMath-B0JgUNbA.js",
  "/assets/hob-C2EFxQ98.js",
  "/assets/horiz-CSU8Rpnz.js",
  "/assets/index-Bgvt3Ki3.css",
  "/assets/index-CJ1pFiMR.js",
  "/assets/lathe-DoMzVxZO.js",
  "/assets/machineExport-ChJpmGd0.js",
  "/assets/machineExport.worker-Csk2pWCh.js",
  "/assets/machineWorkInspect-CAdeNwOF.js",
  "/assets/mill-BZ9dgZ5E.js",
  "/assets/modelKit-coWjfya0.js",
  "/assets/oscar-C07b6fFc.js",
  "/assets/plate-ChieJSYG.js",
  "/assets/press-BtPrh1c7.js",
  "/assets/profiles-C1WcqJbL.js",
  "/assets/profiles-K4q7Vx22.css",
  "/assets/radial-DRMXZypE.js",
  "/assets/roeders-DBNT7Oht.js",
  "/assets/saw-DZ5I4q9K.js",
  "/assets/shaper-Dh-KmOhQ.js",
  "/assets/shaperMath-BfNySK0Q.js",
  "/assets/share-tech-mono-latin-400-normal-CCqdbj5z.woff2",
  "/assets/shear-P5aQA-wV.js",
  "/assets/shopMath-B3CAL8Sc.js",
  "/assets/shuangli-Dj6OEjB9.css",
  "/assets/shuangli-l02tdX4c.js",
  "/assets/sketch-8v3julEc.js",
  "/assets/slotter-Cb5lj8OH.js",
  "/assets/src-Rp9phtVF.js",
  "/assets/tools-CH-ogkIc.js",
  "/assets/voxel-BpIlcVgH.js",
  "/assets/weld-DPeYpD6o.js"
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
