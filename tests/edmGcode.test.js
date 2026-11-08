import { describe, it, expect } from 'vitest';
import { compileEdmGcode, EDM_GCODE_SAMPLE } from '../src/machines/precision/edmGcode';
import { createEdmProcess } from '../src/machines/precision/edmProcess';
import { createStock } from '../src/machines/cnc/voxel';
import {
  readElectrodes,
  parseElectrodes,
  defaultElectrodes,
  ELECTRODE_KEY,
} from '../src/machines/precision/electrodes';
it('compiles absolute and incremental EDM programs with feed and source block numbers', () => {
  const result = compileEdmGcode(EDM_GCODE_SAMPLE);
  expect(result).toMatchObject({ startFlushing: true, endFlushing: false, endLine: 12 });
  expect(result.rows).toEqual([
    { x: -20, y: 0, depth: 8, line: 6, feed: 3 },
    { x: 20, y: 0, depth: 5, line: 9, feed: 3 },
  ]);
  expect(compileEdmGcode('G21 G90\nG0 X10 Y5\nG91\nG1 Z-7 F1\nG90 G0 Z5\nM30').rows[0]).toMatchObject({
    x: 10,
    y: 5,
    depth: 2,
    feed: 1,
  });
});
it('rejects unsupported, unsafe and malformed NC without partially returning a job', () => {
  for (const code of [
    'G2 X0 Y0',
    'G20',
    'G0 Z-5',
    'G1 Z-5\nG0 X10',
    'G1 Z-5\nM30',
    'G1 Z-5\nG1 Z-8\nG0 Z5',
    'M5\nG1 Z-4\nG0 Z5',
    'M9\nG1 Z-4\nG0 Z5',
    'G1 Z-5 F0\nG0 Z5',
    'G1 Z-5 F200\nG0 Z5',
    'G1 Z-5 #1\nG0 Z5',
  ])
    expect(() => compileEdmGcode(code)).toThrow(/NC/);
  expect(() => compileEdmGcode('G21\nG2 X1')).toThrow(/NC 2/);
});
it('runs a compiled NC program through actual stock removal, preserving a paused cut', () => {
  const stock = createStock({ min: [-50, -40, 0], max: [50, 40, 30], res: 1 }),
    p = createEdmProcess(stock),
    rows = compileEdmGcode('G90\nG0 X0 Y0\nG1 Z-2 F3\nG0 Z5\nM30').rows;
  expect(
    p.start({
      rows,
      electrode: { shape: 'box', w: 8, d: 8, length: 100, material: 'graphite' },
      current: 60,
      gap: 0.05,
      oilLevel: 80,
      fixtureHeight: 50,
    }),
  ).toBe(true);
  p.advance(15, { oilLevel: 80 });
  p.hold();
  const removed = stock.removed();
  expect(removed).toBeGreaterThan(0);
  p.advance(20, { oilLevel: 80 });
  expect(stock.removed()).toBe(removed);
  expect(p.S.line).toBe(3);
  p.start(p.job);
  p.advance(100, { oilLevel: 80 });
  expect(p.S.done).toBe(true);
  expect(stock.removed()).toBeGreaterThan(removed);
});
it('adds four graphite sizes to existing cabinets and retains material on JSON import', () => {
  const old = JSON.stringify({ version: 1, electrodes: [defaultElectrodes()[0]] }),
    items = readElectrodes({ getItem: (k) => (k === ELECTRODE_KEY ? old : null) }),
    graphite = items.filter((e) => e.material === 'graphite');
  expect(graphite).toHaveLength(4);
  expect(new Set(graphite.map((e) => e.w + 'x' + e.d)).size).toBe(4);
  expect(parseElectrodes({ version: 1, electrodes: graphite })).toEqual(graphite);
  expect(items[0].id).toBe('copper-prism-20-15');
  expect(() => parseElectrodes({ version: 1, electrodes: [{ ...graphite[0], material: 'invalid' }] })).toThrow();
});

describe('EDM G-kód: elektródy a prúd', () => {
  it('T1 / T2 M6 a S nastavia elektródu a prúd ďalších hĺbení', async () => {
    const { compileEdmGcode } = await import('../src/machines/precision/edmGcode.js');
    const r = compileEdmGcode('M3 M8\nT1 M6\nS30\nG0 Z5\nG1 Z-4 F3\nG0 Z5\nT2 M6\nS8\nG1 Z-4.2 F3\nG0 Z5\nM30');
    expect(r.rows.map((x) => [x.tool, x.current])).toEqual([
      [1, 30],
      [2, 8],
    ]);
    expect(() => compileEdmGcode('M3 M8\nG0 Z5\nG1 Z-2 F3\nT2 M6\nG0 Z5\nM30')).toThrow();
    expect(() => compileEdmGcode('M3 M8\nS80\nG0 Z5\nG1 Z-2\nG0 Z5\nM30')).toThrow();
  });
  it('zložitý program formy 3 × 3 sa preloží a prejde kontrolou úlohy', async () => {
    const { compileEdmGcode, edmComplexProgram, EDM_COMPLEX_ELECTRODES } = await import(
      '../src/machines/precision/edmGcode.js'
    );
    const { validateEdmJob } = await import('../src/machines/precision/edmProcess.js');
    const r = compileEdmGcode(edmComplexProgram());
    expect(r.rows).toHaveLength(27);
    expect(new Set(r.rows.map((x) => x.tool))).toEqual(new Set([1, 2]));
    expect(() =>
      validateEdmJob(
        { rows: r.rows, ...EDM_COMPLEX_ELECTRODES, current: 30, gap: 0.145, oilLevel: 80, fixtureHeight: 50 },
        { min: [-50, -40, 0], max: [50, 40, 30] },
      ),
    ).not.toThrow();
  });
});
