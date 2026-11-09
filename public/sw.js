// Service worker – offline režim. Vygenerovaný pri builde (vite.config.js), needitovať v public/.
// Pri inštalácii uloží menu a 3D jadro. Každý otvorený stroj sa uloží pri prvom otvorení; všetky stroje
// naraz uloží správa {type: 'cache-all'} (tlačidlo v menu). Po novej verzii sa nezmenené súbory prenesú.
const CACHE = 'rmt-a8f7c7fd1ef3';
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
  "/assets/index-C0Wsmuj9.css",
  "/assets/index-aP80nVb-.js",
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
  "/assets/CncCore-C6BeMCIP.js",
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
  "/assets/bbj-BtnudhHz.js",
  "/assets/bbt-BDRMh8Xu.js",
  "/assets/bender-DYrmvDgQ.js",
  "/assets/benderMath-d1cNdKwu.js",
  "/assets/bn-D8S0-8H_.js",
  "/assets/bystronic-BYclj6mn.js",
  "/assets/bystronic-D01xmsYH.css",
  "/assets/core3d-CoB6jRW0.js",
  "/assets/cylgrind-CDjbp0_U.js",
  "/assets/detail-st3vfxVK.js",
  "/assets/drill-DsPPcof6.js",
  "/assets/fgu-CfgyFQ1-.js",
  "/assets/fguMath-drj3A9rw.js",
  "/assets/fnk-BhZNZwdM.js",
  "/assets/folder-90VicCJr.js",
  "/assets/grinder-DDhLreSx.js",
  "/assets/guides-rbdWwl7Z.js",
  "/assets/hermle-BflVjD3h.js",
  "/assets/hermleCradleData-DTKDBSkf.js",
  "/assets/hfMath-B0JgUNbA.js",
  "/assets/hob-Ri7x58Ns.js",
  "/assets/horiz-D2JqTodw.js",
  "/assets/hov-tBO9-9xL.js",
  "/assets/index-C0Wsmuj9.css",
  "/assets/index-aP80nVb-.js",
  "/assets/karusel-B_d0CXJj.js",
  "/assets/lathe-CExbaLzv.js",
  "/assets/machineExport-Cc3MHDnA.js",
  "/assets/machineExport.worker-Csk2pWCh.js",
  "/assets/machineWorkInspect-CRsKdU5V.js",
  "/assets/mill-DOFTtXAi.js",
  "/assets/modelKit-CdlXR2N_.js",
  "/assets/modernTasks-D0RlxjXr.js",
  "/assets/oscar-Bg-EEKTl.js",
  "/assets/pasovka-PJYjcYaO.js",
  "/assets/plate-BpGOqbKB.js",
  "/assets/press-CU6Fd_tW.js",
  "/assets/profiles-CPmBuVAG.js",
  "/assets/radial-D5xRTcWf.js",
  "/assets/roeders-DTQJyklR.js",
  "/assets/rolldown-runtime-WkwZ5CU-.js",
  "/assets/saw-CTQqrL63.js",
  "/assets/scaffold-BSIzPWsj.js",
  "/assets/shaperMath-BfNySK0Q.js",
  "/assets/share-tech-mono-latin-400-normal-CCqdbj5z.woff2",
  "/assets/shear-CGyByZcQ.js",
  "/assets/shopMath-B3CAL8Sc.js",
  "/assets/sketch-MG29kU6N.js",
  "/assets/sketch2-xbF7zv6j.js",
  "/assets/slotter-COnGZZT3.js",
  "/assets/slotterMath-CXWgpEOT.js",
  "/assets/src-CXHwcq18.js",
  "/assets/step-BU-Olmj2.js",
  "/assets/stockMesh-1UMsvrK3.js",
  "/assets/toolGrindMath-BpjbWCQU.js",
  "/assets/toolPicker-DypJ8J-h.js",
  "/assets/toolPicker-K4q7Vx22.css",
  "/assets/util-BIqoJFFx.js",
  "/assets/weld-Ckdeaj1w.js",
  "/assets/workAreaWindow-CCzFg1YG.css",
  "/assets/workAreaWindow-sDqXRwdm.js"
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
