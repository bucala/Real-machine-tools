// Ukážkové programy (generované, aby boli presné): polotovar 100 × 80 × 40 mm, nulový bod G54 v strede hornej plochy.
// Hlavičky nástrojov sú vo formáte postprocesora Fusion („T3 D=10. CR=0. - flat end mill“), aby sa dali prevziať.
import { L } from '../../core/i18n';
import { progDomeFlange } from './complexPrograms';

const f = (v) => {
  const s = (Math.round(v * 1000) / 1000).toFixed(3).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
};
const H = (v) => (v >= 0 ? `+${f(v)}` : f(v));
const isoHead = (o, title, tools) => [
  '%',
  `O${o} (${title})`,
  ...tools.map((t) => `(${t})`),
  'N10 G90 G94 G17 G21 G40 G49 G80',
  'N20 G54',
];
const isoEnd = () => ['M5 M9', 'G53 G0 Z0.', 'G49', 'G0 A0. C0.', 'M30', '%'];

// zigzag riadky v rovine pri výške z
const zig = (x0, x1, ys, z, F, out) => {
  ys.forEach((y, i) => {
    const [a, b] = i % 2 ? [x1, x0] : [x0, x1];
    out.push(`G1 X${f(a)} Y${f(y)} F${F}`, `X${f(b)}`);
  });
};

export function prog3axis() {
  const o = isoHead(1001, '3-OSE: CELO, KAPSA, OBVOD, DIERY', [
    'T1 D=50. CR=0.8 - face mill',
    'T3 D=10. CR=0. - flat end mill',
    'T2 D=16. CR=0. - flat end mill',
    'T5 D=8.5 CR=0. TAPER=118deg - drill',
  ]);
  o.push(
    '(CELO Z-1)',
    'T1 M6',
    'S6000 M3',
    'G0 A0. C0.',
    'G0 X-80. Y-22.',
    'G43 H1 Z30. M8',
    'G0 Z5.',
    'G1 Z-1. F800',
    'G1 X80. F2400',
    'G1 Y22.',
    'G1 X-80.',
    'G0 Z30.',
  );
  o.push('(KAPSA 50 X 30 HL. 6)', 'M5', 'T3 M6', 'S12000 M3', 'G0 X-20. Y-10.', 'G43 H3 Z30. M8', 'G0 Z1.');
  [-3, -5, -7].forEach((z) => {
    o.push(`G1 Z${f(z)} F300`);
    zig(-20, 20, [-10, -5, 0, 5, 10], z, 1800, o);
    o.push('G1 X-20. Y-10. F1800', 'X20.', 'Y10.', 'X-20.', 'Y-10.');
  });
  o.push('G0 Z30.');
  o.push('(OBVOD 90 X 70 R10 HL. 12)', 'M5', 'T2 M6', 'S9000 M3', 'G0 X-62. Y-43.', 'G43 H2 Z30. M8', 'G0 Z2.');
  [-4, -8, -12].forEach((z) => {
    o.push(
      `G1 Z${f(z)} F600`,
      'G1 X-35. Y-43. F1600',
      'G2 X-53. Y-25. I0. J18.',
      'G1 Y25.',
      'G2 X-35. Y43. I18. J0.',
      'G1 X35.',
      'G2 X53. Y25. I0. J-18.',
      'G1 Y-25.',
      'G2 X35. Y-43. I-18. J0.',
      'G1 X-62.',
    );
  });
  o.push('G0 Z30.');
  o.push(
    '(DIERY 4 X D8.5)',
    'M5',
    'T5 M6',
    'S4500 M3',
    'G0 X-35. Y-25.',
    'G43 H5 Z30. M8',
    'G0 Z10.',
    'G98 G83 X-35. Y-25. Z-22. R2. Q5. F350',
    'X35.',
    'Y25.',
    'X-35.',
    'G80',
    'G0 Z30.',
  );
  return [...o, ...isoEnd()].join('\n');
}

