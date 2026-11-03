// Tabuľové nožnice bez three.js: strih pásu po zadný doraz, pravouhlosť podľa priloženia k uholníku,
// vôľa nožov a ostrina, kapacita a kontrola úloh. Testované v tests/shear.test.js. Dĺžky v mm.

export const SHEAR = { maxT: 3, Wmax: 2000, Rm: 420 };          // S235 do 3 mm, dĺžka strihu 2 000 mm
export const gapIdeal = (t) => 0.07 * t;                         // vôľa nožov ≈ 7 % hrúbky
export const burrOf = (t, gap) => Math.abs(gap - gapIdeal(t)) > 0.035 * t;
// strih: plech hĺbky D (od obsluhy k nožu a za nôž) je zasunutý za strihovú čiaru o p, zadný doraz je v g.
// square = plech priložený k bočnému uholníku; inak je pás klinový o skew (mm na dĺžke pásu).
export function cutStrip(sheet, p, { t, gap, square = true, skew = 0.6 }) {
  if (t > SHEAR.maxT + 1e-9) return { error: 'capacity' };
  if (p <= 0.5) return { error: 'none' };
  const w = Math.min(p, sheet.D), strip = { w, L: sheet.L, taper: square ? 0 : skew, burr: burrOf(t, gap), t };
  sheet.D -= w;
  return { strip };
}
const f2 = (v) => v.toFixed(2);
const stripsOk = (strips, w0, tol, n) => strips.filter((s) => Math.abs(s.w - w0) <= tol && s.taper <= 0.3 && !s.burr).length >= n;
export const shearChecks = {
  pasy: ({ strips = [] }) => {
    const good = strips.filter((s) => Math.abs(s.w - 100) <= 0.3);
    return [
      { key: 'count', ok: strips.length >= 3 && good.length >= 3, actual: `${good.length} / ${strips.length}` },
      { key: 'square', ok: good.length >= 3 && good.every((s) => s.taper <= 0.3), actual: strips.length ? `${f2(Math.max(...strips.map((s) => s.taper)))} mm` : '–' },
      { key: 'burr', ok: strips.length > 0 && strips.every((s) => !s.burr), actual: strips.length ? `${strips.filter((s) => s.burr).length}` : '–' },
    ];
  },
  hrube: ({ strips = [] }) => [
    { key: 'size', ok: stripsOk(strips.filter((s) => s.t === 3), 150, 0.3, 2), actual: strips.length ? strips.map((s) => f2(s.w)).join(' / ') : '–' },
    { key: 'burr', ok: strips.some((s) => s.t === 3) && strips.filter((s) => s.t === 3).every((s) => !s.burr), actual: strips.length ? `${strips.filter((s) => s.burr).length}` : '–' },
  ],
};
