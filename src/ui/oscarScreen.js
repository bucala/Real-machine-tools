// Živé HMI OSCARMAX EX 500 (1040 × 650): stránky menu, softvérové tlačidlá a posuvník rýchlosti simulácie
// v stavovom riadku. Ten istý obraz je na displeji v scéne aj v HMI cez celé okno; klik / ťahanie na plátne
// prekladá oscarHmiHit na akciu (oscar.jsx). Text obrazovky je anglický ako na stroji, pomocník dvojjazyčný.
import { L } from '../core/i18n';
import { edmArea, edmFeed, edmGap, edmMrr, edmRa, edmVdi, rowCurrent } from '../machines/precision/edmProcess';

export const OSCAR_TABS = [
  ['machine', 'MACHINE'],
  ['program', 'PROGRAM'],
  ['tool', 'TOOL'],
  ['generator', 'GENERATOR'],
  ['monitor', 'MONITOR'],
  ['help', 'HELP'],
];
export const OSCAR_SPEEDS = [1, 2, 5, 10, 20, 40, 80];
export const OSCAR_MAX_CURRENT = 60;
const TAB = (i) => ({ x: 7 + i * 172, y: 41, w: 166, h: 32 });
const TRACK = { x0: 772, x1: 1012, y: 622 };
const SPEED_HIT = { x: 744, y: 604, w: 296, h: 46 };
const BAR = { x: 30, y: 330, w: 460, h: 34 };
const LN80 = Math.log(80);
export const speedToX = (v) => TRACK.x0 + ((TRACK.x1 - TRACK.x0) * Math.log(Math.max(1, Math.min(80, v)))) / LN80;
export function xToSpeed(x) {
  const p = Math.max(0, Math.min(1, (x - TRACK.x0) / (TRACK.x1 - TRACK.x0))),
    v = Math.round(Math.exp(p * LN80));
  // pri značke sa posuvník prichytí na bežnú hodnotu
  const near = OSCAR_SPEEDS.find((s) => Math.abs(v - s) / s < 0.12);
  return near || v;
}
const barToCurrent = (x) =>
  Math.max(1, Math.min(OSCAR_MAX_CURRENT, Math.round(((x - BAR.x) / BAR.w) * OSCAR_MAX_CURRENT)));

// tlačidlá na stránkach (okrem záložiek a rýchlosti)
const PAGE_KEYS = {
  generator: [
    { id: 'current', step: -10, x: 30, y: 236, w: 104, h: 56, label: '−10' },
    { id: 'current', step: -1, x: 148, y: 236, w: 104, h: 56, label: '−1' },
    { id: 'current', step: 1, x: 266, y: 236, w: 104, h: 56, label: '+1' },
    { id: 'current', step: 10, x: 384, y: 236, w: 104, h: 56, label: '+10' },
    { id: 'currentBar', ...BAR },
    { id: 'fill', x: 540, y: 128, w: 228, h: 58, label: 'DIELECTRIC FILL' },
    { id: 'coolant', x: 784, y: 128, w: 228, h: 58, label: 'FLUSHING' },
    { id: 'light', x: 540, y: 198, w: 228, h: 58, label: 'WORK LIGHT' },
  ],
  program: [
    { id: 'start', x: 10, y: 548, w: 332, h: 48, label: '▶  CYCLE START' },
    { id: 'hold', x: 354, y: 548, w: 332, h: 48, label: '■  FEED HOLD' },
    { id: 'reset', x: 698, y: 548, w: 332, h: 48, label: '↺  RESET' },
  ],
};
export const OSCAR_DRAG = new Set(['speed', 'currentBar']);
const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// klik na súradnice obrazovky → { id, … } alebo null; pri ťahaní (drag = id) rozhoduje len vodorovná poloha
export function oscarHmiHit(c, x, y, drag = null) {
  if (drag === 'speed') return { id: 'speed', value: xToSpeed(x) };
  if (drag === 'currentBar') return { id: 'current', value: barToCurrent(x) };
  for (let i = 0; i < OSCAR_TABS.length; i++) if (inside(TAB(i), x, y)) return { id: 'tab', tab: OSCAR_TABS[i][0] };
  if (inside(SPEED_HIT, x, y)) return { id: 'speed', value: xToSpeed(x), drag: 'speed' };
  for (const k of PAGE_KEYS[c.hmiTab] || []) {
    if (!inside(k, x, y)) continue;
    if (k.id === 'currentBar') return { id: 'current', value: barToCurrent(x), drag: 'currentBar' };
    if (k.id === 'current')
      return { id: 'current', value: Math.max(1, Math.min(OSCAR_MAX_CURRENT, c.current + k.step)) };
    return { id: k.id };
  }
  return null;
}

