import { describe, expect, it } from 'vitest';
import { deltaFor, kLoadedFor } from '../src/machines/benderMath';
import { PLATE_A, bendInfo, createSheet, passPinch, plateChecks, plateProfile, reverseSheet } from '../src/machines/plateMath';

const roll = (sh, p, h, step = 0.004) => { for (let s = 0; s < sh.L; s += step) passPinch(sh, p, s, s + step, h); };
describe('zakružovačka plechu so zovretím', () => {
  const p = plateProfile(3);
  const h = deltaFor(kLoadedFor(1 / 0.25, p), PLATE_A);
  it('jeden prechod: začiatok zostane rovný v dĺžke po zadný valec, koniec sa ohne takmer celý', () => {
    const sh = createSheet(1.57); roll(sh, p, h);
    const b = bendInfo(sh);
    expect(b.R).toBeCloseTo(250, 0); expect(b.ends[0]).toBeCloseTo(PLATE_A * 1000, -1); expect(b.ends[1]).toBeLessThan(10);
    expect(plateChecks.plast({ sheet: sh }).find((c) => c.key === 'ends').ok).toBe(false);
  });
  it('po otočení plechu sa predohne aj začiatok – plášť Ø500 je splnený', () => {
    const sh = createSheet(1.57); roll(sh, p, h); reverseSheet(sh); roll(sh, p, h);
    const b = bendInfo(sh); expect(b.angle).toBeGreaterThan(345); expect(Math.max(...b.ends)).toBeLessThan(25);
    expect(plateChecks.plast({ sheet: sh }).every((c) => c.ok)).toBe(true);
  });
  it('hrubší plech odpruží menej: rovnaký zdvih dá pri 4 mm menší polomer ako pri 3 mm', () => {
    const a3 = createSheet(1.0), a4 = createSheet(1.0); const hh = deltaFor(1 / 0.3, PLATE_A);
    roll(a3, plateProfile(3), hh); roll(a4, plateProfile(4), hh);
    expect(bendInfo(a4).R).toBeLessThan(bendInfo(a3).R);
    expect(plateChecks.oblukP({}).some((c) => c.ok)).toBe(false);
  });
});
