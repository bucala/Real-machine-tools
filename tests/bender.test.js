import { describe, expect, it } from 'vitest';
import {
  BEND_A,
  PROFILES,
  bendChecks,
  bendInfo,
  createBar,
  deltaFor,
  kFinal,
  kLoaded,
  kLoadedFor,
  kYield,
  passBar,
  rollForce,
} from '../src/machines/benderMath';

const P = PROFILES.ploNap;
describe('pružno-plastický ohyb', () => {
  it('pod medzou klzu sa profil vráti rovný, nad ňou zostane trvalý ohyb menší ako v zábere', () => {
    const ky = kYield(P);
    expect(ky).toBeCloseTo(235e6 / (210e9 * 0.005), 6);
    expect(kFinal(ky * 0.9, P)).toBe(0);
    const kL = 2.5;
    expect(kFinal(kL, P)).toBeGreaterThan(0);
    expect(kFinal(kL, P)).toBeLessThan(kL);
    // pri veľkom ohybe je odpruženie ≈ k · κy
    expect(kL - kFinal(kL, P)).toBeCloseTo(P.k * ky, 1);
  });
  it('tenký profil (naplocho) odpruží viac ako vysoký (nastojato) – krajné vlákno je bližšie k osi', () => {
    const kf = 1 / 0.8;
    expect(kLoadedFor(kf, P) - kf).toBeGreaterThan(2 * (kLoadedFor(kf, PROFILES.ploNas) - kf));
    expect(kFinal(kLoadedFor(kf, PROFILES.ploNas), PROFILES.ploNas)).toBeCloseTo(kf, 6);
  });
  it('geometria troch valcov: δ ↔ krivosť a sila stúpa s tuhosťou profilu', () => {
    const k = 1 / 0.4;
    expect(kLoaded(deltaFor(k))).toBeCloseTo(k, 9);
    expect(deltaFor(k)).toBeCloseTo(0.4 - Math.sqrt(0.16 - BEND_A ** 2), 9);
    expect(rollForce(3, PROFILES.ploNas)).toBeGreaterThan(rollForce(3, P) * 3);
  });
});

describe('prechod profilu valcami', () => {
  const roll = (bar, p, d, from = 0, step = 0.005) => {
    for (let s = from; s < bar.L; s += step) passBar(bar, p, s, s + step, kLoaded(d));
  };
  it('oblúk R 500 so správnym prísuvom splní úlohu, konce dĺžky a zostanú rovné', () => {
    const bar = createBar(1.5),
      d = deltaFor(kLoadedFor(2, P));
    roll(bar, P, d);
    const b = bendInfo(bar);
    expect(b.R).toBeCloseTo(500, 0);
    expect(b.spread).toBeLessThan(1);
    expect(b.ends[0]).toBeCloseTo(200, -1);
    expect(b.ends[1]).toBeCloseTo(200, -1);
    expect(bendChecks.oblukNap({ bar }).every((c) => c.ok)).toBe(true);
  });
  it('bez započítania odpruženia vyjde väčší polomer; druhý prechod s menším prísuvom už nič nezmení, s väčším áno', () => {
    const bar = createBar(1.5);
    roll(bar, P, deltaFor(2));
    const r1 = bendInfo(bar).R;
    expect(r1).toBeGreaterThan(560);
    expect(bendChecks.oblukNap({ bar }).find((c) => c.key === 'radius').ok).toBe(false);
    roll(bar, P, deltaFor(2) * 0.8);
    expect(bendInfo(bar).R).toBeCloseTo(r1, 3);
    roll(bar, P, deltaFor(kLoadedFor(2, P)));
    expect(bendInfo(bar).R).toBeCloseTo(500, 0);
  });
  it('prstenec z rúry: uhol nad 345°; bez vodiacich kladiek pri profile nastojato je chyba', () => {
    const p = PROFILES.rura,
      bar = createBar(2.3);
    roll(bar, p, deltaFor(kLoadedFor(1 / 0.3, p)));
    const b = bendInfo(bar);
    expect(b.R).toBeCloseTo(300, 0);
    expect(b.angle).toBeGreaterThan(345);
    expect(bendChecks.prstenec({ bar }).every((c) => c.ok)).toBe(true);
    const q = PROFILES.ploNas,
      bar2 = createBar(1.6);
    for (let s = 0; s < bar2.L; s += 0.005)
      passBar(bar2, q, s, s + 0.005, kLoaded(deltaFor(kLoadedFor(1 / 0.8, q))), BEND_A, 'tw');
    const c2 = bendChecks.oblukNas({ bar: bar2 });
    expect(c2.find((c) => c.key === 'radius').ok).toBe(true);
    expect(c2.find((c) => c.key === 'defect').ok).toBe(false);
    expect(bendChecks.oblukNap({}).some((c) => c.ok)).toBe(false);
  });
});
