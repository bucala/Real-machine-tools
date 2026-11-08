// Dlhé ukážkové programy, ktoré ukážu zložitosť 5-osých centier: viac nástrojov, tvarové plochy, 3+2 aj
// simultánne 5-osé obrábanie. Programy sa generujú výpočtom (presná geometria), polotovar 100 × 80 × 40 mm,
// nulový bod G54 v strede hornej plochy, formát hlavičiek nástrojov ako z postprocesora Fusion.
const f = (v) => {
  const s = (Math.round(v * 1000) / 1000).toFixed(3).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
};
const head = (o, title, tools) => [
  '%',
  `O${o} (${title})`,
  ...tools.map((t) => `(${t})`),
  'N10 G90 G94 G17 G21 G40 G49 G80',
  'N20 G54',
];
const end = () => ['M5 M9', 'G53 G0 Z0.', 'G49', 'G0 A0. C0.', 'M30', '%'];
const toolChange = (o, t, s, x, y, extra = []) =>
  o.push(
    'M5',
    'G49',
    'G53 G0 Z0.',
    `T${t} M6`,
    `S${s} M3`,
    'G0 A0. C0.',
    `G0 X${f(x)} Y${f(y)}`,
    `G43 H${t} Z30. M8`,
    ...extra,
  );
// zaoblený obdĺžnik (stred v 0): body po obvode proti smeru hodín s vonkajšou normálou
function roundedRect(hx, hy, r, step = 3, astep = 6) {
  const pts = [],
    seg = (x0, y0, x1, y1, nx, ny) => {
      const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
      for (let i = 0; i < n; i++) pts.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, nx, ny]);
    },
    arc = (cx, cy, a0) => {
      for (let a = a0; a < a0 + 90; a += astep) {
        const t = (a * Math.PI) / 180;
        pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t), Math.cos(t), Math.sin(t)]);
      }
    };
  seg(hx, -hy + r, hx, hy - r, 1, 0);
  arc(hx - r, hy - r, 0);
  seg(hx - r, hy, -hx + r, hy, 0, 1);
  arc(-hx + r, hy - r, 90);
  seg(-hx, hy - r, -hx, -hy + r, -1, 0);
  arc(-hx + r, -hy + r, 180);
  seg(-hx + r, -hy, hx - r, -hy, 0, -1);
  arc(hx - r, -hy + r, 270);
  return pts;
}

// HERMLE: príruba s guľovou kupolou – 8 nástrojov, 3-osé, 3+2 aj simultánne 5-osé s TCP
let domeCache = null,
  moldCache = null;
