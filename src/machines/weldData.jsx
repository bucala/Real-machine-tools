// Zváranie (MMA a MIG/MAG): konštanty stroja, diely na prehliadku, úlohy a BOZP (bez three.js scény).
import { L } from '../core/i18n';
import { RES } from './weldShape';
import { migChecks, weldChecks } from './shopMath';
import { mkParts } from '../ui/common';

export const WELD_TT = 8.0; // výška zváracieho stola
export const WELD_DIAL = [55, 70, 80, 90, 100, 120, 155]; // stupne prúdu na stupnici
export const WELD_DIAL_ANG = WELD_DIAL.map((_, i) => 2.0 - (i * 4.0) / 6);
export const WELD_MODES = [
  ['off', '0'],
  ['w380', '380 V'],
  ['w220', '220 V'],
  ['charge', 'NAB.'],
];
export const WELD_MODE_ANG = [1.25, 0.45, -0.35, -1.15];
export const ELECTRODES = {
  rutile: {
    sk: 'Rutilová E 6013',
    en: 'Rutile E 6013',
    r: { 2: [40, 70], 2.5: [55, 95], 3.2: [80, 135], 4: [120, 180] },
  },
  basic: { sk: 'Bázická E 7018', en: 'Basic E 7018', r: { 2.5: [65, 105], 3.2: [95, 145], 4: [130, 190] } },
};
// g = skupina tvaru a vzájomnej polohy polotovarov (weldShape.js – SHAPE_GROUPS)
export const WELD_TYPES = [
  { id: 'I', g: 'plane', sk: 'Zvar I', en: 'Square butt', t: [1, 4], sym: 'M11 4v16M19 4v16' },
  { id: 'V', g: 'plane', sk: 'Zvar V', en: 'Single-V', t: [4, 16], sym: 'M7 4l8 16 8-16' },
  { id: 'HV', g: 'plane', sk: 'Zvar ½ V', en: 'Single-bevel', t: [4, 16], sym: 'M11 4v16l10-16' },
  { id: 'Y', g: 'plane', sk: 'Zvar Y', en: 'Y butt', t: [6, 20], sym: 'M7 4l8 9 8-9M15 13v7' },
  { id: 'U', g: 'plane', sk: 'Zvar U', en: 'Single-U', t: [12, 30], sym: 'M8 4v5a7 7 0 0 0 14 0V4M15 16v4' },
  { id: 'J', g: 'plane', sk: 'Zvar J', en: 'Single-J', t: [12, 30], sym: 'M11 4v16M11 15a7 7 0 0 0 9-7V4' },
  { id: 'K', g: 'perp', sk: 'Kútový', en: 'Fillet (T)', t: [2, 25], sym: 'M8 20h14L8 6z' },
  { id: 'L', g: 'plane', sk: 'Presahový', en: 'Lap', t: [2, 10], sym: 'M6 14h18M6 18h18' },
  { id: 'E', g: 'plane', sk: 'Lemový', en: 'Edge', t: [1, 3], sym: 'M8 6q0 10 6 12M22 6q0 10-6 12' },
  { id: 'N', g: 'plane', sk: 'Návar', en: 'Build-up', t: [4, 30], sym: 'M5 10a5 5 0 0 0 10 0a5 5 0 0 0 10 0' },
  { id: 'C', g: 'perp', sk: 'Rohový vnútorný', en: 'Inside corner', t: [2, 20], sym: 'M5 20h18V4M23 14l-6 6' },
  {
    id: 'O',
    g: 'perp',
    sk: 'Rohový vonkajší',
    en: 'Outside corner',
    t: [2, 12],
    sym: 'M4 21l11-15 11 15M11 11l4-5 4 5',
  },
  {
    id: 'RR',
    g: 'round',
    sk: 'Rúra – rúra',
    en: 'Pipe to pipe',
    t: [2, 10],
    sym: 'M4 7h22M4 17h22M15 4v16M4 7v10M26 7v10',
  },
  {
    id: 'RP',
    g: 'round',
    sk: 'Rúra na plech',
    en: 'Pipe on plate',
    t: [3, 12],
    sym: 'M3 20h24M9 20V5M21 20V5M9 5q6-3 12 0',
  },
  { id: 'JK', g: 'shaped', sk: 'Jokel na plech', en: 'Box section on plate', t: [3, 12], sym: 'M3 20h24M9 20V5h12v15' },
  { id: 'TV', g: 'shaped', sk: 'Tvarový rez', en: 'Contour cut', t: [1, 16], sym: 'M3 12q6-9 12 0t12 0' },
];
// polohy zvárania podľa EN ISO 6947 (v zátvorke ASME): plechy PA – PG, rúry PH, PJ, H-L045
export const WELD_POS = [
  ['PA', '1G/1F', 'vodorovná zhora', 'flat'],
  ['PB', '2F', 'vodorovná – zvislá', 'horizontal-vertical'],
  ['PC', '2G', 'vodorovná na stene', 'horizontal'],
  ['PD', '4F', 'nad hlavou – zvislá', 'horizontal-overhead'],
  ['PE', '4G/4F', 'nad hlavou', 'overhead'],
  ['PF', '3G/3F', 'zvislá nahor', 'vertical up'],
  ['PG', '3G/3F', 'zvislá nadol', 'vertical down'],
];
// rúrové polohy: kód ASME pre tupý zvar (G) a kútový zvar (F), popis
export const WELD_POS_PIPE = [
  ['PH', '5G', '5F', 'rúra vodorovne, zvára sa nahor', 'pipe horizontal, welding upwards'],
  ['PJ', '5G', '5F', 'rúra vodorovne, zvára sa nadol', 'pipe horizontal, welding downwards'],
  ['H-L045', '6G', '6F', 'rúra šikmo 45°, nahor', 'pipe inclined 45°, upwards'],
];
// popis skupín tvaru polotovarov
export const SHAPE_HINT = {
  plane: ['tupé, presah, lem, návar', 'butt, lap, edge, build-up'],
  perp: ['T-spoj, rohové spoje', 'T-joint, corner joints'],
  round: ['rúra – rúra, rúra na plech', 'pipe to pipe, pipe on plate'],
  shaped: ['jokel, tvarový rez', 'box section, contour cut'],
};
export const FILLETS = ['K', 'L', 'C', 'RP', 'JK'];
export const weldParts = () =>
  mkParts([
    [
      'zvaracka',
      'Zváračka',
      'Welder',
      'Transformátorová zváračka',
      'Transformer welder',
      'Elektrokov JS 90FN: rozptylový transformátor so stupňami prúdu 55 – 155 A. Prepínač 380 V / 220 V / nabíjanie; pri 220 V najviac 75 A, inak vypadne istič.',
      'Elektrokov JS 90FN: leakage transformer with current steps 55 – 155 A. Switch 380 V / 220 V / charging; on 220 V at most 75 A, otherwise the breaker trips.',
    ],
    [
      'drziak',
      'Držiak elektródy',
      'Electrode holder',
      'Držiak elektródy s káblom',
      'Electrode holder and lead',
      'Izolovaný držiak so svorkou na elektródu. Vedie sa pravým tlačidlom myši, oblúk sa zapáli ľavým tlačidlom pri držanom pravom.',
      'Insulated holder clamping the electrode. It is guided with the right mouse button; the arc strikes with the left button while the right is held.',
    ],
    [
      'svorka',
      'Zemniaca svorka',
      'Ground clamp',
      'Zemniaca svorka',
      'Ground clamp',
      'Uzatvára zvárací obvod cez stôl a zvarenec. Bez pripojenej zeme sa oblúk nezapáli.',
      'Closes the welding circuit through the table and the work. Without it the arc will not strike.',
    ],
    [
      'stol',
      'Zvárací stôl',
      'Welding table',
      'Zvárací stôl s prípravkom',
      'Welding table and fixture',
      'Oceľový stôl; pre polohy PC, PF, PE a rúrové polohy PH, PJ, H-L045 drží zvarenec stojan s upínačom.',
      'Steel table; for positions PC, PF, PE and the pipe positions PH, PJ, H-L045 a stand with a clamp holds the work.',
    ],
    [
      'zvarenec',
      'Zvarenec',
      'Weldment',
      'Zvarenec s úkosmi',
      'Weldment with preparation',
      'Diely pripravené podľa druhu zvaru a hrúbky: medzera, otupenie a úkos. Húsenica sa tvorí podľa prúdu, rýchlosti posuvu a dĺžky oblúka.',
      'Parts prepared for the chosen joint and thickness: gap, root face and bevel. The bead forms according to current, travel speed and arc length.',
    ],
  ]);

