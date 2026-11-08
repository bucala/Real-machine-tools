import { describe, expect, it } from 'vitest';
import { interpret } from '../src/machines/cnc/gcode';
import { SAMPLES } from '../src/machines/cnc/programs';
import { createExecutor } from '../src/machines/cnc/sim';
import { defaultTools } from '../src/machines/cnc/tooling';
import { createStock } from '../src/machines/cnc/voxel';
import { CNC_TASK_PROGRAMS, cncChecks, measureCnc } from '../src/machines/cnc/cncTasks';

const O54 = [0, 0, 90];
const run = (text) => {
  const tools = defaultTools(),
    prog = interpret(text, { o54: O54, tools });
  const stock = createStock({ min: [-50, -40, 50], max: [50, 40, 90], res: 0.7 }),
    ex = createExecutor({ moves: prog.moves, tools, o54: O54, stock });
  let maxA = 0,
    g = 0;
  while (!ex.S.done && !ex.S.alarm && g++ < 1e5) {
    ex.advance(2, { budget: 1e12 });
    if (ex.S.paused) ex.S.paused = false;
    if (Math.abs(ex.S.pose.a) > Math.abs(maxA)) maxA = ex.S.pose.a;
  }
  return measureCnc({ stock, o54: O54, ex, maxA, maxLoad: ex.S.load || 0 });
};
const passed = (checks) => checks.every((c) => c.ok);

// vzorové riešenie: obrys stredu nástroja X ±15, Y ±10, dve hĺbky, riadkovanie po 5 mm
const KAPSA_OK = CNC_TASK_PROGRAMS.kapsa.replace(
  /G1 Z-2\.5 F300[\s\S]*?\(DOPLN[^)]*\)/,
  [-2.5, -5]
    .map((z) =>
      [
        `G1 Z${z} F300`,
        ...[-10, -5, 0, 5, 10].flatMap((y, i) => [`G1 X${i % 2 ? 15 : -15}. Y${y}. F1800`, `X${i % 2 ? -15 : 15}.`]),
        'G1 X-15. Y-10.',
        'X15.',
        'Y10.',
        'X-15.',
        'Y-10.',
      ].join('\n'),
    )
    .join('\n'),
);

describe('úlohy CNC – hodnotenie z merania obrobku', () => {
  it('kapsa: neúplný program neprejde, vzorové riešenie splní rozmery 40 × 30 × 5 ±0,1', () => {
    expect(passed(cncChecks.kapsa(run(CNC_TASK_PROGRAMS.kapsa)))).toBe(false);
    const m = run(KAPSA_OK),
      checks = cncChecks.kapsa(m);
    expect(checks.filter((c) => !c.ok)).toEqual([]);
    expect(m.depth).toBeCloseTo(5, 1);
    expect(m.pocket.x).toBeCloseTo(40, 1);
    expect(m.pocket.y).toBeCloseTo(30, 1);
  }, 60000);
  it('kolízia: zápich rýchloposuvom je alarm, s G1 a posuvom úloha prejde', () => {
    const bad = run(CNC_TASK_PROGRAMS.kolizia);
    expect(bad.alarm).toMatch(/rýchloposuv/);
    expect(passed(cncChecks.kolizia(bad))).toBe(false);
    expect(
      cncChecks.kolizia(run(CNC_TASK_PROGRAMS.kolizia.replace('G0 Z-3.', 'G1 Z-3. F300'))).filter((c) => !c.ok),
    ).toEqual([]);
  }, 60000);
  it('3+2: ukážkový program G68.2 vytvorí plochu so sklonom 30°', () => {
    const m = run(SAMPLES().find((s) => s.id === 'p32').text);
    expect(cncChecks.naklon(m).filter((c) => !c.ok)).toEqual([]);
  }, 60000);
});

import { createEdmProcess, edmGap } from '../src/machines/precision/edmProcess';
import { brakeChecks, edmChecks, measureBrake, measureEdm } from '../src/machines/precision/modernTasks';
import { createBrakeProcess } from '../src/machines/precision/pressBrakeProcess';

