// Service worker – offline režim. Vygenerovaný pri builde (vite.config.js), needitovať v public/.
// Pri inštalácii uloží menu a 3D jadro. Každý otvorený stroj sa uloží pri prvom otvorení; všetky stroje
// naraz uloží správa {type: 'cache-all'} (tlačidlo v menu). Po novej verzii sa nezmenené súbory prenesú.
const CACHE = 'rmt-42c675bce970';
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
  "/assets/index-Bs-gY38k.css",
  "/assets/index-DDeDQWs_.js",
  "/assets/share-tech-mono-latin-400-normal-CCqdbj5z.woff2",
  "/assets/util-BIqoJFFx.js"
];
const ALL = [
  "/",
  "/apple-touch-icon.png",
  "/boot.css",
  "/boot.js",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/manifest.webmanifest",
  "/assets/CncCore-CKtQMyTm.css",
  "/assets/CncCore-DZsPDpqs.js",
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
  "/assets/bender-aVIADTGI.js",
  "/assets/benderMath-d1cNdKwu.js",
  "/assets/bystronic-B2zcypg0.js",
  "/assets/bystronic-D01xmsYH.css",
  "/assets/core3d-D9gM_QGA.js",
  "/assets/cylgrind-Cah3v8TD.js",
  "/assets/drill-b1o_0HNk.js",
  "/assets/folder-k6DL-w2P.js",
  "/assets/grinder-Hi6qdCLB.js",
  "/assets/guides-BuTABRF9.js",
  "/assets/hermle-SrAE3Z-x.js",
  "/assets/hermleCradleData-DTKDBSkf.js",
  "/assets/hfMath-B0JgUNbA.js",
  "/assets/hob-aFEdTQIH.js",
  "/assets/horiz-DYjnR37V.js",
  "/assets/index-Bs-gY38k.css",
  "/assets/index-DDeDQWs_.js",
  "/assets/lathe-C7WcWGF4.js",
  "/assets/machineExport-DhM6q0XZ.js",
  "/assets/machineExport.worker-Csk2pWCh.js",
  "/assets/machineWorkInspect-B_U7HZpi.js",
  "/assets/mill-Q_35I92w.js",
  "/assets/modelKit-DXIzTSb6.js",
  "/assets/modernTasks-B2zR1iv6.js",
  "/assets/oscar-C2NjJXoT.js",
  "/assets/plate-BI6n9xZS.js",
  "/assets/press-PEaIFy5V.js",
  "/assets/profiles-D8JnNyf5.js",
  "/assets/radial-CMyMdfr5.js",
  "/assets/roeders-DqQJNBLl.js",
  "/assets/saw-BXUNA8Gx.js",
  "/assets/shaperMath-BfNySK0Q.js",
  "/assets/share-tech-mono-latin-400-normal-CCqdbj5z.woff2",
  "/assets/shear-D06rQLir.js",
  "/assets/shopMath-B3CAL8Sc.js",
  "/assets/sketch-9GUKGm1W.js",
  "/assets/slotter-DyYplOcK.js",
  "/assets/src-BTTMPAZU.js",
  "/assets/stockMesh-zbLbmLoX.js",
  "/assets/toolPicker-CL63BM9x.js",
  "/assets/toolPicker-K4q7Vx22.css",
  "/assets/tools-DaG0tFK7.js",
  "/assets/util-BIqoJFFx.js",
  "/assets/weld-yD4xsyYr.js",
  "/assets/workAreaWindow-BSTLnroR.css",
  "/assets/workAreaWindow-OGgHcTz9.js"
];
const FULL = '/__rmt-offline-all'; // značka: používateľ si uložil všetky stroje

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

const cacheAll = async (report) => {
  const c = await caches.open(CACHE),
    missing = [];
  for (const f of ALL) if (!(await c.match(f))) missing.push(f);
  let done = ALL.length - missing.length;
  report?.(done, ALL.length);
  for (let i = 0; i < missing.length; i += 6) {
    await c.addAll(missing.slice(i, i + 6));
    done += Math.min(6, missing.length - i);
    report?.(done, ALL.length);
  }
  await c.put(FULL, new Response('1'));
};

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keys = (await caches.keys()).filter((k) => k.startsWith('rmt-') && k !== CACHE);
      const cache = await caches.open(CACHE),
        wanted = new Set(ALL);
      let full = false;
      for (const k of keys) {
        const old = await caches.open(k);
        // hashované súbory, ktoré sa nezmenili, netreba sťahovať znova
        for (const req of await old.keys()) {
          const path = new URL(req.url).pathname;
          if (path === FULL) full = true;
          else if (path !== '/' && wanted.has(path) && !(await cache.match(req)))
            await cache.put(req, await old.match(req));
        }
        await caches.delete(k);
      }
      await self.clients.claim();
      if (full)
        cacheAll().catch(() => {
          /* bez siete – doplní sa pri ďalšej návšteve */
        });
    })(),
  );
});

self.addEventListener('message', (e) => {
  if (e.data?.type !== 'cache-all') return;
  const reply = (msg) => e.source?.postMessage(msg);
  e.waitUntil(
    cacheAll((done, total) => reply({ type: 'cache-all-progress', done, total }))
      .then(() => reply({ type: 'cache-all-done', ok: true }))
      .catch(() => reply({ type: 'cache-all-done', ok: false })),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // stránka: najprv sieť (nová verzia po nasadení), bez siete uložená kópia
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('/', copy));
          }
          return res;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }
  // ostatné súbory: z vyrovnávacej pamäte, inak zo siete (hashované súbory sa uložia – otvorený stroj funguje offline)
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && url.pathname.startsWith('/assets/')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
