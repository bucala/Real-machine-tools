// Zakružovačka plechu – trojvalcová pyramída (predloha TOS XZC 3000/10) bez three.js.
// Dva spodné poháňané valce, horný valec sa prisúva nadol o δ. Využíva pružno-plastický model z benderMath:
// ohne sa len prvok, keď plech leží na oboch spodných valcoch – na oboch koncoch zostane rovný úsek ≈ a.
// Konce sa predohnú s podložným plechom (rovný úsek sa skráti na štvrtinu). Testované v tests/plate.test.js.
import { STEEL, bendInfo, createBar, kFinal, kLoaded } from './benderMath';

export const PLATE_A = 0.18; // polovica rozostupu spodných valcov (m)
export const PLATE_TMAX = 10; // najväčšia hrúbka plechu S235 (mm)
export const PLATE_LMAX = 3000; // pracovná dĺžka valcov (mm)
export const PLATE_DMAX = 60; // najväčší prísuv horného valca (mm) – potom by sa dotkol spodných
export const plateProfile = (t, b = 1000) => ({ h: t, b, c: t / 2, W: (b * t * t) / 6, k: 1.5 });
export const kPyr = (d, a = PLATE_A) => kLoaded(d, a); // kružnica cez dotyky na troch valcoch
export const createSheet = (L, ds = 0.005) => createBar(L, ds);
// prechod úseku [u0, u1] (m od predného konca) pod horným valcom pri prísuve δ (m); backing = podložný plech na konce
export function passPyramid(sh, p, u0, u1, d, { a = PLATE_A, backing = false, m = STEEL } = {}) {
  const kL = kPyr(d, a),
    lo = Math.min(u0, u1),
    hi = Math.max(u0, u1),
    e = backing ? a * 0.25 : a;
  let n = 0;
  for (let i = Math.max(0, Math.floor(lo / sh.ds)); i <= Math.min(sh.N - 1, Math.floor(hi / sh.ds)); i++) {
    const u = (i + 0.5) * sh.ds;
    if (u < e || sh.L - u < e) continue;
    if (kL > sh.kmax[i]) {
      sh.kmax[i] = kL;
      sh.kf[i] = kFinal(kL, p, m);
      n++;
    }
  }
  return n;
}
export function reverseSheet(sh) {
  sh.kmax.reverse();
  sh.kf.reverse();
  sh.tw.reverse();
  sh.ov.reverse();
  return sh;
}
export { bendInfo };

const f0 = (v) => Math.round(v).toString();
const chk =
  (R0, tolR, { minAng = 0, maxEnd = Infinity, minBent = 0 }) =>
  ({ sheet }) => {
    const b = sheet ? bendInfo(sheet) : null,
      ok = !!b && b.bent > 0;
    const out = [
      { key: 'radius', ok: ok && Math.abs(b.R - R0) <= tolR, actual: ok ? `R ${f0(b.R)} mm` : '–' },
      { key: 'even', ok: ok && b.spread <= tolR, actual: ok ? `± ${f0(b.spread)} mm` : '–' },
    ];
    if (minAng) out.push({ key: 'angle', ok: ok && b.angle >= minAng, actual: ok ? `${f0(b.angle)}°` : '–' });
    if (Number.isFinite(maxEnd))
      out.push({
        key: 'ends',
        ok: ok && Math.max(...b.ends) <= maxEnd,
        actual: ok ? `${f0(b.ends[0])} / ${f0(b.ends[1])} mm` : '–',
      });
    if (minBent) out.push({ key: 'bent', ok: ok && b.bent >= minBent, actual: ok ? `${f0(b.bent)} mm` : '–' });
    return out;
  };
export const plateChecks = {
  plast: chk(500, 6, { minAng: 340, maxEnd: 50 }), // plášť Ø1000 z plechu 6 × 1500 × 3140 s predohnutými koncami
  oblukP: chk(800, 10, { minBent: 1500 }), // oblúk R 800 z plechu 10 mm
};
