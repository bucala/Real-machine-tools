// Service worker – offline režim. Vygenerovaný pri builde (vite.config.js), needitovať v public/.
// Pri inštalácii uloží všetky súbory aplikácie, takže po prvej návšteve fungujú všetky stroje aj bez internetu.
const CACHE = 'rmt-982a0bbd4e2e';
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
  "/assets/bender-L0j_p472.js",
  "/assets/benderMath-d1cNdKwu.js",
  "/assets/bystronic-BIS6fnfP.js",
  "/assets/bystronic-CNtSkLmt.css",
  "/assets/core3d-DCypvv5B.js",
  "/assets/cylgrind-B3Ml9S3T.js",
  "/assets/drill-CBV8QZnx.js",
  "/assets/folder-DH1NwLkU.js",
  "/assets/grinder-BfgD23fu.js",
  "/assets/hermle-CKtQMyTm.css",
  "/assets/hermle-CwjcOcTP.js",
  "/assets/hfMath-B0JgUNbA.js",
  "/assets/hob-ByipECbb.js",
  "/assets/horiz-DgVweW-Q.js",
  "/assets/index--pgiPfqs.js",
  "/assets/index-DRfFxF9o.css",
  "/assets/lathe-C4PTfRIe.js",
  "/assets/machineExport-BsgiT0mR.js",
  "/assets/machineExport.worker-Csk2pWCh.js",
  "/assets/machineWorkInspect-Br8joBvS.js",
  "/assets/mill-d5nKuuWq.js",
  "/assets/modelKit-BhGJ9vb7.js",
  "/assets/modelKit-jwf0YOT2.css",
  "/assets/oscar-nK9gg08d.js",
  "/assets/plate-BOp4kDAS.js",
  "/assets/press-kgMC5eBA.js",
  "/assets/profiles-BhgMnwEs.js",
  "/assets/profiles-K4q7Vx22.css",
  "/assets/radial-CEEI-uFn.js",
  "/assets/roeders-3ruPPNxo.js",
  "/assets/saw-ZqQ5ug8k.js",
  "/assets/shaper-BXLiI6SE.js",
  "/assets/shaperMath-BfNySK0Q.js",
  "/assets/share-tech-mono-latin-400-normal-CCqdbj5z.woff2",
  "/assets/shear-BwatcpR9.js",
  "/assets/shopMath-B3CAL8Sc.js",
  "/assets/shuangli-CL-ij7IQ.js",
  "/assets/shuangli-Dj6OEjB9.css",
  "/assets/sketch-BtoJDCWk.js",
  "/assets/slotter-BMPSe1be.js",
  "/assets/src-DnJgGXgt.js",
  "/assets/tools-BBELVjYk.js",
  "/assets/voxel-BpIlcVgH.js",
  "/assets/weld-BNEUCymc.js"
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
