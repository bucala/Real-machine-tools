import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { modelFilename, snapshotMachine } from '../src/core/machineExport';
import { serializeMachineModel } from '../src/core/machineModelFormats';

const box = () => new THREE.Mesh(new THREE.BoxGeometry(2, 1, 3), new THREE.MeshStandardMaterial());
const size = object => new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()).toArray();

describe('Whole machine downloads', () => {
  it('excludes stock, hidden descendants, invisible hit targets and liquid without changing live geometry', () => {
    const root = new THREE.Group(), machine = box(); root.add(machine); machine.position.set(7, 5, -9);
    const original = machine.geometry.attributes.position.array.slice();
    for (const part of ['obrobok', 'plech', 'profil', 'pas', 'zvarenec']) {
      const stock = new THREE.Group(); stock.userData.part = part; stock.add(box()); root.add(stock);
    }
    const hidden = new THREE.Group(); hidden.visible = false; hidden.add(box()); root.add(hidden);
    const proxy = box(); proxy.material.colorWrite = false; root.add(proxy);
    const liquid = box(); liquid.userData.excludeFromMachineExport = true; root.add(liquid);
    const snapshot = snapshotMachine(root);
    expect(snapshot).toHaveLength(1);
    expect(machine.geometry.attributes.position.array).toEqual(original);
    expect(machine.position.toArray()).toEqual([7, 5, -9]);
    expect(snapshot[0].positions.buffer).not.toBe(machine.geometry.attributes.position.array.buffer);
  });
  it('expands instanced parts and corrects winding after a mirrored world transform', () => {
    const root = new THREE.Group(), source = box();
    const instances = new THREE.InstancedMesh(source.geometry, source.material, 2);
    instances.setMatrixAt(0, new THREE.Matrix4().makeTranslation(-4, 1, 0));
    instances.setMatrixAt(1, new THREE.Matrix4().makeTranslation(4, 1, 0));
    root.add(instances); root.scale.x = -1; root.rotation.y = Math.PI / 2;
    const meshes = snapshotMachine(root); expect(meshes).toHaveLength(2);
    const a = new THREE.Vector3(), b = a.clone(), c = a.clone(), normal = a.clone();
    for (const m of meshes) {
      a.fromArray(m.positions, m.index[0] * 3); b.fromArray(m.positions, m.index[1] * 3); c.fromArray(m.positions, m.index[2] * 3);
      normal.fromArray(m.normals, m.index[0] * 3);
      expect(b.sub(a).cross(c.sub(a)).dot(normal)).toBeGreaterThan(0);
    }
    expect(instances.count).toBe(2);
  });
  it('exports only rendered material groups and compacts unused vertices', () => {
    const mesh = box(), hidden = mesh.material.clone(); hidden.visible = false;
    mesh.material = [mesh.material, hidden];
    mesh.geometry.groups.forEach((g, i) => { g.materialIndex = i === 0 ? 0 : 1; });
    const [m] = snapshotMachine(mesh); expect(m.index.length).toBe(6); expect(m.positions.length).toBe(12);
    mesh.geometry.setDrawRange(6, 6); expect(() => snapshotMachine(mesh)).toThrow('No visible');
  });
  it('exports a double-sided sheet as one CAD surface without coincident reverse faces', async () => {
    const positions = new Float32Array([0,0,0, 2,0,0, 0,1,0, 0,1,0, 2,0,0, 0,0,0]);
    const mesh = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(positions,3)),new THREE.MeshBasicMaterial());
    const meshes = snapshotMachine(mesh);
    expect(meshes[0].index.length).toBe(3);
    const text = await (await serializeMachineModel({meshes,name:'sheet',format:'stp'})).text();
    expect(text.match(/FACE_SURFACE\(/g)).toHaveLength(1);
    expect(text).toContain('OPEN_SHELL');
    expect(mesh.geometry.attributes.position.count).toBe(6);
  });
  for (const format of ['obj', 'stl', 'stp']) it(`round-trips ${format.toUpperCase()} dimensions in mm with a common floor origin`, async () => {
    const root = new THREE.Group(), machine = box(); machine.name = 'machine-bed'; machine.position.set(5, 7, 3); root.add(machine);
    const blob = await serializeMachineModel({ meshes: snapshotMachine(root), name: 'hermle-c-42-u', format });
    if (format === 'stp') {
      const text = await blob.text(); expect(text).toContain("PRODUCT('hermle-c-42-u'"); expect(text).toContain('FACETED_BREP');
      expect(text).toContain('machine-bed_1'); expect(text).toContain('SI_UNIT(.MILLI.,.METRE.)');
      const pts = [...text.matchAll(/CARTESIAN_POINT\('',\(([^)]+)\)\)/g)].map(m => m[1].split(',').map(Number));
      expect([0, 1, 2].map(i => Math.max(...pts.map(p => p[i])) - Math.min(...pts.map(p => p[i])))).toEqual([200, 100, 300]);
      expect(Math.min(...pts.map(p => p[1]))).toBe(0);
    } else {
      const loaded = format === 'obj' ? new OBJLoader().parse(await blob.text()) : new THREE.Mesh(new STLLoader().parse(await blob.arrayBuffer()));
      expect(size(loaded)).toEqual([200, 100, 300]); expect(new THREE.Box3().setFromObject(loaded).min.y).toBe(0);
      if (format === 'obj') expect(loaded.children[0].name).toContain('machine-bed');
    }
    expect(machine.position.toArray()).toEqual([5, 7, 3]);
  });
  it('keeps independently moving components in the same assembly coordinates', async () => {
    const root = new THREE.Group(), base = box(), slide = new THREE.Group(); slide.name = 'sliding-door'; slide.position.x = 5; slide.add(box()); root.add(base, slide);
    const text = await (await serializeMachineModel({ meshes: snapshotMachine(root), name: 'roeders', format: 'obj' })).text();
    const loaded = new OBJLoader().parse(text); expect(loaded.children).toHaveLength(2);
    const centers = loaded.children.map(o => new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()));
    expect(centers[1].x - centers[0].x).toBe(500);
  });
  it('uses portable filenames and rejects empty models', () => {
    expect(modelFilename('Röders RXU 1001 DSH')).toBe('roders-rxu-1001-dsh');
    expect(modelFilename('Hermle C 42 U')).not.toBe(modelFilename('Hermle C 32 U'));
    expect(() => snapshotMachine(new THREE.Group())).toThrow('No visible');
  });
});
