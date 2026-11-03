// Hrotová brúska na guľato bez three.js: hriadeľ ako polomer po dĺžke, úber kotúčom s pružným odtláčaním
// (vyiskrovanie), prepal pri veľkom zábere a rozbor rozmeru a kužeľovitosti. Testované v tests/cyl.test.js.
// Dĺžky v mm (hriadeľ od ľavého hrotu), priemery v mm.

export const CYL_WORK_SPEEDS = [56, 80, 112, 160, 224, 315];   // ot/min obrobku
export const CYL_TRAVERSE = [0.5, 1, 2, 3, 4];                  // m/min stola
export const WHEEL = { D: 400, B: 40 };                         // kotúč Ø400 × 40 mm

export function createShaft(D, L, N = 400) {
  return { L, N, dx: L / N, d: new Float64Array(N).fill(D), d0: D, mask: new Uint8Array(N), burn: new Uint8Array(N) };
}
// prechod kotúča: kotúč pokrýva [x0, x1] mm, priemer, na ktorý je nastavený prísuv, je dLim.
// Za čas styku t (s) sa odstráni podiel 1 − e^(−λ t) zvyšného prídavku – pružné odtláčanie, preto treba vyiskrovať.
// Záber nad burnDepth (mm na priemere) prepáli povrch. Vráti odobratý objem (mm na priemere × bunky) a najväčší záber.
export function grindPass(s, x0, x1, dLim, t, { lambda = 0.5, burnDepth = 0.06 } = {}) {
  let removed = 0, depth = 0;
  const i0 = Math.max(0, Math.floor(x0 / s.dx)), i1 = Math.min(s.N - 1, Math.floor(x1 / s.dx));
  const k = 1 - Math.exp(-lambda * t);
  for (let i = i0; i <= i1; i++) {
    const ex = s.d[i] - dLim;
    if (ex <= 0) continue;
    depth = Math.max(depth, ex);
    const r = ex * k; s.d[i] -= r; removed += r; s.mask[i] = 1;
    if (ex > burnDepth) s.burn[i] = 1;
  }
  return { removed, depth };
}
// rozbor: priemery v obrúsenej časti (bez krajných 2 %), kužeľovitosť = rozdiel priemerov na koncoch
export function shaftInfo(s) {
  let a = -1, b = -1;
  for (let i = 0; i < s.N; i++) if (s.mask[i]) { if (a < 0) a = i; b = i; }
  if (a < 0) return { len: 0, dMin: s.d0, dMax: s.d0, taper: 0, burn: 0 };
  const cut = Math.floor((b - a + 1) * 0.02); let dMin = Infinity, dMax = 0, burn = 0, n = 0;
  for (let i = a + cut; i <= b - cut; i++) { dMin = Math.min(dMin, s.d[i]); dMax = Math.max(dMax, s.d[i]); burn += s.burn[i]; if (!s.mask[i]) n++; }
  const w = Math.max(1, Math.floor((b - a + 1) * 0.08)), avg = (i0, i1) => { let q = 0; for (let i = i0; i <= i1; i++) q += s.d[i]; return q / (i1 - i0 + 1); };
  return { len: (b - a + 1) * s.dx, dMin, dMax, taper: Math.abs(avg(a + cut, a + cut + w) - avg(b - cut - w, b - cut)), burn, gaps: n, x0: a * s.dx, x1: (b + 1) * s.dx };
}
export const dAt = (s, x) => s.d[Math.max(0, Math.min(s.N - 1, Math.floor(x / s.dx)))];

const f3 = (v) => v.toFixed(3);
const mk = (dMax, dMin, minLen, tap) => ({ shaft }) => {
  const q = shaft ? shaftInfo(shaft) : null, ok = !!q && q.len > 0;
  return [
    { key: 'size', ok: ok && q.dMin >= dMin - 1e-9 && q.dMax <= dMax + 1e-9, actual: ok ? `${f3(q.dMin)} – ${f3(q.dMax)}` : '–' },
    { key: 'len', ok: ok && q.len >= minLen && q.gaps === 0, actual: ok ? `${Math.round(q.len)} mm` : '–' },
    { key: 'taper', ok: ok && q.taper <= tap, actual: ok ? `${f3(q.taper)} mm` : '–' },
    { key: 'burn', ok: ok && q.burn === 0, actual: ok ? (q.burn ? `${q.burn}` : '0') : '–' },
  ];
};
export const cylChecks = {
  h6: mk(40.0, 39.984, 160, 0.005),   // Ø40 h6 (0 / −0,016) na dĺžke ≥ 160 mm
  h5: mk(25.0, 24.991, 120, 0.004),   // Ø25 h5 (0 / −0,009) na dĺžke ≥ 120 mm
};
