import { describe, expect, it } from 'vitest';
import { WALL, boreStep, createHole, faceOf, holeInfo, horizChecks } from '../src/machines/horizMath';

const pass = (h, a, y, rb, ext = 300) => {
  for (let z = 0; z < WALL; z += 0.5) {
    const r = boreStep(h, a, y, rb, z, z + 0.5, ext);
    if (r.crash) return r.crash;
  }
  return null;
};
const boreTo = (h, a, y, d, ext = 300) => {
  for (const dd of [66, 72, 77, 79.4, 79.9, d]) if (pass(h, a, y, dd / 2, ext)) return false;
  return true;
};

describe('vyvrtávanie na horizontálke', () => {
  it('stena podľa natočenia stola, len zaaretované polohy', () => {
    expect(faceOf(0)).toBe(0);
    expect(faceOf(180)).toBe(2);
    expect(faceOf(-90)).toBe(3);
    expect(faceOf(45)).toBe(-1);
  });
  it('bez otvoru tyč narazí, priveľký záber sa rozchveje, do malého otvoru sa tyč nezmestí', () => {
    expect(boreStep(null, 0, 150, 40, 0, 1, 300).crash).toBe('solid');
    expect(boreStep(createHole(0, 0, 150, 30), 0, 150, 40, 0, 1, 300).crash).toBe('chatter');
    expect(boreStep(createHole(0, 0, 150, 30), 6, 150, 34, 0, 1, 300).crash).toBe('bar');
  });
  it('Ø80 H7 postupnými prechodmi s malým posledným záberom; veľký posledný záber vyjde menší', () => {
    const h = createHole(0, 0.8, 149.5, 30);
    expect(boreTo(h, 0, 150, 80.015)).toBe(true);
    const q = holeInfo(h);
    expect(q.dMin).toBeGreaterThanOrEqual(80);
    expect(q.dMax).toBeLessThanOrEqual(80.03);
    expect(q.a).toBe(0);
    expect(q.y).toBe(150);
    expect(horizChecks.otvor({ holes: [h] }).every((c) => c.ok)).toBe(true);
    const h2 = createHole(0, 0, 150, 30);
    for (const dd of [66, 72, 77, 80.015]) pass(h2, 0, 150, dd / 2);
    expect(holeInfo(h2).dMin).toBeLessThan(80);
  });
  it('súosé otvory: po otočení o 180° treba stôl prestaviť zrkadlovo', () => {
    const h0 = createHole(0, 0, 150, 30),
      h2 = createHole(2, 0, 150, 30);
    boreTo(h0, 4, 150, 80.015);
    boreTo(h2, -4, 150, 80.015);
    expect(horizChecks.suose({ holes: [h0, h2] }).every((c) => c.ok)).toBe(true);
    const h3 = createHole(2, 0, 150, 30);
    boreTo(h3, 4, 150, 80.015);
    expect(horizChecks.suose({ holes: [h0, h3] }).find((c) => c.key === 'coax').ok).toBe(false);
    expect(horizChecks.suose({}).some((c) => c.ok)).toBe(false);
  });
});