// klávesnica na plátne HMI: 1 – 6 stránky, ← → rýchlosť, ↑ ↓ prúd
export function oscarHmiKey(c, key) {
  if (/^[1-6]$/.test(key)) return { id: 'tab', tab: OSCAR_TABS[Number(key) - 1][0] };
  if (key === 'ArrowRight') return { id: 'speed', value: OSCAR_SPEEDS.find((v) => v > c.speed) ?? 80 };
  if (key === 'ArrowLeft') return { id: 'speed', value: OSCAR_SPEEDS.findLast((v) => v < c.speed) ?? 1 };
  if (key === 'ArrowUp') return { id: 'current', value: Math.min(OSCAR_MAX_CURRENT, c.current + 1) };
  if (key === 'ArrowDown') return { id: 'current', value: Math.max(1, c.current - 1) };
  return null;
}

const C = {
  bg: '#edf0ed',
  panel: '#fbfcfa',
  head: '#6d8166',
  dark: '#252b27',
  text: '#394836',
  muted: '#5d6d56',
  cell: '#e4e9e0',
  accent: '#7c986a',
  off: '#d3d8d1',
  alarm: '#a94747',
  warn: '#c58b2c',
};
function panel(g, x, y, w, h, title) {
  g.fillStyle = C.panel;
  g.fillRect(x, y, w, h);
  if (!title) return;
  g.fillStyle = C.head;
  g.fillRect(x, y, w, 30);
  g.fillStyle = 'white';
  g.font = '15px Arial';
  g.fillText(title, x + 13, y + 21);
}
function key(g, k, { on = false, disabled = false, label = k.label } = {}) {
  g.fillStyle = disabled ? '#dfe2de' : on ? C.accent : C.off;
  g.fillRect(k.x, k.y, k.w, k.h);
  g.strokeStyle = disabled ? '#c4c9c2' : on ? '#5e7a50' : '#a9b2a5';
  g.lineWidth = 2;
  g.strokeRect(k.x + 1, k.y + 1, k.w - 2, k.h - 2);
  g.fillStyle = disabled ? '#9aa197' : on ? 'white' : '#36412f';
  g.font = 'bold 16px Arial';
  const tw = g.measureText(label).width;
  g.fillText(label, k.x + (k.w - tw) / 2, k.y + k.h / 2 + 6);
}
function cells(g, x, y, w, list, step = 47) {
  list.forEach(([k, v], i) => {
    g.fillStyle = C.cell;
    g.fillRect(x, y + i * step, w, step - 4);
    g.fillStyle = C.muted;
    g.font = '12px Arial';
    g.fillText(k, x + 8, y + 15 + i * step);
    g.fillStyle = '#303c2f';
    g.font = '18px monospace';
    g.fillText(String(v), x + 8, y + 36 + i * step);
  });
}
const activeCurrent = (c, job, S) => (job ? rowCurrent(job, job.rows[S.row] || job.rows[0]) : c.current);
const electrodeText = (e) =>
  `${e.material === 'graphite' ? 'GRAPHITE' : 'COPPER'}  ${e.shape === 'round' ? 'Ø' + e.w : e.w + ' × ' + e.d} × ${e.length} mm`;

