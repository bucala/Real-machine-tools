// Service worker – offline režim. Vygenerovaný pri builde (vite.config.js), needitovať v public/.
// Pri inštalácii uloží menu a 3D jadro. Každý otvorený stroj sa uloží pri prvom otvorení; všetky stroje
// naraz uloží správa {type: 'cache-all'} (tlačidlo v menu). Po novej verzii sa nezmenené súbory prenesú.
const CACHE = 'rmt-112c6aa259df';
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
  "/assets/core3d-DnkeqRVw.js",
  "/assets/index-B2E67nCI.js",
  "/assets/index-Co4jhlRw.css",
  "/assets/rolldown-runtime-WkwZ5CU-.js",
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
  "/assets/CncCore-B4sQNvs3.js",
  "/assets/CncCore-CKtQMyTm.css",
  "/assets/amada-DPPTRLjd.js",
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
  "/assets/bbj-BMSymr2R.js",
  "/assets/bbt-DaYh985O.js",
  "/assets/bender-BQnmap3R.js",
  "/assets/benderMath-d1cNdKwu.js",
  "/assets/bn-DOf4eou0.js",
  "/assets/buchar-00t9OQUn.js",
  "/assets/bystronic-C8CYj7gp.js",
  "/assets/bystronic-D01xmsYH.css",
  "/assets/core3d-DnkeqRVw.js",
  "/assets/cylgrind-C5TdIydl.js",
  "/assets/detail-DG7XtS3J.js",
  "/assets/drill-BQgcK21W.js",
  "/assets/fgu-C7cAna6X.js",
  "/assets/fguMath-drj3A9rw.js",
  "/assets/fnk-DLxPsp3g.js",
  "/assets/folder-zty4RmTS.js",
  "/assets/grinder-hNUxIYZh.js",
  "/assets/guides-B58RQRIo.js",
  "/assets/hermle-jJFe702E.js",
  "/assets/hermleCradleData-DTKDBSkf.js",
  "/assets/hfMath-B0JgUNbA.js",
  "/assets/hob-CHhF5zX_.js",
  "/assets/horiz-BCdHj_gR.js",
  "/assets/hov-yTCj4oYx.js",
  "/assets/index-B2E67nCI.js",
  "/assets/index-Co4jhlRw.css",
  "/assets/karusel-DtAo1Rh0.js",
  "/assets/lathe-C1ps3San.js",
  "/assets/machineExport-BiuTS806.js",
  "/assets/machineExport.worker-Csk2pWCh.js",
  "/assets/machineWorkInspect-BZ4Seetf.js",
  "/assets/mill-DnQzopsF.js",
  "/assets/modelKit-DGJcl-AJ.js",
  "/assets/modernTasks-CSvVfA0T.js",
  "/assets/oscar-7I4zruzM.js",
  "/assets/pasovka-Dwf7pJ1w.js",
  "/assets/plate-DGANQ7QA.js",
  "/assets/press-Djn2_mU7.js",
  "/assets/profiles-BCWNvzx3.js",
  "/assets/radial-BpYEDEQ5.js",
  "/assets/roeders-Bt06SpXW.js",
  "/assets/rolldown-runtime-WkwZ5CU-.js",
  "/assets/saw-BN30SAbq.js",
  "/assets/scaffold-CH3TxD-e.js",
  "/assets/sceneOptimize-Dfx7rUKK.js",
  "/assets/shaperMath-BfNySK0Q.js",
  "/assets/share-tech-mono-latin-400-normal-CCqdbj5z.woff2",
  "/assets/shear-DrGZoM9H.js",
  "/assets/shopMath-B3CAL8Sc.js",
  "/assets/sketch-DFs9bNMP.js",
  "/assets/sketch2-scwXLqcE.js",
  "/assets/slotter-BlO3yFp4.js",
  "/assets/slotterMath-CXWgpEOT.js",
  "/assets/src-C7nlATq6.js",
  "/assets/step-PSD0ffT-.js",
  "/assets/stockMesh-BWEBUua4.js",
  "/assets/toolGrindMath-BpjbWCQU.js",
  "/assets/toolPicker-BgaiQPOa.js",
  "/assets/toolPicker-K4q7Vx22.css",
  "/assets/touchScreen-DMNk6Q-U.js",
  "/assets/util-BIqoJFFx.js",
  "/assets/weld-COReKenZ.js",
  "/assets/workAreaFeed-C6-BZzt9.js",
  "/assets/workAreaFeed-CCzFg1YG.css"
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
