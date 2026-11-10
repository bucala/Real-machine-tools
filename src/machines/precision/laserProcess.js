// Vláknový laser Amada BREVIS 1212 AJ bez three.js: programy (obrysy dielov na tabuli), rezné podmienky podľa materiálu
// a hrúbky, kvalita rezu podľa rýchlosti / plynu / ohniska a priebeh programu (presun, prepal, rez). Dĺžky v mm, čas v s.

// 3 kW, pracovný priestor 1 270 × 1 270 × 200 mm, rýchloposuv 40 m/min, AMNC 3i (leták Amada BREVIS E133)
export const BREVIS = {
  power: 3000,
  travel: [1270, 1270, 200],
  rapid: 40,
  sheet: 1250,
  maxT: { S235: 12, 1.4301: 12, AlMg3: 12 },
};

export const MATERIALS = {
  S235: { sk: 'Oceľ S235', en: 'Steel S235', gas: 'O2', thick: [1, 2, 3, 6, 10] },
  1.4301: { sk: 'Nerez 1.4301', en: 'Stainless 1.4301', gas: 'N2', thick: [1, 2, 3, 6] },
  AlMg3: { sk: 'Hliník AlMg3', en: 'Aluminium AlMg3', gas: 'N2', thick: [1, 2, 3, 6] },
};
// odporúčané podmienky pri 3 kW (orientačné hodnoty simulátora): rýchlosť m/min, plyn, tlak bar, ohnisko mm, dýza mm
const TABLE = {
  S235: {
    1: [10, 'O2', 1.0, 0, 1.2],
    2: [6, 'O2', 0.8, 0.5, 1.2],
    3: [4.2, 'O2', 0.7, 1, 1.5],
    6: [2.3, 'O2', 0.6, 2, 2.0],
    10: [1.1, 'O2', 0.5, 3, 2.5],
  },
  1.4301: {
    1: [28, 'N2', 10, -0.5, 1.5],
    2: [11, 'N2', 12, -1, 2.0],
    3: [6, 'N2', 14, -1.5, 2.0],
    6: [1.8, 'N2', 16, -3, 2.5],
  },
  AlMg3: {
    1: [25, 'N2', 10, -0.5, 1.5],
    2: [10, 'N2', 12, -1, 2.0],
    3: [6, 'N2', 14, -1.5, 2.0],
    6: [1.6, 'N2', 16, -3, 2.5],
  },
};
export const recommend = (mat, t) => {
  const r = TABLE[mat]?.[t];
  return r ? { speed: r[0], gas: r[1], pressure: r[2], focus: r[3], nozzle: r[4], power: 100 } : null;
};
// čas prepalu (s) podľa hrúbky
export const pierceTime = (t) => 0.2 + 0.12 * t * t;

// kvalita rezu: through = prerezané, edge = 'ok' | 'otrep' | 'oxid' | 'prepal' | 'nie'
export function cutQuality(mat, t, cond) {
  const rec = recommend(mat, t);
  if (!rec) return { through: false, edge: 'nie', ratio: 0 };
  const eff = rec.speed * (cond.power / 100); // pri nižšom výkone treba pomalšie
  const ratio = cond.speed / Math.max(0.01, eff);
  const gasOk = cond.gas === rec.gas || (mat === 'S235' && cond.gas === 'N2' && t <= 3);
  const pressOk = cond.pressure >= rec.pressure * 0.7 && cond.pressure <= rec.pressure * 1.6;
  const focusOk = Math.abs(cond.focus - rec.focus) <= 1.5;
  if (ratio > 1.2 || cond.power < 30) return { through: false, edge: 'nie', ratio };
  if (mat !== 'S235' && cond.gas === 'O2') return { through: true, edge: 'oxid', ratio };
  if (!gasOk || !pressOk || !focusOk || ratio > 1.05) return { through: true, edge: 'otrep', ratio };
  if (ratio < 0.6) return { through: true, edge: 'prepal', ratio };
  return { through: true, edge: 'ok', ratio };
}

// ---------- programy: diely ako uzavreté obrysy (mm, počiatok v ľavom prednom rohu tabule) ----------
const circle = (cx, cy, r, n = 48) =>
  Array.from({ length: n }, (_, i) => [
    cx + r * Math.cos((i / n) * 2 * Math.PI),
    cy + r * Math.sin((i / n) * 2 * Math.PI),
  ]);
