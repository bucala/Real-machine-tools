// Radiálna vŕtačka bez three.js: poloha vretena z natočenia ramena a vyloženia vreteníka, spätný výpočet
// a kontrola úloh (rozteč dier, diery na rozstupovej kružnici). Testované v tests/radial.test.js.
// Jednotky scény (1 = 100 mm), uhly v stupňoch; rameno pri α = 0 smeruje v +X, kladný uhol ho otáča k −Z.

export const RD = { CX: -5.2, CZ: -1.45, SZO: 1.45 };          // os stĺpa, vyosenie vretena pred osou ramena
export const RADIAL_SPEEDS = [32, 45, 63, 90, 125, 180, 250, 355, 500, 710, 1000, 1400];
export const RADIAL_FEEDS = [0.1, 0.16, 0.25, 0.4];           // mm/ot
export const RADIAL_SIZES = [10, 13, 16, 20, 25, 32, 40];

// os vretena v pôdoryse pre natočenie ramena a (°) a vyloženie R (od osi stĺpa)
export function spindleXZ(a, R, K = RD) {
  const t = a * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  return { x: K.CX + R * c + K.SZO * s, z: K.CZ - R * s + K.SZO * c };
}
// natočenie a vyloženie, pri ktorých je vreteno nad bodom (x, z)
export function reachXZ(x, z, K = RD) {
  const dx = x - K.CX, dz = z - K.CZ, d2 = dx * dx + dz * dz;
  const R = Math.sqrt(Math.max(0, d2 - K.SZO * K.SZO));
  const a = (Math.atan2(-dz, dx) + Math.atan2(K.SZO, R)) * 180 / Math.PI;
  return { a, R };
}

// diery: [{ x, y, d, through }] v mm od stredu dosky (x doprava, y od obsluhy)
const near = (holes, x, y) => holes.reduce((b, h) => { const e = Math.hypot(h.x - x, h.y - y); return e < b.e ? { h, e } : b; }, { h: null, e: Infinity });
const f1 = (v) => v.toFixed(1);
export const radialChecks = {
  // štyri diery Ø16 naskrz v rozteči 300 × 200 mm, súmerne k stredu dosky
  roztec: ({ holes = [] }) => {
    const tg = [[-150, -100], [150, -100], [150, 100], [-150, 100]], m = tg.map(([x, y]) => near(holes, x, y)), err = Math.max(...m.map((q) => q.e));
    return [
      { key: 'count', ok: holes.length === 4, actual: String(holes.length) },
      { key: 'd', ok: holes.length > 0 && holes.every((h) => Math.abs(h.d - 16) < 0.05), actual: holes.length ? [...new Set(holes.map((h) => `Ø${h.d}`))].join(', ') : '–' },
      { key: 'through', ok: holes.length > 0 && holes.every((h) => h.through), actual: `${holes.filter((h) => h.through).length} / ${holes.length}` },
      { key: 'pos', ok: holes.length >= 4 && err <= 0.5, actual: holes.length ? `${f1(err)} mm` : '–' },
    ];
  },
  // šesť dier Ø20 naskrz na rozstupovej kružnici Ø300, rozostup 60°
  priruba: ({ holes = [] }) => {
    const rs = holes.map((h) => Math.hypot(h.x, h.y)), angs = holes.map((h) => (Math.atan2(h.y, h.x) * 180 / Math.PI + 360) % 360).sort((p, q) => p - q);
    const rErr = rs.length ? Math.max(...rs.map((r) => Math.abs(r - 150))) : Infinity;
    let aErr = Infinity;
    if (angs.length > 1) { aErr = 0; for (let i = 0; i < angs.length; i++) { const d = ((angs[(i + 1) % angs.length] - angs[i]) + 360) % 360; aErr = Math.max(aErr, Math.abs(d - 360 / angs.length)); } }
    return [
      { key: 'count', ok: holes.length === 6, actual: String(holes.length) },
      { key: 'd', ok: holes.length > 0 && holes.every((h) => Math.abs(h.d - 20) < 0.05), actual: holes.length ? [...new Set(holes.map((h) => `Ø${h.d}`))].join(', ') : '–' },
      { key: 'through', ok: holes.length > 0 && holes.every((h) => h.through), actual: `${holes.filter((h) => h.through).length} / ${holes.length}` },
      { key: 'circle', ok: holes.length === 6 && rErr <= 0.5, actual: holes.length ? `Ø${f1(2 * rs.reduce((p, q) => p + q, 0) / rs.length)} ± ${f1(rErr)}` : '–' },
      { key: 'pitch', ok: holes.length === 6 && aErr <= 0.3, actual: holes.length > 1 ? `± ${aErr.toFixed(2)}°` : '–' },
    ];
  },
};
