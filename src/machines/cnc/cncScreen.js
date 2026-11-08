// Živé dotykové displeje CNC: HEIDENHAIN TNC 640 (Hermle, 640 × 460) a Röders RMS6 (1024 × 768).
// Záložky so stránkami, posuvník rýchlosti simulácie a korekcie posuvu v spodnom riadku, na RMS aj softvérové
// tlačidlá cyklu. Ten istý obraz je v scéne aj v HMI cez celé okno; klik / ťahanie preloží cncHmiHit na akciu.
import { L } from '../../core/i18n';

export const SPEEDS = [1, 2, 5, 10, 20, 40, 80];
const LN80 = Math.log(80);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// rozloženie oboch displejov
export const CNC_SCREENS = {
  tnc: {
    w: 640,
    h: 460,
    tabs: [
      ['program', 'PROGRAM'],
      ['position', 'POSITION'],
      ['tools', 'TOOLS'],
      ['monitor', 'MONITOR'],
    ],
    tab: (i) => ({ x: 6 + i * 157, y: 38, w: 151, h: 26 }),
    content: { x: 8, y: 70, w: 624, h: 308 },
    status: { y: 382, h: 28 },
    speed: { x0: 92, x1: 296, y: 436, hit: { x: 8, y: 414, w: 300, h: 46 } },
    feed: { x0: 418, x1: 622, y: 436, hit: { x: 334, y: 414, w: 300, h: 46 } },
    keys: [],
  },
  rms: {
    w: 1024,
    h: 768,
    tabs: [
      ['program', 'PROGRAM'],
      ['machine', 'MACHINE'],
      ['tools', 'TOOLS'],
      ['setup', 'SETUP'],
      ['monitor', 'DIAGNOSTICS'],
    ],
    tab: (i) => ({ x: 7 + i * 203, y: 55, w: 197, h: 36 }),
    content: { x: 20, y: 104, w: 748, h: 448 },
    status: { y: 724, h: 44 },
    speed: { x0: 640, x1: 790, y: 746, hit: { x: 560, y: 724, w: 238, h: 44 } },
    feed: { x0: 866, x1: 1008, y: 746, hit: { x: 804, y: 724, w: 220, h: 44 } },
    keys: [
      { id: 'start', x: 40, y: 440, w: 220, h: 86, label: '▶  CYCLE START' },
      { id: 'hold', x: 276, y: 440, w: 220, h: 86, label: '■  FEED HOLD' },
      { id: 'reset', x: 512, y: 440, w: 220, h: 86, label: '↺  RESET' },
    ],
  },
};
const speedToX = (S, v) => S.x0 + ((S.x1 - S.x0) * Math.log(clamp(v, 1, 80))) / LN80;
function xToSpeed(S, x) {
  const p = clamp((x - S.x0) / (S.x1 - S.x0), 0, 1),
    v = Math.round(Math.exp(p * LN80));
  return SPEEDS.find((s) => Math.abs(v - s) / s < 0.12) || v;
}
const feedToX = (F, v) => F.x0 + ((F.x1 - F.x0) * clamp(v, 0, 150)) / 150;
const xToFeed = (F, x) => Math.round((clamp((x - F.x0) / (F.x1 - F.x0), 0, 1) * 150) / 5) * 5;