export const progDomeFlange = () => (domeCache ||= buildDomeFlange());
export const progMold = () => (moldCache ||= buildMold());
function buildDomeFlange() {
  const o = head(1004, 'PRIRUBA S KUPOLOU - 5-OSE, 8 NASTROJOV', [
    'T1 D=50. CR=0.8 - face mill',
    'T2 D=16. CR=0. - flat end mill',
    'T3 D=10. CR=0. - flat end mill',
    'T8 D=10. CR=5. - ball end mill',
    'T9 D=12. CR=2. - bull nose end mill',
    'T6 D=12. CR=0. TAPER=90deg - chamfer mill',
    'T5 D=8.5 CR=0. TAPER=118deg - drill',
    'T10 D=5. CR=0. TAPER=118deg - drill',
  ]);
  // 1) čelo
  o.push('(1 - CELO Z-1 - T1)', 'T1 M6', 'S6000 M3', 'G0 A0. C0.', 'G0 X-80. Y-25.', 'G43 H1 Z30. M8', 'G0 Z5.');
  o.push('G1 Z-1. F800', 'G1 X80. F2400', 'G1 Y0.', 'G1 X-80.', 'G1 Y25.', 'G1 X80.', 'G0 Z30.');
  // 2) obvod 96 × 76 R8 do hĺbky 20, štyri prechody
  const outer = roundedRect(56, 46, 16, 6, 10);
  toolChange(o, 2, 9000, outer[0][0] + 6, outer[0][1], ['(2 - OBVOD 96 X 76 R8 HL. 20 - T2)', 'G0 Z2.']);
  for (const z of [-5, -10, -15, -20]) {
    o.push(`G1 Z${f(z)} F600`);
    outer.forEach(([x, y], i) => o.push(`G1 X${f(x)} Y${f(y)}${i ? '' : ' F1800'}`));
    o.push(`G1 X${f(outer[0][0])} Y${f(outer[0][1])}`);
  }
  o.push('G0 Z30.');
  // 3) prstencová kapsa Ø68 okolo guľovej kupoly R32 (vrchol Z-2), vrstvy po 2 mm
  const R = 32,
    zc = -34,
    rd = (z) => (z < -2 ? Math.sqrt(R * R - (z - zc) ** 2) : 0);
  toolChange(o, 3, 12000, 29, 0, ['(3 - KAPSA D68 OKOLO KUPOLY HL. 13 - T3)', 'G0 Z2.']);
  for (let z = -3; z >= -13; z -= 2) {
    o.push(`G1 X29. Y0. Z${f(z)} F300`);
    const rMin = rd(z) + 5.4;
    for (let r = 29; r >= rMin - 0.01; r -= 3.5) o.push(`G1 X${f(r)} Y0. F2000`, `G3 X${f(r)} Y0. I${f(-r)} J0.`);
    o.push('G1 X29. Y0.');
  }
  o.push('G0 Z30.');
  // 4) dokončenie kupoly guľovou frézou – súvislá špirála od vrcholu po dno kapsy
  const rb = 5,
    phiMax = Math.acos((-13 - zc) / R),
    turns = 28,
    per = 72;
  toolChange(o, 8, 14000, 0, 0, ['(4 - KUPOLA R32 - SPIRALA GULOVOU FREZOU - T8)', 'G0 Z2.']);
  o.push(`G1 Z${f(zc + R)} F600`);
  for (let i = 1; i <= turns * per; i++) {
    const th = (2 * Math.PI * i) / per,
      phi = (phiMax * i) / (turns * per),
      rr = (R + rb) * Math.sin(phi);
    o.push(
      `G1 X${f(rr * Math.cos(th))} Y${f(rr * Math.sin(th))} Z${f(zc + (R + rb) * Math.cos(phi) - rb)}${i === 1 ? ' F2600' : ''}`,
    );
  }
  o.push('G0 Z30.');
  // 5) 3+2: šikmé plochy 20° na dlhých hranách (G68.2, rovina natočená okolo Z o 0° a 180°)
  toolChange(o, 9, 10000, 0, 0, ['(5 - 3+2 SIKME PLOCHY 20 ST. NA DLHYCH HRANACH - T9)']);
  for (const c of [0, 180]) {
    o.push(
      'G49',
      'G53 G0 Z0.',
      `G68.2 X0. Y-38. Z-1. I${c} J-20. K0.`,
      'G53.1',
      'G0 X-60. Y-10.',
      'G43 H9 Z20.',
      'G0 Z8.',
    );
    for (const z of [5, 2.5, 0]) {
      o.push(`G1 Z${f(z)} F600`);
      [-10, -5, 0, 4].forEach((y, i) => {
        const [a, b] = i % 2 ? [60, -60] : [-60, 60];
        o.push(`G1 X${f(a)} Y${f(y)} F2200`, `X${f(b)}`);
      });
      o.push('G0 Z8.', 'G0 X-60. Y-10.');
    }
    o.push('G0 Z20.', 'G69');
  }
  // 6) simultánne 5-osé: úkos obvodovej steny 10° bokom frézy, A a C sa menia spolu s X, Y (TCP G43.4)
  const tilt = (10 * Math.PI) / 180,
    rt = 5,
    wall = roundedRect(48, 38, 8, 3, 6);
  o.push('M5', 'G49', 'G53 G0 Z0.', '(6 - 5-OSE: UKOS OBVODU 10 ST. - TCP G43.4 - T3)', 'T3 M6', 'S11000 M3');
  const tip = ([x, y, nx, ny]) => [
    x + nx * rt * Math.cos(tilt),
    y + ny * rt * Math.cos(tilt),
    -20 + rt * Math.sin(tilt),
  ];
  const cang = ([, , nx, ny]) => -90 - (Math.atan2(ny, nx) * 180) / Math.PI;
  let cPrev = cang(wall[0]);
  const [x0, y0, z0] = tip(wall[0]);
  o.push(
    'G43.4 H3',
    `G0 X${f(x0 + 15)} Y${f(y0)} Z20. A10. C${f(cPrev)}`,
    'M8',
    `G1 Z${f(z0)} F1500`,
    `G1 X${f(x0)} F600`,
  );
  [...wall, wall[0]].forEach((p) => {
    let cc = cang(p);
    while (cc - cPrev > 180) cc -= 360;
    while (cc - cPrev < -180) cc += 360;
    cPrev = cc;
    const [x, y, z] = tip(p);
    o.push(`G1 X${f(x)} Y${f(y)} Z${f(z)} A10. C${f(cc)} F1400`);
  });
  o.push(`G1 X${f(x0 + 15)} F2000`, 'G0 Z30.', 'G49');
  // 7) diery Ø8,5 v rohoch (G83) a Ø5 na kružnici v dne kapsy (G81)
  const corners = [
    [-36, -26],
    [36, -26],
    [36, 26],
    [-36, 26],
  ];
  toolChange(o, 5, 4500, -36, -26, ['(7 - DIERY D8.5 V ROHOCH - T5)', 'G0 Z10.']);
  o.push(
    `G98 G83 X-36. Y-26. Z-24. R2. Q5. F350`,
    ...corners.slice(1).map(([x, y]) => `X${f(x)} Y${f(y)}`),
    'G80',
    'G0 Z30.',
  );
  const bolt = Array.from({ length: 8 }, (_, i) => [
    29 * Math.cos((i * Math.PI) / 4),
    29 * Math.sin((i * Math.PI) / 4),
  ]);
  toolChange(o, 10, 6000, bolt[0][0], bolt[0][1], ['(8 - 8 X D5 NA KRUZNICI R29 V DNE KAPSY - T10)', 'G0 Z10.']);
  o.push(
    `G98 G81 X${f(bolt[0][0])} Y${f(bolt[0][1])} Z-24. R-11. F300`,
    ...bolt.slice(1).map(([x, y]) => `X${f(x)} Y${f(y)}`),
    'G80',
    'G0 Z30.',
  );
  // 8) zrazenie hrán dier skosovacou frézou
  toolChange(o, 6, 8000, -36, -26, ['(9 - ZRAZENIE HRAN DIER 0.8 X 45 ST. - T6)', 'G0 Z10.']);
  o.push(
    `G98 G81 X-36. Y-26. Z-6.05 R2. F400`,
    ...corners.slice(1).map(([x, y]) => `X${f(x)} Y${f(y)}`),
    'G80',
    'G0 Z30.',
  );
  return [...o, ...end()].join('\n');
}