function pageMachine(g, { S, c, oilLevel, job }) {
  panel(g, 10, 83, 225, 377, 'ACTUAL POSITION');
  [
    ['X', S.x],
    ['Y', S.y],
    ['Z', -S.depth],
  ].forEach(([k, v], i) => {
    g.fillStyle = '#596b57';
    g.font = '16px Arial';
    g.fillText(k + '  mm', 24, 155 + i * 65);
    g.fillStyle = C.dark;
    g.font = 'bold 26px monospace';
    g.fillText(v.toFixed(3), 55, 185 + i * 65);
  });
  g.font = '14px Arial';
  g.fillStyle = '#536050';
  g.fillText('G54 · ABSOLUTE', 25, 392);
  g.fillText('OP ' + (S.row + 1) + ' / ' + (job?.rows || c.rows).length + (job ? '   E' + (S.tool || 1) : ''), 25, 424);
  panel(g, 245, 83, 533, 377);
  g.strokeStyle = '#d4ddd1';
  g.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    g.moveTo(260, 140 + i * 33);
    g.lineTo(760, 140 + i * 33);
    g.stroke();
  }
  const X = (x) => 510 + x * 4,
    Y = (y) => 260 - y * 3;
  g.strokeStyle = '#627965';
  g.lineWidth = 2;
  g.strokeRect(310, 140, 400, 240);
  (job?.rows || c.rows).forEach((r, i) => {
    const e = r.tool === 2 ? c.electrode2 || c.electrode : c.electrode,
      ew = e.w * 4,
      ed = (e.shape === 'round' ? e.w : e.d) * 3;
    g.fillStyle = i === S.row ? '#b7c3a9' : '#e0e7dc';
    g.strokeStyle = i === S.row ? '#799559' : '#9faa9a';
    g.fillRect(X(r.x) - ew / 2, Y(r.y) - ed / 2, ew, ed);
    g.strokeRect(X(r.x) - ew / 2, Y(r.y) - ed / 2, ew, ed);
  });
  g.strokeStyle = '#364a3b';
  g.beginPath();
  g.moveTo(X(S.x) - 16, Y(S.y));
  g.lineTo(X(S.x) + 16, Y(S.y));
  g.moveTo(X(S.x), Y(S.y) - 16);
  g.lineTo(X(S.x), Y(S.y) + 16);
  g.stroke();
  g.fillStyle = '#5c6b59';
  g.font = '14px Arial';
  g.fillText('WORKPIECE 100 × 80 × 30 mm', 270, 110);
  g.fillText('E1  ' + electrodeText(c.electrode), 267, 438);
  const I = activeCurrent(c, job, S);
  panel(g, 789, 83, 241, 377, 'DISCHARGE DATA');
  cells(g, 799, 122, 222, [
    ['CURRENT', I + ' A'],
    ['GAP', edmGap(I).toFixed(3) + ' mm'],
    ['Ra', edmRa(I).toFixed(1) + ' µm'],
    ['OIL LEVEL', oilLevel.toFixed(0) + ' mm'],
    ['REMOVED', (S.removed / 1000).toFixed(3) + ' cm³'],
    ['TIME', S.t.toFixed(1) + ' s'],
    ['BLOCK', S.line || '—'],
  ]);
  ncList(g, { S, c }, 472, 5);
}
function ncList(g, { S, c }, y0, n) {
  g.fillStyle = '#fff';
  g.fillRect(10, y0, 1020, n * 23 + 10);
  const lines =
      c.ncMode === 'gcode'
        ? c.ncText.split(/\r?\n/)
        : c.rows.map((r, i) => `${i + 1}    X ${r.x.toFixed(3)}   Y ${r.y.toFixed(3)}   DEPTH ${r.depth.toFixed(3)}`),
    current = c.ncMode === 'gcode' ? Math.max(0, (S.line || 1) - 1) : S.row,
    start = Math.max(0, Math.min(current - 2, lines.length - n));
  lines.slice(start, start + n).forEach((line, i) => {
    if (start + i === current) {
      g.fillStyle = '#cddbbf';
      g.fillRect(15, y0 + 6 + i * 23, 1010, 22);
    }
    g.fillStyle = C.text;
    g.font = '15px monospace';
    g.fillText(line.slice(0, 105), 25, y0 + 23 + i * 23);
  });
}
function pageProgram(g, { S, c, job }) {
  const rows = job?.rows || c.rows;
  panel(g, 10, 83, 1020, 262, (c.ncMode === 'gcode' ? 'ISO PROGRAM' : 'OPERATIONS') + '  ·  ' + rows.length + ' OP');
  const cols = [
    ['N', 26],
    ['X mm', 80],
    ['Y mm', 200],
    ['DEPTH mm', 320],
    ['E', 470],
    ['I A', 530],
    ['GAP mm', 610],
    ['Ra µm', 730],
    ['STATUS', 850],
  ];
  g.fillStyle = C.muted;
  g.font = '12px Arial';
  cols.forEach(([t, x]) => g.fillText(t, x, 132));
  rows.slice(0, 8).forEach((r, i) => {
    const y = 140 + i * 25,
      I = r.current ?? (job ? job.current : c.current),
      done = S.done || (job && i < S.row),
      active = job && !S.done && i === S.row;
    if (active) {
      g.fillStyle = '#cddbbf';
      g.fillRect(16, y, 1008, 23);
    }
    g.fillStyle = C.text;
    g.font = '15px monospace';
    [
      i + 1,
      r.x.toFixed(3),
      r.y.toFixed(3),
      r.depth.toFixed(3),
      'E' + (r.tool || 1),
      I,
      edmGap(I).toFixed(3),
      edmRa(I).toFixed(1),
    ].forEach((v, k) => g.fillText(String(v), cols[k][1], y + 17));
    g.fillStyle = active ? '#4f6d3c' : done ? '#6f7d6a' : '#8b9488';
    g.font = 'bold 14px Arial';
    g.fillText(active ? S.phase.toUpperCase() : done ? 'DONE' : 'WAIT', 850, y + 17);
  });
  if (rows.length > 8) {
    g.fillStyle = C.muted;
    g.font = '13px Arial';
    g.fillText('+ ' + (rows.length - 8) + ' more', 26, 338);
  }
  ncList(g, { S, c }, 355, 8);
  PAGE_KEYS.program.forEach((k) =>
    key(g, k, { on: k.id === 'start' ? S.run : k.id === 'hold' ? !S.run && !!job && !S.done : false }),
  );
}
function toolCard(g, x, n, e, { S, c, job }) {
  const rows = job?.rows || c.rows,
    uses = rows.filter((r) => (r.tool || 1) === n).length,
    active = job && !S.done && (S.tool || 1) === n,
    wear = S.wearBy?.[n] || 0;
  panel(g, x, 83, 505, 513, 'ELECTRODE  E' + n + (active ? '   ·   ACTIVE' : ''));
  if (active) {
    g.fillStyle = '#cddbbf';
    g.fillRect(x, 113, 505, 6);
  }
  cells(
    g,
    x + 12,
    128,
    230,
    [
      ['MATERIAL', e.material === 'graphite' ? 'GRAPHITE' : 'COPPER'],
      ['SHAPE', e.shape === 'round' ? 'ROUND' : 'PRISM'],
      ['SIZE', (e.shape === 'round' ? 'Ø ' + e.w : e.w + ' × ' + e.d) + ' mm'],
      ['LENGTH', e.length + ' mm'],
      ['AREA', edmArea(e).toFixed(0) + ' mm²'],
      ['WEAR', wear.toFixed(3) + ' mm'],
      ['OPERATIONS', uses ? uses + ' OP' : 'NOT USED'],
    ],
    56,
  );
  // pôdorys čela elektródy v mierke
  const cx = x + 375,
    cy = 300,
    s = Math.min(9, 200 / Math.max(e.w, e.d || e.w));
  g.strokeStyle = '#c9d2c5';
  g.lineWidth = 1;
  g.strokeRect(x + 262, 140, 226, 320);
  g.fillStyle = e.material === 'graphite' ? '#5d6062' : '#c27c4a';
  g.strokeStyle = '#3c4a39';
  g.lineWidth = 2;
  g.beginPath();
  if (e.shape === 'round') g.arc(cx, cy, (e.w * s) / 2, 0, Math.PI * 2);
  else g.rect(cx - (e.w * s) / 2, cy - (e.d * s) / 2, e.w * s, e.d * s);
  g.fill();
  g.stroke();
  g.fillStyle = C.muted;
  g.font = '13px Arial';
  g.fillText('FRONT FACE', x + 274, 160);
  const first = rows.find((r) => (r.tool || 1) === n),
    I = first ? rowCurrent(job || c, first) : c.current;
  g.fillText(
    'MRR ' + edmMrr(e, I).toFixed(0) + ' mm³/min  ·  FEED ' + edmFeed(e, I).toFixed(2) + ' mm/min',
    x + 12,
    540,
  );
  g.fillText('AT ' + I + ' A', x + 12, 562);
}
function pageTool(g, s) {
  toolCard(g, 10, 1, s.c.electrode, s);
  toolCard(g, 525, 2, s.c.electrode2 || s.c.electrode, s);
}
function pageGenerator(g, { S, c, job, locked, oilLevel }) {
  const I = activeCurrent(c, job, S),
    e = (job && S.electrode) || c.electrode;
  panel(g, 10, 83, 500, 513, 'GENERATOR' + (locked ? '   ·   LOCKED (RESET TO EDIT)' : ''));
  g.fillStyle = C.muted;
  g.font = '14px Arial';
  g.fillText(job ? 'ACTIVE OPERATION CURRENT' : 'WORKING CURRENT', 30, 140);
  g.fillStyle = C.dark;
  g.font = 'bold 64px monospace';
  g.fillText(I + ' A', 30, 210);
  PAGE_KEYS.generator.filter((k) => k.id === 'current').forEach((k) => key(g, k, { disabled: locked }));
  g.fillStyle = '#dfe4dc';
  g.fillRect(BAR.x, BAR.y, BAR.w, BAR.h);
  g.fillStyle = locked ? '#b2b9ae' : C.accent;
  g.fillRect(BAR.x, BAR.y, (BAR.w * c.current) / OSCAR_MAX_CURRENT, BAR.h);
  g.fillStyle = C.muted;
  g.font = '12px Arial';
  [1, 15, 30, 45, 60].forEach((v) => g.fillText(String(v), BAR.x + (BAR.w * v) / OSCAR_MAX_CURRENT - 6, BAR.y + 50));
  cells(
    g,
    30,
    398,
    460,
    [
      ['GAP  (side)', edmGap(I).toFixed(3) + ' mm'],
      ['ROUGHNESS', 'Ra ' + edmRa(I).toFixed(1) + ' µm  ·  VDI ' + edmVdi(I).toFixed(0)],
      ['REMOVAL  ·  FEED', edmMrr(e, I).toFixed(0) + ' mm³/min  ·  ' + edmFeed(e, I).toFixed(2) + ' mm/min'],
    ],
    62,
  );
  panel(g, 520, 83, 510, 513, 'DIELECTRIC · FLUSHING');
  const [fill, flush, light] = PAGE_KEYS.generator.slice(5);
  key(g, fill, { on: c.fill, label: c.fill ? 'FILL  ON' : 'FILL  OFF' });
  key(g, flush, { on: c.flushing, label: c.flushing ? 'FLUSH  ON' : 'FLUSH  OFF' });
  key(g, light, { on: c.light, label: c.light ? 'LIGHT  ON' : 'LIGHT  OFF' });
  // hladina dielektrika v nádrži (obrobok 50 – 80 mm, štart od 120 mm)
  const tx = 800,
    ty = 210,
    th = 360,
    lvl = Math.max(0, Math.min(1, oilLevel / 160));
  g.strokeStyle = '#7e8c79';
  g.lineWidth = 2;
  g.strokeRect(tx, ty, 200, th);
  g.fillStyle = '#d9c97e';
  g.fillRect(tx + 2, ty + th - th * lvl, 196, th * lvl);
  g.fillStyle = '#8b939a';
  g.fillRect(tx + 50, ty + th - (th * 80) / 160, 100, (th * 30) / 160);
  g.strokeStyle = C.warn;
  g.setLineDash([6, 5]);
  g.beginPath();
  g.moveTo(tx, ty + th - (th * 120) / 160);
  g.lineTo(tx + 200, ty + th - (th * 120) / 160);
  g.stroke();
  g.setLineDash([]);
  cells(
    g,
    540,
    280,
    228,
    [
      ['OIL LEVEL', oilLevel.toFixed(0) + ' mm'],
      ['ABOVE WORK', Math.max(0, oilLevel - 80).toFixed(0) + ' mm'],
      ['TANK GATE', c.door ? 'OPEN' : 'CLOSED'],
      ['E-STOP', c.estop ? 'PRESSED' : 'RELEASED'],
    ],
    62,
  );
}
function plot(g, x, y, w, h, title, data, unit, color) {
  panel(g, x, y, w, h, title);
  const px = x + 52,
    py = y + 60,
    pw = w - 70,
    ph = h - 98;
  g.strokeStyle = '#d4ddd1';
  g.lineWidth = 1;
  g.fillStyle = C.muted;
  g.font = '11px Arial';
  const tMax = Math.max(10, ...data.map((d) => d[0])),
    vMax = Math.max(1e-6, ...data.map((d) => d[1])) * 1.1;
  for (let i = 0; i <= 4; i++) {
    const yy = py + (ph * i) / 4;
    g.beginPath();
    g.moveTo(px, yy);
    g.lineTo(px + pw, yy);
    g.stroke();
    g.fillText(((vMax * (4 - i)) / 4).toFixed(vMax < 1 ? 3 : 1), x + 6, yy + 4);
  }
  g.fillText('0', px, py + ph + 16);
  g.fillText(tMax.toFixed(0) + ' s', px + pw - 30, py + ph + 16);
  g.fillText(unit, x + 6, y + 46);
  if (data.length < 2) {
    g.font = '14px Arial';
    g.fillText('NO DATA – START THE CYCLE', px + 20, py + ph / 2);
    return;
  }
  g.strokeStyle = color;
  g.lineWidth = 2.5;
  g.beginPath();
  data.forEach(([t, v], i) => {
    const X = px + (pw * t) / tMax,
      Y = py + ph - (ph * v) / vMax;
    if (i) g.lineTo(X, Y);
    else g.moveTo(X, Y);
  });
  g.stroke();
}
function pageMonitor(g, { S, c, job, hist = [] }) {
  plot(
    g,
    10,
    83,
    505,
    360,
    'DEPTH  Z',
    hist.map((p) => [p.t, p.d]),
    'mm',
    '#56794a',
  );
  plot(
    g,
    525,
    83,
    505,
    360,
    'REMOVED VOLUME',
    hist.map((p) => [p.t, p.r / 1000]),
    'cm³',
    '#a9743a',
  );
  // úberová rýchlosť z modelu generátora (objem obrobku sa mení po voxeloch, derivácia by skákala)
  const I = activeCurrent(c, job, S),
    rate = S.sparking ? edmMrr((job && S.electrode) || c.electrode, I) : 0;
  panel(g, 10, 453, 1020, 143);
  g.fillStyle = S.sparking ? '#e2b93b' : '#c9cec6';
  g.beginPath();
  g.arc(60, 524, 30, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = C.muted;
  g.font = 'bold 12px Arial';
  g.fillText('SPARK', 40, 574);
  [
    ['PHASE', S.phase.toUpperCase()],
    ['CURRENT', (S.sparking ? I : 0) + ' A'],
    ['DEPTH', Math.max(0, S.depth).toFixed(3) + ' mm'],
    ['REMOVAL', rate.toFixed(0) + ' mm³/min'],
    ['WEAR E' + (S.tool || 1), (S.wear || 0).toFixed(3) + ' mm'],
  ].forEach(([k, v], i) => {
    const x = 120 + i * 180;
    g.fillStyle = C.cell;
    g.fillRect(x, 476, 170, 96);
    g.fillStyle = C.muted;
    g.font = '12px Arial';
    g.fillText(k, x + 10, 498);
    g.fillStyle = '#303c2f';
    g.font = 'bold 20px monospace';
    g.fillText(v, x + 10, 538);
  });
}
function pageHelp(g, { c, oilLevel }) {
  panel(g, 10, 83, 505, 513, L('PRED ŠTARTOM CYKLU', 'BEFORE CYCLE START'));
  [
    [!c.estop, L('Núdzový STOP uvoľnený', 'Emergency STOP released')],
    [!c.unclamped, L('Obrobok upnutý', 'Workpiece clamped')],
    [!c.door, L('Dvere nádrže zatvorené', 'Tank gate closed')],
    [c.fill, L('Napúšťanie dielektrika zapnuté', 'Dielectric fill on')],
    [oilLevel >= 120, L('Hladina ≥ 40 mm nad obrobkom', 'Level ≥ 40 mm above the workpiece')],
    [c.flushing, L('Výplach elektródy zapnutý', 'Electrode flushing on')],
  ].forEach(([ok, t], i) => {
    const y = 140 + i * 66;
    g.fillStyle = ok ? '#dfe8d6' : '#f1e1dc';
    g.fillRect(26, y - 26, 472, 54);
    g.fillStyle = ok ? '#4f7a3c' : C.alarm;
    g.font = 'bold 26px Arial';
    g.fillText(ok ? '✓' : '✗', 40, y + 10);
    g.fillStyle = C.text;
    g.font = '17px Arial';
    g.fillText(t, 84, y + 7);
  });
  panel(g, 525, 83, 505, 513, L('OVLÁDANIE', 'CONTROLS'));
  [
    ['▶', L('Štart cyklu', 'Cycle start')],
    ['■', L('Stop posuvu', 'Feed hold')],
    ['↺', L('Reset – nový polotovar', 'Reset – new blank')],
    ['STOP', L('Núdzový STOP', 'Emergency STOP')],
    ['≈', L('Výplach elektródy', 'Electrode flushing')],
    ['1 – 6', L('Stránky menu (klávesnica)', 'Menu pages (keyboard)')],
    ['← →', L('Rýchlosť simulácie', 'Simulation speed')],
    ['↑ ↓', L('Prúd generátora', 'Generator current')],
  ].forEach(([k, t], i) => {
    const y = 146 + i * 52;
    g.fillStyle = C.cell;
    g.fillRect(545, y - 26, 84, 40);
    g.fillStyle = C.dark;
    g.font = 'bold 17px Arial';
    g.fillText(k, 556, y);
    g.fillStyle = C.text;
    g.font = '16px Arial';
    g.fillText(t, 646, y);
  });
  g.fillStyle = C.muted;
  g.font = '13px Arial';
  g.fillText(L('Ťukni na záložku alebo potiahni posuvník SPEED.', 'Tap a tab or drag the SPEED slider.'), 545, 572);
}
const PAGES = {
  machine: pageMachine,
  program: pageProgram,
  tool: pageTool,
  generator: pageGenerator,
  monitor: pageMonitor,
  help: pageHelp,
};

export function drawOscarScreen(g, w, h, s) {
  const { S, c, msg } = s,
    tab = PAGES[c.hmiTab] ? c.hmiTab : 'machine';
  g.save();
  g.scale(w / 1040, h / 650);
  g.fillStyle = C.bg;
  g.fillRect(0, 0, 1040, 650);
  g.fillStyle = '#4e5650';
  g.fillRect(0, 0, 1040, 33);
  g.fillStyle = '#f3f5f2';
  g.font = 'bold 17px Arial';
  g.fillText('OSCARMAX     EX 500     CNC EDM', 14, 23);
  g.font = '14px Arial';
  g.fillText('AUTO     ' + (c.ncMode === 'gcode' ? 'ISO PROGRAM' : 'OPERATIONS'), 688, 23);
  OSCAR_TABS.forEach(([id, t], i) => {
    const r = TAB(i);
    g.fillStyle = id === tab ? C.accent : C.off;
    g.fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle = id === tab ? 'white' : '#424a43';
    g.font = (id === tab ? 'bold ' : '') + '13px Arial';
    g.fillText(i + 1 + '  ' + t, r.x + 13, r.y + 21);
  });
  PAGES[tab](g, s);
  // stavový riadok: hlásenie a posuvník rýchlosti simulácie
  g.fillStyle = S.alarm ? C.alarm : msg ? C.warn : '#7a8e6c';
  g.fillRect(0, 604, 1040, 46);
  g.fillStyle = 'white';
  g.font = '16px Arial';
  g.fillText(
    (S.alarm || msg || S.phase.toUpperCase() + '   ·   ' + (S.run ? 'CYCLE RUN' : 'READY')).slice(0, 68),
    15,
    633,
  );
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(684, 604, 356, 46);
  g.fillStyle = 'white';
  g.font = 'bold 13px Arial';
  g.fillText('SPEED', 694, 620);
  g.font = 'bold 16px monospace';
  g.fillText('×' + c.speed, 694, 640);
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(TRACK.x0, TRACK.y);
  g.lineTo(TRACK.x1, TRACK.y);
  g.stroke();
  g.strokeStyle = 'white';
  g.beginPath();
  g.moveTo(TRACK.x0, TRACK.y);
  g.lineTo(speedToX(c.speed), TRACK.y);
  g.stroke();
  g.font = '10px Arial';
  g.fillStyle = 'rgba(255,255,255,0.85)';
  [1, 5, 20, 80].forEach((v) => {
    const x = speedToX(v);
    g.fillRect(x - 1, TRACK.y + 5, 2, 5);
    g.fillText(String(v), x - (v > 9 ? 6 : 3), TRACK.y + 22);
  });
  g.fillStyle = 'white';
  g.strokeStyle = '#4e5a49';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(speedToX(c.speed), TRACK.y, 9, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.restore();
}