export const CNC_DRAG = new Set(['speed', 'fo']);
// klik na súradnice displeja → { id, … } alebo null; pri ťahaní (drag = id) rozhoduje len vodorovná poloha
export function cncHmiHit(kind, c, x, y, drag = null) {
  const D = CNC_SCREENS[kind];
  if (drag === 'speed') return { id: 'speed', value: xToSpeed(D.speed, x) };
  if (drag === 'fo') return { id: 'fo', value: xToFeed(D.feed, x) };
  for (let i = 0; i < D.tabs.length; i++) if (inside(D.tab(i), x, y)) return { id: 'tab', tab: D.tabs[i][0] };
  if (inside(D.speed.hit, x, y)) return { id: 'speed', value: xToSpeed(D.speed, x), drag: 'speed' };
  if (inside(D.feed.hit, x, y)) return { id: 'fo', value: xToFeed(D.feed, x), drag: 'fo' };
  if ((c.scrTab || 'program') === 'program') for (const k of D.keys) if (inside(k, x, y)) return { id: k.id };
  return null;
}
// klávesnica na displeji: číslice stránky, ← → rýchlosť, ↑ ↓ korekcia posuvu po 10 %
export function cncHmiKey(kind, c, key) {
  const tabs = CNC_SCREENS[kind].tabs;
  if (/^[1-9]$/.test(key) && Number(key) <= tabs.length) return { id: 'tab', tab: tabs[Number(key) - 1][0] };
  if (key === 'ArrowRight') return { id: 'speed', value: SPEEDS.find((v) => v > c.speed) ?? 80 };
  if (key === 'ArrowLeft') return { id: 'speed', value: SPEEDS.findLast((v) => v < c.speed) ?? 1 };
  if (key === 'ArrowUp') return { id: 'fo', value: Math.min(150, Math.floor(c.fo / 10) * 10 + 10) };
  if (key === 'ArrowDown') return { id: 'fo', value: Math.max(0, Math.ceil(c.fo / 10) * 10 - 10) };
  return null;
}

