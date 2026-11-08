import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createHmiPanel, HMI_CONTROL_LAYOUT, HMI_MONITOR_LAYOUT } from '../src/machines/cnc/hmiPanel';

describe('TNC console geometry', () => {
  it('uses a landscape LCD and seats raised keys on the same inclined plane as the controls', () => {
    const parent = new THREE.Group(),
      mat = new THREE.MeshStandardMaterial();
    const M = Object.fromEntries(
      ['brush', 'cab2', 'black', 'steelD', 'steel', 'red', 'yellow', 'cab', 'anth'].map((k) => [k, mat]),
    );
    const panel = createHmiPanel(parent, M);
    expect(panel.display.geometry.parameters.width / panel.display.geometry.parameters.height).toBeGreaterThan(1.45);
    expect(panel.monitor.rotation.x).toBeLessThan(0);
    expect(Object.keys(panel.controls.buttons).sort()).toEqual([
      'coolant',
      'emergency',
      'hold',
      'light',
      'reset',
      'single',
      'start',
    ]);
    for (const [id, p] of Object.entries(HMI_CONTROL_LAYOUT.dials)) {
      expect(panel.controls.knobs[id].position.x).toBe(p.x);
      expect(panel.controls.knobs[id].position.z).toBe(p.z);
    }
    for (const [id, p] of Object.entries(HMI_CONTROL_LAYOUT.buttons)) {
      expect(panel.controls.buttons[id].position.x).toBe(p.x);
      expect(panel.controls.buttons[id].position.z).toBe(p.z);
    }
    expect(panel.display.geometry.parameters.width).toBe(HMI_MONITOR_LAYOUT.screen.width);
    expect(panel.display.geometry.parameters.height).toBe(HMI_MONITOR_LAYOUT.screen.height);
    expect(panel.deck.rotation.x).toBeCloseTo((20 * Math.PI) / 180);
    for (const mesh of Object.values(panel.instances)) {
      for (let i = 0; i < mesh.count; i++) {
        const matrix = new THREE.Matrix4();
        mesh.getMatrixAt(i, matrix);
        const p = new THREE.Vector3(),
          q = new THREE.Quaternion(),
          s = new THREE.Vector3();
        matrix.decompose(p, q, s);
        expect(p.y - s.y / 2).toBeCloseTo(0.07, 5);
      }
    }
    // Keep distinct banks from physically intersecting one another.
    for (let i = 0; i < panel.keys.length; i++)
      for (let j = i + 1; j < panel.keys.length; j++) {
        const a = panel.keys[i],
          b = panel.keys[j];
        expect(Math.abs(a.x - b.x) >= (a.w + b.w) / 2 - 0.001 || Math.abs(a.z - b.z) >= (a.d + b.d) / 2 - 0.001).toBe(
          true,
        );
      }
    parent.updateMatrixWorld(true);
    expect(new THREE.Box3().setFromObject(panel.body).min.y).toBeGreaterThan(9.6);
    expect(new THREE.Box3().setFromObject(parent).min.y).toBeGreaterThan(6.4);
    parent.traverse((o) => o.geometry?.dispose());
    mat.dispose();
  });
  it('has two open-ended side tubes and a low pendant with keys, hanger, connector and coiled cable', () => {
    const parent = new THREE.Group(),
      mat = new THREE.MeshStandardMaterial();
    const M = Object.fromEntries(
      ['brush', 'cab2', 'black', 'steelD', 'steel', 'red', 'yellow', 'cab', 'anth'].map((k) => [k, mat]),
    );
    createHmiPanel(parent, M);
    expect(parent.getObjectByName('HMI-front-grab-rail')).toBeUndefined();
    for (const name of ['HMI-left-side-tube', 'HMI-right-side-tube']) {
      const tube = parent.getObjectByName(name),
        p = tube.geometry.attributes.position;
      expect(tube.geometry.type).toBe('TubeGeometry');
      for (let i = 0; i < p.count; i++) expect(Math.abs(p.getX(i))).toBeGreaterThan(3.18);
    }
    const caps = parent.children.filter((o) => o.name === 'HMI-tube-end-plug');
    expect(caps).toHaveLength(4);
    caps.forEach((o) => {
      expect(o.geometry.type).toBe('CylinderGeometry');
      expect(o.material).toBe(M.black);
    });
    const pendant = parent.getObjectByName('handheld-pendant'),
      body = pendant.getObjectByName('pendant-moulded-housing');
    body.geometry.computeBoundingBox();
    const size = body.geometry.boundingBox.getSize(new THREE.Vector3());
    expect(size.x / size.y).toBeGreaterThan(2);
    expect(pendant.rotation.z).toBeCloseTo((20 * Math.PI) / 180);
    expect(pendant.children.filter((o) => o.name === 'pendant-keycap')).toHaveLength(15);
    expect(pendant.getObjectByName('pendant-rail-hanger')).toBeTruthy();
    expect(pendant.getObjectByName('pendant-cable-connector')).toBeTruthy();
    const cable = parent.getObjectByName('pendant-coiled-cable');
    expect(cable.geometry.parameters.path.points.length).toBeGreaterThan(190);
    parent.updateMatrixWorld(true);
    expect(new THREE.Box3().setFromObject(cable).min.y).toBeGreaterThan(6.4);
    const local = pendant.position.clone();
    parent.rotation.y = Math.PI;
    parent.updateMatrixWorld(true);
    expect(pendant.position.equals(local)).toBe(true);
    expect(cable.parent).toBe(parent);
    parent.traverse((o) => o.geometry?.dispose());
    mat.dispose();
  });
});
