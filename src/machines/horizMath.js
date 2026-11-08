// Horizontálna vŕtačka a frézka (vyvrtávanie) bez three.js: otvory v stenách skriňového odliatku, priebeh priemeru
// po hĺbke steny, priehyb vyvrtávacej tyče a kontrola úloh (rozmer H7, poloha, súosovosť). Testované v tests/horiz.test.js.
// Dĺžky v mm. Steny skrine: 0 = stena oproti vretenu pri B = 0°, 2 = protiľahlá (po otočení o 180°), 1 a 3 bočné.
// a = vodorovná súradnica na stene videná od vretena (mm od stredu skrine), y = výška nad spodkom skrine.

export const HZ_SPEEDS = [20, 32, 50, 80, 125, 200, 315, 500, 800];
export const HZ_FEEDS = [0.05, 0.1, 0.16, 0.25];
export const BAR_R = 24; // polomer vyvrtávacej tyče
export const WALL = 40; // hrúbka steny odliatku
export const H7_80 = [80.0, 80.03];

export const faceOf = (B) => {
  const k = Math.round(B / 90);
  return Math.abs(B - k * 90) < 1e-6 ? ((k % 4) + 4) % 4 : -1;
};
// otvor s profilom polomeru po hĺbke steny (bunky po 1 mm)
export function createHole(face, a, y, r) {
  return { face, a, y, ca: a, cy: y, r: new Float32Array(WALL).fill(r), core: r, bored: false, ecc: 0 };
}
export const findHole = (holes, face, a, y, tol = 8) =>
  holes.find((h) => h.face === face && Math.hypot(h.ca - a, h.cy - y) < tol);
// priehyb tyče: chyba priemeru (mm) pri radiálnom zábere ap (mm) a vyložení ext (mm od čela vretena po nôž)
export const deflection = (ap, ext) => 0.002 * ap * (ext / 100) ** 2;

// jeden krok vyvrtávania: tyč v osi (a, y), nôž na polomere rb (mm), hĺbka do steny z0 → z1 (mm).
// Vráti { crash, ap, removed }. crash: 'solid' (bez otvoru), 'bar' (tyč sa nezmestí do otvoru), 'chatter' (záber > 8 mm).
export function boreStep(h, a, y, rb, z0, z1, ext) {
  if (!h) return { crash: 'solid' };
  const off = Math.hypot(a - h.ca, y - h.cy);
  const i0 = Math.max(0, Math.floor(z0)),
    i1 = Math.min(WALL - 1, Math.floor(z1));
  let ap = 0,
    rmin = Infinity;
  for (let i = i0; i <= i1; i++) {
    rmin = Math.min(rmin, h.r[i] - off);
    ap = Math.max(ap, rb - (h.r[i] - off));
  }
  if (rmin < BAR_R + 0.5) return { crash: 'bar' };
  if (ap > 8) return { crash: 'chatter', ap };
  if (ap <= 0) return { ap: 0, removed: 0 };
  const re = rb - deflection(ap, ext) / 2;
  let removed = 0;
  // os otvoru: prvé vyvrtanie ju presunie do osi tyče, ďalší prechod mimo osi sa zapíše ako výstrednosť
  if (!h.bored && rb >= off + h.core) {
    h.ca = a;
    h.cy = y;
    h.bored = true;
  } else if (h.bored && off > 0.001) h.ecc = Math.max(h.ecc, off);
  for (let i = i0; i <= i1; i++)
    if (re > h.r[i]) {
      removed += re - h.r[i];
      h.r[i] = re;
    }
  return { ap, removed };
}
export function holeInfo(h) {
  let dMin = Infinity,
    dMax = 0;
  for (let i = 0; i < WALL; i++) {
    dMin = Math.min(dMin, 2 * h.r[i]);
    dMax = Math.max(dMax, 2 * h.r[i]);
  }
  return { dMin, dMax, a: h.ca, y: h.cy, ecc: h.ecc, bored: h.bored };
}

const f3 = (v) => v.toFixed(3),
  f2 = (v) => v.toFixed(2);
const sizeOk = (q) => q.dMin >= H7_80[0] - 1e-9 && q.dMax <= H7_80[1] + 1e-9;
export const horizChecks = {
  // otvor Ø80 H7 v stene 0, os 150 mm nad spodkom a v strede šírky (±0,05 mm)
  otvor: ({ holes = [] }) => {
    const h = holes.find((q) => q.face === 0),
      q = h ? holeInfo(h) : null;
    return [
      { key: 'size', ok: !!q && sizeOk(q), actual: q ? `${f3(q.dMin)} – ${f3(q.dMax)}` : '–' },
      {
        key: 'pos',
        ok: !!q && q.bored && Math.abs(q.a) <= 0.05 && Math.abs(q.y - 150) <= 0.05,
        actual: q ? `a ${f2(q.a)} · y ${f2(q.y)}` : '–',
      },
      { key: 'ecc', ok: !!q && q.bored && q.ecc <= 0.01, actual: q ? `${f3(q.ecc)} mm` : '–' },
    ];
  },
  // súosé otvory Ø80 H7 v stenách 0 a 2: os v stene 2 videná od vretena je zrkadlová (a₂ = −a₀)
  suose: ({ holes = [] }) => {
    const h0 = holes.find((q) => q.face === 0),
      h2 = holes.find((q) => q.face === 2),
      q0 = h0 ? holeInfo(h0) : null,
      q2 = h2 ? holeInfo(h2) : null;
    const co = q0 && q2 ? Math.hypot(q0.a + q2.a, q0.y - q2.y) : Infinity;
    return [
      { key: 'size0', ok: !!q0 && sizeOk(q0), actual: q0 ? `${f3(q0.dMin)} – ${f3(q0.dMax)}` : '–' },
      { key: 'size2', ok: !!q2 && sizeOk(q2), actual: q2 ? `${f3(q2.dMin)} – ${f3(q2.dMax)}` : '–' },
      {
        key: 'coax',
        ok: !!q0 && !!q2 && q0.bored && q2.bored && co <= 0.02,
        actual: Number.isFinite(co) ? `${f3(co)} mm` : '–',
      },
    ];
  },
};
