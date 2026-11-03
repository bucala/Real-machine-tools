import { describe, expect, it } from 'vitest';
import { SPEEDS, LATHE_FEEDS, LATHE_TOOLS } from '../src/machines/lathe';
import { MILL_SPEEDS, MILL_FEEDS, MILL_TOOLS } from '../src/machines/mill';
import { DRILL_SPEEDS } from '../src/machines/drill';

// stupne prevodovky tvoria geometrický rad – podiel susedných stupňov je približne stály
const ratios = (a) => a.slice(1).map((v, i) => v / a[i]);

describe('prevodovky', () => {
  it.each([
    ['sústruh', SPEEDS, 12, 40, 1800],
    ['fréza', MILL_SPEEDS, 18, 40, 2000],
    ['vŕtačka', DRILL_SPEEDS, 8, 125, 1400],
  ])('%s: otáčky stúpajú v geometrickom rade', (_, s, n, lo, hi) => {
    expect(s).toHaveLength(n);
    expect(s[0]).toBe(lo); expect(s[n - 1]).toBe(hi);
    for (const r of ratios(s)) { expect(r).toBeGreaterThan(1.15); expect(r).toBeLessThan(1.5); }
  });
  it('sústruh: posuvy z prevodovky Norton (8 základných × násobič 1 / 2) bez duplicít', () => {
    expect(LATHE_FEEDS).toEqual([0.05, 0.07, 0.1, 0.14, 0.2, 0.25, 0.28, 0.35, 0.4, 0.5, 0.7, 1]);
  });
  it('fréza: 18 posuvov 19 – 950 mm/min vzostupne', () => {
    expect(MILL_FEEDS).toHaveLength(18);
    expect([...MILL_FEEDS].sort((a, b) => a - b)).toEqual(MILL_FEEDS);
  });
});

describe('nástroje', () => {
  it.each(Object.keys(LATHE_TOOLS))('sústružnícky nôž %s: hrot je v nule, mimo ostria nereže', (k) => {
    const prof = LATHE_TOOLS[k].prof;
    expect(prof(0)).toBeCloseTo(0, 6);
    expect(prof(5)).toBe(Infinity);
    expect(prof(-5)).toBe(Infinity);
    for (let d = -0.4; d <= 0.4; d += 0.01) { const v = prof(d); if (v !== Infinity) expect(v).toBeGreaterThanOrEqual(0); }
  });
  it('frézy: polomer je polovica priemeru v mierke 1 : 100 mm', () => {
    for (const t of Object.values(MILL_TOOLS)) expect(t.r).toBeCloseTo(t.d / 200, 9);
  });
});
