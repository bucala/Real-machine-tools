import { describe, expect, it } from 'vitest';
import { DIVISIONS, HOLE_CIRCLES, barCut, createBar, indexChecks, indexPlan, polyInfo } from '../src/machines/millIndex';

describe('plán delenia n = 40 / z', () => {
  it('celé otáčky a diery na kruhu deliaceho kotúča', () => {
    expect(indexPlan(4)).toMatchObject({ turns: 10, holes: 0 });
    expect(indexPlan(8)).toMatchObject({ turns: 5, holes: 0 });
    const p6 = indexPlan(6);
    expect(p6.turns).toBe(6); expect(p6.holes / p6.circle).toBeCloseTo(2 / 3, 9); expect(HOLE_CIRCLES).toContain(p6.circle);
    const p3 = indexPlan(3);
    expect(p3.turns + p3.holes / p3.circle).toBeCloseTo(40 / 3, 9);
  });
  it('všetky ponúkané delenia sú presné', () => {
    for (const z of DIVISIONS) { const p = indexPlan(z); expect(p.exact).toBe(true); expect(p.turns + (p.circle ? p.holes / p.circle : 0)).toBeCloseTo(40 / z, 9); }
  });
});

// tyč Ø45 × 120 mm, frézovanie zhora čelnou frézou Ø100 (pokryje celú šírku tyče)
const mill = (b, z, s, phi0 = 0, len = 0.5) => {
  for (let q = 0; q < z; q++) for (let x = b.L / 2 - len; x <= b.L / 2 + 0.01; x += 0.02) barCut(b, phi0 + q * 2 * Math.PI / z, 0.5, s / 200, x, 0, true);
};
describe('rez frézou zhora a mnohohran', () => {
  it('rovina zhora: polomer v smere hore klesne na výšku čela, spodok tyče zostane', () => {
    const b = createBar({ L: 1.2, R: 0.225, NX: 120, NT: 180 });
    const { pen } = barCut(b, 0, 0.5, 0.18, 0.4, 0, true);
    expect(pen).toBeCloseTo(0.045, 4);
    const i = Math.round((0.4 + 0.6) / b.dX);
    expect(b.r[i * 180]).toBeCloseTo(0.18, 6); expect(b.r[i * 180 + 90]).toBeCloseTo(0.225, 6);   // dole bez zmeny
  });
  it('šesťhran 36 mm na konci tyče: úloha splnená, nedorobený neprejde', () => {
    const b = createBar({ L: 1.2, R: 0.225, NX: 120, NT: 360 });
    mill(b, 6, 36);
    const p = polyInfo(b, 6);
    expect(p.faces).toHaveLength(6);
    p.s.forEach((v) => expect(v).toBeCloseTo(36, 1));
    expect(p.len).toBeGreaterThanOrEqual(48);
    expect(indexChecks.sesthran({ bar: b }).every((c) => c.ok)).toBe(true);
    const b2 = createBar({ L: 1.2, R: 0.225, NX: 120, NT: 360 });
    for (let q = 0; q < 5; q++) for (let x = 0.1; x <= 0.61; x += 0.02) barCut(b2, q * Math.PI / 3, 0.5, 0.18, x, 0, true);   // jedna stena chýba
    expect(indexChecks.sesthran({ bar: b2 }).every((c) => c.ok)).toBe(false);
  });
  it('štvorhran 30 mm', () => {
    const b = createBar({ L: 1.2, R: 0.225, NX: 120, NT: 360 });
    mill(b, 4, 30, 0.3);
    expect(indexChecks.stvorhran({ bar: b }).every((c) => c.ok)).toBe(true);
  });
  it('bez obrábania nič nesplní', () => {
    expect(indexChecks.sesthran({ bar: createBar({ L: 1.2, R: 0.225, NX: 60, NT: 90 }) }).some((c) => c.ok)).toBe(false);
    expect(indexChecks.sesthran({}).some((c) => c.ok)).toBe(false);
  });
});
