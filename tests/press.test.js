import { describe, expect, it } from 'vitest';
import { PRESS, addHole, penetration, pressChecks, punchForce, strokeResult } from '../src/machines/pressMath';

describe('výstredníkový lis', () => {
  it('sila dierovania F = π · d · t · 0,8 Rm; Ø50 do 6 mm prejde, do 8 mm je nad 400 kN', () => {
    expect(punchForce(20, 4)).toBeCloseTo(Math.PI * 20 * 4 * 352 / 1000, 6);
    expect(punchForce(50, 6)).toBeLessThan(PRESS.Fmax);
    expect(strokeResult({ d: 50, t: 8, adj: 42, x: 100, L: 400 }).kind).toBe('overload');
  });
  it('prestavenie baranidla: vysoko = vzduch, trochu nižšie = len vtlačené, správne = naskrz, príliš nízko = náraz', () => {
    const z = (adj) => strokeResult({ d: 20, t: 4, adj, x: 50, L: 400 }).kind;
    expect(penetration(PRESS.adj0)).toBe(0);
    expect(z(30)).toBe('air'); expect(z(38)).toBe('dent'); expect(z(42)).toBe('through'); expect(z(50)).toBe('crash');
    expect(strokeResult({ d: 20, t: 4, adj: 42, x: -30, L: 400 }).kind).toBe('miss');
    expect(strokeResult({ d: 20, t: 4, adj: 42, x: 5, L: 400 }).edge).toBe(true);
  });
  it('úloha dierovanie: 5 dier v rozstupe 50 mm je splnená, opakovaný zdvih na tom istom mieste nepridá dieru', () => {
    const holes = [];
    for (let k = 1; k <= 5; k++) addHole(holes, { x: 50 * k, d: 20, t: 4, kind: 'through' });
    addHole(holes, { x: 250, d: 20, t: 4, kind: 'through' });
    expect(pressChecks.dierovanie({ holes, crashes: 0 }).every((c) => c.ok)).toBe(true);
    holes[2].x = 152;
    expect(pressChecks.dierovanie({ holes, crashes: 0 }).find((c) => c.key === 'pitch').ok).toBe(false);
  });
  it('úloha podložky: mostík menší ako hrúbka plechu nevyhovuje', () => {
    const good = [], bad = [];
    [40, 100, 160, 220].forEach((x) => addHole(good, { x, d: 50, t: 6, kind: 'through' }));
    [40, 93, 146, 199].forEach((x) => addHole(bad, { x, d: 50, t: 6, kind: 'through' }));
    expect(pressChecks.podlozky({ holes: good, overloads: 0 }).every((c) => c.ok)).toBe(true);
    expect(pressChecks.podlozky({ holes: bad, overloads: 0 }).find((c) => c.key === 'web').ok).toBe(false);
    expect(pressChecks.podlozky({ holes: good, overloads: 1 }).find((c) => c.key === 'load').ok).toBe(false);
  });
});
