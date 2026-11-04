import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createAccessories } from '../src/machines/cnc/accessories';

const setup = () => {
  const root = new THREE.Group(), material = new THREE.MeshBasicMaterial();
  const M = Object.fromEntries(['cab', 'cab2', 'steel', 'steelD', 'anth', 'dark', 'black', 'red', 'yellow'].map((k) => [k, material]));
  return { root, ...createAccessories(root, M, 1.23) };
};
describe('Hermle catalogue equipment', () => {
  it('starts without extras and removes a previous full configuration when returning to basic', () => {
    const { equipment: e, update } = setup();
    expect(Object.values(e).every((g) => !g.visible)).toBe(true);
    update({ accessorySetup: 'ics80cooler' }, 0);
    expect(Object.values(e).every((g) => g.visible)).toBe(true);
    update({ accessorySetup: 'none' }, 0);
    expect(Object.values(e).every((g) => !g.visible)).toBe(true);
  });
  it('includes a conveyor in ICS setups, swaps pump variants and reserves recooling for the last setup', () => {
    const { equipment: e, update } = setup();
    for (const mode of ['conveyor', 'ics40', 'ics80', 'ics80cooler']) {
      update({ accessorySetup: mode }, 0);
      expect(e.conveyor.visible).toBe(true);
      expect(e.coolant.visible).toBe(mode !== 'conveyor');
      expect(e.coolant.getObjectByName('ICS40').visible).toBe(mode === 'ics40');
      expect(e.coolant.getObjectByName('ICS80').visible).toBe(mode === 'ics80' || mode === 'ics80cooler');
      expect(e.recooler.visible).toBe(mode === 'ics80cooler');
    }
  });
  it('keeps equipment above the floor with finite geometry on the scaled C42', () => {
    const { root } = setup();
    root.traverse((m) => { if (m.geometry) expect(Array.from(m.geometry.attributes.position.array).every(Number.isFinite)).toBe(true); });
    for (const g of root.children) expect(new THREE.Box3().setFromObject(g).min.y).toBeGreaterThanOrEqual(0);
  });
});