const roundRect = (x0, y0, w, h, r, n = 6) => {
  const p = [],
    c = [
      [x0 + w - r, y0 + r, -Math.PI / 2],
      [x0 + w - r, y0 + h - r, 0],
      [x0 + r, y0 + h - r, Math.PI / 2],
      [x0 + r, y0 + r, Math.PI],
    ];
  c.forEach(([cx, cy, a0]) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (Math.PI / 2);
      p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  });
  return p;
};
// diel: vnútorné obrysy (otvory) sa režú pred vonkajším – výrez ostáva pevný v tabuli
const flange = (cx, cy) => ({
  inner: [
    circle(cx, cy, 40),
    ...Array.from({ length: 6 }, (_, k) =>
      circle(cx + 80 * Math.cos((k * Math.PI) / 3), cy + 80 * Math.sin((k * Math.PI) / 3), 7, 20),
    ),
  ],
  outer: circle(cx, cy, 100, 72),
});
const bracket = (x0, y0) => ({
  inner: [
    roundRect(x0 + 40, y0 + 54, 50, 12, 6, 4),
    roundRect(x0 + 210, y0 + 54, 50, 12, 6, 4),
    circle(x0 + 150, y0 + 30, 5, 16),
    circle(x0 + 150, y0 + 90, 5, 16),
  ],
  outer: roundRect(x0, y0, 300, 120, 10),
});
export const PROGRAMS = {
  priruba: {
    sk: 'Príruba Ø200 · 9 ks',
    en: 'Flange Ø200 · 9 pcs',
    parts: [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => flange(265 + i * 360, 265 + j * 360))),
  },
  konzola: {
    sk: 'Konzola 300 × 120 · 12 ks',
    en: 'Bracket 300 × 120 · 12 pcs',
    parts: [0, 1, 2].flatMap((i) => [0, 1, 2, 3].map((j) => bracket(90 + i * 370, 120 + j * 260))),
  },
};
const len = (pts) =>
  pts.reduce((s, p, i) => s + Math.hypot(pts[(i + 1) % pts.length][0] - p[0], pts[(i + 1) % pts.length][1] - p[1]), 0);
// zoznam operácií programu: pre každý diel otvory, potom obrys
export const operations = (prog) =>
  PROGRAMS[prog].parts.flatMap((p, k) => [
    ...p.inner.map((pts) => ({ part: k, inner: true, pts, len: len(pts) })),
    { part: k, inner: false, pts: p.outer, len: len(p.outer) },
  ]);
export function programStats(prog, mat, t, cond) {
  const ops = operations(prog),
    L = ops.reduce((s, o) => s + o.len, 0),
    v = (cond.speed * 1000) / 60;
  let rapid = 0;
  ops.forEach((o, i) => {
    const prev = i ? ops[i - 1].pts[0] : [0, 0];
    rapid += Math.hypot(o.pts[0][0] - prev[0], o.pts[0][1] - prev[1]);
  });
  return {
    parts: PROGRAMS[prog].parts.length,
    pierces: ops.length,
    cutLen: L,
    time: L / Math.max(1, v) + ops.length * pierceTime(t) + rapid / ((BREVIS.rapid * 1000) / 60),
  };
}

