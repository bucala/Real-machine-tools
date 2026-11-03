import { describe, expect, it } from 'vitest';
import { cutStrip, gapIdeal, shearChecks } from '../src/machines/shearMath';

describe('tabuľové nožnice', () => {
  it('pás má šírku podľa zadného dorazu, plech sa skráti; hrubý plech je nad kapacitu', () => {
    const sh = { L: 1000, D: 500 };
    const r = cutStrip(sh, 100, { t: 2, gap: gapIdeal(2) });
    expect(r.strip.w).toBe(100); expect(sh.D).toBe(400); expect(r.strip.burr).toBe(false);
    expect(cutStrip(sh, 100, { t: 4, gap: 0.28 }).error).toBe('capacity');
  });
  it('úloha 3 pásy 100 mm: s uholníkom a správnou vôľou splnená, bez uholníka a so zlou vôľou nie', () => {
    const sh = { L: 1000, D: 500 }, strips = [];
    for (let k = 0; k < 3; k++) strips.push(cutStrip(sh, 100, { t: 2, gap: 0.14 }).strip);
    expect(shearChecks.pasy({ strips }).every((c) => c.ok)).toBe(true);
    const sh2 = { L: 1000, D: 500 }, s2 = [];
    for (let k = 0; k < 3; k++) s2.push(cutStrip(sh2, 100, { t: 2, gap: 0.4, square: k > 0 }).strip);
    const ch = shearChecks.pasy({ strips: s2 });
    expect(ch.find((c) => c.key === 'square').ok).toBe(false); expect(ch.find((c) => c.key === 'burr').ok).toBe(false);
  });
});
