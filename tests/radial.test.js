import { describe, expect, it } from 'vitest';
import { RD, radialChecks, reachXZ, spindleXZ } from '../src/machines/radialMath';

describe('poloha vretena radiálnej vŕtačky', () => {
  it('pri α = 0 je vreteno vo vyložení R pred stĺpom, vyosené o SZO', () => {
    const p = spindleXZ(0, 8);
    expect(p.x).toBeCloseTo(RD.CX + 8, 9); expect(p.z).toBeCloseTo(RD.CZ + RD.SZO, 9);
  });
  it('spätný výpočet natočenia a vyloženia dá ten istý bod', () => {
    for (const [x, z] of [[5, 0], [3.5, -1.5], [6.5, 1.5], [2, 2.5]]) {
      const { a, R } = reachXZ(x, z), p = spindleXZ(a, R);
      expect(p.x).toBeCloseTo(x, 9); expect(p.z).toBeCloseTo(z, 9);
    }
  });
});

describe('úlohy radiálnej vŕtačky', () => {
  const rect = [[-150, -100], [150, -100], [150, 100], [-150, 100]].map(([x, y]) => ({ x, y, d: 16, through: true }));
  it('rozteč 300 × 200: presne splnené, posunutá diera nesplní', () => {
    expect(radialChecks.roztec({ holes: rect }).every((c) => c.ok)).toBe(true);
    const bad = rect.map((h, i) => (i === 2 ? { ...h, x: 151 } : h));
    expect(radialChecks.roztec({ holes: bad }).find((c) => c.key === 'pos').ok).toBe(false);
    expect(radialChecks.roztec({ holes: rect.slice(0, 3) }).every((c) => c.ok)).toBe(false);
  });
  it('príruba: 6 dier na kružnici Ø300 po 60°', () => {
    const fl = Array.from({ length: 6 }, (_, k) => ({ x: 150 * Math.cos(k * Math.PI / 3 + 0.2), y: 150 * Math.sin(k * Math.PI / 3 + 0.2), d: 20, through: true }));
    expect(radialChecks.priruba({ holes: fl }).every((c) => c.ok)).toBe(true);
    const off = fl.map((h, i) => (i === 1 ? { ...h, x: h.x * 1.01, y: h.y * 1.01 } : h));
    expect(radialChecks.priruba({ holes: off }).find((c) => c.key === 'circle').ok).toBe(false);
    expect(radialChecks.priruba({}).some((c) => c.ok)).toBe(false);
  });
});
