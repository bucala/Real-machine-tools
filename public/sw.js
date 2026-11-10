// Service worker – offline režim. Vygenerovaný pri builde (vite.config.js), needitovať v public/.
// Pri inštalácii uloží menu a 3D jadro. Každý otvorený stroj sa uloží pri prvom otvorení; všetky stroje
// naraz uloží správa {type: 'cache-all'} (tlačidlo v menu). Po novej verzii sa nezmenené súbory prenesú.
const CACHE = 'rmt-bc8f4723add9';
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
  "/assets/index-Co4jhlRw.css",
  "/assets/index-DpbfAbbM.js",
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
  "/assets/CncCore-BElg24jc.js",
  "/assets/CncCore-CKtQMyTm.css",
  "/assets/amada-BXomtbBu.js",
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
  "/assets/bbj-BQkwP2KK.js",
  "/assets/bbt-Bm3W6gSv.js",
  "/assets/bender-BbxqmTYj.js",
  "/assets/benderMath-d1cNdKwu.js",
  "/assets/bn-n0vWMr9K.js",
  "/assets/buchar-BurWJb44.js",
  "/assets/bystronic-D01xmsYH.css",
  "/assets/bystronic-OjFIZRTO.js",
  "/assets/core3d-DnkeqRVw.js",
  "/assets/cylgrind-DJ7mCuLC.js",
  "/assets/detail-DG7XtS3J.js",
  "/assets/drill-nuO30Vdk.js",
  "/assets/fgu-DTa3TKem.js",
  "/assets/fguMath-drj3A9rw.js",
  "/assets/fnk-6KfTGMUj.js",
  "/assets/folder-BGsqHj7j.js",
  "/assets/grinder-D6yMRF0E.js",
  "/assets/guides-Cy0Z2vwc.js",
  "/assets/hermle-D7W8gk_j.js",
  "/assets/hermleCradleData-DTKDBSkf.js",
  "/assets/hfMath-B0JgUNbA.js",
  "/assets/hob-o-qK1NOU.js",
  "/assets/horiz-CFZ7rLsi.js",
  "/assets/hov-iJ-J6TXd.js",
  "/assets/index-Co4jhlRw.css",
  "/assets/index-DpbfAbbM.js",
  "/assets/karusel-B-yvBVaP.js",
  "/assets/lathe-CxqzFwsW.js",
  "/assets/machineExport-BiuTS806.js",
  "/assets/machineExport.worker-Csk2pWCh.js",
  "/assets/machineWorkInspect-BZ4Seetf.js",
  "/assets/mill-BSgNOMXG.js",
  "/assets/modelKit-DGJcl-AJ.js",
  "/assets/modernTasks-CC7meXXs.js",
  "/assets/oscar-70UHn4nE.js",
  "/assets/pasovka-CWkLU5Cr.js",
  "/assets/plate-BHHLMa_d.js",
  "/assets/press-Bj8Am6r8.js",
  "/assets/profiles-DTc4UAAa.js",
  "/assets/radial-Bsfz6Gob.js",
  "/assets/roeders-B6E_MX2w.js",
  "/assets/rolldown-runtime-WkwZ5CU-.js",
  "/assets/saw-yP8yj7f4.js",
  "/assets/scaffold-BNKzeSHE.js",
  "/assets/sceneOptimize-Dfx7rUKK.js",
  "/assets/shaperMath-BfNySK0Q.js",
  "/assets/share-tech-mono-latin-400-normal-CCqdbj5z.woff2",
  "/assets/shear-up7nWrlG.js",
  "/assets/shopMath-B3CAL8Sc.js",
  "/assets/sketch-CgQ39lSw.js",
  "/assets/sketch2-5Vmi3_NG.js",
  "/assets/slotter-YcM_S7Sd.js",
  "/assets/slotterMath-CXWgpEOT.js",
  "/assets/src-C7nlATq6.js",
  "/assets/step-Chq4aEQF.js",
  "/assets/stockMesh-BWEBUua4.js",
  "/assets/toolGrindMath-BpjbWCQU.js",
  "/assets/toolPicker-CzVumVe1.js",
  "/assets/toolPicker-K4q7Vx22.css",
  "/assets/touchScreen-DMNk6Q-U.js",
  "/assets/util-BIqoJFFx.js",
  "/assets/weld-CiobA6B4.js",
  "/assets/workAreaFeed-CCzFg1YG.css",
  "/assets/workAreaFeed-qZ4WHKOU.js"
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
