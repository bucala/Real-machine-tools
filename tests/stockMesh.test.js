import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createStock } from '../src/machines/cnc/voxel';
import { createStockMesh } from '../src/machines/cnc/stockMesh';
import { defaultTools } from '../src/machines/cnc/tooling';

describe('sieť obrobku zlúčená po blokoch', () => {
  it('rovnaké trojuholníky ako po blokoch, ale osemkrát menej sietí; zmena bloku prestaví len jeho skupinu', () => {
    const stock = createStock({ min: [-50, -40, 0], max: [50, 40, 40], res: 0.7 }),
      group = new THREE.Group();
    const parts = stock.takeDirty(),
      tris = parts.reduce((a, p) => a + p.idx.length / 3, 0),
      withTris = parts.filter((p) => p.idx.length).length;
    const sm = createStockMesh({
      group,
      material: new THREE.MeshStandardMaterial(),
      stock,
      color: () => [
        [1, 0, 0],
        [0, 1, 0],
      ],
    });
    sm.apply(parts);
    const merged = sm.meshes().reduce((a, m) => a + m.geometry.index.count / 3, 0);
    expect(merged).toBe(tris);
    expect(sm.meshes().length).toBeLessThanOrEqual(Math.ceil(withTris / 4));
    for (const m of sm.meshes())
      expect(Math.max(...m.geometry.index.array)).toBeLessThan(m.geometry.attributes.position.count);
    const before = new Map(sm.meshes().map((m) => [m, m.geometry]));
    const t = defaultTools().find((x) => x.t === 3);
    for (let x = -5; x <= 5; x += 0.5) stock.cut([x, 0, 37], [0, 0, 1], t);
    sm.apply(stock.takeDirty());
    const changed = sm.meshes().filter((m) => before.get(m) !== m.geometry).length;
    expect(changed).toBeGreaterThan(0);
    expect(changed).toBeLessThan(sm.meshes().length / 2);
    expect(sm.meshes()[0].geometry.attributes.color).toBeTruthy();
  });
});
