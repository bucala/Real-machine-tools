// Service worker – offline režim. Vygenerovaný pri builde (vite.config.js), needitovať v public/.
// Pri inštalácii uloží všetky súbory aplikácie, takže po prvej návšteve fungujú všetky stroje aj bez internetu.
const CACHE = 'rmt-478da70c3fbc';
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
  "/assets/bender-BRF28hIS.js",
  "/assets/benderMath-d1cNdKwu.js",
  "/assets/core3d-MPyVCCvB.js",
  "/assets/cylgrind-CPGh7NrT.js",
  "/assets/drill-CACF51SE.js",
  "/assets/folder-mjdyOZO8.js",
  "/assets/grinder-BbOsHvnT.js",
  "/assets/hermle-Bo_gT8Hb.js",
  "/assets/hermle-CKtQMyTm.css",
  "/assets/hfMath-B0JgUNbA.js",
  "/assets/hob-Bs4FsCfu.js",
  "/assets/horiz-BR_n7BB-.js",
  "/assets/index-CSQo4scE.css",
  "/assets/index-DUphA_Iw.js",
  "/assets/lathe-BotN3Zbr.js",
  "/assets/machineExport-ChJpmGd0.js",
  "/assets/machineExport.worker-Csk2pWCh.js",
  "/assets/machineWorkInspect-CXWbNR4x.js",
  "/assets/mill-BhfhCcH3.js",
  "/assets/modelKit-8emGHhHt.js",
  "/assets/oscar-CQp6xc0j.js",
  "/assets/plate-BpgiuFWa.js",
  "/assets/press-C1r76glJ.js",
  "/assets/profiles-C1WcqJbL.js",
  "/assets/profiles-K4q7Vx22.css",
  "/assets/radial-DQdHbhPA.js",
  "/assets/roeders-3U6Jbmyf.js",
  "/assets/saw-uifl3Bsi.js",
  "/assets/shaper-DhrQogeg.js",
  "/assets/shaperMath-BfNySK0Q.js",
  "/assets/share-tech-mono-latin-400-normal-CCqdbj5z.woff2",
  "/assets/shear-uSv-BAHw.js",
  "/assets/shopMath-B3CAL8Sc.js",
  "/assets/shuangli-BfqPLKUv.js",
  "/assets/shuangli-Dj6OEjB9.css",
  "/assets/sketch-DxuqY7n-.js",
  "/assets/slotter-I9HRc80U.js",
  "/assets/src-Rp9phtVF.js",
  "/assets/tools-Cvqgxwwl.js",
  "/assets/weld-CYc1Q2QP.js"
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
