// Odvalovacia frézka na ozubenie bez three.js: odvalovanie (zuby podľa výmenných kolies delenia), hĺbka zuba,
// sklon frézy, rozmer cez zuby Wk a kontrola úloh. Testované v tests/hob.test.js. Dĺžky v mm.

export const HOB = { d0: 70, K: 24, ALPHA: 20 * Math.PI / 180 };   // fréza Ø70, jednochodá; konštanta delenia K
export const HOB_Z = [20, 24, 25, 30, 32, 36, 40];
export const HOB_FEEDS = [0.5, 1, 2, 3];                          // mm na otáčku stola
export const inv = (a) => Math.tan(a) - a;
export const hobAngle = (m, d0 = HOB.d0) => Math.asin(m / d0) * 180 / Math.PI;   // stúpací uhol jednochodej frézy (°)
// výmenné kolesá delenia: i = a/b · c/d = K / z (pri jednochodej fréze)
export function indexGears(z, K = HOB.K) {
  const sets = [20, 24, 25, 30, 32, 36, 40, 45, 48, 50, 60, 72, 80];
  for (const b of sets) for (const a of sets) if (Math.abs(a / b - K / z) < 1e-9) return { a, b, c: 1, d: 1 };
  for (const a of sets) for (const b of sets) for (const c2 of sets) for (const d of sets) if (Math.abs((a / b) * (c2 / d) - K / z) < 1e-9) return { a, b, c: c2, d };
  return null;
}
export const tipD = (m, z) => m * (z + 2);
export const fullDepth = (m) => 2.25 * m;
// rozmer cez k zubov pre priame čelné koleso; radiálne nedorezanie Δ zväčší Wk o 2 Δ sin α
export const wk = (m, z, k, under = 0, a = HOB.ALPHA) => m * Math.cos(a) * ((k - 0.5) * Math.PI + z * inv(a)) + 2 * under * Math.sin(a);
export const wkTeeth = (z) => Math.max(2, Math.round(z / 9 + 0.5));

// polotovar: bunky po výške, v každej počet zubov z (podľa delenia pri reze) a hĺbka
export function createGear(m, zT, b, NH = 20) { return { m, zT, b, NH, z: new Int16Array(NH), depth: new Float32Array(NH), mixed: new Uint8Array(NH), skew: new Float32Array(NH) }; }
// rez v pásme výšok [y0, y1] (mm od spodku) s počtom zubov z, hĺbkou d a chybou sklonu frézy (°)
export function hobCut(g, y0, y1, z, d, angErr = 0) {
  let n = 0;
  for (let i = 0; i < g.NH; i++) {
    const yc = (i + 0.5) * g.b / g.NH;
    if (yc < y0 || yc > y1) continue;
    if (g.depth[i] > 0.01 && g.z[i] && g.z[i] !== z) g.mixed[i] = 1;
    if (d > g.depth[i]) { g.depth[i] = d; n++; }
    g.z[i] = z; g.skew[i] = Math.max(g.skew[i], Math.abs(angErr));
  }
  return n;
}
export function gearInfo(g) {
  let dMin = Infinity, dMax = 0, cut = 0, mixed = 0, skew = 0; const zs = new Set();
  for (let i = 0; i < g.NH; i++) { if (g.depth[i] > 0.01) { cut++; zs.add(g.z[i]); dMin = Math.min(dMin, g.depth[i]); dMax = Math.max(dMax, g.depth[i]); } mixed += g.mixed[i]; skew = Math.max(skew, g.skew[i]); }
  const z = zs.size === 1 ? [...zs][0] : 0, k = wkTeeth(g.zT);
  return { cover: cut / g.NH, z, zs: [...zs], dMin: cut ? dMin : 0, dMax, mixed, skew, k, Wk: z ? wk(g.m, z, k, fullDepth(g.m) - dMin) : 0, Wk0: wk(g.m, g.zT, k) };
}

const f3 = (v) => v.toFixed(3);
export const hobChecks = {
  gear: ({ gear }) => {
    const q = gear ? gearInfo(gear) : null, ok = !!q && q.cover > 0;
    return [
      { key: 'z', ok: ok && q.z === gear.zT && q.mixed === 0, actual: ok ? (q.zs.length > 1 || q.mixed ? `z ${q.zs.join(' / ')} ✗` : `z ${q.z}`) : '–' },
      { key: 'wk', ok: ok && q.z === gear.zT && Math.abs(q.Wk - q.Wk0) <= 0.05 && q.dMax - q.dMin < 0.03, actual: ok && q.z ? `W${q.k} ${f3(q.Wk)} (${f3(q.Wk0)})` : '–' },
      { key: 'face', ok: ok && q.cover >= 1, actual: ok ? `${Math.round(q.cover * 100)} %` : '–' },
      { key: 'angle', ok: ok && q.skew <= 0.3, actual: ok ? `${q.skew.toFixed(2)}°` : '–' },
    ];
  },
};