export function prog32() {
  const o = isoHead(1002, '3+2: SIKMA PLOCHA 30 ST. A DIERY', [
    'T3 D=10. CR=0. - flat end mill',
    'T5 D=8.5 CR=0. TAPER=118deg - drill',
  ]);
  o.push(
    '(NAKLONENA ROVINA A30 - G68.2 / G53.1)',
    'T3 M6',
    'S12000 M3',
    'G53 G0 Z0.',
    'G68.2 X0. Y20. Z0. I0. J-30. K0.',
    'G53.1',
    'G0 X-60. Y-6.',
    'G43 H3 Z20. M8',
    'G0 Z12.',
  );
  [8, 5, 2.5, 0].forEach((z) => {
    o.push(`G1 Z${f(z)} F600`);
    zig(-60, 60, [-6, 0, 6, 12, 18, 24, 30], z, 2000, o);
    o.push('G0 Z20.', 'G0 X-60. Y-6.');
  });
  o.push(
    'M5',
    'G49',
    'G53 G0 Z0.',
    '(DIERY KOLMO NA SIKMU PLOCHU)',
    'T5 M6',
    'S4500 M3',
    'G0 X-25. Y12.',
    'G43 H5 Z20. M8',
    'G0 Z10.',
    'G98 G81 X-25. Y12. Z-12. R2. F300',
    'X25.',
    'G80',
    'G0 Z20.',
    'M5',
    'G69',
  );
  return [...o, ...isoEnd()].join('\n');
}

export function prog5axis() {
  const o = isoHead(1003, '5-OSE: CAP S UKOSOM 20 ST. - TCP G43.4', [
    'T2 D=16. CR=0. - flat end mill',
    'T3 D=10. CR=0. - flat end mill',
  ]);
  o.push(
    '(HRUBOVANIE CAPU D86 VYSKA 17)',
    'T2 M6',
    'S9000 M3',
    'G0 A0. C0.',
    'G0 X75. Y0.',
    'G43 H2 Z30. M8',
    'G0 Z2.',
  );
  [-4, -8, -12, -17].forEach((z) => {
    o.push(`G1 Z${f(z)} F600`);
    [67, 59, 51].forEach((r) => o.push(`G1 X${f(r)} Y0. F2200`, `G2 X${f(r)} Y0. I${f(-r)} J0.`));
    o.push('G1 X75.');
  });
  o.push('G0 Z30.', 'M5', 'G49', 'G53 G0 Z0.');
  // kužeľ: spodok R 40,46 v Z-15, vrch R 35 v Z0; os nástroja leží v povrchovej priamke (sklon 20° dovnútra),
  // bok frézy sa dotýka kužeľa – A20 a C = −90° − θ sa menia spolu s X, Y (TCP drží špičku na dráhe)
  o.push(
    '(UKOS 20 ST. BOKOM FREZY - SIMULTANNE A + C S TCP G43.4)',
    'T3 M6',
    'S11000 M3',
    'G43.4 H3',
    'G0 X75. Y0. Z20. A20. C-90.',
    'M8',
  );
  const tilt = (20 * Math.PI) / 180,
    R = 5,
    rb = 35 + 15 * Math.tan(tilt);
  const pt = (th) => {
    const c = Math.cos(th),
      s = Math.sin(th),
      rr = rb + R * Math.cos(tilt);
    return [rr * c, rr * s, -15 + R * Math.sin(tilt)];
  };
  const [x0, y0, zt] = pt(0);
  o.push(`G1 X${f(x0 + 12)} Y${f(y0)} Z${f(zt)} A20. C-90. F2000`, `G1 X${f(x0)} F800`);
  for (let d = 0; d <= 360; d += 3) {
    const [x, y, z] = pt((d * Math.PI) / 180);
    o.push(`G1 X${f(x)} Y${f(y)} Z${f(z)} A20. C${f(-90 - d)} F1200`);
  }
  o.push(`G1 X${f(x0 + 12)} Y${f(y0)} F2000`, 'G0 Z30.', 'G49', 'M5');
  return [...o, ...isoEnd()].join('\n');
}

