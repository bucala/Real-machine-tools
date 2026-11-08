import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { HIDDEN_LAYER, limitShadowCasters, mergeStaticMeshes, simplifyCylinders } from '../src/core/sceneOptimize';

const scene = () => {
  const root = new THREE.Group(),
    door = new THREE.Group();
  root.add(door);
  const steel = new THREE.MeshStandardMaterial(),
    red = new THREE.MeshStandardMaterial();
  const box = (parent, mat, x, sx = 1) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    m.position.x = x;
    m.scale.x = sx;
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const a = box(root, steel, 0),
    b = box(root, steel, 2),
    c = box(root, steel, 4, -1),
    d = box(root, red, 6);
  const e = box(door, steel, 0),
    f = box(door, steel, 1);
  return { root, door, a, b, c, d, e, f };
};
const triCount = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;

describe('zlučovanie statických sietí', () => {
  it('zlúči súrodencov s rovnakým materiálom v rámci rodiča a pôvodné siete skryje', () => {
    const s = scene(),
      opt = mergeStaticMeshes(s.root);
    expect(opt.stats()).toEqual({ groups: 2, merged: 5, undone: 0 });
    const merged = s.root.children.find((o) => o.userData.mergedStatic);
    expect(triCount(merged.geometry)).toBe(36);
    expect(s.a.layers.isEnabled(HIDDEN_LAYER)).toBe(true);
    expect(s.d.layers.isEnabled(0)).toBe(true); // iný materiál – ostáva samostatne
    expect(s.door.children.some((o) => o.userData.mergedStatic)).toBe(true);
    expect(merged.userData.excludeFromMachineExport).toBe(true); // export používa pomenované pôvodné diely
  });
  it('zrkadlený diel (záporná mierka) zachová smer normál navonok', () => {
    const s = scene();
    mergeStaticMeshes(s.root);
    const merged = s.root.children.find((o) => o.userData.mergedStatic),
      g = merged.geometry;
    const p = g.attributes.position,
      ix = g.index.array,
      v = (i) => new THREE.Vector3().fromBufferAttribute(p, i);
    // trojuholníky zrkadlenej kocky (x okolo 4) musia mať normálu smerujúcu od stredu kocky
    let checked = 0;
    for (let t = 0; t < ix.length; t += 3) {
      const A = v(ix[t]),
        B = v(ix[t + 1]),
        C = v(ix[t + 2]),
        ctr = A.clone().add(B).add(C).divideScalar(3);
      if (Math.abs(ctr.x - 4) > 0.6) continue;
      const n = B.clone().sub(A).cross(C.clone().sub(A));
      expect(n.dot(ctr.clone().sub(new THREE.Vector3(4, 0, 0)))).toBeGreaterThan(0);
      checked++;
    }
    expect(checked).toBe(12);
  });
  it('samooprava: pohnutá alebo skrytá pôvodná sieť zruší zlúčenie svojej skupiny', () => {
    const s = scene(),
      opt = mergeStaticMeshes(s.root);
    expect(opt.check()).toBe(0);
    s.e.position.y = 1; // kód pohol diel v dverách
    expect(opt.check()).toBe(1);
    expect(s.e.layers.isEnabled(0)).toBe(true);
    expect(s.door.children.some((o) => o.userData.mergedStatic)).toBe(false);
    s.b.visible = false;
    expect(opt.check()).toBe(1);
    expect(opt.stats()).toEqual({ groups: 0, merged: 0, undone: 2 });
  });
  it('malé diely nevrhajú tieň a malé valce majú menej segmentov', () => {
    const root = new THREE.Group(),
      m = new THREE.MeshStandardMaterial();
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 64), m),
      drum = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 1, 64), m);
    bolt.castShadow = drum.castShadow = true;
    root.add(bolt, drum);
    expect(limitShadowCasters(root, 0.25)).toBe(1);
    expect(bolt.castShadow).toBe(false);
    expect(drum.castShadow).toBe(true);
    expect(simplifyCylinders(root, 0.1)).toBeGreaterThan(0);
    expect(bolt.geometry.parameters.radialSegments).toBe(8);
    expect(drum.geometry.parameters.radialSegments).toBe(64);
  });
});