const edm = (current, depth) => {
  const stock = createStock({ min: [-50, -40, 0], max: [50, 40, 30], res: 0.7 }),
    p = createEdmProcess(stock),
    row = { x: 0, y: 0, depth };
  const job = {
    rows: [row],
    electrode: { shape: 'box', w: 20, d: 15, length: 100 },
    current,
    gap: edmGap(current),
    oilLevel: 80,
    fixtureHeight: 50,
  };
  expect(p.start(job)).toBe(true);
  for (let i = 0; i < 20000 && !p.S.done; i++) p.advance(5, { oilLevel: 80, flushing: true });
  return measureEdm({ stock, S: p.S, current, row });
};
describe('úlohy elektroerózie – medzera a drsnosť', () => {
  it('dutina 20,3 × 15,3 × 6: pri 30 A treba hĺbku zmenšiť o čelnú medzeru', () => {
    expect(edmChecks.dutina(edm(30, 6)).find((c) => c.key === 'depth').ok).toBe(false); // bez kompenzácie hlbšie
    const m = edm(30, 6 - edmGap(30));
    expect(edmChecks.dutina(m).filter((c) => !c.ok)).toEqual([]);
  }, 60000);
  it('dokončenie: Ra ≤ 1,6 µm len pri malom prúde', () => {
    expect(edmChecks.dokoncenie(edm(20, 2 - edmGap(20))).find((c) => c.key === 'ra').ok).toBe(false);
    expect(edmChecks.dokoncenie(edm(4, 2 - edmGap(4))).filter((c) => !c.ok)).toEqual([]);
  }, 60000);
});

const bend = (cfg) => {
  const p = createBrakeProcess(),
    s = { hydraulic: true };
  p.start(cfg, s);
  for (let i = 0; i < 2000 && !p.S.done; i++) p.advance(0.1, s);
  return measureBrake({ S: p.S, c: cfg });
};
describe('úlohy ohraňovacieho lisu', () => {
  const base = { material: 'steel', thickness: 3, length: 2000, depth: 100, flange: 50, angle: 90 };
  it('uholník 90°: V-matrica 6 – 10 × t', () => {
    expect(brakeChecks.uholnik(bend({ ...base, v: 24 })).filter((c) => !c.ok)).toEqual([]);
    expect(brakeChecks.uholnik(bend({ ...base, v: 40 })).find((c) => c.key === 'v').ok).toBe(false);
  });
  it('sila do 50 % kapacity: pri 6 mm a 3 000 mm treba širšiu matricu', () => {
    const cfg = { material: 'steel', thickness: 6, length: 3000, depth: 300, flange: 150, angle: 90 };
    expect(brakeChecks.sila(bend({ ...cfg, v: 40 })).find((c) => c.key === 'force').ok).toBe(false);
    expect(brakeChecks.sila(bend({ ...cfg, v: 50 })).filter((c) => !c.ok)).toEqual([]);
  });
});

describe('elektroerózia – hrubovanie a dokončenie dvoma elektródami', () => {
  const E1 = { shape: 'box', w: 19.6, d: 14.6, length: 100 },
    E2 = { shape: 'box', w: 20.25, d: 15.25, length: 100 };
  const twoStage = (finishCurrent, finishDepth) => {
    const stock = createStock({ min: [-50, -40, 0], max: [50, 40, 30], res: 0.7 }),
      p = createEdmProcess(stock);
    const rows = [
      { x: 0, y: 0, depth: 5.6, tool: 1, current: 30 },
      { x: 0, y: 0, depth: finishDepth, tool: 2, current: finishCurrent },
    ];
    const job = { rows, electrode: E1, electrode2: E2, current: 30, gap: edmGap(30), oilLevel: 80, fixtureHeight: 50 };
    expect(p.start(job)).toBe(true);
    let phases = new Set();
    for (let i = 0; i < 40000 && !p.S.done; i++) {
      p.advance(5, { oilLevel: 80, flushing: true });
      phases.add(p.S.phase);
    }
    return { m: measureEdm({ stock, S: p.S, current: finishCurrent, row: rows[0], rows }), phases, t: p.S.t };
  };
  it('pripravený program (E2 pri 12 A, bez kompenzácie) neprejde, s 3 A a hĺbkou 6 − medzera áno', () => {
    expect(
      edmChecks
        .dve(twoStage(12, 6).m)
        .filter((c) => !c.ok)
        .map((c) => c.key),
    ).toEqual(expect.arrayContaining(['depth', 'ra']));
    const { m, phases, t } = twoStage(3, 6 - edmGap(3));
    expect(edmChecks.dve(m).filter((c) => !c.ok)).toEqual([]);
    expect(phases.has('change')).toBe(true);
    expect(t).toBeLessThan(3 * 3600); // dokončenie prejde prázdnou dutinou rýchlo, nie celých 6 mm pri 3 A
  }, 120000);
});