export const migParts = () =>
  mkParts([
    [
      'zdroj',
      'Zdroj TPS 450',
      'TPS 450 source',
      'Invertorový zdroj Fronius TransPuls Synergic TPS 450',
      'Fronius TransPuls Synergic TPS 450 inverter source',
      'Digitálne riadený zdroj 3 – 450 A. Synergia: k zvolenej rýchlosti drôtu nastaví prúd a napätie podľa programu (drôt, plyn), korekciou sa dolaďuje dĺžka oblúka. Režimy štandard a impulz, 2-takt a 4-takt.',
      'Digitally controlled source 3 – 450 A. Synergic: for the chosen wire speed it sets current and voltage from the program (wire, gas); the arc length is fine-tuned by the correction. Standard and pulse modes, 2-step and 4-step.',
    ],
    [
      'podavac',
      'Podávač drôtu',
      'Wire feeder',
      'Podávač drôtu VR 4000',
      'VR 4000 wire feeder',
      'Cievka s drôtom a štvorkladkový podávač; drôt ide cez hadicové vedenie do horáka. Spúšťač na horáku zapne plyn, podávanie a prúd naraz.',
      'Wire spool and four-roll drive; the wire runs through the hose pack to the torch. The torch trigger switches gas, wire feed and current together.',
    ],
    [
      'chladenie',
      'Chladiaci modul',
      'Cooling unit',
      'Chladiaci modul FK',
      'FK cooling unit',
      'Čerpá chladiacu kvapalinu do horáka – pri vysokých prúdoch sa horák neprehrieva.',
      'Pumps coolant to the torch so that it does not overheat at high currents.',
    ],
    [
      'flasa',
      'Plynová fľaša',
      'Gas cylinder',
      'Fľaša s ochranným plynom a redukčným ventilom',
      'Shielding gas cylinder and regulator',
      'Ochranný plyn chráni kúpeľ pred vzduchom. Bežne Ar + 18 % CO₂ (M21) s prietokom 12 – 16 l/min. Bez plynu je zvar pórovitý.',
      'The shielding gas protects the pool from air. Usually Ar + 18 % CO₂ (M21) at 12 – 16 l/min. Without gas the weld is porous.',
    ],
    [
      'horak',
      'Horák MIG/MAG',
      'MIG/MAG torch',
      'Zvárací horák s hadicovým vedením',
      'Welding torch and hose pack',
      'Plynová hubica, kontaktná špička a drôt. Výlet drôtu (vzdialenosť špičky od dielu) 10 – 15 mm. Vedie sa pravým tlačidlom myši, spúšťač je ľavé tlačidlo.',
      'Gas nozzle, contact tip and wire. Contact tip to work distance 10 – 15 mm. Guided with the right mouse button, the left button is the trigger.',
    ],
    [
      'svorka',
      'Zemniaca svorka',
      'Ground clamp',
      'Zemniaca svorka',
      'Ground clamp',
      'Uzatvára zvárací obvod cez stôl a zvarenec.',
      'Closes the welding circuit through the table and the work.',
    ],
    [
      'stol',
      'Zvárací stôl',
      'Welding table',
      'Zvárací stôl s prípravkom',
      'Welding table and fixture',
      'Oceľový stôl; pre polohy PC, PF, PE a rúrové polohy PH, PJ, H-L045 drží zvarenec stojan s upínačom.',
      'Steel table; for positions PC, PF, PE and the pipe positions PH, PJ, H-L045 a stand with a clamp holds the work.',
    ],
    [
      'zvarenec',
      'Zvarenec',
      'Weldment',
      'Zvarenec s úkosmi',
      'Weldment with preparation',
      'Diely pripravené podľa druhu zvaru a hrúbky. Pri MAG zváraní plným drôtom nevzniká troska.',
      'Parts prepared for the chosen joint and thickness. MAG welding with solid wire leaves no slag.',
    ],
  ]);
