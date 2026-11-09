import { L } from '../../core/i18n';
// Manufacturer values: supplied Xpert Pro technical data, PDF page 4,
// standard 320/4300 column. Process timing and springback are training estimates.
export const XPERT320 = Object.freeze({
  length: 5260,
  width: 2000,
  height: 3170,
  force: 3200,
  bendLength: 4300,
  stroke: 250,
  openHeight: 640,
  frameGap: 3750,
  throat: 400,
  tableWidth: 74,
  xRange: 1050,
  xTravel: 600,
  rTravel: 250,
  zTravel: 2900,
  oil: 600,
  mass: 24300,
  power: 34,
  yAccuracy: 0.004,
});
export const BRAKE_MATERIALS = {
  steel: { rm: 450, spring: 2.2 },
  stainless: { rm: 700, spring: 3.2 },
  aluminium: { rm: 250, spring: 1.4 },
};
export const OPEN_TIP = 180; // Selected tool stack leaves 180 mm above the die.
const rad = Math.PI / 180;
export const brakeForce = (c) => (1.42 * BRAKE_MATERIALS[c.material].rm * c.length * c.thickness ** 2) / c.v / 1000;
export const insideRadius = (c) => Math.max(0.16 * c.v, 0.8 * c.thickness);
export const springback = (c) => BRAKE_MATERIALS[c.material].spring * Math.sqrt(c.v / (8 * c.thickness));
export function supportDepth(c, beta) {
  const r = insideRadius(c) + c.thickness / 2;
  return r * (1 - Math.cos(beta)) + (c.v / 2 - r * Math.sin(beta)) * Math.tan(beta);
}
export function brakeSetup(c) {
  if (!c || !BRAKE_MATERIALS[c.material]) throw new Error(L('Vyber materiál.', 'Select material.'));
  for (const [key, min, max] of [
    ['thickness', 0.5, 12],
    ['length', 100, XPERT320.bendLength],
    ['depth', 80, 1400],
    ['flange', 20, XPERT320.xRange],
    ['v', 16, 120],
    ['angle', 90, 170],
  ]) {
    if (!Number.isFinite(c[key]) || c[key] < min || c[key] > max)
      throw new Error(L(`Rozmer mimo rozsahu: ${key}.`, `Dimension outside range: ${key}.`));
  }
  if (c.v < 6 * c.thickness) throw new Error(L('V-matrica je príliš úzka pre hrúbku plechu.', 'V-die is too narrow.'));
  if (Math.min(c.flange, c.depth - c.flange) < 0.7 * c.v)
    throw new Error(L('Krátke rameno nedosiahne na oporu matrice.', 'Flange does not reach the die shoulder.'));
  if (c.length > XPERT320.frameGap && c.flange > XPERT320.throat)
    throw new Error(L('Široký plech presahuje vyloženie rámu 400 mm.', 'Wide sheet exceeds the 400 mm frame throat.'));
  const force = brakeForce(c),
    spring = springback(c),
    beta = ((180 - c.angle + spring) * rad) / 2;
  if (180 - (beta / rad) * 2 < 85)
    throw new Error(L('Kompenzovaný uhol prekračuje 85° nástroj.', 'Compensated angle exceeds 85° tooling.'));
  if (force > XPERT320.force) throw new Error(L('Prekročená sila 3 200 kN.', '3,200 kN capacity exceeded.'));
  const contact = OPEN_TIP - c.thickness,
    target = contact + supportDepth(c, beta);
  if (target > XPERT320.stroke) throw new Error(L('Ohyb presahuje zdvih 250 mm.', 'Bend exceeds 250 mm stroke.'));
  return { force, spring, beta, contact, target };
}

// Neutral-surface cross-section, in mm, centred at the bend. Offsetting by the
// surface normal supplies a continuous finite-thickness sheet for display/CAD.
export function sheetSection(c, beta) {
  const r = insideRadius(c) + c.thickness / 2,
    a = Math.max(0, beta),
    arc = r * a;
  const at = (t) => ({ z: r * Math.sin(t), y: r * (1 - Math.cos(t)), t });
  const back = at(-a),
    front = at(a),
    points = [];
  points.push({ z: back.z - (c.flange - arc) * Math.cos(a), y: back.y + (c.flange - arc) * Math.sin(a), t: -a });
  for (let i = 0; i <= 20; i++) points.push(at(-a + (2 * a * i) / 20));
  points.push({
    z: front.z + (c.depth - c.flange - arc) * Math.cos(a),
    y: front.y + (c.depth - c.flange - arc) * Math.sin(a),
    t: a,
  });
  // At zero bend the arc collapses to one point; remove coincident vertices.
  return points.filter((p, i) => i === 0 || Math.hypot(p.z - points[i - 1].z, p.y - points[i - 1].y) > 1e-7);
}

