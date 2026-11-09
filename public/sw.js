// Service worker – offline režim. Vygenerovaný pri builde (vite.config.js), needitovať v public/.
// Pri inštalácii uloží menu a 3D jadro. Každý otvorený stroj sa uloží pri prvom otvorení; všetky stroje
// naraz uloží správa {type: 'cache-all'} (tlačidlo v menu). Po novej verzii sa nezmenené súbory prenesú.
const CACHE = 'rmt-cf2e95f0529e';
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
  "/assets/index-Cs0EqUvQ.css",
  "/assets/index-nLOPWGeQ.js",
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
  "/assets/CncCore-Cx_oL-Vq.js",
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
  "/assets/bender-qixhgOiG.js",
  "/assets/benderMath-d1cNdKwu.js",
  "/assets/bystronic-ByRumBlR.js",
  "/assets/bystronic-D01xmsYH.css",
  "/assets/core3d-DAcyT6bT.js",
  "/assets/cylgrind-DAz1XwOk.js",
  "/assets/drill-BNqR8_4g.js",
  "/assets/folder-CD92PwJP.js",
  "/assets/grinder-CuvmFlod.js",
  "/assets/guides-BSEFv6EM.js",
  "/assets/hermle-RBlOb9Us.js",
  "/assets/hermleCradleData-DTKDBSkf.js",
  "/assets/hfMath-B0JgUNbA.js",
  "/assets/hob-U09oczbF.js",
  "/assets/horiz-CfkMBc4y.js",
  "/assets/index-Cs0EqUvQ.css",
  "/assets/index-nLOPWGeQ.js",
  "/assets/lathe-DaH2uirx.js",
  "/assets/machineExport-Dw80pIc4.js",
  "/assets/machineExport.worker-Csk2pWCh.js",
  "/assets/machineWorkInspect-8Qb-OTWk.js",
  "/assets/mill---EhIq-4.js",
  "/assets/modelKit-c_tooSRR.js",
  "/assets/modernTasks-BgNYdj2j.js",
  "/assets/oscar-DcXT0GPN.js",
  "/assets/plate-CVm6Hdxt.js",
  "/assets/press-CNsMqBw8.js",
  "/assets/profiles-D_YaQGai.js",
  "/assets/radial-DPOzXitH.js",
  "/assets/roeders-CxN9OZ3D.js",
  "/assets/saw-DQYRwjMS.js",
  "/assets/shaperMath-BfNySK0Q.js",
  "/assets/share-tech-mono-latin-400-normal-CCqdbj5z.woff2",
  "/assets/shear-BlHf6Nl_.js",
  "/assets/shopMath-B3CAL8Sc.js",
  "/assets/sketch-BFWZ2lAL.js",
  "/assets/slotter-Bah909Dc.js",
  "/assets/src-DOP8N23I.js",
  "/assets/stockMesh-Buw8RdHZ.js",
  "/assets/toolPicker-CJhdC7ix.js",
  "/assets/toolPicker-K4q7Vx22.css",
  "/assets/tools-BJBMuvdM.js",
  "/assets/util-BIqoJFFx.js",
  "/assets/weld-hJzKIuCf.js",
  "/assets/workAreaWindow-CCzFg1YG.css",
  "/assets/workAreaWindow-DVP8bfWS.js"
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
