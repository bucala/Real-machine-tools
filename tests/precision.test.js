import { describe, it, expect } from 'vitest';
import { createStock } from '../src/machines/cnc/voxel';
import { interpret } from '../src/machines/cnc/gcode';
import { createExecutor } from '../src/machines/cnc/sim';
import { defaultTools } from '../src/machines/cnc/tooling';
import { createEdmProcess, validateEdmJob } from '../src/machines/precision/edmProcess';
import { RXU, RXU_PROGRAM, EX500, validateRxuTool } from '../src/machines/precision/profiles';
const stock = () => createStock({ min: [-25, -20, 0], max: [25, 20, 20], res: 0.5 });
const config = (over = {}) => ({
  rows: [
    { x: -12, y: 0, depth: 4 },
    { x: 12, y: 0, depth: 3 },
  ],
  electrode: { shape: 'box', w: 8, d: 6, length: 120 },
  gap: 0.05,
  current: 30,
  oilLevel: 70,
  ...over,
});
const ready = { oilLevel: 70, flushing: true };
describe('Verified precision-machine profiles', () => {
  it('uses the DSH travels, not the 3-axis RXU travels or the EXD drilling data', () => {
    expect(RXU.X[1] - RXU.X[0]).toBe(800);
    expect(RXU.Y[1] - RXU.Y[0]).toBe(855);
    expect(RXU.A).toEqual([-115, 115]);
    expect(RXU.mag).toBe(24);
    expect(EX500.table).toEqual([850, 450]);
    expect(EX500.current).toBe(60);
    expect(EX500.structure).toBe('column-moving');
  });
  it('completes the RXU demonstration through the shared CNC executor', () => {
    const tools = defaultTools().filter((t) => t.d <= 35),
      s = createStock({ min: [-50, -40, 50], max: [50, 40, 90], res: 1 });
    const p = interpret(RXU_PROGRAM, { tools, o54: [0, 0, 90], mach: RXU });
    expect(p.errors).toEqual([]);
    const ex = createExecutor({
      moves: p.moves,
      tools,
      stock: s,
      o54: [0, 0, 90],
      fixture: { r: 35, h: 50 },
      mach: RXU,
      kc: 800,
    });
    for (let i = 0; i < 2000 && !ex.S.done && !ex.S.alarm; i++) ex.advance(0.2);
    expect(ex.S.alarm).toBeNull();
    expect(ex.S.done).toBe(true);
    expect(ex.S.removed).toBeGreaterThan(300);
  });
  it('checks installed tools and reports the actual A-axis limit', () => {
    expect(() => validateRxuTool(defaultTools()[0])).toThrow('Ø35');
    const p = interpret('G0 A120', { tools: [], mach: RXU });
    expect(p.errors.some((e) => e.text.includes('115'))).toBe(true);
  });
});
describe('Sinker EDM process', () => {
  it('validates the generator, footprint, chuck clearance and fluid coverage', () => {
    const s = stock();
    expect(() => validateEdmJob(config(), s)).not.toThrow();
    for (const cfg of [
      config({ current: 61 }),
      config({ oilLevel: 59 }),
      config({ rows: [{ x: 251, y: 0, depth: 2 }] }),
      config({ rows: [{ x: 0, y: 0, depth: 21 }] }),
      config({ electrode: { shape: 'box', w: 8, d: 6, length: 40 } }),
    ])
      expect(() => validateEdmJob(cfg, s)).toThrow();
  });
  it('includes the real fixture height in the EX500 chuck clearance', () => {
    const s = createStock({ min: [-50, -40, 0], max: [50, 40, 30], res: 1 }),
      job = config({
        rows: [{ x: 0, y: 0, depth: 8 }],
        electrode: { shape: 'box', w: 20, d: 15, length: 100 },
        oilLevel: 80,
        fixtureHeight: 50,
      });
    expect(() => validateEdmJob(job, s)).not.toThrow();
    expect(() => validateEdmJob({ ...job, fixtureHeight: 0 }, s)).toThrow();
  });
  it('never removes material with an open gate or insufficient dielectric', () => {
    for (const conditions of [{ door: true }, { oilLevel: 59 }, { flushing: false }, { estop: true }]) {
      const s = stock(),
        p = createEdmProcess(s),
        v = s.volume();
      expect(p.start(config())).toBe(true);
      p.advance(20, { ...ready, ...conditions });
      expect(p.S.run).toBe(false);
      expect(p.S.alarm).toBeTruthy();
      expect(s.volume()).toBe(v);
    }
  });
  it('preserves the paused cut, resumes, retracts between cavities and avoids a connecting trench', () => {
    const s = stock(),
      p = createEdmProcess(s);
    p.start(config());
    while (p.S.depth < 1) p.advance(1, ready);
    p.hold();
    const volume = s.volume(),
      depth = p.S.depth;
    p.advance(80, ready);
    expect(s.volume()).toBe(volume);
    expect(p.S.depth).toBe(depth);
    expect(p.start(config())).toBe(true);
    for (let i = 0; i < 400 && !p.S.done; i++) p.advance(1, ready);
    expect(p.S.done).toBe(true);
    expect(s.inside([-12, 0, 19])).toBe(false);
    expect(s.inside([12, 0, 18])).toBe(false);
    expect(s.inside([0, 0, 19])).toBe(true);
    expect(p.S.removed).toBeGreaterThan(200);
    expect(s.takeDirty().some((c) => c.idx.length > 0)).toBe(true);
  });
  it('makes a prism cavity distinct from a round electrode', () => {
    const a = stock(),
      b = stock(),
      row = { x: 0, y: 0, depth: 4 };
    for (const [s, shape] of [
      [a, 'box'],
      [b, 'round'],
    ]) {
      const p = createEdmProcess(s);
      p.start(config({ rows: [row], electrode: { shape, w: 8, d: 8, length: 120 } }));
      for (let i = 0; i < 200 && !p.S.done; i++) p.advance(1, ready);
      expect(p.S.done).toBe(true);
    }
    expect(a.inside([3.5, 3.5, 19])).toBe(false);
    expect(b.inside([3.5, 3.5, 19])).toBe(true);
    expect(a.removed()).toBeGreaterThan(b.removed());
  });
});

import { edmArea, edmFeed, edmGap, edmRa, edmVdi } from '../src/machines/precision/edmProcess';
describe('elektroerózia – fyzikálny model', () => {
  it('rýchlosť hĺbenia klesá s plochou elektródy, medzera a drsnosť rastú s prúdom', () => {
    const small = { shape: 'box', w: 8, d: 6 },
      big = { shape: 'box', w: 30, d: 20 };
    expect(edmArea(big)).toBe(600);
    expect(edmFeed(small, 30) / edmFeed(big, 30)).toBeCloseTo(600 / 48, 6);
    expect(edmFeed({ ...big, material: 'graphite' }, 30)).toBeGreaterThan(edmFeed(big, 30));
    expect(edmGap(60)).toBeGreaterThan(edmGap(5));
    expect(edmRa(2)).toBeLessThan(1);
    expect(edmRa(30)).toBeGreaterThan(5);
    expect(edmVdi(30)).toBeGreaterThan(edmVdi(2));
  });
});
