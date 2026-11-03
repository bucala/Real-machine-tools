import { describe, expect, it } from 'vitest';
import { weldPrep, weldProfile, WELD_TYPES, WELD_DIAL, ELECTRODES } from '../src/machines/weld';

const BUTT = ['I', 'V', 'HV', 'Y', 'U', 'J'];
const thicknesses = (t) => [t[0], Math.round((t[0] + t[1]) / 2), t[1]];

describe('zvarová príprava', () => {
  for (const id of BUTT) {
    const wt = WELD_TYPES.find((w) => w.id === id);
    for (const t of thicknesses(wt.t)) {
      it(`${id} ${t} mm: medzera je prázdna, ďaleko od spoja plná hrúbka`, () => {
        const p = weldPrep(id, t), prof = weldProfile(id, t, p);
        expect(p.gap).toBeGreaterThan(0);
        expect(prof(0)).toBe(0);                       // v medzere nie je materiál
        expect(prof(-50)).toBe(t); expect(prof(50)).toBe(t);
        expect(prof(p.gap / 2 + 0.01)).toBeLessThanOrEqual(t);
        if (id !== 'I') expect(prof(p.gap / 2 + 0.001)).toBeCloseTo(Math.min(t, p.root), 1);   // otupenie na hrane medzery
      });
    }
  }
  it('profil V-zvaru neklesá smerom od osi', () => {
    const p = weldPrep('V', 12), prof = weldProfile('V', 12, p);
    let prev = 0;
    for (let z = 0; z <= 30; z += 0.25) { const h = prof(z); expect(h).toBeGreaterThanOrEqual(prev - 1e-9); prev = h; }
  });
  it('½ V a J sú jednostranné – druhý diel má rovnú hranu', () => {
    for (const id of ['HV', 'J']) { const p = weldPrep(id, 16), prof = weldProfile(id, 16, p); expect(prof(-p.gap)).toBe(16); expect(prof(p.gap)).toBeLessThan(16); }
  });
});

describe('zváracie prúdy', () => {
  it('pre každú elektródu je na stupnici aspoň jeden vhodný prúd', () => {
    for (const [k, e] of Object.entries(ELECTRODES)) for (const [d, [lo, hi]] of Object.entries(e.r)) {
      expect(WELD_DIAL.some((a) => a >= lo && a <= hi), `${k} Ø${d}`).toBe(true);
    }
  });
});
