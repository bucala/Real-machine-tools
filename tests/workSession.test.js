import { describe, expect, it } from 'vitest';
import { createStock } from '../src/machines/cnc/voxel.js';
import { stockSnapshot } from '../src/core/workSession.js';

describe('rozpracovaná práca', () => {
  it('obrobok sa obnoví zo snímky v rovnakom stave', () => {
    const cfg = { min: [-10, -10, 0], max: [10, 10, 10], res: 1 },
      a = createStock(cfg);
    a.cutBox?.([-5, -5, 5], [5, 5, 11]);
    if (!a.removed()) a.cut([0, 0, 6], [0, 0, 1], { kind: 'flat', d: 8, lc: 30 });
    expect(a.removed()).toBeGreaterThan(0);
    const snap = stockSnapshot(a, 'x'),
      b = createStock(cfg);
    b.takeDirty();
    expect(b.restore(snap.field, snap.removed)).toBe(true);
    expect(b.removed()).toBeCloseTo(a.removed());
    expect(b.field).toEqual(a.field);
    expect(b.takeDirty().length).toBeGreaterThan(0);
    // iné rozmery sa neobnovia
    expect(createStock({ ...cfg, res: 2 }).restore(snap.field, snap.removed)).toBe(false);
  });
});
