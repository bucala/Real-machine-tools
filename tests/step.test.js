import { expect, it } from 'vitest';
import * as THREE from 'three';
import { exportStep } from '../src/core/step';

const pointBounds = text => {
  const pts = [...text.matchAll(/CARTESIAN_POINT\('',\(([^)]+)\)\)/g)].map(m => m[1].split(',').map(Number));
  return [0, 1, 2].map(axis => Math.max(...pts.map(p => p[axis])) - Math.min(...pts.map(p => p[axis])));
};
it('exports the current shape in mm with complete STEP references and closed solid topology', async () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, .8, .4));
  mesh.geometry.scale(1, .5, 1); mesh.position.set(7, 8, 9);
  const blob = await exportStep(mesh), text = await blob.text();
  expect(text).toContain("FILE_SCHEMA(('AUTOMOTIVE_DESIGN'))");
  expect(text).toContain('FACETED_BREP'); expect(text).not.toContain('OPEN_SHELL');
  expect(pointBounds(text)).toEqual([100, 40, 40]);
  const ids = new Set([...text.matchAll(/^#(\d+)=/gm)].map(m => m[1]));
  for (const ref of text.matchAll(/#(\d+)/g)) expect(ids.has(ref[1])).toBe(true);
  expect(mesh.position.toArray()).toEqual([7, 8, 9]);
});

it('subtracts actual bore volumes rather than exporting the decorative hole marker as added material', async () => {
  const group = new THREE.Group(); group.add(new THREE.Mesh(new THREE.BoxGeometry(1, .4, 1)));
  group.position.set(40.1234, 15.7865, -5.234);
  const cutter = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, .6, 32)); cutter.userData.stepSubtract = true; group.add(cutter);
  const text = await (await exportStep(group)).text();
  expect(pointBounds(text)).toEqual([100, 40, 100]);
  expect(text.match(/CLOSED_SHELL/g)).toHaveLength(1);
  expect(text.match(/FACETED_BREP/g)).toHaveLength(1);
  expect(text).not.toContain('OPEN_SHELL');
});

it('exports open geometry as a surface and excludes fixtures and hidden meshes', async () => {
  const group = new THREE.Group(), part = new THREE.Mesh(new THREE.PlaneGeometry(1, .5)); group.add(part);
  const fixture = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20)); fixture.userData.excludeFromExport = true; group.add(fixture);
  const hidden = new THREE.Group(); hidden.visible = false; hidden.add(new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30))); group.add(hidden);
  const text = await (await exportStep(group)).text();
  expect(pointBounds(text)).toEqual([100, 50, 0]);
  expect(text).toContain('SHELL_BASED_SURFACE_MODEL'); expect(text).not.toContain('FACETED_BREP');
});

it('joins adjacent voxel-style surface chunks into a single closed body', async () => {
  const box = new THREE.BoxGeometry(1, 1, 1).toNonIndexed(), group = new THREE.Group(); group.userData.stepJoin = true;
  const pos = box.attributes.position;
  for (let face = 0; face < 6; face++) {
    const geo = new THREE.BufferGeometry(), xyz = new Float32Array(18);
    for (let i = 0; i < 6; i++) { xyz[i * 3] = pos.getX(face * 6 + i); xyz[i * 3 + 1] = pos.getY(face * 6 + i); xyz[i * 3 + 2] = pos.getZ(face * 6 + i); }
    geo.setAttribute('position', new THREE.BufferAttribute(xyz, 3)); group.add(new THREE.Mesh(geo));
  }
  const text = await (await exportStep(group)).text();
  expect(text.match(/FACETED_BREP/g)).toHaveLength(1); expect(text).not.toContain('OPEN_SHELL');
});
