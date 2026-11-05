// Service worker – offline režim. Vygenerovaný pri builde (vite.config.js), needitovať v public/.
// Pri inštalácii uloží všetky súbory aplikácie, takže po prvej návšteve fungujú všetky stroje aj bez internetu.
const CACHE = 'rmt-110a90be5857';
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
  "/assets/bender-D1WFFXS2.js",
  "/assets/benderMath-d1cNdKwu.js",
  "/assets/core3d-CpYwH7Hl.js",
  "/assets/cylgrind-CcufTqct.js",
  "/assets/drill-wyVeQNRL.js",
  "/assets/folder-BF9IpcHE.js",
  "/assets/grinder-BXXx4HJM.js",
  "/assets/hermle-CKtQMyTm.css",
  "/assets/hermle-Oz6V-hsj.js",
  "/assets/hfMath-B0JgUNbA.js",
  "/assets/hob-U2Xv6qNU.js",
  "/assets/horiz-DPHn-OUT.js",
  "/assets/index-CpQg6aC5.js",
  "/assets/index-Cxj8E2vL.css",
  "/assets/lathe-Cmjuxdpm.js",
  "/assets/machineWorkInspect-wllqPpzk.js",
  "/assets/mill-xI3wcmyc.js",
  "/assets/oscar-BPlm1JoB.js",
  "/assets/plate-DNxw1_yf.js",
  "/assets/press-FyQp-C_C.js",
  "/assets/profiles-K4q7Vx22.css",
  "/assets/profiles-nQvphqVO.js",
  "/assets/radial-qnRNGUpC.js",
  "/assets/roeders-DoLW6us8.js",
  "/assets/saw-CYgjNSgR.js",
  "/assets/shaper-Cx6wRtdB.js",
  "/assets/shaperMath-BfNySK0Q.js",
  "/assets/share-tech-mono-latin-400-normal-CCqdbj5z.woff2",
  "/assets/shear-BgeBp8Jz.js",
  "/assets/shopMath-B3CAL8Sc.js",
  "/assets/sketch-WbHy4iDs.js",
  "/assets/slotter-CD7WgCC8.js",
  "/assets/src-B4wH5sZ0.js",
  "/assets/tools-JtVr55XB.js",
  "/assets/weld-9zT4utdP.js"
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
