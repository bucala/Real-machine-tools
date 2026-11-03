// Profilová ohýbačka (tri valce v pyramíde) bez three.js: pružno-plastický ohyb s odpružením, profil ako
// pole krivostí po dĺžke a rozbor ohnutého oblúka. Testované v tests/bender.test.js.
// Jednotky: dĺžky v metroch, krivosť v 1/m (v scéne sa prepočíta na 1 = 100 mm).

export const STEEL = { E: 210e9, fy: 235e6 };
export const BEND_A = 0.2;                 // polovica rozpätia krajných valcov (m)
export const BEND_SPEEDS = [3, 5, 8];      // m/min

// profily: h = rozmer v rovine ohybu (mm), b = rozmer kolmo (mm), c = vzdialenosť krajného vlákna od neutrálnej osi (mm),
// W = prierezový modul (mm³), k = tvarový súčiniteľ (Mp / My), rolls = potrebné valce, guide = potrebuje bočné vodiace kladky
export const PROFILES = {
  ploNap: { h: 10, b: 40, c: 5, W: 667, k: 1.5, rolls: 'plocha', guide: false, shape: 'rect' },
  ploNas: { h: 40, b: 10, c: 20, W: 2667, k: 1.5, rolls: 'plocha', guide: true, shape: 'rect' },
  rura: { h: 33.7, b: 33.7, c: 16.85, W: 2043, k: 1.32, rolls: 'rura', guide: false, shape: 'tube', t: 3 },
  jakl: { h: 30, b: 30, c: 15, W: 1961, k: 1.2, rolls: 'plocha', guide: false, shape: 'box', t: 2 },
  uhol: { h: 40, b: 40, c: 28.8, W: 1552, k: 1.7, rolls: 'plocha', guide: true, shape: 'angle', t: 4 },
};

