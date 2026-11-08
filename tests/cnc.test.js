import { describe, expect, it } from 'vitest';
import { interpret } from '../src/machines/cnc/gcode';
import { MODELS, axisToAC, toMach, toTable, toolAxisT } from '../src/machines/cnc/kin';
import { moveTime, poseAt } from '../src/machines/cnc/motion';
import { SAMPLES } from '../src/machines/cnc/programs';
import { createExecutor } from '../src/machines/cnc/sim';
import { defaultTools, toolsFromComments } from '../src/machines/cnc/tooling';
import { createStock } from '../src/machines/cnc/voxel';

const STOCK = { min: [-50, -40, 50], max: [50, 40, 90] },
  O54 = [0, 0, 90];
const close = (a, b, e = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < e);
const run = (text, res = 1.0, mach = MODELS.c32) => {
  const tools = defaultTools(),
    prog = interpret(text, { o54: O54, tools, mach });
  const stock = createStock({ ...STOCK, res }),
    ex = createExecutor({ moves: prog.moves, tools, o54: O54, stock, mach });
  let guard = 0;
  while (!ex.S.done && !ex.S.alarm && guard++ < 200000) {
    ex.advance(5, { budget: 1e12 });
    if (ex.S.paused) ex.S.paused = false;
  }
  return { prog, ex, stock };
};

describe('CNC – kinematika otočno-sklopného stola', () => {
  it('rám stola ↔ stroj, os nástroja a inverzná úloha A/C', () => {
    const p = [12, -30, 75];
    expect(close(toTable(toMach(p, 35, 120), 35, 120), p)).toBe(true);
    expect(close(toolAxisT(30, 0), [0, 0.5, Math.sqrt(3) / 2])).toBe(true);
    const s = axisToAC(toolAxisT(-40, 75), 70);
    expect(close(toolAxisT(s.a, s.c), toolAxisT(-40, 75))).toBe(true);
    const s2 = axisToAC([0, -1, 0]);
    expect(Math.abs(s2.a)).toBeCloseTo(90, 6);
    expect(close(toolAxisT(s2.a, s2.c), [0, -1, 0])).toBe(true);
  });
});

describe('CNC – interpreter', () => {
  it('ISO: lineárne a kruhové pohyby, korekcia dĺžky a chýbajúci posuv', () => {
    const tools = defaultTools();
    const pr = interpret('G90 G17 G21\nT3 M6\nS10000 M3\nG0 X0 Y0\nG43 H3 Z5\nG1 Z-2 F300\nG2 X20 Y0 I10 J0\nG1 X30', {
      o54: O54,
      tools,
    });
    expect(pr.errors).toEqual([]);
    const arc = pr.moves.find((m) => m.kind === 'arc');
    expect(arc.sweep).toBeCloseTo(-180, 6);
    expect(close(poseAt(arc, 0.5, O54).pT, [10, 10, 88])).toBe(true);
    // bez G43 je naprogramovaný bod čelo vretena – špička je o dĺžku nástroja nižšie
    const p2 = interpret('T3 M6\nG0 X0 Y0 Z150', { o54: O54, tools });
    const last = p2.moves[p2.moves.length - 1];
    expect(last.q1[2]).toBeCloseTo(150 + (O54[2] - 100) - 115, 6);
    expect(interpret('T3 M6\nG1 X10', { o54: O54, tools }).errors.length).toBeGreaterThan(0);
    expect(interpret('G0 B30', { o54: O54, tools }).errors.length).toBeGreaterThan(0);
  });
  it('ISO 3+2: G68.2 / G53.1 natočí stôl A30, pohyby sú v naklonenej rovine', () => {
    const pr = interpret('T3 M6\nG53 G0 Z0\nG68.2 X0 Y20 Z0 I0 J-30 K0\nG53.1\nG43 H3 Z10\nG0 X0 Y0 Z0', {
      o54: O54,
      tools: defaultTools(),
    });
    expect(pr.errors).toEqual([]);
    const mv = pr.moves[pr.moves.length - 1];
    expect(mv.a1).toBeCloseTo(30, 6);
    expect(close(mv.q1, [0, 20, 0])).toBe(true);
  });
  it('Heidenhain: BLK FORM, TOOL CALL, CC / C, PLANE SPATIAL a cyklus 200', () => {
    const pr = interpret(SAMPLES().find((s) => s.id === 'ph').text, { o54: O54, tools: defaultTools() });
    expect(pr.dialect).toBe('heidenhain');
    expect(pr.errors).toEqual([]);
    expect(pr.stock).toEqual({ min: [-50, -40, -40], max: [50, 40, 0] });
    expect(pr.moves.some((m) => m.kind === 'arc' && Math.abs(m.sweep + 360) < 1e-6)).toBe(true);
    expect(pr.moves.some((m) => m.kind === 'lin' && Math.abs(m.a1 - 25) < 1e-6)).toBe(true);
  });
  it('nástroje z komentárov CAM postprocesora', () => {
    const t = toolsFromComments([
      'T4 D=6. CR=3. - ZMIN=-10. - ball end mill',
      ' T7 D=8.5 CR=0. TAPER=118deg - drill',
      'bez nástroja',
    ]);
    expect(t).toHaveLength(2);
    expect(t[0]).toMatchObject({ t: 4, d: 6, cr: 3, kind: 'mill' });
    expect(t[1]).toMatchObject({ t: 7, kind: 'cone', tip: 118 });
  });
  it('čas pohybu: posuv aj dynamika osí', () => {
    const pr = interpret('T3 M6\nG43 H3 G0 X0 Y0 Z10\nG1 X60 F1200\nG0 A90', { o54: O54, tools: defaultTools() });
    const ms = pr.moves.filter((m) => m.kind === 'lin');
    expect(moveTime(ms[ms.length - 2], O54)).toBeCloseTo(3, 1);
    expect(moveTime(ms[ms.length - 1], O54)).toBeGreaterThan(90 / 150);
  });
});

