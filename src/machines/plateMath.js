// Zakružovačka plechu so zovretím (horný a spodný valec ťahajú, zadný valec ohýba) bez three.js.
// Využíva pružno-plastický model z benderMath. Ohne sa len prvok, za ktorým je plech aspoň po zadný valec;
// rovný začiatok sa predohne otočením plechu (začiatok sa stane koncom). Testované v tests/plate.test.js.
import { STEEL, bendInfo, createBar, kFinal, kLoaded } from './benderMath';

export const PLATE_A = 0.16;                        // vodorovná vzdialenosť zadného valca od zovretia (m)
export const plateProfile = (t, b = 1000) => ({ h: t, b, c: t / 2, W: b * t * t / 6, k: 1.5 });
export const kPinch = (h, a = PLATE_A) => kLoaded(h, a);   // kružnica dotýkajúca sa v zovretí a prechádzajúca zadným valcom

export const createSheet = (L, ds = 0.005) => createBar(L, ds);
// prechod úseku [u0, u1] (m od predného konca) zovretím pri zdvihu zadného valca h (m)
export function passPinch(sh, p, u0, u1, h, a = PLATE_A, m = STEEL) {
  const kL = kPinch(h, a), lo = Math.min(u0, u1), hi = Math.max(u0, u1);
  let n = 0;
  for (let i = Math.max(0, Math.floor(lo / sh.ds)); i <= Math.min(sh.N - 1, Math.floor(hi / sh.ds)); i++) {
    const u = (i + 0.5) * sh.ds;
    if (u < a) continue;                            // pred prvkom musí byť plech až po zadný valec
    if (kL > sh.kmax[i]) { sh.kmax[i] = kL; sh.kf[i] = kFinal(kL, p, m); n++; }
  }
  return n;
}
// otočenie plechu: predný koniec sa stane zadným
export function reverseSheet(sh) { sh.kmax.reverse(); sh.kf.reverse(); sh.tw.reverse(); sh.ov.reverse(); return sh; }
export { bendInfo };

const f0 = (v) => Math.round(v).toString();
const chk = (R0, tolR, { minAng = 0, maxEnd = Infinity, minBent = 0 }) => ({ sheet }) => {
  const b = sheet ? bendInfo(sheet) : null, ok = !!b && b.bent > 0;
  const out = [
    { key: 'radius', ok: ok && Math.abs(b.R - R0) <= tolR, actual: ok ? `R ${f0(b.R)} mm` : '–' },
    { key: 'even', ok: ok && b.spread <= tolR, actual: ok ? `± ${f0(b.spread)} mm` : '–' },
  ];
  if (minAng) out.push({ key: 'angle', ok: ok && b.angle >= minAng, actual: ok ? `${f0(b.angle)}°` : '–' });
  if (Number.isFinite(maxEnd)) out.push({ key: 'ends', ok: ok && Math.max(...b.ends) <= maxEnd, actual: ok ? `${f0(b.ends[0])} / ${f0(b.ends[1])} mm` : '–' });
  if (minBent) out.push({ key: 'bent', ok: ok && b.bent >= minBent, actual: ok ? `${f0(b.bent)} mm` : '–' });
  return out;
};
export const plateChecks = {
  plast: chk(250, 4, { minAng: 345, maxEnd: 25 }),     // plášť Ø500 z plechu 3 × 1000 × 1570
  oblukP: chk(400, 6, { minBent: 800 }),             // oblúk R 400 z plechu 4 mm
};
