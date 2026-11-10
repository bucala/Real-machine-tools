// Service worker – offline režim. Vygenerovaný pri builde (vite.config.js), needitovať v public/.
// Pri inštalácii uloží menu a 3D jadro. Každý otvorený stroj sa uloží pri prvom otvorení; všetky stroje
// naraz uloží správa {type: 'cache-all'} (tlačidlo v menu). Po novej verzii sa nezmenené súbory prenesú.
const CACHE = 'rmt-667cee89350f';
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
  "/assets/core3d-CoB6jRW0.js",
  "/assets/index-BTb7GMrx.js",
  "/assets/index-C0Wsmuj9.css",
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
  "/assets/CncCore-6WD5LxcN.js",
  "/assets/CncCore-CKtQMyTm.css",
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
  "/assets/bbj-vEBx9yDi.js",
  "/assets/bbt-KLoPd5Ai.js",
  "/assets/bender-BUCRL84z.js",
  "/assets/benderMath-d1cNdKwu.js",
  "/assets/bn-9_VCCKGk.js",
  "/assets/buchar-BjOXBKor.js",
  "/assets/bystronic-Bt2zIzYd.js",
  "/assets/bystronic-D01xmsYH.css",
  "/assets/core3d-CoB6jRW0.js",
  "/assets/cylgrind-Cykpm0cr.js",
  "/assets/detail-st3vfxVK.js",
  "/assets/drill-CNKhNpgs.js",
  "/assets/fgu-Bw8NtuFG.js",
  "/assets/fguMath-drj3A9rw.js",
  "/assets/fnk-CEhWhTN1.js",
  "/assets/folder--Ltno9yc.js",
  "/assets/grinder-C-vCjf5l.js",
  "/assets/guides-D1PLgWt6.js",
  "/assets/hermle-Brph8_mK.js",
  "/assets/hermleCradleData-DTKDBSkf.js",
  "/assets/hfMath-B0JgUNbA.js",
  "/assets/hob-JYbOgJFQ.js",
  "/assets/horiz-B8wQSmzP.js",
  "/assets/hov-rnfRrVVm.js",
  "/assets/index-BTb7GMrx.js",
  "/assets/index-C0Wsmuj9.css",
  "/assets/karusel-pdi87obx.js",
  "/assets/lathe-4-_aUppw.js",
  "/assets/machineExport-Cc3MHDnA.js",
  "/assets/machineExport.worker-Csk2pWCh.js",
  "/assets/machineWorkInspect-CRsKdU5V.js",
  "/assets/mill-BoaRlnHi.js",
  "/assets/modelKit-CdlXR2N_.js",
  "/assets/modernTasks-BikMMeDE.js",
  "/assets/oscar-Bs-F9KD1.js",
  "/assets/pasovka-BYiMYfPO.js",
  "/assets/plate-J2-oBvzO.js",
  "/assets/press-KFyPR4NI.js",
  "/assets/profiles-DMjYxpZC.js",
  "/assets/radial-CJcW65fc.js",
  "/assets/roeders-lq9rNjM_.js",
  "/assets/rolldown-runtime-WkwZ5CU-.js",
  "/assets/saw-D2gUzON5.js",
  "/assets/scaffold-D2xcC_sr.js",
  "/assets/shaperMath-BfNySK0Q.js",
  "/assets/share-tech-mono-latin-400-normal-CCqdbj5z.woff2",
  "/assets/shear-DWYHqf4L.js",
  "/assets/shopMath-B3CAL8Sc.js",
  "/assets/sketch-DTDi_DRp.js",
  "/assets/sketch2-J9clTek-.js",
  "/assets/slotter-Ca5kO0wK.js",
  "/assets/slotterMath-CXWgpEOT.js",
  "/assets/src-CXHwcq18.js",
  "/assets/step-Bi9uvCdW.js",
  "/assets/stockMesh-1UMsvrK3.js",
  "/assets/toolGrindMath-BpjbWCQU.js",
  "/assets/toolPicker-CvdRZkwZ.js",
  "/assets/toolPicker-K4q7Vx22.css",
  "/assets/util-BIqoJFFx.js",
  "/assets/weld-YVuU_mxy.js",
  "/assets/workAreaWindow-B9fBxuDj.js",
  "/assets/workAreaWindow-CCzFg1YG.css"
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