describe('CNC – voxelový úber', () => {
  it('zápich stopkovej frézy Ø10 do hĺbky 5 mm odoberie ≈ π · 5² · 5', () => {
    const st = createStock({ min: [-20, -20, 0], max: [20, 20, 20], res: 0.4 });
    const t = defaultTools().find((x) => x.t === 3);
    for (let z = 25; z >= 15; z -= 0.1) st.cut([0, 0, z], [0, 0, 1], t);
    expect(st.removed()).toBeGreaterThan(Math.PI * 25 * 5 * 0.85);
    expect(st.removed()).toBeLessThan(Math.PI * 25 * 5 * 1.2);
    const parts = st.takeDirty();
    expect(parts.some((p) => p.idx.length > 0)).toBe(true);
  });
  it('rýchloposuv do materiálu a stojace vreteno sú kolízie', () => {
    expect(run('T3 M6\nS9000 M3\nG43 H3 G0 X0 Y0 Z5\nG0 Z-5').ex.S.alarm.text).toMatch(/rýchloposuv/);
    expect(run('T3 M6\nG43 H3 G0 X0 Y0 Z5\nG1 Z-5 F300').ex.S.alarm.text).toMatch(/stojacim vretenom/);
  });
  it('ukážkové programy prebehnú bez chýb a alarmov a odoberú materiál', () => {
    SAMPLES().forEach((s) => {
      const { prog, ex } = run(s.text, 1.2);
      expect(prog.errors).toEqual([]);
      expect([s.id, ex.S.alarm && ex.S.alarm.text, ex.S.alarm && prog.lines[ex.S.alarm.line]]).toEqual([
        s.id,
        null,
        null,
      ]);
      expect(ex.S.done).toBe(true);
      expect(ex.S.removed).toBeGreaterThan(5000);
    });
  }, 60000);
  it('C 42 U: rovnaké programy bežia s väčšími dráhami, X 450 je mimo C 32 ale v rozsahu C 42', () => {
    SAMPLES().forEach((s) => {
      const { prog, ex } = run(s.text, 1.5, MODELS.c42);
      expect(prog.errors).toEqual([]);
      expect(ex.S.alarm).toBe(null);
      expect(ex.S.done).toBe(true);
    });
    const t = 'T3 M6\nG43 H3 G0 X390 Y0 Z50';
    expect(interpret(t, { o54: O54, tools: defaultTools(), mach: MODELS.c32 }).errors.length).toBeGreaterThan(0);
    expect(interpret(t, { o54: O54, tools: defaultTools(), mach: MODELS.c42 }).errors).toEqual([]);
  }, 60000);
});
