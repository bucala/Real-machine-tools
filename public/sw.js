// Service worker – offline režim. Vygenerovaný pri builde (vite.config.js), needitovať v public/.
// Pri inštalácii uloží všetky súbory aplikácie, takže po prvej návšteve fungujú všetky stroje aj bez internetu.
const CACHE = 'rmt-ed0dadc69c33';
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
  "/assets/bender-H8hXmmKR.js",
  "/assets/benderMath-d1cNdKwu.js",
  "/assets/core3d-MPyVCCvB.js",
  "/assets/cylgrind-BiZrOTAC.js",
  "/assets/drill-C9bDZ9SW.js",
  "/assets/folder-BhRZ5n7x.js",
  "/assets/grinder-bF7a6_aK.js",
  "/assets/hermle-Bu-S_rjW.js",
  "/assets/hermle-CKtQMyTm.css",
  "/assets/hfMath-B0JgUNbA.js",
  "/assets/hob-UC-7Y0pi.js",
  "/assets/horiz-BNYMh_vG.js",
  "/assets/index-7AKMwR5z.css",
  "/assets/index-CaCEEJKF.js",
  "/assets/lathe-CtTedVYp.js",
  "/assets/machineExport-ChJpmGd0.js",
  "/assets/machineExport.worker-Csk2pWCh.js",
  "/assets/machineWorkInspect-u8CslQsl.js",
  "/assets/mill-h-AmOueq.js",
  "/assets/oscar-BYiFdxAj.js",
  "/assets/plate-D51JZ9yl.js",
  "/assets/press--pafs7at.js",
  "/assets/profiles-CYlnb0Ux.js",
  "/assets/profiles-K4q7Vx22.css",
  "/assets/radial-hWmLi5ct.js",
  "/assets/roeders-Br-eg5f4.js",
  "/assets/saw-CzPjURst.js",
  "/assets/shaper-DvhQItfb.js",
  "/assets/shaperMath-BfNySK0Q.js",
  "/assets/share-tech-mono-latin-400-normal-CCqdbj5z.woff2",
  "/assets/shear-BkijsaCO.js",
  "/assets/shopMath-B3CAL8Sc.js",
  "/assets/sketch-CIoFgN2S.js",
  "/assets/slotter-CoN39Kly.js",
  "/assets/src-Rp9phtVF.js",
  "/assets/tools-wOOfslza.js",
  "/assets/weld-1PbAd0xl.js"
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
