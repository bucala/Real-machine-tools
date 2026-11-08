// Úlohy s hodnotením pre CNC centrá (Hermle, Röders): zadanie, pripravený program a kontroly nad
// meraním obrobku z voxelového poľa. Bez three.js a Reactu – testované v tests/modernTasks.test.js.
import { L } from '../../core/i18n';
import { pocketSize, surfaceZ } from './measure';

const f3 = (v) => (v == null || !Number.isFinite(v) ? '–' : v.toFixed(2));
const within = (v, nom, tol) => v != null && Math.abs(v - nom) <= tol + 1e-9;

// pripravené programy: polotovar 100 × 80 × 40 mm, G54 v strede hornej plochy, T3 = stopková fréza Ø10
const head = (o, title) => ['%', `O${o} (${title})`, '(T3 D=10. CR=0. - flat end mill)', 'N10 G90 G94 G17 G21 G40 G49 G80', 'N20 G54'];
const end = ['M5 M9', 'G53 G0 Z0.', 'M30', '%'];
export const CNC_TASK_PROGRAMS = {
  // neúplný program: kapsa je len 30 × 20 a 2,5 mm hlboká – žiak ju má doplniť na 40 × 30 × 5
  kapsa: [...head(2001, 'KAPSA 40 X 30 HL. 5 - DOPLN'),
    '(ZADANIE: kapsa 40 x 30 mm, hlbka 5 mm, stred v G54)', '(FREZA D10: dráha stredu je o polomer 5 mm vnútri steny)',
    'T3 M6', 'S12000 M3', 'G0 X-10. Y-5.', 'G43 H3 Z30. M8', 'G0 Z1.',
    'G1 Z-2.5 F300', 'G1 X10. F1800', 'Y5.', 'X-10.', 'Y-5.',
    '(DOPLN: dalsie dráhy a druhú hĺbku)', 'G0 Z30.', ...end].join('\n'),
  // chybný program: zápich rýchloposuvom do materiálu
  kolizia: [...head(2002, 'ZAPICH - NAJDI CHYBU'),
    'T3 M6', 'S12000 M3', 'G0 X0. Y0.', 'G43 H3 Z30. M8', 'G0 Z2.',
    'G0 Z-3.', 'G1 X10. F1200', 'X-10.', 'X0.',
    'G0 Z30.', ...end].join('\n'),
};

// meranie: stav programu z vykonávača a rozmery obrobku z poľa vzdialeností
export function measureCnc({ stock, o54, ex, maxA = 0, maxLoad = 0 }) {
  if (!stock || !ex) return null;
  const S = ex.S, z = (x, y) => surfaceZ(stock, o54, x, y);
  const depth = (() => { const c = z(0, 0); return c == null ? null : -c; })();
  const floor = [[-12, -8], [12, -8], [12, 8], [-12, 8]].map(([x, y]) => z(x, y));
  const pocket = depth > 1 ? pocketSize(stock, o54, 0, 0, -Math.min(depth / 2, 2.5)) : { x: null, y: null };
  const zA = z(0, 25), zB = z(0, 35);
  const slope = zA != null && zB != null ? Math.atan2(zA - zB, 10) * 180 / Math.PI : null;
  return { done: !!S.done, alarm: S.alarm ? S.alarm.text : null, removed: S.removed, depth, floor, pocket, slope, maxA, maxLoad };
}

const progress = (m) => (m.alarm ? L(`alarm: ${m.alarm}`, `alarm: ${m.alarm}`) : m.done ? L('dokončený', 'finished') : L('nedokončený', 'not finished'));

export const cncChecks = {
  kapsa: (m) => {
    const flat = m.depth > 1 && m.floor.every((v) => v != null && Math.abs(-v - m.depth) <= 0.1);
    return [
      { key: 'run', ok: m.done && !m.alarm, actual: progress(m) },
      { key: 'depth', ok: within(m.depth, 5, 0.1), actual: `${f3(m.depth)} mm` },
      { key: 'x', ok: within(m.pocket.x, 40, 0.1), actual: `${f3(m.pocket.x)} mm` },
      { key: 'y', ok: within(m.pocket.y, 30, 0.1), actual: `${f3(m.pocket.y)} mm` },
      { key: 'floor', ok: flat, actual: m.floor.map((v) => f3(v == null ? null : -v)).join(' / ') },
      { key: 'load', ok: m.maxLoad <= 1, actual: `${Math.round(m.maxLoad * 100)} %` },
    ];
  },
  kolizia: (m) => [
    { key: 'run', ok: m.done && !m.alarm, actual: progress(m) },
    { key: 'depth', ok: within(m.depth, 3, 0.1), actual: `${f3(m.depth)} mm` },
    { key: 'x', ok: within(m.pocket.x, 30, 0.2), actual: `${f3(m.pocket.x)} mm` },
  ],
  naklon: (m) => [
    { key: 'run', ok: m.done && !m.alarm, actual: progress(m) },
    { key: 'a', ok: within(Math.abs(m.maxA), 30, 0.1), actual: `${m.maxA.toFixed(2)}°` },
    { key: 'slope', ok: within(m.slope, 30, 0.5), actual: m.slope == null ? '–' : `${m.slope.toFixed(2)}°` },
  ],
};

export const CNC_SAFETY = () => [
  L('Obrobok je upnutý v nulovom upínacom systéme a nástroje v zásobníku zodpovedajú tabuľke nástrojov.', 'The workpiece is clamped in the zero-point system and the magazine tools match the tool table.'),
  L('Program som skontroloval (Kontrola programu bez chýb) a poznám nulový bod G54.', 'I checked the program (Program check without errors) and know the G54 datum.'),
  L('Dvere sú zatvorené; pri prvom behu znížim korekciu rýchloposuvu a mám ruku pri Stop posuvu.', 'The doors are closed; on the first run I lower the rapid override and keep my hand near Feed hold.'),
];
