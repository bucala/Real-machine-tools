// Service worker – offline režim. Vygenerovaný pri builde (vite.config.js), needitovať v public/.
// Pri inštalácii uloží všetky súbory aplikácie, takže po prvej návšteve fungujú všetky stroje aj bez internetu.
const CACHE = 'rmt-aa0cf08911f5';
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
  "/assets/bender-DikXxyIb.js",
  "/assets/benderMath-d1cNdKwu.js",
  "/assets/core3d-ClYShsSf.js",
  "/assets/cylgrind-_BuNR-eH.js",
  "/assets/drill-BCXwQxT5.js",
  "/assets/folder-CRcAub7F.js",
  "/assets/grinder-CblrVu1C.js",
  "/assets/hermle-AsVct04e.js",
  "/assets/hermle-CKtQMyTm.css",
  "/assets/hfMath-B0JgUNbA.js",
  "/assets/hob-ChnGcgb5.js",
  "/assets/horiz-j4acNnW7.js",
  "/assets/index-B-mWLnuz.css",
  "/assets/index-DUHKLrDE.js",
  "/assets/lathe-C6puBold.js",
  "/assets/machineWorkInspect-CT2twjkn.js",
  "/assets/mill-BLfSjN-F.js",
  "/assets/oscar-DDMBL-hO.js",
  "/assets/plate-cK82a_hM.js",
  "/assets/press-w3MT2XQR.js",
  "/assets/profiles-DnlPG5IV.js",
  "/assets/profiles-K4q7Vx22.css",
  "/assets/radial-DW_W6TxH.js",
  "/assets/roeders-CBihpD9l.js",
  "/assets/saw-DBLsCn5X.js",
  "/assets/shaper-Bi9VPP6J.js",
  "/assets/shaperMath-BfNySK0Q.js",
  "/assets/share-tech-mono-latin-400-normal-CCqdbj5z.woff2",
  "/assets/shear-C33uOQVH.js",
  "/assets/shopMath-B3CAL8Sc.js",
  "/assets/sketch-LJ8F5Pt2.js",
  "/assets/slotter-PbYF703_.js",
  "/assets/src-D1_nnZek.js",
  "/assets/tools-J8njjRlW.js",
  "/assets/weld-BkdfUsQ-.js"
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