export function progHeid() {
  const o = [
    '0 BEGIN PGM DIEL4 MM',
    '1 BLK FORM 0.1 Z X-50 Y-40 Z-40',
    '2 BLK FORM 0.2 X+50 Y+40 Z+0',
    '; T1 D=50 CR=0.8 - face mill',
    '; T3 D=10 CR=0 - flat end mill',
    '; T5 D=8.5 CR=0 TAPER=118deg - drill',
    'TOOL CALL 1 Z S6000',
    'L Z+100 R0 FMAX M3 M8',
    'L X-80 Y-22 R0 FMAX',
    'L Z+5 R0 FMAX',
    'L Z-1 R0 F800',
    'L X+80 R0 F2400',
    'L Y+22',
    'L X-80',
    'L Z+50 R0 FMAX',
    'M5',
    '* - KRUHOVA KAPSA D40 HL. 6',
    'TOOL CALL 3 Z S12000',
    'L X+0 Y+0 R0 FMAX M3',
    'L Z+2 R0 FMAX',
    'CC X+0 Y+0',
  ];
  [-3, -5, -7].forEach((z) => {
    o.push(`L X+0 Y+0 Z${H(z)} R0 F300`);
    [5, 10, 15].forEach((r) => o.push(`L X${H(r)} Y+0 R0 F1800`, `C X${H(r)} Y+0 DR-`));
  });
  o.push(
    'L Z+50 R0 FMAX',
    'M5',
    '* - SIKMA PLOCHA SPA-25 (PLANE SPATIAL)',
    'PLANE SPATIAL SPA-25 SPB+0 SPC+0 TURN MB MAX FMAX',
    'L X-60 Y-6 R0 FMAX M3',
    'L Z+25 R0 FMAX',
  );
  [16, 12, 8, 4, 0].forEach((z) => {
    o.push(`L Z${H(z)} R0 F600`);
    [-6, 2, 10, 18, 26, 34, 42, 50].forEach((y, i) => {
      const [a, b] = i % 2 ? [60, -60] : [-60, 60];
      o.push(`L X${H(a)} Y${H(y)} R0 F2000`, `L X${H(b)}`);
    });
    o.push('L Z+25 R0 FMAX', 'L X-60 Y-6 R0 FMAX');
  });
  o.push(
    'M5',
    '* - VRTANIE KOLMO NA SIKMU PLOCHU',
    'TOOL CALL 5 Z S4500',
    'L X-25 Y+20 R0 FMAX M3',
    'L Z+30 R0 FMAX',
    'CYCL DEF 200 VRTANIE',
    'Q200=+2 ;BEZP. VZDIALENOST',
    'Q201=-12 ;HLBKA',
    'Q206=+300 ;POSUV PRISUVU',
    'Q202=+5 ;HLBKA PRISUVU',
    'Q210=+0 ;CAS ZOTRV. HORE',
    'Q203=+0 ;SURAD. POVRCHU',
    'Q204=+30 ;2. BEZP. VZDIAL.',
    'Q211=+0 ;CAS ZOTRV. DOLE',
    'L X-25 Y+20 R0 FMAX M99',
    'L X+25 Y+20 R0 FMAX M99',
    'M5 M9',
    'PLANE RESET TURN MB MAX FMAX',
    'L Z+100 R0 FMAX M30',
    'END PGM DIEL4 MM',
  );
  return o.map((s, i) => (/^\d+\s/.test(s) ? s : `${i} ${s}`)).join('\n');
}

export const SAMPLES = () => [
  {
    id: 'cx5',
    name: L(
      'Zložitý diel: príruba s kupolou – 8 nástrojov, 3+2 a 5-osé TCP (ISO, dlhý)',
      'Complex part: dome flange – 8 tools, 3+2 and 5-axis TCP (ISO, long)',
    ),
    get text() {
      return progDomeFlange();
    },
  },
  {
    id: 'p3',
    name: L('3-osé: čelo, kapsa, obvod, diery (ISO)', '3-axis: face, pocket, contour, holes (ISO)'),
    text: prog3axis(),
  },
  {
    id: 'p32',
    name: L('3+2: šikmá plocha 30° a diery – G68.2 (ISO)', '3+2: 30° inclined face and holes – G68.2 (ISO)'),
    text: prog32(),
  },
  {
    id: 'p5',
    name: L('5-osé simultánne: čap s úkosom – TCP G43.4 (ISO)', '5-axis simultaneous: tapered boss – TCP G43.4 (ISO)'),
    text: prog5axis(),
  },
  {
    id: 'ph',
    name: L(
      'Heidenhain Klartext: kapsa, PLANE SPATIAL, cyklus 200',
      'Heidenhain conversational: pocket, PLANE SPATIAL, cycle 200',
    ),
    text: progHeid(),
  },
];
