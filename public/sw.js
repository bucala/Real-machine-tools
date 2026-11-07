// Service worker – offline režim. Vygenerovaný pri builde (vite.config.js), needitovať v public/.
// Pri inštalácii uloží všetky súbory aplikácie, takže po prvej návšteve fungujú všetky stroje aj bez internetu.
const CACHE = 'rmt-14a081833645';
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
  "/assets/bender-CpUc2tVj.js",
  "/assets/benderMath-d1cNdKwu.js",
  "/assets/core3d-MPyVCCvB.js",
  "/assets/cylgrind-Dt-CaHrn.js",
  "/assets/drill-CDakZby4.js",
  "/assets/folder-DCty9VhL.js",
  "/assets/grinder-BPI4fjKP.js",
  "/assets/hermle-CKtQMyTm.css",
  "/assets/hermle-W12vDp6J.js",
  "/assets/hfMath-B0JgUNbA.js",
  "/assets/hob-ghPsUSDo.js",
  "/assets/horiz-CIa5T4lO.js",
  "/assets/index-Bgvt3Ki3.css",
  "/assets/index-CPeXIMiN.js",
  "/assets/lathe-CEsvLzsJ.js",
  "/assets/machineExport-ChJpmGd0.js",
  "/assets/machineExport.worker-Csk2pWCh.js",
  "/assets/machineWorkInspect-BRYSMXHA.js",
  "/assets/mill-CiNIa8K8.js",
  "/assets/modelKit-8emGHhHt.js",
  "/assets/oscar-CIMdlOLR.js",
  "/assets/plate-dD2a67VE.js",
  "/assets/press-BM41XpaJ.js",
  "/assets/profiles-C1WcqJbL.js",
  "/assets/profiles-K4q7Vx22.css",
  "/assets/radial-yupD6Dee.js",
  "/assets/roeders-BbkeUhIK.js",
  "/assets/saw-DGYNn6LI.js",
  "/assets/shaper-DxXiZp92.js",
  "/assets/shaperMath-BfNySK0Q.js",
  "/assets/share-tech-mono-latin-400-normal-CCqdbj5z.woff2",
  "/assets/shear-_IukD_6N.js",
  "/assets/shopMath-B3CAL8Sc.js",
  "/assets/shuangli-Bwpe-2mi.js",
  "/assets/shuangli-Dj6OEjB9.css",
  "/assets/sketch-DIt4JoJy.js",
  "/assets/slotter-UqfwVaBb.js",
  "/assets/src-Rp9phtVF.js",
  "/assets/tools-BD9Uxfie.js",
  "/assets/weld-dCxxpyjz.js"
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
