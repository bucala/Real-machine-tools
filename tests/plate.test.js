import { describe, expect, it } from 'vitest';
import { deltaFor, kLoadedFor } from '../src/machines/benderMath';
import { PLATE_A, bendInfo, createSheet, passPyramid, plateChecks, plateProfile } from '../src/machines/plateMath';

const roll = (sh, p, d, opt = {}, step = 0.004) => {
  for (let s = 0; s < sh.L; s += step) passPyramid(sh, p, s, s + step, d, opt);
};
describe('zakružovačka plechu – trojvalcová pyramída', () => {
  const p = plateProfile(6, 1500);
  const d = deltaFor(kLoadedFor(1 / 0.5, p), PLATE_A);
  it('bez podložného plechu zostanú oba konce rovné v dĺžke polovice rozostupu valcov', () => {
    const sh = createSheet(3.14);
    roll(sh, p, d);
    const b = bendInfo(sh);
    expect(b.R).toBeCloseTo(500, 0);
    expect(b.ends[0]).toBeCloseTo(PLATE_A * 1000, -1);
    expect(b.ends[1]).toBeCloseTo(PLATE_A * 1000, -1);
    expect(plateChecks.plast({ sheet: sh }).find((c) => c.key === 'ends').ok).toBe(false);
  });
  it('s podložným plechom sa konce predohnú – plášť Ø1000 je splnený', () => {
    const sh = createSheet(3.14);
    roll(sh, p, d, { backing: true });
    const b = bendInfo(sh);
    expect(b.angle).toBeGreaterThan(340);
    expect(Math.max(...b.ends)).toBeLessThan(50);
    expect(plateChecks.plast({ sheet: sh }).every((c) => c.ok)).toBe(true);
  });
  it('hrubší plech odpruží menej: rovnaký prísuv dá pri 10 mm menší polomer ako pri 6 mm', () => {
    const a6 = createSheet(2.0),
      a10 = createSheet(2.0);
    const dd = deltaFor(1 / 0.7, PLATE_A);
    roll(a6, plateProfile(6), dd);
    roll(a10, plateProfile(10), dd);
    expect(bendInfo(a10).R).toBeLessThan(bendInfo(a6).R);
    expect(plateChecks.oblukP({}).some((c) => c.ok)).toBe(false);
  });
});
