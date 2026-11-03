import { describe, expect, it } from 'vitest';
import { createGear, fullDepth, gearInfo, hobAngle, hobChecks, hobCut, indexGears, wk } from '../src/machines/hobMath';

describe('odvalovacia frézka', () => {
  it('výmenné kolesá delenia i = 24 / z a stúpací uhol frézy', () => {
    const g = indexGears(30); expect(g.a / g.b * g.c / g.d).toBeCloseTo(24 / 30, 9);
    expect(indexGears(25)).not.toBeNull();
    expect(hobAngle(2)).toBeCloseTo(1.637, 2);
  });
  it('rozmer cez zuby: z 30, m 2, k 4 ≈ 21,50 mm; nedorezanie ho zväčší', () => {
    expect(wk(2, 30, 4)).toBeCloseTo(21.505, 2);
    expect(wk(2, 30, 4, 0.1)).toBeGreaterThan(wk(2, 30, 4));
  });
  it('koleso z 30: plná hĺbka po celej šírke so správnym sklonom splní úlohu', () => {
    const g = createGear(2, 30, 20);
    for (let y = 20; y >= -5; y -= 1) hobCut(g, y - 8, y + 8, 30, fullDepth(2), 0.1);
    expect(gearInfo(g).cover).toBe(1);
    expect(hobChecks.gear({ gear: g }).every((c) => c.ok)).toBe(true);
  });
  it('zlé delenie, zmena delenia počas rezu, plytký zub a zlý sklon úlohu nesplnia', () => {
    const a = createGear(2, 30, 20); for (let y = 20; y >= -5; y -= 1) hobCut(a, y - 8, y + 8, 32, 4.5);
    expect(hobChecks.gear({ gear: a }).find((c) => c.key === 'z').ok).toBe(false);
    const b = createGear(2, 30, 20); hobCut(b, 0, 10, 30, 4.5); hobCut(b, 5, 20, 25, 4.5);
    expect(gearInfo(b).mixed).toBeGreaterThan(0);
    const c = createGear(2, 30, 20); for (let y = 20; y >= -5; y -= 1) hobCut(c, y - 8, y + 8, 30, 4.3);
    expect(hobChecks.gear({ gear: c }).find((q) => q.key === 'wk').ok).toBe(false);
    const d = createGear(2, 30, 20); for (let y = 20; y >= -5; y -= 1) hobCut(d, y - 8, y + 8, 30, 4.5, 1.6);
    expect(hobChecks.gear({ gear: d }).find((q) => q.key === 'angle').ok).toBe(false);
  });
});