export const MIG_TASKS = [
  {
    id: 'mvpa',
    title: () => L('MAG: tupý zvar V, plech 8 mm, PA', 'MAG: single-V butt weld, 8 mm, PA'),
    desc: () =>
      L(
        'Zvar V na plechoch 8 mm vo vodorovnej polohe. Drôt Ø1,0, plyn M21 s prietokom 12 – 16 l/min, výlet drôtu 10 – 15 mm. Koreň aj výplň skratovým prenosom (rýchlosť drôtu 6 – 9 m/min), úkos vyplň celý.',
        'Single-V weld on 8 mm plates in the flat position. Ø1.0 wire, M21 gas at 12 – 16 l/min, 10 – 15 mm stick-out. Root and fill with a short arc (wire speed 6 – 9 m/min), fill the whole groove.',
      ),
    setup: {
      wType: 'V',
      wT: 8,
      wPos: 'PA',
      wire: 1,
      gas: 'M21',
      vd: 8,
      corr: 0,
      prog: 'std',
      flow: 14,
      valve: true,
      ctwd: 12,
    },
    labels: {
      setup: () => L('Zvar V, 8 mm, poloha PA', 'V joint, 8 mm, position PA'),
      fill: () => L('Úkos vyplnený (≥ 90 %)', 'Groove filled (≥ 90 %)'),
      cov: () => L('Zvarená celá dĺžka (≥ 95 %)', 'Whole length welded (≥ 95 %)'),
      off: () => L('Materiál mimo spoja ≤ 15 %', 'Metal off the joint ≤ 15 %'),
      flaws: () => L('Bez chýb (studený spoj, rýchly posuv, stekanie)', 'No defects (cold lap, fast travel, sagging)'),
      por: () => L('Bez pórov (plynová ochrana)', 'No porosity (gas shielding)'),
    },
  },
  {
    id: 'mkpb',
    title: () => L('MAG: kútový zvar, plech 8 mm, PB', 'MAG: fillet weld, 8 mm, PB'),
    desc: () =>
      L(
        'Kútový zvar T-spoja v polohe PB, šírka húsenice aspoň 6 mm. Drôt Ø1,0 alebo Ø1,2, plyn M21, rýchlosť drôtu 8 – 10 m/min.',
        'Fillet weld of a T-joint in position PB, bead at least 6 mm wide. Ø1.0 or Ø1.2 wire, M21 gas, wire speed 8 – 10 m/min.',
      ),
    setup: {
      wType: 'K',
      wT: 8,
      wPos: 'PB',
      wire: 1,
      gas: 'M21',
      vd: 9,
      corr: 0,
      prog: 'std',
      flow: 14,
      valve: true,
      ctwd: 12,
    },
    labels: {
      setup: () => L('Kútový zvar, 8 mm, poloha PB', 'Fillet weld, 8 mm, position PB'),
      width: () => L('Šírka húsenice ≥ 6 mm', 'Bead width ≥ 6 mm'),
      cov: () => L('Zvarená celá dĺžka (≥ 95 %)', 'Whole length welded (≥ 95 %)'),
      off: () => L('Materiál mimo spoja ≤ 15 %', 'Metal off the joint ≤ 15 %'),
      flaws: () => L('Bez chýb', 'No defects'),
      por: () => L('Bez pórov', 'No porosity'),
    },
  },
  {
    id: 'mrr3',
    title: () => L('MAG: rúra Ø88,9 × 8 na polohovadle, 3 vrstvy', 'MAG: Ø88.9 × 8 pipe on a positioner, 3 passes'),
    desc: () =>
      L(
        'Tupý zvar V rúr Ø88,9 × 8 mm v polohe PA: polohovadlo otáča rúru, horák drž na vrchu a veď priečne. Prvá otáčka koreň (nižšia rýchlosť drôtu), ďalšie výplň a krycia vrstva – spolu aspoň 3 vrstvy nad sebou. Drôt Ø1,0, plyn M21.',
        'Single-V butt weld of Ø88.9 × 8 mm pipes in position PA: the positioner turns the pipe, keep the torch on top and move it across. First turn root (lower wire speed), then fill and cap – at least 3 layers stacked. Ø1.0 wire, M21 gas.',
      ),
    setup: {
      wType: 'RR',
      wT: 8,
      wD: 88.9,
      wPos: 'PA',
      rotOn: true,
      rotV: 3,
      wire: 1,
      gas: 'M21',
      vd: 7,
      corr: 0,
      prog: 'std',
      flow: 14,
      valve: true,
      ctwd: 12,
    },
    labels: {
      setup: () => L('Rúra Ø88,9 × 8, poloha PA (polohovadlo)', 'Pipe Ø88.9 × 8, position PA (positioner)'),
      layers: () => L('Aspoň 3 vrstvy nad sebou', 'At least 3 layers stacked'),
      fill: () => L('Úkos vyplnený (≥ 90 %)', 'Groove filled (≥ 90 %)'),
      cov: () => L('Zvarený celý obvod (≥ 95 %)', 'Whole circumference welded (≥ 95 %)'),
      off: () => L('Materiál mimo spoja ≤ 15 %', 'Metal off the joint ≤ 15 %'),
      flaws: () => L('Bez chýb', 'No defects'),
      por: () => L('Bez pórov', 'No porosity'),
    },
  },
  {
    id: 'mtenky',
    title: () => L('MAG: tenký plech 2 mm, zvar I, PA', 'MAG: thin 2 mm sheet, square butt, PA'),
    desc: () =>
      L(
        'Zvar I na plechoch 2 mm. Drôt Ø0,8, nízka rýchlosť drôtu (4 – 6 m/min), rýchlejší posuv bez zastavenia – pri vysokom prúde hrozí prepálenie.',
        'Square butt on 2 mm sheets. Ø0.8 wire, low wire speed (4 – 6 m/min), faster steady travel – high current risks burning through.',
      ),
    setup: {
      wType: 'I',
      wT: 2,
      wPos: 'PA',
      wire: 0.8,
      gas: 'M21',
      vd: 5,
      corr: 0,
      prog: 'std',
      flow: 12,
      valve: true,
      ctwd: 10,
    },
    labels: {
      setup: () => L('Zvar I, 2 mm, poloha PA', 'Square butt, 2 mm, position PA'),
      cur: () => L('Prúd primeraný hrúbke (do 110 A)', 'Current suited to the thickness (up to 110 A)'),
      cov: () => L('Zvarená celá dĺžka (≥ 95 %)', 'Whole length welded (≥ 95 %)'),
      off: () => L('Materiál mimo spoja ≤ 15 %', 'Metal off the joint ≤ 15 %'),
      flaws: () => L('Bez chýb', 'No defects'),
      por: () => L('Bez pórov', 'No porosity'),
    },
  },
  {
    id: 'mrr',
    title: () => L('MAG: rúra Ø60,3 × 4, obvodový zvar, PH', 'MAG: Ø60.3 × 4 pipe, circumferential weld, PH'),
    desc: () =>
      L(
        'Tupý zvar V dvoch rúr Ø60,3 × 4 mm s vodorovnou osou (PH). Zváraj každú polovicu obvodu od spodku nahor, úkos vyplň celý. Drôt Ø1,0, rýchlosť drôtu 4 – 6 m/min (skratový prenos), plyn M21.',
        'Single-V butt weld of two Ø60.3 × 4 mm pipes with a horizontal axis (PH). Weld each half of the circumference from the bottom upwards and fill the whole groove. Ø1.0 wire, wire speed 4 – 6 m/min (short arc), M21 gas.',
      ),
    setup: {
      wType: 'RR',
      wT: 4,
      wD: 60.3,
      wPos: 'PH',
      wire: 1,
      gas: 'M21',
      vd: 5,
      corr: 0,
      prog: 'std',
      flow: 13,
      valve: true,
      ctwd: 12,
    },
    labels: {
      setup: () => L('Rúra Ø60,3 × 4, poloha PH', 'Pipe Ø60.3 × 4, position PH'),
      fill: () => L('Úkos vyplnený (≥ 90 %)', 'Groove filled (≥ 90 %)'),
      cov: () => L('Zvarený celý obvod (≥ 95 %)', 'Whole circumference welded (≥ 95 %)'),
      off: () => L('Materiál mimo spoja ≤ 15 %', 'Metal off the joint ≤ 15 %'),
      flaws: () => L('Bez chýb (aj smer zvárania nahor)', 'No defects (incl. upward travel)'),
      por: () => L('Bez pórov', 'No porosity'),
    },
  },
].map((t) => ({ ...t, checks: (m) => migChecks[t.id](m).map((c) => ({ ...c, label: t.labels[c.key]() })) }));
export const MIG_SAFETY = () => [
  L(
    'Mám zváračskú kuklu (DIN 10 – 13), kožené rukavice a odev bez syntetiky.',
    'I have a welding helmet (DIN 10 – 13), leather gloves and no synthetic clothing.',
  ),
  L('Plynová fľaša je zaistená reťazou na vozíku.', 'The gas cylinder is chained to the trolley.'),
  L(
    'Odsávanie dymu je zapnuté, v okolí nie sú horľaviny.',
    'Fume extraction is on, there is nothing flammable around.',
  ),
  L(
    'Zemniaca svorka je na zvarenci, hadicové vedenie nie je zalomené.',
    'The ground clamp is on the work, the hose pack is not kinked.',
  ),
];

