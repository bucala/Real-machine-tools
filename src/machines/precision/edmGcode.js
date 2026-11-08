import { L } from '../../core/i18n';
// Training sinker EDM subset: safe XY positioning and straight Z burns. G54 Z0
// is the blank top. Unsupported codes fail with a source line, never disappear.
export const EDM_GCODE_SAMPLE = `(EX 500 - two cavities, G54 Z0 = blank top)
G21 G90 G94 G54
M3 M8
G0 Z5
G0 X-20 Y0
G1 Z-8 F3
G0 Z5
G0 X20 Y0
G1 Z-5 F3
G0 Z5
M5 M9
M30`;
// Zložitý program: vložka formy s 3 × 3 dutinami rôznej hĺbky – hrubovanie E1 pri 30 A s prídavkom 0,4 mm,
// dokončenie E2 pri 12 A a 4 A s kompenzáciou čelnej medzery (medzera = 0,01 + 0,0045 · I mm)
export const EDM_COMPLEX_ELECTRODES = {
  electrode: { id: 'copper-rough-19.6-14.6', name: 'Cu · 19,6 × 14,6 mm', shape: 'box', w: 19.6, d: 14.6, length: 100 },
  electrode2: {
    id: 'copper-finish-20.25-15.25',
    name: 'Cu · 20,25 × 15,25 mm',
    shape: 'box',
    w: 20.25,
    d: 15.25,
    length: 100,
  },
};
export function edmComplexProgram() {
  const gap = (I) => Math.round((0.01 + 0.0045 * I) * 1000) / 1000,
    fmt = (v) => String(Math.round(v * 1000) / 1000);
  const cav = [];
  [22, 0, -22].forEach((y, row) =>
    [-30, 0, 30].forEach((x) => cav.push({ x, y, depth: [3.5, 2.5, 1.5][row] + (x === 0 ? 0.5 : 0) })),
  );
  const o = [
    '%',
    'O2001 (EX 500 - VLOZKA FORMY 3 X 3 DUTINY - E1 HRUBOVANIE, E2 DOKONCENIE)',
    '(G54 Z0 = HORNA PLOCHA OBROBKU, S = PRUD GENERATORA V A)',
    'G21 G90 G94 G54',
    'T1 M6 (E1 CU 19.6 X 14.6 - HRUBOVANIE)',
    'S30 M3 M8',
    'G0 Z5',
  ];
  const pass = (title, d) => {
    o.push(`(${title})`);
    cav.forEach((c, i) => o.push(`G0 X${fmt(c.x)} Y${fmt(c.y)}`, `G1 Z-${fmt(d(c))} F3 (DUTINA ${i + 1})`, 'G0 Z5'));
  };
  pass('HRUBOVANIE 30 A, PRIDAVOK 0.4 MM', (c) => c.depth - 0.4);
  o.push('T2 M6 (E2 CU 20.25 X 15.25 - DOKONCENIE)', 'S12');
  pass('DOKONCENIE 12 A', (c) => c.depth - gap(12) - 0.02);
  o.push('S4');
  pass('JEMNE DOKONCENIE 4 A - RA ~ 1.4 UM', (c) => c.depth - gap(4));
  o.push('M5 M9', 'G0 Z5', 'M30', '%');
  return o.join('\n');
}
export function compileEdmGcode(text) {
  if (typeof text !== 'string' || text.length > 256000) throw new Error('NC: max. 256 kB');
  let x = 0,
    y = 0,
    z = 5,
    absolute = true,
    mode = 0,
    feed = null,
    on = true,
    flush = true,
    ended = false,
    startFlushing = null,
    endFlushing = null,
    endLine = null,
    tool = 1,
    nextTool = null,
    toolSet = false,
    current = null;
  const rows = [];
  const fail = (line, msg) => {
    throw new Error(`NC ${line}: ${msg}`);
  };
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1,
      s = raw
        .replace(/\([^)]*\)/g, '')
        .split(';')[0]
        .trim()
        .toUpperCase();
    if (!s || s === '%' || /^O\d+$/.test(s)) return;
    if (ended) fail(line, L('Blok po M30.', 'Block after M30.'));
    const words = [...s.matchAll(/([A-Z])\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/g)];
    if (!words.length || s.replace(/([A-Z])\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/g, '').trim())
      fail(line, L('Neplatný zápis.', 'Invalid syntax.'));
    const axis = {};
    let hasMotion = false,
      change = false;
    for (const [, letter, value] of words) {
      const n = Number(value);
      if (!Number.isFinite(n)) fail(line, L('Neplatné číslo.', 'Invalid number.'));
      if (letter === 'N') continue;
      if (letter === 'G') {
        if ([0, 1].includes(n)) mode = n;
        else if (n === 90) absolute = true;
        else if (n === 91) absolute = false;
        else if (![21, 54, 94].includes(n)) fail(line, L(`G${n} nie je podporované.`, `G${n} is not supported.`));
      } else if (letter === 'M') {
        if ([2, 30].includes(n)) {
          ended = true;
          endLine = line;
        } else if (n === 3) on = true;
        else if (n === 5) on = false;
        else if (n === 8) {
          flush = true;
          if (!rows.length) startFlushing = true;
          endFlushing = true;
        } else if (n === 9) {
          flush = false;
          if (!rows.length) startFlushing = false;
          endFlushing = false;
        } else if (n === 6) change = true;
        else fail(line, L(`M${n} nie je podporované.`, `M${n} is not supported.`));
      } else if (letter === 'F') {
        if (n <= 0 || n > 100) fail(line, L('F musí byť 0–100 mm/min.', 'F must be 0–100 mm/min.'));
        feed = n;
      } else if (letter === 'T') {
        if (![1, 2].includes(n)) fail(line, L('Elektróda T1 alebo T2.', 'Electrode T1 or T2.'));
        nextTool = n;
      } else if (letter === 'S') {
        if (n < 1 || n > 60) fail(line, L('Prúd S 1–60 A.', 'Current S 1–60 A.'));
        current = n;
      } else if (['X', 'Y', 'Z'].includes(letter)) {
        if (letter in axis) fail(line, L('Opakovaná os.', 'Duplicate axis.'));
        axis[letter] = n;
        hasMotion = true;
      } else fail(line, L(`${letter} nie je podporované.`, `${letter} is not supported.`));
    }
    // výmena elektródy T1 / T2 M6 (len zdvihnutá elektróda)
    if (change) {
      if (nextTool == null) fail(line, L('M6 bez čísla elektródy T.', 'M6 without electrode number T.'));
      if (z < 5) fail(line, L('Výmena elektródy vyžaduje Z≥5.', 'Electrode change requires Z≥5.'));
      tool = nextTool;
      toolSet = true;
    }
    if (!hasMotion) return;
    const nx = 'X' in axis ? (absolute ? axis.X : x + axis.X) : x,
      ny = 'Y' in axis ? (absolute ? axis.Y : y + axis.Y) : y,
      nz = 'Z' in axis ? (absolute ? axis.Z : z + axis.Z) : z;
    if ((nx !== x || ny !== y) && Math.min(z, nz) < 5)
      fail(line, L('Pred XY zdvihni elektródu na Z≥5.', 'Retract to Z≥5 before XY.'));
    if (mode === 0 && nz < 5) fail(line, L('Rýchloposuv vyžaduje Z≥5.', 'Rapid requires Z≥5.'));
    if (nz < 0) {
      if (!on || !flush) fail(line, L('Hĺbenie vyžaduje M3 a M8.', 'Burn requires M3 and M8.'));
      if (nz >= z) fail(line, L('Návrat vykonaj G0 Z5.', 'Retract using G0 Z5.'));
      if (rows.length && z < 5) fail(line, L('Medzi hĺbeniami použi G0 Z5.', 'Use G0 Z5 between burns.'));
      rows.push({
        x: nx,
        y: ny,
        depth: -nz,
        line,
        feed,
        ...(toolSet ? { tool } : {}),
        ...(current != null ? { current } : {}),
      });
    }
    if (nz > 100 || nz < -29.5) fail(line, L('Z mimo rozsahu.', 'Z outside range.'));
    x = nx;
    y = ny;
    z = nz;
  });
  if (!rows.length || rows.length > 100) throw new Error(L('NC: zadaj 1–100 hĺbení.', 'Enter 1–100 burns.'));
  if (z < 5) throw new Error(L('NC: ukonči program bezpečným zdvihom G0 Z5.', 'End with G0 Z5.'));
  return { rows, startFlushing, endFlushing, endLine };
}