// RÖDERS: forma s voľnou plochou – vlnité dno dutiny, hrubovanie, polodokončenie a dokončenie guľovou frézou
// (rastre, tisíce blokov ako pri HSC obrábaní foriem), vyhadzovacie diery
const W = 40,
  Hh = 30;
export function moldSurface(x, y) {
  const u = Math.abs(x) / W,
    v = Math.abs(y) / Hh;
  if (u >= 1 || v >= 1) return 0;
  const g = (1 - u ** 4) * (1 - v ** 4);
  return -g * (8 + 2.5 * Math.sin((Math.PI * x) / 20) * Math.cos((Math.PI * y) / 30));
}
// najnižšia bezpečná výška čela nástroja nad plochou (ploché čelo alebo guľa) – vzorkovanie plochy pod nástrojom
function toolZ(x, y, r, ball) {
  let z = -Infinity;
  for (let a = 0; a < 12; a++)
    for (const k of [0, 0.5, 1]) {
      const d = k * r,
        t = (a * Math.PI) / 6,
        s = moldSurface(x + d * Math.cos(t), y + d * Math.sin(t));
      z = Math.max(z, ball ? s + Math.sqrt(r * r - d * d) - r : s);
    }
  return z;
}
function raster(o, { r, ball, step, dx, allow, level = -Infinity, F }) {
  let first = true;
  for (let y = -Hh - r + 2, i = 0; y <= Hh + r - 2; y += step, i++) {
    const xs = [];
    for (let x = -W - r; x <= W + r + 0.01; x += dx) xs.push(x);
    if (i % 2) xs.reverse();
    xs.forEach((x, j) => {
      const z = Math.min(1, Math.max(level, toolZ(x, y, r, ball) + allow));
      if (first) {
        o.push(`G0 X${f(x)} Y${f(y)}`, `G1 Z${f(z)} F600`);
        first = false;
      } else o.push(`G1 X${f(x)} Y${f(y)} Z${f(z)}${j === 0 && i === 1 ? ` F${F}` : ''}`);
    });
  }
}
function buildMold() {
  const o = head(1005, 'ROEDERS - FORMA S VOLNOU PLOCHOU - HSC', [
    'T2 D=16. CR=0. - flat end mill',
    'T8 D=10. CR=5. - ball end mill',
    'T4 D=6. CR=3. - ball end mill',
    'T10 D=5. CR=0. TAPER=118deg - drill',
  ]);
  o.push(
    '(1 - HRUBOVANIE PO VRSTVACH, PRIDAVOK 0.5 - T2)',
    'T2 M6',
    'S16000 M3',
    'G0 A0. C0.',
    'G0 X-56. Y-36.',
    'G43 H2 Z30. M8',
  );
  for (const level of [-3, -6, -9, -11]) raster(o, { r: 8, ball: false, step: 10, dx: 3, allow: 0.5, level, F: 3000 });
  o.push('G0 Z30.', 'M5', 'G49', 'G53 G0 Z0.');
  o.push(
    '(2 - POLODOKONCENIE GULOU D10, PRIDAVOK 0.15 - T8)',
    'T8 M6',
    'S18000 M3',
    'G0 X-45. Y-35.',
    'G43 H8 Z30. M8',
  );
  raster(o, { r: 5, ball: true, step: 3, dx: 2, allow: 0.15, F: 4000 });
  o.push('G0 Z30.', 'M5', 'G49', 'G53 G0 Z0.');
  o.push('(3 - DOKONCENIE GULOU D6, KROK 1.2 - T4)', 'T4 M6', 'S24000 M3', 'G0 X-43. Y-33.', 'G43 H4 Z30. M8');
  raster(o, { r: 3, ball: true, step: 1.2, dx: 1.5, allow: 0, F: 5000 });
  o.push('G0 Z30.', 'M5', 'G49', 'G53 G0 Z0.');
  o.push('(4 - VYHADZOVACIE DIERY D5 - T10)', 'T10 M6', 'S8000 M3', 'G0 X-44. Y-34.', 'G43 H10 Z30. M8', 'G0 Z10.');
  o.push('G98 G83 X-44. Y-34. Z-20. R2. Q4. F300', 'X44.', 'Y34.', 'X-44.', 'G80', 'G0 Z30.');
  return [...o, ...end()].join('\n');
}
