import { describe, expect, it } from 'vitest';
import { WHEEL, createShaft, cylChecks, grindPass, shaftInfo } from '../src/machines/cylMath';

// pozdĺžne brúsenie: kotúč šírky B prechádza tam a späť medzi xa a xb, prísuv na obrate o step (na priemere)
const traverse = (s, xa, xb, dTarget, step, vMin = 1, spark = 3) => {
  let dLim = s.d0, dir = 1, x = xa, sparks = 0;
  const t = WHEEL.B / (vMin * 1000 / 60) / 20;                 // čas styku jedného z 20 krokov na šírku kotúča
  for (let k = 0; k < 20000; k++) {
    grindPass(s, x - WHEEL.B / 2, x + WHEEL.B / 2, dLim, t);
    x += dir * WHEEL.B / 20;
    if (x > xb || x < xa) { dir = -dir; x = Math.max(xa, Math.min(xb, x)); if (dLim > dTarget + 1e-9) dLim = Math.max(dTarget, dLim - step); else if (++sparks > spark * 2) break; }
  }
};

describe('brúsenie na guľato', () => {
  it('odtláčanie: jeden prechod neodstráni celý záber, vyiskrovanie dorovná rozmer', () => {
    const s = createShaft(40.3, 200);
    grindPass(s, 50, 90, 40.25, 2.4);
    const d1 = s.d[Math.floor(70 / s.dx)]; expect(d1).toBeGreaterThan(40.25); expect(d1).toBeLessThan(40.3);
    for (let k = 0; k < 12; k++) grindPass(s, 50, 90, 40.25, 2.4);
    expect(s.d[Math.floor(70 / s.dx)]).toBeCloseTo(40.25, 3);
  });
  it('veľký záber prepáli povrch', () => {
    const s = createShaft(40.3, 200);
    grindPass(s, 50, 90, 40.1, 1); expect(shaftInfo(s).burn).toBeGreaterThan(0);
  });
  it('Ø40 h6: prísuv 0,01 mm na obrat s vyiskrovaním splní úlohu, bez vyiskrovania nie', () => {
    const s = createShaft(40.3, 200);
    traverse(s, 10, 190, 39.992, 0.01);
    expect(cylChecks.h6({ shaft: s }).every((c) => c.ok)).toBe(true);
    const s2 = createShaft(40.3, 200);
    traverse(s2, 10, 190, 39.992, 0.01, 1, 0);
    expect(shaftInfo(s2).dMax).toBeGreaterThan(39.992);
    const s3 = createShaft(40.3, 200);
    traverse(s3, 10, 190, 39.992, 0.1);
    expect(cylChecks.h6({ shaft: s3 }).find((c) => c.key === 'burn').ok).toBe(false);
    expect(cylChecks.h6({}).some((c) => c.ok)).toBe(false);
  });
});
