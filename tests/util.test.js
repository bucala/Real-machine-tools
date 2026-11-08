import { describe, expect, it } from 'vitest';
import { approach, clamp, fanAngles, logNear } from '../src/core/util';

describe('pomocné funkcie', () => {
  it('clamp drží hodnotu v rozsahu', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
  it('approach sa blíži k cieľu najviac o krok a neprestrelí', () => {
    expect(approach(0, 10, 3)).toBe(3);
    expect(approach(9, 10, 3)).toBe(10);
    expect(approach(10, 0, 4)).toBe(6);
  });
  it('logNear nájde najbližší stupeň v logaritmickej mierke', () => {
    const s = [40, 56, 80, 112];
    expect(logNear(s, 40)).toBe(0);
    expect(logNear(s, 65)).toBe(1); // 65 je logaritmicky bližšie k 56 ako k 80
    expect(logNear(s, 1000)).toBe(3);
  });
  it('fanAngles rozloží polohy páky súmerne', () => {
    expect(fanAngles(1, 1)).toEqual([0]);
    const a = fanAngles(3, 0.6);
    expect(a[0]).toBeCloseTo(0.6);
    expect(a[1]).toBeCloseTo(0);
    expect(a[2]).toBeCloseTo(-0.6);
  });
});
