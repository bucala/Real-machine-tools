import { describe, expect, it } from 'vitest';
import { hfInfo } from '../src/core/hfMath';
import { SHAPER_TOOLS, SH_K, crankR, cutSpeed, fwdShare, isForward, ramPos, shaperChecks, toolLift } from '../src/machines/shaperMath';

describe('kulisový mechanizmus', () => {
  it('polomer čapu dá presne nastavený zdvih', () => {
    for (const S of [0.5, 1.5, 3, 5]) {
      const r = crankR(S); let lo = Infinity, hi = -Infinity;
      for (let k = 0; k < 3600; k++) { const { x } = ramPos(k / 3600 * 2 * Math.PI, r); lo = Math.min(lo, x); hi = Math.max(hi, x); }
      expect(hi - lo).toBeCloseTo(S, 3);
      expect(r).toBeLessThan(SH_K.d);
    }
  });
  it('rýchly spätný chod: pracovný zdvih trvá dlhšie ako spätný', () => {
    const r = crankR(3);
    expect(fwdShare(r)).toBeGreaterThan(0.55);
    expect(fwdShare(r)).toBeLessThan(0.75);
    // počas pracovného zdvihu smykadlo ide dopredu (x rastie), počas spätného späť
    for (const phi of [-1.2, 0, 0.8]) { expect(isForward(phi, r)).toBe(true); expect(ramPos(phi + 0.01, r).x).toBeGreaterThan(ramPos(phi, r).x); }
    expect(isForward(Math.PI, r)).toBe(false); expect(ramPos(Math.PI + 0.01, r).x).toBeLessThan(ramPos(Math.PI, r).x);
  });
  it('rezná rýchlosť rastie so zdvihom aj počtom zdvihov', () => {
    const r = crankR(2);
    expect(cutSpeed(200, 28, r)).toBeGreaterThan(cutSpeed(200, 14, r));
    expect(cutSpeed(200, 28, r)).toBeCloseTo(200 * 28 / 1000 / fwdShare(r), 9);
  });
});

describe('nože', () => {
  it('profil: plôška bez zdvihu, boky podľa sklonu', () => {
    const t = SHAPER_TOOLS.ubr;
    expect(toolLift(t, 0)).toBe(0); expect(toolLift(t, 0.5)).toBe(0); expect(toolLift(t, 2.5)).toBeCloseTo(2, 9);
    expect(toolLift(SHAPER_TOOLS.drazk10, 4.9)).toBe(0); expect(toolLift(SHAPER_TOOLS.drazk10, 5.5)).toBeGreaterThan(10);
  });
});

// syntetický obrobok 160 × 80 × 50 mm (jednotky scény), bunka 2 × 0,5 mm
const block = (fn) => {
  const W = 1.6, D = 0.8, H = 0.5, NX = 80, NZ = 160, hgt = new Float32Array((NX + 1) * (NZ + 1)), mask = new Uint8Array(hgt.length);
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const k = j * (NX + 1) + i, d = fn(i * W / NX * 100, j * D / NZ * 100); hgt[k] = H - d / 100; if (d > 0) mask[k] = 1; }
  return { info: hfInfo({ hgt, mask, NX, NZ, W, D, H }) };
};
describe('úlohy obrážačky', () => {
  it('rovina o 2 mm', () => {
    expect(shaperChecks.rovina(block(() => 2)).every((c) => c.ok)).toBe(true);
    expect(shaperChecks.rovina(block((x, z) => (z < 40 ? 2 : 1.5))).every((c) => c.ok)).toBe(false);
  });
  it('drážka 10 × 5 v strede', () => {
    expect(shaperChecks.drazka(block((x, z) => (Math.abs(z - 40) <= 5 ? 5 : 0))).every((c) => c.ok)).toBe(true);
    expect(shaperChecks.drazka(block((x, z) => (Math.abs(z - 25) <= 5 ? 5 : 0))).find((c) => c.key === 'center').ok).toBe(false);
  });
  it('osadenie 30 × 10 na ktorejkoľvek hrane', () => {
    expect(shaperChecks.osadenie(block((x, z) => (z <= 30 ? 10 : 0))).every((c) => c.ok)).toBe(true);
    expect(shaperChecks.osadenie(block((x, z) => (z >= 50 ? 10 : 0))).every((c) => c.ok)).toBe(true);
    expect(shaperChecks.osadenie(block((x, z) => (z <= 30 ? 8 : 0))).every((c) => c.ok)).toBe(false);
  });
});