// ---------- priebeh programu ----------
export function createLaserProcess() {
  const S = {
    phase: 'idle',
    prog: null,
    ops: [],
    op: 0,
    stage: 'move',
    s: 0,
    t: 0,
    head: { x: 0, y: 0, z: 30 },
    results: [],
    alarm: null,
    done: false,
    cutLen: 0,
    time: 0,
    beam: false,
  };
  let job = null;
  const segs = []; // nové úseky rezu na vykreslenie [{x0,y0,x1,y1,op}]
  const finished = []; // dokončené obrysy [{op, q}]
  return {
    S,
    takeSegs: () => segs.splice(0),
    takeFinished: () => finished.splice(0),
    load(prog, mat, t, cond) {
      job = { prog, mat, t, cond: { ...cond } };
      Object.assign(S, {
        phase: 'ready',
        prog,
        ops: operations(prog),
        op: 0,
        stage: 'move',
        s: 0,
        results: [],
        alarm: null,
        done: false,
        cutLen: 0,
        time: 0,
        beam: false,
      });
    },
    start(check) {
      if (!job) return ((S.alarm = 'noprog'), false);
      const why = check();
      if (why) {
        S.alarm = why;
        return false;
      }
      if (S.phase === 'done') this.load(job.prog, job.mat, job.t, job.cond);
      S.alarm = null;
      S.phase = 'run';
      return true;
    },
    hold(msg) {
      if (S.phase === 'run') S.phase = 'hold';
      S.beam = false;
      if (msg) S.alarm = msg;
    },
    reset() {
      Object.assign(S, { phase: 'idle', ops: [], op: 0, results: [], alarm: null, done: false, beam: false });
      S.head.z = 30;
      job = null;
    },
    setCond(cond) {
      if (job) job.cond = { ...job.cond, ...cond };
    },
    job: () => job,
    advance(dt) {
      if (S.phase !== 'run' || !job) return;
      let rest = dt;
      while (rest > 0 && S.phase === 'run') {
        const o = S.ops[S.op];
        if (!o) {
          S.phase = 'done';
          S.done = true;
          S.beam = false;
          S.head.z = 30;
          break;
        }
        if (S.stage === 'move') {
          S.beam = false;
          const [tx, ty] = o.pts[0],
            d = Math.hypot(tx - S.head.x, ty - S.head.y),
            v = (BREVIS.rapid * 1000) / 60,
            step = Math.min(d, v * rest);
          if (d > 1e-6) {
            S.head.x += ((tx - S.head.x) / d) * step;
            S.head.y += ((ty - S.head.y) / d) * step;
          }
          S.head.z = 1 + 29 * Math.min(1, d / 150);
          rest -= step / v;
          S.time += step / v;
          if (d - step < 1e-6) {
            S.stage = 'pierce';
            S.t = 0;
          }
        } else if (S.stage === 'pierce') {
          S.beam = true;
          S.head.z = 1;
          const need = pierceTime(job.t) - S.t,
            use = Math.min(need, rest);
          S.t += use;
          rest -= use;
          S.time += use;
          if (S.t >= pierceTime(job.t) - 1e-9) {
            S.stage = 'cut';
            S.s = 0;
            S.q = cutQuality(job.mat, job.t, job.cond);
          }
        } else {
          S.beam = true;
          const v = (job.cond.speed * 1000) / 60,
            ds = Math.min(o.len - S.s, v * rest);
          // posun po obryse o ds
          let s0 = S.s,
            todo = ds;
          const n = o.pts.length;
          let acc = 0;
          for (let i = 0; i < n && todo > 1e-9; i++) {
            const a = o.pts[i],
              b = o.pts[(i + 1) % n],
              l = Math.hypot(b[0] - a[0], b[1] - a[1]);
            if (acc + l <= s0) {
              acc += l;
              continue;
            }
            const u0 = (s0 - acc) / l,
              u1 = Math.min(1, u0 + todo / l),
              p0 = [a[0] + (b[0] - a[0]) * u0, a[1] + (b[1] - a[1]) * u0],
              p1 = [a[0] + (b[0] - a[0]) * u1, a[1] + (b[1] - a[1]) * u1];
            segs.push({ x0: p0[0], y0: p0[1], x1: p1[0], y1: p1[1], op: S.op, q: S.q });
            const used = (u1 - u0) * l;
            todo -= used;
            s0 += used;
            acc += l;
            S.head.x = p1[0];
            S.head.y = p1[1];
          }
          S.s += ds;
          S.cutLen += ds;
          rest -= ds / v;
          S.time += ds / v;
          if (S.s >= o.len - 1e-6) {
            S.results[S.op] = S.q;
            finished.push({ op: S.op, q: S.q, o });
            S.op++;
            S.stage = 'move';
          }
        }
      }
    },
  };
}

// ---------- vyhodnotenie úloh ----------
export function laserInfo(S, prog) {
  const ops = S.ops.length ? S.ops : prog ? operations(prog) : [];
  const nParts = prog ? PROGRAMS[prog].parts.length : 0;
  const byPart = Array.from({ length: nParts }, () => ({ cut: 0, total: 0, bad: 0, through: true, edges: new Set() }));
  ops.forEach((o, i) => {
    const b = byPart[o.part];
    if (!b) return;
    b.total++;
    const r = S.results[i];
    if (r) {
      b.cut++;
      b.edges.add(r.edge);
      if (!r.through) b.through = false;
      if (r.edge !== 'ok') b.bad++;
    }
  });
  const done = byPart.filter((b) => b.cut === b.total && b.total > 0);
  return {
    parts: nParts,
    done: done.length,
    good: done.filter((b) => b.through && !b.bad).length,
    edges: [...new Set(byPart.flatMap((b) => [...b.edges]))],
  };
}
export const LASER_TASKS = {
  priruba: { prog: 'priruba', mat: 'S235', t: 3 },
  nerez: { prog: 'konzola', mat: '1.4301', t: 2 },
};
export const laserChecks = Object.fromEntries(
  Object.entries(LASER_TASKS).map(([id, T]) => [
    id,
    (m) => [
      {
        key: 'setup',
        ok: m.prog === T.prog && m.mat === T.mat && m.t === T.t,
        value: `${m.prog || '—'} · ${m.mat} ${m.t} mm`,
      },
      { key: 'parts', ok: m.info.parts > 0 && m.info.good === m.info.parts, value: `${m.info.good} / ${m.info.parts}` },
      {
        key: 'edge',
        ok: m.info.done > 0 && m.info.edges.every((e) => e === 'ok'),
        value: m.info.edges.join(', ') || '—',
      },
      { key: 'door', ok: !m.doorAlarm, value: m.doorAlarm ? '✗' : '✓' },
      { key: 'unload', ok: m.unloaded, value: m.unloaded ? '✓' : '—' },
    ],
  ]),
);
