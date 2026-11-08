import { describe, expect, it } from 'vitest';
import { latheChecks, profileInfo, threadDepth, threadRadius } from '../src/machines/latheMath';

// rovnaké konštanty ako v sústruhu: obrobok začína v skľučovadle (x0), čelo čeľustí je nula osi Z
const W_N = 340,
  x0 = -4.2,
  jaw = -3.45;
const blank = (D, len) => {
  const x1 = jaw + len / 100,
    dx = (x1 - x0) / W_N;
  const prof = new Float32Array(W_N).fill(D / 200),
    thr = new Float32Array(W_N),
    pit = new Float32Array(W_N);
  const zc = (i) => (x0 + (i + 0.5) * dx - jaw) * 100; // stred úseku v mm od čeľustí
  return { prof, thr, pit, dx, zc, info: () => profileInfo(prof, thr, pit, { x0, dx, jaw }) };
};
const allOk = (cs) => cs.every((c) => c.ok);

describe('závit', () => {
  it('hĺbka metrického závitu h3 = 0,6134 · P', () => {
    expect(threadDepth(1.5)).toBeCloseTo(0.92, 2);
  });
  it('drážka tvaru V: vrchol na vonkajšom polomere, dno o hĺbku nižšie, perióda = stúpanie', () => {
    const R = 15,
      D = 0.9,
      p = 1.5;
    expect(threadRadius(R, D, p, 0, 0)).toBeCloseTo(R, 6); // vrchol
    expect(threadRadius(R, D, p, p / 2, 0)).toBeCloseTo(R - D, 6); // dno drážky
    for (const x of [0.1, 0.37, 0.9])
      expect(threadRadius(R, D, p, x + p, 0)).toBeCloseTo(threadRadius(R, D, p, x, 0), 6);
    // skrutkovica: otočenie o 360° posunie drážku presne o jedno stúpanie
    expect(threadRadius(R, D, p, 0.4, Math.PI * 2)).toBeCloseTo(threadRadius(R, D, p, 0.4 + p, 0), 6);
    // boky pod 30°: 0,1 mm od stredu drážky je o 0,1 / tan 30° plytšia
    expect(threadRadius(R, D, p, p / 2 + 0.1, 0)).toBeCloseTo(R - D + 0.1 / Math.tan(Math.PI / 6), 6);
  });
});

describe('rozbor profilu', () => {
  it('nedotknutý polotovar: jedno osadenie po celej dĺžke', () => {
    const b = blank(60, 150),
      info = b.info();
    expect(info.end).toBeCloseTo(150, 1);
    expect(info.steps).toHaveLength(1);
    expect(info.steps[0].d).toBeCloseTo(60, 3);
    expect(info.dAt(75)).toBeCloseTo(60, 3);
    expect(info.thread).toBeNull();
  });
});

describe('úlohy sústruhu', () => {
  it('čelo na 100 mm', () => {
    const b = blank(50, 110);
    expect(allOk(latheChecks.celo({ info: b.info(), D0: 50 }))).toBe(false);
    for (let i = 0; i < W_N; i++) if (b.zc(i) > 100) b.prof[i] = 0;
    expect(allOk(latheChecks.celo({ info: b.info(), D0: 50 }))).toBe(true);
  });
  it('osadenie Ø40 × 50: splnené aj chybný priemer', () => {
    const b = blank(60, 150);
    for (let i = 0; i < W_N; i++) if (b.zc(i) > 100) b.prof[i] = 0.2;
    expect(latheChecks.osadenie({ info: b.info(), D0: 60 }).map((c) => c.ok)).toEqual([true, true, true]);
    for (let i = 0; i < W_N; i++) if (b.zc(i) > 100) b.prof[i] = 0.205; // Ø41
    expect(latheChecks.osadenie({ info: b.info(), D0: 60 })[0].ok).toBe(false);
  });
  it('osadenie: iný polotovar ako predpísaný Ø60 nevyhovuje', () => {
    const b = blank(90, 150);
    for (let i = 0; i < W_N; i++) if (b.zc(i) > 100) b.prof[i] = 0.2;
    expect(latheChecks.osadenie({ info: b.info(), D0: 90 })[2].ok).toBe(false);
  });
  it('zápich 6 mm na Ø40, 30 mm od konca', () => {
    const b = blank(50, 120);
    for (let i = 0; i < W_N; i++) {
      const z = b.zc(i);
      if (z > 84 && z < 90) b.prof[i] = 0.2;
    }
    const cs = latheChecks.zapich({ info: b.info(), D0: 50 });
    expect(cs.map((c) => c.ok)).toEqual([true, true, true]);
  });
  it('závit M30 × 1,5: hĺbka, dĺžka, stúpanie; zmiešané stúpanie sa odhalí', () => {
    const b = blank(30, 150);
    for (let i = 0; i < W_N; i++)
      if (b.zc(i) > 110) {
        b.thr[i] = 0.0092;
        b.pit[i] = 0.015;
      }
    expect(allOk(latheChecks.zavit({ info: b.info(), D0: 30 }))).toBe(true);
    b.pit[W_N - 5] = 0.0125;
    expect(latheChecks.zavit({ info: b.info(), D0: 30 })[0].ok).toBe(false);
  });
  it('príliš hlboký závit zreže vrcholy – vonkajší priemer nesedí', () => {
    const b = blank(30, 150);
    for (let i = 0; i < W_N; i++)
      if (b.zc(i) > 110) {
        b.thr[i] = 0.016;
        b.pit[i] = 0.015;
      }
    const cs = latheChecks.zavit({ info: b.info(), D0: 30 });
    expect(cs[1].ok).toBe(false);
    expect(cs[3].ok).toBe(false);
  });
});