// ---------- rez zvarom (makrovýbrus) so zvarovou mierkou ----------
export const PASS_COL = ['#c9d0d6', '#aeb7bf', '#d8dee3', '#9fa9b2', '#bcc4cb', '#e2e7eb'];
export function WeldSection({ sec, m }) {
  const cols = sec.cols,
    ok = cols.filter(Boolean);
  const top = Math.min(Math.max(...ok.map((c) => c.h)), sec.gref + 14) + 2;
  const bot = Math.min(0, ...ok.map((c) => c.h0 - c.fus - c.heat * 2.5)) - 1;
  const W = 300,
    H = 178,
    k = Math.min((W - 24) / (2 * sec.span), (H - 34) / (top - bot)),
    f1 = (v) => L(v.toFixed(1).replace('.', ','), v.toFixed(1));
  const X = (u) => W / 2 + u * k,
    Y = (y) => H - 22 - (Math.min(y, top) - bot) * k,
    dw = RES * k + 0.5;
  const rect = (c, y0, y1, fill, key, op = 1) =>
    y1 > y0 + 1e-3 ? (
      <rect
        key={key}
        x={X(c.u) - dw / 2}
        y={Y(y1)}
        width={dw}
        height={Math.max(0.3, Y(y0) - Y(y1))}
        fill={fill}
        opacity={op}
      />
    ) : null;
  const els = [];
  cols.forEach((c, i) => {
    if (!c) return;
    els.push(rect(c, bot + 0.6, Math.min(c.h0, top), '#7b838a', `b${i}`)); // základný materiál (leptaný)
    if (c.fus > 0.05 || c.heat > 0.05)
      els.push(rect(c, c.h0 - c.fus - c.heat * 2.5, c.h0 - c.fus, '#8f8a6d', `z${i}`, 0.75)); // tepelne ovplyvnená oblasť
    if (c.fus > 0.05) els.push(rect(c, c.h0 - c.fus, c.h0, PASS_COL[0], `f${i}`)); // natavený základný materiál
    let y = c.h0;
    c.passes.forEach((p, q) => {
      if (p.th > 0.02) els.push(rect(c, y, y + p.th, PASS_COL[p.id % PASS_COL.length], `p${i}-${q}`));
      y += p.th;
    });
  });
  const surf = ok.map((c) => `${X(c.u).toFixed(1)},${Y(c.h).toFixed(1)}`).join(' ');
  const fusion = ok
    .filter((c) => c.fus > 0.05 || c.dep > 0.1)
    .map((c) => `${X(c.u).toFixed(1)},${Y(c.h0 - c.fus).toFixed(1)}`)
    .join(' ');
  const pores = ok
    .filter((c, i) => c.por && c.dep > 0.3 && i % 3 === 0)
    .map((c, i) => <circle key={`o${i}`} cx={X(c.u)} cy={Y(c.h0 + c.dep * 0.55)} r={1.6} fill="#111" />);
  const incs = ok
    .filter((c, i) => c.inc && c.passes.length > 1 && i % 2 === 0)
    .map((c, i) => (
      <ellipse key={`s${i}`} cx={X(c.u)} cy={Y(c.h0 + c.passes[0].th)} rx={2.2} ry={0.9} fill="#2a2118" />
    ));
  const lof = ok
    .filter((c) => sec.groove && c.dep > 0.1 && c.h0 > 0.05 && c.h0 < sec.gref - 0.01 && c.fus < 0.2)
    .map((c, i) => <rect key={`l${i}`} x={X(c.u) - dw / 2} y={Y(c.h0) - 0.8} width={dw} height={1.6} fill="#e0402a" />);
  // zvarová mierka: pri tupom zvare prevýšenie h a šírka b, pri kútovom ramená z a účinná hrúbka a
  const gauge = [];
  const weldCols = ok.filter((c) => c.dep > 0.2);
  if (m && m.legs && m.legs.a > 0) {
    const iw = cols.findIndex((c) => c && c.h0 > sec.gref + 0.5);
    let ie = iw;
    while (ie + 1 < cols.length && cols[ie + 1] && cols[ie + 1].h0 > sec.gref + 0.5) ie++;
    const rightW = cols[ie + 1] && cols[ie + 1].dep > 0.2,
      face = rightW ? cols[ie].u + RES / 2 : cols[iw].u - RES / 2,
      dir = rightW ? 1 : -1;
    const cx = X(face),
      cy = Y(sec.gref),
      ax = X(face + dir * m.legs.z1),
      ay = Y(sec.gref + m.legs.z2);
    const L2 = Math.hypot(ax - cx, ay - cy) || 1,
      nx = (ay - cy) / L2,
      ny = -(ax - cx) / L2,
      tq = m.legs.a * k;
    gauge.push(
      <polyline
        key="tri"
        points={`${ax},${cy} ${cx},${ay}`}
        fill="none"
        stroke="#f0a020"
        strokeWidth="1.6"
        strokeDasharray="4 2"
      />,
    );
    gauge.push(
      <line
        key="thr"
        x1={cx}
        y1={cy}
        x2={cx + dir * Math.abs(nx) * tq}
        y2={cy - Math.abs(ny) * tq}
        stroke="#f0a020"
        strokeWidth="2"
      />,
    );
    gauge.push(
      <text
        key="ta"
        x={cx + dir * (Math.abs(nx) * tq + 6) - (dir < 0 ? 52 : 0)}
        y={cy - Math.abs(ny) * tq - 4}
        fontSize="11"
        fill="#f0a020"
        fontFamily="var(--f-mono)"
      >
        a = {f1(m.legs.a)}
      </text>,
    );
    gauge.push(
      <text key="tz" x={Math.min(cx, ax) + 2} y={cy + 13} fontSize="10" fill="currentColor" fontFamily="var(--f-mono)">
        z₁ {f1(m.legs.z1)}
      </text>,
    );
  } else if (m && weldCols.length) {
    const lo = weldCols[0].u,
      hi = weldCols[weldCols.length - 1].u,
      crown = weldCols.reduce((a, c) => (c.h > a.h ? c : a), weldCols[0]);
    gauge.push(
      <line key="bar" x1={X(lo - 5)} y1={Y(sec.ref)} x2={X(hi + 5)} y2={Y(sec.ref)} stroke="#f0a020" strokeWidth="2" />,
    );
    if (m.reinf > 0.05)
      gauge.push(
        <line
          key="pin"
          x1={X(crown.u)}
          y1={Y(sec.ref)}
          x2={X(crown.u)}
          y2={Y(crown.h)}
          stroke="#f0a020"
          strokeWidth="2.4"
        />,
      );
    gauge.push(
      <text
        key="th"
        x={X(crown.u) + 5}
        y={Y(Math.max(crown.h, sec.ref)) - 4}
        fontSize="11"
        fill="#f0a020"
        fontFamily="var(--f-mono)"
      >
        h = {f1(m.reinf)}
      </text>,
    );
    gauge.push(
      <text key="tb" x={X(lo)} y={H - 6} fontSize="10" fill="currentColor" fontFamily="var(--f-mono)">
        b = {f1(m.width)} mm
      </text>,
    );
  }
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={L('Rez zvarom', 'Weld section')}
      style={{ display: 'block', background: '#25292c', borderRadius: 8 }}
    >
      {els}
      <polyline points={fusion} fill="none" stroke="#3c3f30" strokeWidth="1" strokeDasharray="3 2" />
      <polyline points={surf} fill="none" stroke="#15181a" strokeWidth="1.2" />
      {pores}
      {incs}
      {lof}
      {gauge}
    </svg>
  );
}

