// Zvislá obrážačka TOS HOV 25 bez three.js: viac drážok v otvore náboja s delením otočného stola a vonkajší oblúk
// kruhovým posuvom. Obrobok aj rez nožom zdieľa model prstenca so zvislou obrážačkou (slotterMath). Dĺžky v mm, uhly v °.
import { createRing } from './slotterMath';

// zdvih 250 mm, otočný stôl Ø500, pozdĺžny posuv 560 mm, priečny 450 mm (podľa inzerátov stroja TOS HOV 25)
export const HOV = {
  stroke: 250,
  table: 500,
  travX: 450,
  travZ: 560,
  speeds: [20, 32, 50, 80], // zdvihy/min – orientačné stupne simulátora
  feeds: [0.05, 0.1, 0.2, 0.3], // mm na zdvih (priečny a pozdĺžny posuv)
  cFeeds: [0.1, 0.25, 0.5, 1], // ° na zdvih (kruhový posuv)
  cTurn: 4, // ° na otáčku kolesa otočného stola (šnek 1 : 90)
};
// nože: w = šírka ostria, b = dĺžka reznej časti za ostrím, A = najväčší prierez triesky na zdvih (mm²)
export const HOV_TOOLS = {
  drazk10: { w: 10, b: 12, A: 6 },
  plochy: { w: 16, b: 10, A: 12 },
};
// prierez reznej časti noža voči stredu obrobku; dir = +1 ostrie smeruje k +x, −1 k −x (nôž otočený v držiaku)
export const hovToolRect = (T, tip, zc, dir = 1) =>
  dir > 0
    ? [tip - T.b / 100, tip, zc - T.w / 200, zc + T.w / 200]
    : [tip, tip + T.b / 100, zc - T.w / 200, zc + T.w / 200];
// náboj Ø120 / Ø40 × 60 mm
export const hovBlank = () => createRing({ rIn: 0.2, rOut: 0.6, H: 0.6, NT: 720 });

const ang = (j, g) => (j * g.dT * 180) / Math.PI;
// všetky drážky v otvore: súvislé úseky lúčov s otvorom väčším ako pôvodný; šírka, hĺbka a uhol osi drážky
export function keywaysInfo(g) {
  const r0 = g.rIn0,
    cut = Array.from(g.rin, (r) => r > r0 + 0.0005),
    out = [];
  if (!cut.some(Boolean)) return out;
  if (cut.every(Boolean)) return [{ width: 360, depth: 0, angle: 0 }];
  for (let s = 0; s < g.NT; s++) {
    if (!cut[s] || cut[(s - 1 + g.NT) % g.NT]) continue;
    let n = 0;
    while (n < g.NT && cut[(s + n) % g.NT]) n++;
    const thc = (s + (n - 1) / 2) * g.dT;
    let wp = -Infinity,
      wm = Infinity,
      d = 0;
    for (let q = 0; q < n; q++) {
      const j = (s + q) % g.NT,
        del = j * g.dT - thc,
        r = g.rin[j];
      wp = Math.max(wp, r * Math.sin(del));
      wm = Math.min(wm, r * Math.sin(del));
      d = Math.max(d, r * Math.cos(del));
    }
    out.push({ width: (wp - wm) * 100, depth: (d - r0) * 100, angle: ((((thc * 180) / Math.PI) % 360) + 360) % 360 });
  }
  return out.sort((a, b) => a.angle - b.angle);
}
// najväčšia odchýlka rozostupu drážok od 360 / n (°)
export function pitchErr(ks) {
  if (ks.length < 2) return ks.length ? 0 : Infinity;
  const p = 360 / ks.length;
  let e = 0;
  for (let i = 0; i < ks.length; i++) {
    const a = ks[i].angle,
      b = i + 1 < ks.length ? ks[i + 1].angle : ks[0].angle + 360;
    e = Math.max(e, Math.abs(b - a - p));
  }
  return e;
}
// vonkajší oblúk: najdlhší úsek lúčov so zmenšeným obrysom; v ňom oblúk = lúče do 0,15 mm od najmenšieho polomeru
// (nábeh a výbeh plochého noža sa tak nepočíta). span = rozsah oblúka (°), err = odchýlka od R (mm), runs = počet úsekov
export function arcInfo(g, R) {
  const cut = Array.from(g.rout, (r) => r < g.rOut0 - 0.0005);
  if (!cut.some(Boolean)) return { span: 0, err: Infinity, runs: 0, r: 0 };
  let best = null,
    runs = 0;
  if (cut.every(Boolean)) best = { s: 0, n: g.NT };
  else
    for (let s = 0; s < g.NT; s++) {
      if (!cut[s] || cut[(s - 1 + g.NT) % g.NT]) continue;
      runs++;
      let n = 0;
      while (n < g.NT && cut[(s + n) % g.NT]) n++;
      if (!best || n > best.n) best = { s, n };
    }
  let rmin = Infinity;
  for (let q = 0; q < best.n; q++) rmin = Math.min(rmin, g.rout[(best.s + q) % g.NT] * 100);
  let err = 0,
    r = 0,
    k = 0;
  for (let q = 0; q < best.n; q++) {
    const v = g.rout[(best.s + q) % g.NT] * 100;
    if (v > rmin + 0.15) continue;
    err = Math.max(err, Math.abs(v - R));
    r += v;
    k++;
  }
  return { span: ang(k, g), err, runs: Math.max(1, runs), r: r / k };
}
const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '–');
export const hovChecks = {
  // 4 drážky 10 × 3 mm v otvore Ø40 po 90°
  drazky: ({ ring, crashes, shallow }) => {
    const ks = ring ? keywaysInfo(ring) : [];
    const wErr = ks.length ? Math.max(...ks.map((k) => Math.abs(k.width - 10))) : Infinity,
      dErr = ks.length ? Math.max(...ks.map((k) => Math.abs(k.depth - 3))) : Infinity;
    return [
      { key: 'count', ok: ks.length === 4, value: String(ks.length) },
      {
        key: 'width',
        ok: wErr <= 0.2,
        value: ks.length
          ? `${f2(Math.min(...ks.map((k) => k.width)))} – ${f2(Math.max(...ks.map((k) => k.width)))} mm`
          : '–',
      },
      {
        key: 'depth',
        ok: dErr <= 0.1,
        value: ks.length
          ? `${f2(Math.min(...ks.map((k) => k.depth)))} – ${f2(Math.max(...ks.map((k) => k.depth)))} mm`
          : '–',
      },
      {
        key: 'pitch',
        ok: ks.length === 4 && pitchErr(ks) <= 0.5,
        value: ks.length > 1 ? `±${f2(pitchErr(ks))}°` : '–',
      },
      { key: 'through', ok: !shallow, value: shallow ? '✗' : '✓' },
      { key: 'crash', ok: !crashes, value: String(crashes || 0) },
    ];
  },
  // vonkajší oblúk R 55 na 120° segmente obrysu Ø120
  oblouk: ({ ring, crashes, shallow }) => {
    const a = ring ? arcInfo(ring, 55) : { span: 0, err: Infinity, runs: 0, r: 0 };
    return [
      { key: 'radius', ok: a.err <= 0.2, value: a.r ? `R ${f2(a.r)} mm` : '–' },
      { key: 'span', ok: Math.abs(a.span - 120) <= 5, value: `${a.span.toFixed(1)}°` },
      { key: 'one', ok: a.runs === 1, value: String(a.runs) },
      { key: 'through', ok: !shallow, value: shallow ? '✗' : '✓' },
      { key: 'crash', ok: !crashes, value: String(crashes || 0) },
    ];
  },
};
