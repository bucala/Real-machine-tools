// Obrážačka ozubenia TOS Čelákovice OHA 32 A (Fellows) bez three.js: vnútorné ozubenie nožovým kolesom.
// Obrobok = prstenec; hĺbka medzery po obvode (bunky), počet medzier podľa výmenných kolies delenia, hĺbka podľa
// radiálneho prísuvu, výška podľa zdvihu. Dĺžky v mm.

export const OHA = {
  m: 3,
  z0: 25,
  strokes: [125, 180, 250, 355, 500],
  rotFeed: [0.1, 0.16, 0.25, 0.4],
  zSet: [48, 50, 56, 60, 64, 72],
};
export const tipInt = (m, z) => m * (z - 2); // hlavová kružnica vnútorného ozubenia
export const fullDepth = (m) => 2.25 * m;
export const centreDist = (m, z, z0) => (m * (z - z0)) / 2;
// tvar medzery v rámci rozstupu (0 – 1): 1 = plná hĺbka v strede medzery
export const spaceShape = (frac) => {
  const q = Math.abs(frac - 0.5);
  return q < 0.14 ? 1 : q > 0.32 ? 0 : 1 - (q - 0.14) / 0.18;
};
export function createRing({ m = OHA.m, zT = 60, b = 30, N = 720 } = {}) {
  return { m, zT, b, N, depth: new Float32Array(N), cover: 0 };
}
// rez: bunky okolo uhla a (rad, obrobok) dostanú hĺbku podľa delenia zSel a prísuvu d
export function cutAt(ring, a, d, zSel, hCover) {
  const N = ring.N,
    i0 = Math.round(((((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI)) * N);
  let n = 0;
  for (let k = -4; k <= 4; k++) {
    const i = (i0 + k + N) % N,
      ang = (i / N) * 2 * Math.PI,
      frac = ((((ang / (2 * Math.PI)) * zSel) % 1) + 1) % 1,
      dd = d * spaceShape(frac);
    if (dd > ring.depth[i] + 1e-6) {
      ring.depth[i] = dd;
      n++;
    }
  }
  ring.cover = Math.max(ring.cover, hCover);
  return n;
}
export function ringInfo(ring) {
  const N = ring.N,
    th = 0.3 * fullDepth(ring.m);
  let spaces = 0,
    inSpace = ring.depth[N - 1] > th,
    dMin = Infinity,
    dMax = 0,
    peak = 0;
  for (let i = 0; i < N; i++) {
    const d = ring.depth[i];
    if (d > th && !inSpace) {
      spaces++;
      inSpace = true;
      peak = d;
    } else if (d > th) peak = Math.max(peak, d);
    else if (d <= th && inSpace) {
      inSpace = false;
      dMin = Math.min(dMin, peak);
      dMax = Math.max(dMax, peak);
    }
  }
  if (inSpace && spaces) {
    dMin = Math.min(dMin, peak);
    dMax = Math.max(dMax, peak);
  }
  if (!spaces && ring.depth[0] > th) spaces = 0;
  return { spaces, dMin: dMin === Infinity ? 0 : dMin, dMax, cover: ring.cover };
}
export const ohaChecks = {
  vnutorne: (m) => [
    { key: 'z', ok: m.info.spaces === 60, value: String(m.info.spaces) },
    {
      key: 'depth',
      ok: m.info.dMin >= 6.65 && m.info.dMax <= 6.85,
      value: `${m.info.dMin.toFixed(2)} – ${m.info.dMax.toFixed(2)} mm`,
    },
    { key: 'cover', ok: m.info.cover >= 30, value: `${m.info.cover.toFixed(0)} mm` },
    { key: 'crash', ok: !m.crashes, value: String(m.crashes) },
  ],
};