// Prierez dielu s viacerými ohybmi (program ohybov): hotové ohyby prog.bends = [{ s, beta }] v polohe s od hrany A,
// práve ohýbaný ohyb v polohe prog.cur s pol-uhlom beta; prog.side = hrana pri doraze ('A' alebo 'B').
// Všetky ohyby smerujú nahor (diel sa medzi ohybmi len otáča okolo zvislej osi). Body idú od zadného konca
// k prednému, t = uhol dotyčnice – rovnaký tvar výstupu ako sheetSection.
export function profileSection(c, beta, prog) {
  if (!prog) return sheetSection(c, beta);
  const r = insideRadius(c) + c.thickness / 2,
    a = Math.max(0, beta),
    D = c.depth,
    sc = prog.cur;
  // prechod od ohraňovaného ohybu ku koncu pásu; dir = −1 dozadu (hrana pri doraze), +1 dopredu
  const walk = (dir, toEnd, bends) => {
    let th = dir < 0 ? Math.PI - a : a,
      z = dir < 0 ? -r * Math.sin(a) : r * Math.sin(a),
      y = r * (1 - Math.cos(a)),
      used = r * a;
    const pts = [];
    const straight = (len) => {
      if (len <= 1e-6) return;
      z += len * Math.cos(th);
      y += len * Math.sin(th);
      pts.push({ z, y, th });
    };
    for (const b of bends) {
      const phi = 2 * b.beta,
        half = r * b.beta;
      straight(b.d - used - half);
      const n = Math.max(2, Math.ceil(phi / 0.12));
      for (let i = 0; i < n; i++) {
        const dth = ((dir < 0 ? -1 : 1) * phi) / n,
          mid = th + dth / 2;
        z += (r * phi * Math.cos(mid)) / n;
        y += (r * phi * Math.sin(mid)) / n;
        th += dth;
        pts.push({ z, y, th });
      }
      used = b.d + half;
    }
    straight(toEnd - used);
    return pts;
  };
  const backA = prog.side !== 'B',
    side = (back) =>
      prog.bends
        .filter((b) => (back === backA ? b.s < sc : b.s > sc))
        .map((b) => ({ d: Math.abs(b.s - sc), beta: b.beta }))
        .sort((p, q) => p.d - q.d);
  const back = walk(-1, backA ? sc : D - sc, side(true)),
    front = walk(1, backA ? D - sc : sc, side(false));
  const at = (t) => ({ z: r * Math.sin(t), y: r * (1 - Math.cos(t)), t });
  const points = [
    ...back.reverse().map((p) => ({ z: p.z, y: p.y, t: p.th - Math.PI })),
    ...Array.from({ length: 21 }, (_, i) => at(-a + (2 * a * i) / 20)),
    ...front.map((p) => ({ z: p.z, y: p.y, t: p.th })),
  ];
  return points.filter((p, i) => i === 0 || Math.hypot(p.z - points[i - 1].z, p.y - points[i - 1].y) > 1e-7);
}

// manipulácia s plechom pred krokom programu
export const TURN_LABEL = {
  flip: () => L('Prevrátiť plech (lícom hore)', 'Flip the sheet (face up)'),
  rot180: () => L('Otočiť plech o 180°', 'Turn the sheet 180°'),
  rot90: () => L('Pootočiť plech o 90°', 'Rotate the sheet 90°'),
};

// hrany krabičky (brakePart.js BOX_PART)
export const BOX_EDGE = {
  F: () => L('lem 25 na stene A', 'flange 25 on wall A'),
  A: () => L('stena A (zadná)', 'wall A (back)'),
  B: () => L('stena B (predná)', 'wall B (front)'),
  C: () => L('stena C (ľavá)', 'wall C (left)'),
  D: () => L('stena D (pravá)', 'wall D (right)'),
};
// Zložitý program: krabička 200 × 150 × 60 mm z plechu 2 mm, na zadnej stene vonkajší lem 25 mm (brakePart.js).
// Lem sa ohýba prvý (plech prevrátený), potom dlhé steny a nakoniec krátke steny medzi už ohnutými – na to sa
// razník zloží zo segmentov na dĺžku ohybu (box tooling). Pred každým ďalším ohybom sa plech otočí (turn).
export const BRAKE_PROGRAMS = [
  {
    id: 'krabicka',
    name: () => L('Krabička 200 × 150 × 60 s lemom 25 – 5 ohybov', 'Box 200 × 150 × 60 with 25 flange – 5 bends'),
    part: 'box',
    material: 'steel',
    thickness: 2,
    v: 16,
    r: 0,
    tooling: () =>
      L(
        'Razník 85° so segmentmi zloženými na dĺžku ohybu (200 / 150 mm) – voľný priestor pre steny 60 mm, matrica V16',
        'Punch 85° with segments assembled to the bend length (200 / 150 mm) – clearance for 60 mm walls, die V16',
      ),
    steps: [
      { hinge: 'F', flange: 25, length: 200, depth: 295, angle: 90, turn: null },
      { hinge: 'A', flange: 60, length: 200, depth: 295, angle: 90, turn: 'flip' },
      { hinge: 'B', flange: 60, length: 200, depth: 295, angle: 90, turn: 'rot180' },
      { hinge: 'C', flange: 60, length: 150, depth: 320, angle: 90, turn: 'rot90' },
      { hinge: 'D', flange: 60, length: 150, depth: 320, angle: 90, turn: 'rot180' },
    ],
  },
];