export const WELD_TASKS = [
  {
    id: 'vpa',
    title: () => L('Tupý zvar V, plech 8 mm, poloha PA', 'Single-V butt weld, 8 mm plate, PA'),
    desc: () =>
      L(
        'Zvar V na plechoch hrúbky 8 mm vo vodorovnej polohe PA. Zvar celú dĺžku spoja, vyplň úkos, drž krátky oblúk a rovnomernú rýchlosť, potom otlč trosku. Elektróda rutilová Ø3,2, prúd 100 – 120 A.',
        'Single-V weld on 8 mm plates in the flat position PA. Weld the whole joint length, fill the groove, keep a short arc and a steady speed, then chip the slag. Rutile Ø3.2 electrode, 100 – 120 A.',
      ),
    setup: { wType: 'V', wT: 8, wPos: 'PA', etype: 'rutile', de: 3.2, current: 100 },
    labels: {
      setup: () => L('Zvar V, 8 mm, poloha PA', 'V joint, 8 mm, position PA'),
      fill: () => L('Úkos vyplnený (≥ 90 %)', 'Groove filled (≥ 90 %)'),
      cov: () => L('Zvarená celá dĺžka (≥ 95 %)', 'Whole length welded (≥ 95 %)'),
      off: () => L('Materiál mimo spoja ≤ 15 %', 'Metal off the joint ≤ 15 %'),
      flaws: () =>
        L('Bez chýb (studený spoj, dlhý oblúk, rýchly posuv)', 'No defects (cold lap, long arc, fast travel)'),
      slag: () => L('Troska otlčená', 'Slag chipped off'),
    },
  },
  {
    id: 'kpb',
    title: () => L('Kútový zvar, plech 8 mm, poloha PB', 'Fillet weld, 8 mm plate, PB'),
    desc: () =>
      L(
        'Kútový zvar T-spoja na plechoch 8 mm v polohe PB. Zvar celú dĺžku so šírkou húsenice aspoň 6 mm, potom otlč trosku. Elektróda rutilová Ø3,2, prúd 110 – 120 A.',
        'Fillet weld of a T-joint on 8 mm plates in position PB. Weld the whole length with a bead at least 6 mm wide, then chip the slag. Rutile Ø3.2 electrode, 110 – 120 A.',
      ),
    setup: { wType: 'K', wT: 8, wPos: 'PB', etype: 'rutile', de: 3.2, current: 120 },
    labels: {
      setup: () => L('Kútový zvar, 8 mm, poloha PB', 'Fillet weld, 8 mm, position PB'),
      width: () => L('Šírka húsenice ≥ 6 mm', 'Bead width ≥ 6 mm'),
      cov: () => L('Zvarená celá dĺžka (≥ 95 %)', 'Whole length welded (≥ 95 %)'),
      off: () => L('Materiál mimo spoja ≤ 15 %', 'Metal off the joint ≤ 15 %'),
      flaws: () => L('Bez chýb', 'No defects'),
      slag: () => L('Troska otlčená', 'Slag chipped off'),
    },
  },
  {
    id: 'vrstvy',
    title: () => L('Viacvrstvový zvar V, plech 12 mm, PA', 'Multi-pass V weld, 12 mm, PA'),
    desc: () =>
      L(
        'Zvar V na plechoch 12 mm: koreňová vrstva, výplňová a krycia vrstva (aspoň 3 vrstvy nad sebou). Pred každou ďalšou húsenicou otlč trosku – inak vzniknú troskové vtrúseniny. Výsledok skontroluj rezom zvarom. Bázická Ø3,2, koreň 90 – 100 A, výplň a krycia 110 – 130 A.',
        'Single-V weld on 12 mm plates: root pass, fill and cap (at least 3 layers stacked). Chip the slag before every further pass – otherwise slag inclusions form. Check the result with the weld section. Basic Ø3.2, root 90 – 100 A, fill and cap 110 – 130 A.',
      ),
    setup: { wType: 'V', wT: 12, wPos: 'PA', etype: 'basic', de: 3.2, current: 100 },
    labels: {
      setup: () => L('Zvar V, 12 mm, poloha PA', 'V joint, 12 mm, position PA'),
      layers: () => L('Aspoň 3 vrstvy nad sebou', 'At least 3 layers stacked'),
      fill: () => L('Úkos vyplnený (≥ 90 %)', 'Groove filled (≥ 90 %)'),
      inc: () => L('Bez troskových vtrúsenín', 'No slag inclusions'),
      cov: () => L('Zvarená celá dĺžka (≥ 95 %)', 'Whole length welded (≥ 95 %)'),
      off: () => L('Materiál mimo spoja ≤ 15 %', 'Metal off the joint ≤ 15 %'),
      flaws: () => L('Bez chýb', 'No defects'),
      slag: () => L('Troska otlčená', 'Slag chipped off'),
    },
  },
  {
    id: 'rpb',
    title: () => L('Rúra na plech, kútový zvar dookola, PB', 'Pipe on plate, fillet all round, PB'),
    desc: () =>
      L(
        'Rúra Ø60,3 postavená na plech 6 mm, kútový zvar po celom obvode v polohe PB (šírka húsenice aspoň 5 mm). Veď elektródu po modrej kružnici, na prechode okolo rúry plynule natáčaj ruku, potom otlč trosku. Rutilová Ø3,2, 90 – 110 A.',
        'Ø60.3 pipe set on a 6 mm plate, fillet all round in position PB (bead at least 5 mm wide). Guide the electrode along the blue circle, turn your hand smoothly around the pipe, then chip the slag. Rutile Ø3.2, 90 – 110 A.',
      ),
    setup: { wType: 'RP', wT: 6, wD: 60.3, wL: 150, wPos: 'PB', etype: 'rutile', de: 3.2, current: 100 },
    labels: {
      setup: () => L('Rúra na plech, 6 mm, poloha PB', 'Pipe on plate, 6 mm, position PB'),
      width: () => L('Šírka húsenice ≥ 5 mm', 'Bead width ≥ 5 mm'),
      cov: () => L('Zvarený celý obvod (≥ 95 %)', 'Whole circumference welded (≥ 95 %)'),
      off: () => L('Materiál mimo spoja ≤ 15 %', 'Metal off the joint ≤ 15 %'),
      flaws: () => L('Bez chýb', 'No defects'),
      slag: () => L('Troska otlčená', 'Slag chipped off'),
    },
  },
].map((t) => ({ ...t, checks: (m) => weldChecks[t.id](m).map((c) => ({ ...c, label: t.labels[c.key]() })) }));
export const WELD_SAFETY = () => [
  L(
    'Mám zváračskú kuklu so správnym stupňom filtra (DIN 10 – 12).',
    'I have a welding helmet with the right filter shade (DIN 10 – 12).',
  ),
  L('Mám kožené rukavice, zástere a odev bez syntetiky.', 'I wear leather gloves, an apron and no synthetic clothing.'),
  L(
    'Odsávanie dymu je zapnuté, v okolí nie sú horľaviny.',
    'Fume extraction is on, there is nothing flammable around.',
  ),
  L('Zemniaca svorka je pripojená priamo na zvarenec.', 'The ground clamp is attached directly to the workpiece.'),
];