const THEMES = {
  tnc: {
    bg: '#e9edf0',
    head: '#292e33',
    tabOn: '#3c6e9a',
    tabOff: '#cfd7de',
    panel: '#d7dfe5',
    text: '#27333e',
    dark: '#172b3b',
    muted: '#526675',
    cur: '#ffd34d',
    ok: '#59d17b',
    alarm: '#ff5a4f',
    bar: '#2f3a44',
    font: 'monospace',
    s: 1,
  },
  rms: {
    bg: '#b9bdc5',
    head: '#a63243',
    tabOn: '#a33d52',
    tabOff: '#e5e6ea',
    panel: '#e8e9ed',
    text: '#30394b',
    dark: '#1c2235',
    muted: '#5b6378',
    cur: '#ded7ae',
    ok: '#424e7e',
    alarm: '#ae3345',
    bar: '#2b3260',
    font: 'Arial',
    s: 1.4,
  },
};
const fmt = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '–');
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function cells(g, T, x, y, w, rows, step) {
  rows.forEach(([k, v], i) => {
    g.fillStyle = T.panel;
    g.fillRect(x, y + i * step, w, step - 4);
    g.fillStyle = T.muted;
    g.font = `${Math.round(11 * T.s)}px Arial`;
    g.fillText(k, x + 8, y + i * step + 13 * T.s);
    g.fillStyle = T.dark;
    g.font = `bold ${Math.round(16 * T.s)}px monospace`;
    g.fillText(String(v), x + 8, y + i * step + step - 10);
  });
}
// stránky (obsah do obdĺžnika r)
function pagePosition(g, T, r, s) {
  const big = [
    ['X', s.pos.X],
    ['Y', s.pos.Y],
    ['Z', s.pos.Z],
    ['A', s.pos.A],
    ['C', s.pos.C],
  ];
  const rh = (r.h - 70 * T.s) / big.length;
  big.forEach(([k, v], i) => {
    const y = r.y + i * rh;
    g.fillStyle = i % 2 ? T.bg : T.panel;
    g.fillRect(r.x, y, r.w * 0.62, rh - 3);
    g.fillStyle = T.muted;
    g.font = `bold ${Math.round(20 * T.s)}px Arial`;
    g.fillText(k, r.x + 14, y + rh * 0.68);
    g.fillStyle = T.dark;
    g.font = `bold ${Math.round(30 * T.s)}px monospace`;
    const txt = fmt(v) + (k === 'A' || k === 'C' ? ' °' : ''),
      tw = g.measureText(txt).width;
    g.fillText(txt, r.x + r.w * 0.6 - tw, y + rh * 0.72);
  });
  cells(
    g,
    T,
    r.x + r.w * 0.64,
    r.y,
    r.w * 0.36,
    [
      ['TOOL', 'T' + s.T],
      ['SPINDLE', s.S + ' rpm'],
      ['FEED', s.F < 0 ? 'RAPID' : s.F + ' mm/min'],
      ['WORK X Y Z', `${fmt(s.wx, 1)} ${fmt(s.wy, 1)} ${fmt(s.wz, 1)}`],
    ],
    (r.h - 70 * T.s) / 4,
  );
  // zaťaženie vretena
  const y = r.y + r.h - 56 * T.s,
    lw = r.w - 20;
  g.fillStyle = T.muted;
  g.font = `${Math.round(12 * T.s)}px Arial`;
  g.fillText(`SPINDLE LOAD ${Math.round((s.load || 0) * 100)} %`, r.x + 4, y + 14 * T.s);
  g.fillStyle = T.panel;
  g.fillRect(r.x + 4, y + 22 * T.s, lw, 22 * T.s);
  g.fillStyle = s.load > 1 ? T.alarm : s.load > 0.8 ? '#e0a33c' : T.ok;
  g.fillRect(r.x + 4, y + 22 * T.s, lw * clamp(s.load || 0, 0, 1.2) * (1 / 1.2), 22 * T.s);
}
function pageTools(g, T, r, s) {
  const cols = [
    ['T', 0],
    ['NAME', 0.08],
    ['Ø mm', 0.58],
    ['L mm', 0.72],
    ['', 0.86],
  ];
  g.fillStyle = T.muted;
  g.font = `bold ${Math.round(12 * T.s)}px Arial`;
  cols.forEach(([t, f]) => g.fillText(t, r.x + 8 + f * r.w, r.y + 14 * T.s));
  const rh = 23 * T.s,
    n = Math.floor((r.h - 24 * T.s) / rh);
  (s.tools || []).slice(0, n).forEach((t, i) => {
    const y = r.y + 22 * T.s + i * rh,
      on = t.t === s.T;
    g.fillStyle = on ? T.cur : i % 2 ? T.bg : T.panel;
    g.fillRect(r.x, y, r.w, rh - 2);
    g.fillStyle = T.dark;
    g.font = `${Math.round(14 * T.s)}px ${T.font}`;
    g.fillText(String(t.t), r.x + 8, y + rh * 0.72);
    g.fillText(String(t.name || '').slice(0, Math.round(26 * (r.w / 624))), r.x + 8 + 0.08 * r.w, y + rh * 0.72);
    g.fillText(fmt(t.d, 1), r.x + 8 + 0.58 * r.w, y + rh * 0.72);
    g.fillText(fmt(t.l, 1), r.x + 8 + 0.72 * r.w, y + rh * 0.72);
    if (on) g.fillText('SPINDLE', r.x + 8 + 0.86 * r.w, y + rh * 0.72);
  });
  if (!(s.tools || []).length) {
    g.fillStyle = T.muted;
    g.fillText('NO TOOLS', r.x + 8, r.y + 50);
  }
}
function plot(g, T, x, y, w, h, title, data, unit, color, max) {
  g.fillStyle = T.panel;
  g.fillRect(x, y, w, h);
  g.fillStyle = T.muted;
  g.font = `${Math.round(12 * T.s)}px Arial`;
  g.fillText(`${title} [${unit}]`, x + 8, y + 16 * T.s);
  const px = x + 8,
    py = y + 24 * T.s,
    pw = w - 16,
    ph = h - 32 * T.s;
  g.strokeStyle = T.bg;
  g.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    g.beginPath();
    g.moveTo(px, py + (ph * i) / 4);
    g.lineTo(px + pw, py + (ph * i) / 4);
    g.stroke();
  }
  if (data.length < 2) {
    g.fillText('NO DATA – START THE PROGRAM', px + 10, py + ph / 2);
    return;
  }
  const t0 = data[0][0],
    t1 = Math.max(t0 + 1, data.at(-1)[0]),
    vm = Math.max(max || 0, ...data.map((d) => d[1])) || 1;
  g.strokeStyle = color;
  g.lineWidth = 2;
  g.beginPath();
  data.forEach(([t, v], i) => {
    const X = px + (pw * (t - t0)) / (t1 - t0),
      Y = py + ph - (ph * v) / vm;
    if (i) g.lineTo(X, Y);
    else g.moveTo(X, Y);
  });
  g.stroke();
  g.fillStyle = T.muted;
  g.fillText(vm.toFixed(vm < 10 ? 1 : 0), px + pw - 30 * T.s, py + 12 * T.s);
}
function pageMonitor(g, T, r, s) {
  const hist = s.hist || [],
    gh = (r.h - 64 * T.s) / 2;
  plot(
    g,
    T,
    r.x,
    r.y,
    r.w,
    gh - 4,
    'SPINDLE LOAD',
    hist.map((p) => [p.t, p.load * 100]),
    '%',
    '#d9822b',
    100,
  );
  plot(
    g,
    T,
    r.x,
    r.y + gh,
    r.w,
    gh - 4,
    'REMOVAL RATE',
    hist.map((p) => [p.t, p.mrr]),
    'cm³/min',
    '#3c78b4',
  );
  const y = r.y + 2 * gh + 4,
    items = [
      ['TIME', mmss(s.t || 0)],
      ['ESTIMATE', mmss(s.est || 0)],
      ['REMOVED', fmt(s.removed, 2) + ' cm³'],
      ['MAX LOAD', Math.round((s.maxLoad || 0) * 100) + ' %'],
    ];
  const cw = r.w / items.length;
  items.forEach(([k, v], i) => {
    g.fillStyle = T.panel;
    g.fillRect(r.x + i * cw, y, cw - 6, 56 * T.s);
    g.fillStyle = T.muted;
    g.font = `${Math.round(11 * T.s)}px Arial`;
    g.fillText(k, r.x + i * cw + 8, y + 15 * T.s);
    g.fillStyle = T.dark;
    g.font = `bold ${Math.round(17 * T.s)}px monospace`;
    g.fillText(v, r.x + i * cw + 8, y + 42 * T.s);
  });
}
function pageSetup(g, T, r, s) {
  cells(
    g,
    T,
    r.x,
    r.y,
    r.w / 2 - 8,
    [
      ['BLANK', `${s.stock?.sx ?? '–'} × ${s.stock?.sy ?? '–'} × ${s.stock?.sz ?? '–'} mm`],
      ['MATERIAL', String(s.stock?.mat || '–').toUpperCase()],
      ['VOXEL', fmt(s.stock?.res, 2) + ' mm'],
      ['DOORS', s.door ? 'OPEN' : 'CLOSED'],
    ],
    r.h / 4,
  );
  cells(
    g,
    T,
    r.x + r.w / 2,
    r.y,
    r.w / 2,
    [
      ['PROGRAM', `${s.nLines || 0} BLOCKS · ${String(s.dialect || 'iso').toUpperCase()}`],
      ['ESTIMATED TIME', mmss(s.est || 0)],
      ['FEED / RAPID OVERRIDE', `${s.fo} % / ${s.ro} %`],
      ['SINGLE BLOCK', s.single ? 'ON' : 'OFF'],
    ],
    r.h / 4,
  );
}
// RMS: prehľad programu a softvérové tlačidlá cyklu
function pageRmsProgram(g, T, r, s) {
  cells(
    g,
    T,
    r.x,
    r.y,
    r.w / 2 - 8,
    [
      ['ACTIVE BLOCK', `${(s.line || 0) + 1} / ${s.nLines || 0}`],
      ['DIALECT', String(s.dialect || 'iso').toUpperCase()],
      ['ESTIMATED TIME', mmss(s.est || 0)],
    ],
    96,
  );
  cells(
    g,
    T,
    r.x + r.w / 2,
    r.y,
    r.w / 2,
    [
      ['TOOL', 'T' + s.T],
      ['RUN TIME', mmss(s.t || 0)],
      ['STATE', s.alarm ? 'ALARM' : s.done ? 'FINISHED' : s.running ? 'RUNNING' : 'READY'],
    ],
    96,
  );
  // priebeh programu
  const p = s.nLines ? clamp(((s.line || 0) + (s.done ? 1 : 0)) / s.nLines, 0, 1) : 0;
  g.fillStyle = T.panel;
  g.fillRect(r.x, r.y + 296, r.w, 26);
  g.fillStyle = '#1635b1';
  g.fillRect(r.x, r.y + 296, r.w * p, 26);
  for (const k of CNC_SCREENS.rms.keys) {
    g.fillStyle = k.id === 'start' && s.running ? '#2e8b57' : k.id === 'hold' && s.paused ? '#a33d52' : '#1635b1';
    g.fillRect(k.x, k.y, k.w, k.h);
    g.fillStyle = 'white';
    g.font = 'bold 20px Arial';
    const tw = g.measureText(k.label).width;
    g.fillText(k.label, k.x + (k.w - tw) / 2, k.y + k.h / 2 + 7);
  }
}
// TNC: výpis programu a súradnice (pôvodný displej)
function pageTncProgram(g, T, r, s) {
  g.font = '17px monospace';
  s.lines.slice(0, 12).forEach((ln, i) => {
    if (ln.cur) {
      g.fillStyle = T.cur;
      g.fillRect(r.x, r.y + i * 24, 384, 22);
    }
    g.fillStyle = ln.cur ? '#10202f' : T.text;
    g.fillText(ln.t.slice(0, 36), r.x + 4, r.y + 16 + i * 24);
  });
  g.fillStyle = T.panel;
  g.fillRect(404, r.y, 228, r.h);
  g.font = '18px monospace';
  s.posList.forEach(([k, v], i) => {
    g.fillStyle = '#334b5f';
    g.fillText(k, 414, r.y + 26 + i * 37);
    g.fillStyle = T.dark;
    g.fillText(v, 446, r.y + 26 + i * 37);
  });
}
function slider(g, T, D, label, value, x, txt) {
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.font = `bold ${Math.round(11 * T.s)}px Arial`;
  g.fillText(label, D.hit.x + 6, D.y - 4);
  g.font = `bold ${Math.round(14 * T.s)}px monospace`;
  g.fillStyle = 'white';
  g.fillText(txt, D.hit.x + 6, D.y + 14 * T.s);
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(D.x0, D.y);
  g.lineTo(D.x1, D.y);
  g.stroke();
  g.strokeStyle = 'white';
  g.beginPath();
  g.moveTo(D.x0, D.y);
  g.lineTo(x, D.y);
  g.stroke();
  g.fillStyle = 'white';
  g.strokeStyle = T.bar;
  g.lineWidth = 2;
  g.beginPath();
  g.arc(x, D.y, 8 * T.s, 0, Math.PI * 2);
  g.fill();
  g.stroke();
}