export function createBrakeProcess() {
  const S = {
    phase: 'idle',
    run: false,
    paused: false,
    done: false,
    complete: false,
    y: 0,
    beta: 0,
    peak: 0,
    force: 0,
    maxForce: 0,
    t: 0,
    alarm: null,
  };
  let job = null,
    dwell = 0;
  const safetyError = (s) =>
    s.estop
      ? L('Núdzový STOP', 'Emergency STOP')
      : !s.hydraulic
        ? L('Zapni hydrauliku.', 'Enable hydraulics.')
        : s.guardOpen
          ? L('Zatvor bočné kryty.', 'Close side guards.')
          : s.obstructed
            ? L('Prekážka v ochrannom poli.', 'Safety field obstructed.')
            : s.unclamped
              ? L('Vráť plech k nástroju.', 'Return sheet to tooling.')
              : null;
  const stop = (alarm) => {
    S.run = false;
    S.paused = !!job && !S.done;
    S.alarm = alarm || null;
  };
  const start = (c, s) => {
    const error = safetyError(s);
    if (error) {
      stop(error);
      return false;
    }
    if (S.done) {
      stop(L('Vlož nový plech.', 'Load a new sheet.'));
      return false;
    }
    if (!job) {
      try {
        job = { ...c, ...brakeSetup(c) };
      } catch (e) {
        stop(e.message);
        return false;
      }
      S.phase = 'approach';
    }
    S.run = true;
    S.paused = false;
    S.alarm = null;
    return true;
  };
  const retract = (s) => {
    if (s.estop || !s.hydraulic || s.unclamped) {
      stop(safetyError(s));
      return false;
    }
    if (!job || S.y === 0) return false;
    S.phase = 'return';
    S.run = true;
    S.paused = false;
    S.alarm = null;
    return true;
  };
  const reset = () => {
    if (S.run || S.y > 0.01) return false;
    job = null;
    dwell = 0;
    Object.assign(S, {
      phase: 'idle',
      paused: false,
      done: false,
      complete: false,
      y: 0,
      beta: 0,
      peak: 0,
      force: 0,
      maxForce: 0,
      t: 0,
      alarm: null,
    });
    return true;
  };
  const advance = (dt, s) => {
    if (!S.run) return;
    const err = safetyError(s);
    if (err) {
      stop(err);
      return;
    }
    let remain = Math.max(0, Math.min(120, dt));
    while (remain > 1e-8 && S.run) {
      const h = Math.min(0.02, remain);
      remain -= h;
      S.t += h;
      if (S.phase === 'approach') {
        S.y = Math.min(job.contact, S.y + 80 * h);
        if (S.y === job.contact) S.phase = 'bend';
      } else if (S.phase === 'bend') {
        S.y = Math.min(job.target, S.y + 8 * h);
        let lo = 0,
          hi = job.beta;
        for (let i = 0; i < 25; i++) {
          const b = (lo + hi) / 2;
          if (supportDepth(job, b) < S.y - job.contact) lo = b;
          else hi = b;
        }
        S.beta = (lo + hi) / 2;
        S.peak = Math.max(S.peak, S.beta);
        S.force = (job.force * Math.sin(S.beta)) / Math.sin(job.beta);
        S.maxForce = Math.max(S.maxForce, S.force);
        if (S.y === job.target) {
          S.beta = job.beta;
          S.peak = job.beta;
          S.complete = true;
          S.phase = 'dwell';
          dwell = 0;
        }
      } else if (S.phase === 'dwell') {
        dwell += h;
        if (dwell >= 0.8) S.phase = 'return';
      } else if (S.phase === 'return') {
        S.y = Math.max(0, S.y - 100 * h);
        S.force = 0;
        const release = Math.min(1, Math.max(0, (job.contact + supportDepth(job, S.peak) - S.y) / 5));
        S.beta = Math.max(0, S.peak - (release * job.spring * rad) / 2);
        if (S.y === 0) {
          S.run = false;
          S.paused = false;
          S.done = true;
          S.phase = 'done';
        }
      }
    }
  };
  return {
    S,
    start,
    hold: (alarm) => stop(alarm),
    acknowledge: (s) => {
      const error = safetyError(s);
      if (error) {
        stop(error);
        return false;
      }
      S.alarm = null;
      return true;
    },
    retract,
    reset,
    advance,
    get job() {
      return job;
    },
  };
}
