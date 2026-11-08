// Service worker – offline režim. Vygenerovaný pri builde (vite.config.js), needitovať v public/.
// Pri inštalácii uloží všetky súbory aplikácie, takže po prvej návšteve fungujú všetky stroje aj bez internetu.
const CACHE = 'rmt-695006ea44d9';
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
  "/assets/bender-DLlYACOB.js",
  "/assets/benderMath-d1cNdKwu.js",
  "/assets/bystronic-B0iqMyG6.js",
  "/assets/bystronic-CNtSkLmt.css",
  "/assets/core3d-B9BU--T4.js",
  "/assets/cylgrind-nx6Rtbvq.js",
  "/assets/drill-DDkLWoFO.js",
  "/assets/folder-uKc2ZqM3.js",
  "/assets/grinder-CjWIBz3R.js",
  "/assets/hermle-CKtQMyTm.css",
  "/assets/hermle-ztvmZcak.js",
  "/assets/hfMath-B0JgUNbA.js",
  "/assets/hob-Bvccgu90.js",
  "/assets/horiz-6cgduziD.js",
  "/assets/index-BFgNrQmI.js",
  "/assets/index-Bk9O5q5G.css",
  "/assets/lathe-BqgHZyCN.js",
  "/assets/machineExport-B1LxTQxZ.js",
  "/assets/machineExport.worker-Csk2pWCh.js",
  "/assets/machineWorkInspect-PqdVk40z.js",
  "/assets/mill-CnKKe6KT.js",
  "/assets/modelKit-DSwhnhmE.css",
  "/assets/modelKit-dySQfiif.js",
  "/assets/oscar-D8sSGGSI.js",
  "/assets/plate-hw5TcjuG.js",
  "/assets/press-BO23Xs27.js",
  "/assets/profiles-C1MIL2jZ.js",
  "/assets/profiles-K4q7Vx22.css",
  "/assets/radial-mLwcRFc1.js",
  "/assets/roeders-DvGh-SZL.js",
  "/assets/saw-CPVTvPTS.js",
  "/assets/shaper-C8IrTAmu.js",
  "/assets/shaperMath-BfNySK0Q.js",
  "/assets/share-tech-mono-latin-400-normal-CCqdbj5z.woff2",
  "/assets/shear-DKpdLAqt.js",
  "/assets/shopMath-B3CAL8Sc.js",
  "/assets/shuangli-Dj6OEjB9.css",
  "/assets/shuangli-KmGPFN3y.js",
  "/assets/sketch-4lwW6eB1.js",
  "/assets/slotter-CQ9cbKzD.js",
  "/assets/src-B2Tu5CbP.js",
  "/assets/tools-ybyFBE7K.js",
  "/assets/voxel-BpIlcVgH.js",
  "/assets/weld-WvXJCbCt.js"
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
