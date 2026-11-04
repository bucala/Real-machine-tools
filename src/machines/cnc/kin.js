// Kinematika 5-osého centra s otočno-sklopným stolom (predloha Hermle C 32): lineárne osi X, Y, Z nesie nástroj,
// stôl sa skláňa okolo osi A (rovnobežná s X) a otáča okolo osi C (kolmá na plochu stola). Dĺžky v mm, uhly v stupňoch.
// Rám stola T: počiatok v strede plochy stola, z hore po osi C. Rám stroja M: počiatok v priesečníku osí A a C
// (otočný bod), X doprava, Y od obsluhy, Z hore. Os A leží hA nad plochou stola (stôl tvaru U – os v obrobku).
// Bod stola do stroja: m = Rx(A) · (Rz(C) · pT − hA·ẑ). Nástroj v stroji vždy smeruje +Z.

// K = mierka konštrukcie voči C 32 (pre 3D model), tcY = poloha výmeny nástroja nad zásobníkom
export const MODELS = {
  c32: {
    id: 'c32', name: 'C 32 U', K: 1, table: 650, mag: 36, upperW: 3.0,
    hA: 100,                          // výška osi A nad plochou stola pri A = 0
    X: [-325, 325], Y: [-325, 325],   // dráhy 650 / 650 mm
    nose: [35, 535],                  // čelo vretena nad otočným bodom (Z dráha 500 mm, svetlá výška 135 – 635 mm)
    A: [-130, 130],                   // rozsah sklápania
    rapid: 45000, rapidZ: 40000,      // mm/min
    vA: 25 * 360 / 60, vC: 30 * 360 / 60,   // °/s (25 a 30 ot/min)
    smax: 18000, pmax: 42, mmax: 148, // vreteno HSK-A63: 42 kW / 148 Nm
    tc: 4.5, tcY: 320,                // čas výmeny nástroja (s), poloha výmeny
  },
  // C 42 U – orientačné údaje (bez katalógu): väčší stroj rovnakej koncepcie
  c42: {
    id: 'c42', name: 'C 42 U', K: 1.23, table: 800, mag: 42, upperW: 4.4, approx: true,
    hA: 123, X: [-400, 400], Y: [-400, 400], nose: [43, 593], A: [-130, 130],
    rapid: 60000, rapidZ: 55000, vA: 25 * 360 / 60, vC: 30 * 360 / 60,
    smax: 18000, pmax: 35, mmax: 130, tc: 5, tcY: 394,
  },
};
export const MACH = MODELS.c32;
const D2R = Math.PI / 180;
export const rotX = (p, a) => { const c = Math.cos(a * D2R), s = Math.sin(a * D2R); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; };
export const rotZ = (p, a) => { const c = Math.cos(a * D2R), s = Math.sin(a * D2R); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; };
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// rám stola → stroj a späť
export const toMach = (pT, a, c, hA = MACH.hA) => rotX(sub(rotZ(pT, c), [0, 0, hA]), a);
export const toTable = (m, a, c, hA = MACH.hA) => rotZ(add(rotX(m, -a), [0, 0, hA]), -c);
// os nástroja (+Z stroja) v ráme stola
export const toolAxisT = (a, c) => rotZ(rotX([0, 0, 1], -a), -c);
// inverzná úloha: os nástroja v ráme stola → (A, C); v = (sin A · sin C, sin A · cos C, cos A)
export function axisToAC(v, cPrev = 0, lim = MACH.A) {
  const n = norm(v), A = Math.acos(Math.max(-1, Math.min(1, n[2]))) / D2R;
  let C = Math.abs(Math.sin(A * D2R)) < 1e-9 ? cPrev : Math.atan2(n[0], n[1]) / D2R;
  const near = (c) => { let x = c; while (x - cPrev > 180) x -= 360; while (x - cPrev < -180) x += 360; return x; };
  const sols = [[A, near(C)], [-A, near(C + 180)]].filter(([a]) => a >= lim[0] - 1e-6 && a <= lim[1] + 1e-6);
  if (!sols.length) return null;
  sols.sort((p, q) => Math.abs(p[1] - cPrev) - Math.abs(q[1] - cPrev) || (q[0] >= 0) - (p[0] >= 0));
  return { a: sols[0][0], c: sols[0][1] };
}
// matice 3 × 3 (riadky) pre naklonenú rovinu
export const matMul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
export const matVec = (M, v) => M.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
export const matT = (M) => [0, 1, 2].map((i) => [M[0][i], M[1][i], M[2][i]]);
const RX = (a) => { const c = Math.cos(a * D2R), s = Math.sin(a * D2R); return [[1, 0, 0], [0, c, -s], [0, s, c]]; };
const RY = (a) => { const c = Math.cos(a * D2R), s = Math.sin(a * D2R); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; };
const RZ = (a) => { const c = Math.cos(a * D2R), s = Math.sin(a * D2R); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; };
export const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
export const eulerZXZ = (i, j, k) => matMul(matMul(RZ(i), RX(j)), RZ(k));      // Fanuc G68.2 I J K
export const spatialABC = (a, b, c) => matMul(matMul(RZ(c), RY(b)), RX(a));   // Heidenhain PLANE SPATIAL SPA SPB SPC