// krivosť medze klzu krajného vlákna
export const kYield = (p, m = STEEL) => m.fy / (m.E * p.c / 1000);
// trvalá krivosť po odľahčení z najväčšej zaťaženej krivosti kL (moment M = My (k − (k − 1)(κy/κ)²) nad medzou klzu)
export function kFinal(kL, p, m = STEEL) {
  const ky = kYield(p, m), a = Math.abs(kL);
  if (a <= ky) return 0;
  return Math.sign(kL) * (a - ky * (p.k - (p.k - 1) * (ky / a) ** 2));
}
// ohybový moment (N·m) pri zaťaženej krivosti
export function moment(kL, p, m = STEEL) {
  const ky = kYield(p, m), a = Math.abs(kL), My = m.fy * p.W * 1e-9;
  return a <= ky ? My * a / ky : My * (p.k - (p.k - 1) * (ky / a) ** 2);
}
// krivosť v zábere: kružnica cez tri dotyky, stredný valec vysunutý o δ (m) voči priamke krajných valcov
export const kLoaded = (d, a = BEND_A) => (d <= 0 ? 0 : 2 * d / (a * a + d * d));
export const deltaFor = (k, a = BEND_A) => { if (k <= 0) return 0; const R = 1 / k; return R - Math.sqrt(Math.max(0, R * R - a * a)); };
// sila na strednom valci (N): trojbodový ohyb s rozpätím 2a
export const rollForce = (kL, p, a = BEND_A) => 2 * moment(kL, p) / a;
// zaťažená krivosť pre požadovanú trvalú krivosť (bisekcia)
export function kLoadedFor(kf, p, m = STEEL) {
  let lo = 0, hi = kf + 4 * kYield(p, m) * p.k + 1;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (kFinal(mid, p, m) < kf) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

// profil dĺžky L (m) rozdelený na prvky ds: kmax = najväčšia zaťažená krivosť, kf = trvalá krivosť, tw / ov = skrútenie / zvlnenie
export function createBar(L, ds = 0.01) {
  const N = Math.max(2, Math.round(L / ds));
  return { L, N, ds: L / N, kmax: new Float32Array(N), kf: new Float32Array(N), tw: new Uint8Array(N), ov: new Uint8Array(N) };
}
// prechod úseku profilu [u0, u1] (m od predného konca) stredným valcom so zaťaženou krivosťou kL.
// Ohýba sa len prvok, keď profil leží na oboch krajných valcoch (koniec je ďalej ako a od stredného valca).
// defect: 'tw' (bez vodiacich kladiek) alebo 'ov' (nevhodné valce) – zapíše sa na ohnuté prvky.
export function passBar(bar, p, u0, u1, kL, a = BEND_A, defect = null) {
  const lo = Math.min(u0, u1), hi = Math.max(u0, u1);
  let n = 0;
  const i0 = Math.max(0, Math.floor(lo / bar.ds)), i1 = Math.min(bar.N - 1, Math.floor(hi / bar.ds));
  for (let i = i0; i <= i1; i++) {
    const u = (i + 0.5) * bar.ds;
    if (u < a || bar.L - u < a) continue;
    if (kL > bar.kmax[i]) {
      bar.kmax[i] = kL; bar.kf[i] = kFinal(kL, p); n++;
      if (defect && bar.kf[i] > 0) bar[defect][i] = 1;
    }
  }
  return n;
}

// rozbor ohnutého profilu: ohnutá časť = prvky s krivosťou nad polovicou mediánu ohnutých prvkov.
// R = stredný polomer (mm), spread = najväčšia odchýlka polomeru v ohnutej časti (mm, bez krajných 3 %),
// angle = uhol oblúka (°), ends = rovné konce (mm), bent = dĺžka ohnutej časti (mm), tw / ov = počet chybných prvkov
export function bendInfo(bar) {
  const ks = Array.from(bar.kf).filter((k) => k > 1e-4).sort((x, y) => x - y);
  if (!ks.length) return { R: 0, spread: 0, angle: 0, ends: [bar.L * 1000, 0], bent: 0, tw: 0, ov: 0 };
  const kmed = ks[Math.floor(ks.length / 2)], lim = kmed * 0.5;
  let first = -1, last = -1;
  for (let i = 0; i < bar.N; i++) if (bar.kf[i] > lim) { if (first < 0) first = i; last = i; }
  const n = last - first + 1, cut = Math.floor(n * 0.03);
  let sk = 0, ang = 0, tw = 0, ov = 0;
  for (let i = first; i <= last; i++) { sk += bar.kf[i]; ang += bar.kf[i] * bar.ds; tw += bar.tw[i]; ov += bar.ov[i]; }
  const R = n / sk;
  let spread = 0;
  for (let i = first + cut; i <= last - cut; i++) spread = Math.max(spread, Math.abs((bar.kf[i] > 1e-6 ? 1 / bar.kf[i] : 1e3) - R));
  return { R: R * 1000, spread: spread * 1000, angle: ang * 180 / Math.PI, ends: [first * bar.ds * 1000, (bar.N - 1 - last) * bar.ds * 1000], bent: n * bar.ds * 1000, tw, ov };
}

const f0 = (v) => Math.round(v).toString();
const mk = (R0, tolR, minBent, minAng) => ({ bar }) => {
  const b = bar ? bendInfo(bar) : null, ok = !!b && b.bent > 0;
  const out = [
    { key: 'radius', ok: ok && Math.abs(b.R - R0) <= tolR, actual: ok ? `R ${f0(b.R)} mm` : '–' },
    { key: 'even', ok: ok && b.spread <= tolR, actual: ok ? `± ${f0(b.spread)} mm` : '–' },
  ];
  if (minBent) out.push({ key: 'bent', ok: ok && b.bent >= minBent, actual: ok ? `${f0(b.bent)} mm` : '–' });
  if (minAng) out.push({ key: 'angle', ok: ok && b.angle >= minAng, actual: ok ? `${f0(b.angle)}°` : '–' });
  out.push({ key: 'defect', ok: ok && b.tw === 0 && b.ov === 0, actual: ok ? (b.tw || b.ov ? `${b.tw + b.ov}` : '0') : '–' });
  return out;
};
export const bendChecks = {
  oblukNap: mk(500, 10, 1000, 0),          // plochá tyč 40×10 naplocho, oblúk R 500 na dĺžke aspoň 1 m
  prstenec: mk(300, 8, 0, 345),           // rúra Ø33,7×3, prstenec R 300
  oblukNas: mk(800, 15, 1000, 0),          // plochá tyč 40×10 nastojato, R 800 s vodiacimi kladkami
};