// s: stav displeja z cncScene (title, lines, posList, status, alarm, pos, T, S, F, load, tools, hist …)
export function drawCncScreen(g, w, h, kind, s, c) {
  const D = CNC_SCREENS[kind],
    T = THEMES[kind],
    tab = D.tabs.some(([id]) => id === c.scrTab) ? c.scrTab : 'program';
  g.save();
  g.scale(w / D.w, h / D.h);
  g.fillStyle = T.bg;
  g.fillRect(0, 0, D.w, D.h);
  // hlavička
  if (kind === 'rms') {
    g.fillStyle = T.head;
    g.fillRect(0, 0, D.w, 49);
    g.fillStyle = 'white';
    g.font = 'bold 20px Arial';
    g.fillText('Röders precision and rapid machining', 24, 31);
    g.font = '18px Arial';
    g.fillText('RMS6 · RXU 1001 DSH', 730, 31);
  } else {
    g.fillStyle = T.head;
    g.fillRect(0, 0, D.w, 34);
    g.fillStyle = '#fff';
    g.font = 'bold 18px monospace';
    g.fillText(`${s.controller} · ${s.title}`.slice(0, 50), 12, 23);
  }
  D.tabs.forEach(([id, t], i) => {
    const r = D.tab(i);
    g.fillStyle = id === tab ? T.tabOn : T.tabOff;
    g.fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle = id === tab ? 'white' : T.text;
    g.font = `${id === tab ? 'bold ' : ''}${Math.round(13 * T.s)}px Arial`;
    g.fillText(`${i + 1}  ${t}`, r.x + 10, r.y + r.h / 2 + 5 * T.s);
  });
  const r = D.content;
  if (kind === 'rms') {
    // RMS: súradnice vpravo a NC výpis dole sú na každej stránke
    ({ program: pageRmsProgram, machine: pagePosition, tools: pageTools, setup: pageSetup, monitor: pageMonitor })[tab](
      g,
      T,
      r,
      s,
    );
    g.fillStyle = '#263498';
    g.fillRect(783, 104, 219, 448);
    g.fillStyle = 'white';
    g.font = 'bold 19px Arial';
    g.fillText(s.alarm ? 'ALARM' : s.running ? 'AUTOMATIC' : s.done ? 'PROGRAM END' : 'RMS6 READY', 800, 134);
    s.posList.forEach(([k, v], i) => {
      g.fillStyle = '#c2cafa';
      g.font = '18px Arial';
      g.fillText(k, 799, 174 + i * 43);
      g.fillStyle = 'white';
      g.font = '20px monospace';
      g.fillText(v, 840, 174 + i * 43);
    });
    g.fillStyle = '#e6e7eb';
    g.fillRect(12, 562, 1000, 156);
    s.lines.slice(0, 6).forEach((ln, i) => {
      if (ln.cur) {
        g.fillStyle = T.cur;
        g.fillRect(18, 567 + i * 24, 988, 23);
      }
      g.fillStyle = '#343847';
      g.font = '16px monospace';
      g.fillText(ln.t.slice(0, 105), 28, 585 + i * 24);
    });
  } else ({ program: pageTncProgram, position: pagePosition, tools: pageTools, monitor: pageMonitor })[tab](g, T, r, s);
  // stavový riadok a posuvníky
  if (kind === 'tnc') {
    g.fillStyle = s.alarm ? T.alarm : s.msg ? '#e0a33c' : T.ok;
    g.fillRect(0, D.status.y, D.w, D.status.h);
    g.fillStyle = '#0d1a2a';
    g.font = 'bold 16px sans-serif';
    g.fillText((s.msg || s.status).slice(0, 66), 12, D.status.y + 20);
    g.fillStyle = T.bar;
    g.fillRect(0, D.status.y + D.status.h, D.w, D.h - D.status.y - D.status.h);
  } else {
    g.fillStyle = s.alarm ? T.alarm : s.msg ? '#c58b2c' : T.ok;
    g.fillRect(0, D.status.y, 552, D.status.h);
    g.fillStyle = 'white';
    g.font = '17px Arial';
    g.fillText((s.msg || s.status).slice(0, 56), 16, D.status.y + 28);
    g.fillStyle = T.bar;
    g.fillRect(552, D.status.y, D.w - 552, D.status.h);
  }
  slider(g, T, D.speed, 'SPEED', c.speed, speedToX(D.speed, c.speed), '×' + c.speed);
  slider(g, T, D.feed, 'FEED', c.fo, feedToX(D.feed, c.fo), c.fo + ' %');
  g.restore();
}

// text pre čítačku obrazovky (plátno samo osebe nie je čitateľné)
export const cncScreenLabel = () =>
  L(
    'Živý dotykový displej: záložky stránok, posuvníky rýchlosti simulácie a korekcie posuvu v spodnom riadku. Klávesy čísla stránky, šípky vľavo a vpravo rýchlosť, hore a dole korekcia posuvu.',
    'Live touch display: page tabs, simulation speed and feed override sliders in the bottom row. Number keys select pages, left and right arrows speed, up and down feed override.',
  );
